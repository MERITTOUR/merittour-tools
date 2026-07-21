# ROLLBACK_GUIDE

> 저장소: merittour-tools · 브랜치: `claude/security-hardening` · 기준 커밋: `e6b61fc` · 작성일: 2026-07-21
> ⚠ 롤백은 대부분 **보안 약화**를 의미한다. 최후 수단으로만, 원인 파악 후 진행.

---

## 0. 가장 빠른 완화 (권장 1차)
- **클라이언트 가드만 해제**: `shared/access.js` 의 `ENABLED = false` → 배포.
  - 효과: 로그인 강제/영역 가드 즉시 해제(기존 UX 복귀). **단 DB RLS 는 그대로** 이므로,
    RLS 적용 후라면 anon 호출은 여전히 실패한다(아래 DB 롤백 필요할 수 있음).

## 1. 인증 도입으로 대시보드가 막힌 경우
증상: 로그인 후에도 reservations/confirm-docs 동작 실패.
- 확인: 해당 계정이 `user_access` 에 있고 `active=true`, 역할이 맞는지.
- 확인: 클라이언트 호출이 **세션 JWT** 로 나가는지(anon 단독이면 RLS 차단).
- 임시: 문제 계정에 admin 역할 부여로 우회 테스트.

## 2. DB 롤백 (RLS 되돌리기 — 보안 약화, 신중)
운영 중단이 크고 원인 해결이 지연될 때만. 각 파일의 정책을 되돌린다.

### reservations (02 역-적용)
```sql
-- authenticated 정책 제거
drop policy if exists resv_select on public.reservations;
drop policy if exists resv_insert on public.reservations;
drop policy if exists resv_update on public.reservations;
-- (임시) 기존 anon 허용 복구 — ⚠ 보안 약화
grant select, insert, update on public.reservations to anon;
create policy "reservations anon read"   on public.reservations for select to anon using (true);
create policy "reservations anon insert" on public.reservations for insert to anon with check (true);
create policy "reservations anon update" on public.reservations for update to anon using (true) with check (true);
```
> 원본 정의: `supabase/reservations_setup.sql`

### resort_master / history (03 역-적용)
```sql
drop policy if exists rm_select on public.resort_master;
drop policy if exists rm_write_insert on public.resort_master;
drop policy if exists rm_write_update on public.resort_master;
drop policy if exists rmh_select on public.resort_master_history;
drop policy if exists rmh_insert on public.resort_master_history;
-- 기존 anon 복구는 supabase/resort_master_setup.sql 의 정책/GRANT 블록 재실행. ⚠ 보안 약화
```

### confirm-docs (04 역-적용)
```sql
-- ⚠ 버킷을 다시 public 으로 돌리면 확정서가 공개된다. 매우 신중.
-- update storage.buckets set public = true where id='confirm-docs';   -- 비권장
-- anon 쓰기 복구는 supabase/confirm_docs_storage.sql 재실행. ⚠ 보안 약화
```

## 3. Edge Function 롤백
- `upload-confirm-doc`: 대시보드가 직접 업로드로 되돌아가려면 04 롤백 필요(함께).
- `cron-d7-alimtalk`: fail-closed 되돌리기는 **권장하지 않음**. 문제는 시크릿 미설정이므로 `CRON_SECRET` 설정으로 해결.

## 4. user_access 제거(전면 롤백)
```sql
-- ⚠ 역할 체계 제거. 위 DB 롤백을 먼저 끝낸 뒤에만.
-- drop table if exists public.user_access cascade;
-- drop function if exists public.mt_role(); ... (mt_is_admin/mt_has_role/mt_is_active)
```

## 5. 코드/브랜치 롤백
- 이 브랜치를 머지하지 않았다면 운영 영향 없음(파일만 존재).
- 머지했다면 해당 커밋 revert PR. 정적 자산 캐시 갱신 고려.

## 검증
롤백 후 `supabase/verify_security.sql` 로 상태 재확인(이때는 anon 정책이 다시 보일 수 있음 — 의도한 상태인지 확인).
