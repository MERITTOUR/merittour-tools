# 00_SECURITY_CHANGE_SUMMARY

> 저장소: merittour-tools · 브랜치: `claude/security-hardening` · 기준 커밋: `e6b61fc` · 작성일: 2026-07-21
> 문서 상태: 기술기준(코드 근거) · **운영 DB 미실행**(준비만) · 비밀값 미포함

---

## 1단계 재검증 결과 (현재 상태)

| 대상 | 현재 GRANT(anon) | RLS | 현재 정책명 | anon | authenticated | service_role | 클라이언트 호출 위치 | 개인정보 | 변경필요 |
|---|---|:--:|---|---|---|---|---|:--:|:--:|
| `public.reservations` | select·insert·update | ON | reservations anon read/insert/update | 전면 허용 | 정책 없음 | cron(우회) | `tools/dashboard/index.html`(`/rest/v1/reservations`) | 대표명·전화·PNR·pax | **예** |
| `public.notice_sent` | 없음 | ON | 없음 | 차단 | 차단 | cron(우회) | (서버 전용) | 발송결과(result) | 검토(마스킹) |
| `public.resort_master` | select·insert·update | ON | rm_anon_select/insert/update | 전면 허용 | 정책 없음 | — | 대시보드 동기화 `확인 필요`(CLAUDE.md "미적용") | 낮음 | **예** |
| `public.resort_master_history` | select·insert | ON | rmh_anon_select/insert | 읽기·추가 | 정책 없음 | — | 〃 | 낮음 | **예** |
| Storage `confirm-docs` | insert·update·(select) | — | "confirm-docs anon *" | 쓰기/읽기 허용 | — | (권장 경로) | `tools/dashboard/index.html`(`storage/v1/object`) | 확정서(고객정보) | **예** |
| Edge `send-alimtalk` | — | — | — | (요청 인증 없음) | — | 미사용 | `tools/dashboard/index.html`(연동설정) | 수신 전화·이름 | **예**(인증·CORS) |
| Edge `cron-d7-alimtalk` | — | — | — | — | — | 사용 | (cron) | 예약·발송 | **예**(fail-open) |
| 게이트 `shared/gate.js` | — | — | — | 클라이언트 검증 | — | — | 전 페이지 | 비번 해시 | 유지(UX)·서버보안 대체 |
| `auth.js`(Google GSI) | — | — | — | — | — | — | 미로드/휴면 | 이메일 화이트리스트 | 정리(대체) |

근거 파일: `supabase/reservations_setup.sql`, `supabase/resort_master_setup.sql`, `supabase/confirm_docs_storage.sql`, `supabase/confirm_docs_storage_policy.sql`(두 정책 상충 — 운영 적용본 `확인 필요`), `supabase/functions/send-alimtalk/index.ts`, `supabase/functions/cron-d7-alimtalk/index.ts`, `tools/dashboard/index.html`, `shared/gate.js`, `auth.js`

## 이번 작업으로 해결(준비)한 위험
1. reservations anon 전면허용 → **authenticated 역할 기반**(`supabase/migrations/02_reservations_rls.sql`)
2. resort_master(+history) anon → **authenticated + 쓰기 admin/manage, history 수정·삭제 금지**(`03_resort_master_rls.sql`)
3. confirm-docs anon 쓰기/공개 → **Private 강제 + anon 제거 + Edge Function 업로드**(`04_confirm_docs_storage_rls.sql`, `supabase/functions/upload-confirm-doc/index.ts`)
4. cron **fail-open**(CRON_SECRET 미설정 시 통과) → **fail-closed(503)**(`supabase/functions/cron-d7-alimtalk/index.ts`)
5. 클라이언트 인증 부재 → **Supabase Auth + user_access 역할 가드**(`shared/access.js`, 기본 비활성 단계적 전환)
6. 검증 수단 → `supabase/verify_security.sql`

## 아직 남은 위험 / 확인 필요
- **운영 적용 미실행**: 위 마이그레이션은 파일만. 운영 SQL Editor에서 순서 실행 필요.
- `send-alimtalk` 요청 인증: 현재 코드 그대로면 여전히 무인증. 하드닝 방안은 설계 문서에 기술(적용 시 클라이언트 호출에 JWT 필요) → **적용 결정 `확인 필요`**.
- reservations 행(row) 단위 담당 제한: 담당/팀 컬럼 부재로 미구현 → 모델 도입 `확인 필요`.
- confirm-docs 운영 버킷이 public/private 중 무엇인지 → `확인 필요`(전환 시 기존 링크 영향).
- localStorage 정본 이전: 계획만 수립(`LOCALSTORAGE_MIGRATION_PLAN.md`).
- 게이트/auth.js 최종 정책(유지·제거) → `확인 필요`.

## 생성·수정 파일
- 신규 SQL: `supabase/migrations/01_user_access.sql`, `02_reservations_rls.sql`, `03_resort_master_rls.sql`, `04_confirm_docs_storage_rls.sql`, `supabase/verify_security.sql`
- 신규 Edge: `supabase/functions/upload-confirm-doc/index.ts`
- 수정 Edge(안전): `supabase/functions/cron-d7-alimtalk/index.ts`(fail-closed)
- 신규 공통: `shared/access.js`(기본 비활성)
- 수정: `tools/dashboard/index.html`(access.js include + `data-area` — 비활성 no-op)
- 문서: `docs/security/*.md`

## 운영 적용 순서(요약)
`DEPLOYMENT_CHECKLIST.md` 참조. 요지: 백업 → 01→02→03→04 실행 → Edge 배포/시크릿 → 클라이언트 ENABLED=true → `verify_security.sql` 확인.
