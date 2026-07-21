# DEPLOYMENT_CHECKLIST

> 저장소: merittour-tools · 브랜치: `claude/security-hardening` · 기준 커밋: `e6b61fc` · 작성일: 2026-07-21
> ⚠ 운영 DB에 destructive 변경을 자동 실행하지 말 것. 아래 순서를 **운영자가 수동**으로 진행.

---

## 0. 적용 전 백업 (필수)
- [ ] Supabase 프로젝트 **DB 백업**(대시보드 Backups 또는 pg_dump) — 특히 `reservations`, `resort_master`, `resort_master_history`, `notice_sent`.
- [ ] `storage.objects` / `confirm-docs` 버킷 파일 목록·현재 public 여부 기록.
- [ ] 현재 정책 스냅샷: `select * from pg_policies where schemaname in ('public','storage');`
- [ ] 현재 GRANT 스냅샷: `verify_security.sql`의 7·8번 쿼리 결과 저장.
- [ ] 기존 confirm-docs **공개/서명 링크가 외부(고객)에 배포되어 있는지** 확인(전환 시 끊길 수 있음).

## 1. 사전 확인 (확인 필요 항목 해소)
- [ ] confirm-docs 운영 버킷이 public 인지 private 인지 확인.
- [ ] 로그인 페이지 경로 결정(`shared/access.js` `LOGIN_URL`).
- [ ] 초대할 직원 이메일·역할 명부 확정(admin/sales/air/manage).
- [ ] `SUPABASE_URL`, publishable(anon) key 확보(프론트용). service_role 키는 서버 시크릿에만.

## 2. DB 마이그레이션 (SQL Editor에서 순서대로)
- [ ] `supabase/migrations/01_user_access.sql`
- [ ] Auth에서 **최초 admin 초대** → 발급된 user_id로 `user_access` admin 1행 insert(01 파일 하단 주석 참고, 수동)
- [ ] `supabase/migrations/02_reservations_rls.sql`
- [ ] `supabase/migrations/03_resort_master_rls.sql`
- [ ] `supabase/migrations/04_confirm_docs_storage_rls.sql`  ⚠ **confirm-docs Private 전환 · anon 제거 → 기존 공개 링크 끊김**
- [ ] 나머지 직원 초대 + `user_access` 행 추가(role/active)

## 3. Edge Functions
- [ ] `upload-confirm-doc` 배포
- [ ] `cron-d7-alimtalk` 재배포(fail-closed 반영본)
- [ ] 시크릿 설정(값은 별도 보관): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOW_ORIGIN`(운영 도메인, `*` 금지), `CRON_SECRET`(강한 값), `ALIGO_*`
- [ ] (선택) `send-alimtalk` 인증/CORS 하드닝 적용 여부 결정 — 적용 시 대시보드 호출에 JWT 추가 필요

## 4. 클라이언트(프론트)
- [ ] `shared/access.js`: `ENABLED=true`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOGIN_URL`, `AREA_ROLES` 확인
- [ ] 로그인 페이지 준비(`signInWithPassword`)
- [ ] 확정서 업로드 코드 → `upload-confirm-doc` 호출로 전환(대시보드) · anon 직접 업로드 제거
- [ ] reservations 동기화 호출이 로그인 세션(JWT)으로 나가는지 확인
- [ ] 배포 후 정적 자산 캐시 갱신(access.js — 필요 시 `?v=` 캐시버스터)

## 5. 적용 후 검증 (`verify_security.sql`)
- [ ] RLS 전부 ON
- [ ] anon 정책/GRANT 0건
- [ ] authenticated 정책 존재
- [ ] confirm-docs 버킷 public=false, anon 정책 0건
- [ ] 함수 execute: anon=false / authenticated=true, search_path 고정
- [ ] 소스에 service_role/secret 실제 값 없음(grep)

## 6. 기능 회귀 확인
- [ ] 대시보드 기본 분석(엑셀 업로드→분석) 정상(로컬 기능이라 인증과 무관)
- [ ] 로그인 후 reservations 조회/동기화 정상
- [ ] 확정서 업로드(Edge 경유) 정상, 서명 URL 열람
- [ ] D-7 cron 정상(시크릿 헤더 포함), 미포함 시 401/미설정 시 503
- [ ] 미로그인/비활성/권한없음 차단 확인

## 롤백
문제 시 `ROLLBACK_GUIDE.md`. 1차 롤백은 클라이언트 `ENABLED=false`.
