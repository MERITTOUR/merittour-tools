# TEST_RESULTS

> 저장소: merittour-tools · 브랜치: `claude/security-hardening` · 기준 커밋: `e6b61fc` · 작성일: 2026-07-21
> 로컬에서 실행 가능한 항목만 수행. **운영 Supabase 접속 불가 항목은 `실행 필요`.**

---

## 로컬에서 실행·통과한 항목
| 항목 | 방법 | 결과 |
|---|---|---|
| 프로젝트 문법검사(인라인+.js) | `node scripts/check-syntax.mjs` | ✅ 19파일/20스크립트 통과 |
| `shared/access.js` 파싱 | `node --check shared/access.js` | ✅ OK |
| 공통 함수 단위테스트 | `node --test tests/util.test.mjs` | ✅ 9 pass / 0 fail |
| **대시보드 회귀**(access.js 비활성 시 무영향) | Chromium 로드 | ✅ `MT_ACCESS.enabled=false`, 차단오버레이 없음, 기존 게이트 유지, `analyze()` 존재, pageerror 0 |

→ 결론: 이번 변경(파일 추가 + 비활성 include + `data-area`)은 **기존 대시보드 기능을 깨지 않는다**.

## 실행 필요 (운영 Supabase 필요 · 미실행)
아래는 마이그레이션·Edge 배포·Auth 설정 후 운영/스테이징에서 수행:

| # | 시나리오 | 기대 결과 | 근거 |
|--:|---|---|---|
| 1 | 미로그인 사용자의 `reservations` 접근 | 실패(RLS 차단) | `02_reservations_rls.sql` |
| 2 | 일반(sales) 사용자 허용 범위 조회/등록 | 허용 | 〃 |
| 3 | admin 전체 접근 | 허용 | `01`,`02`,`03` |
| 4 | 비활성(active=false) 사용자 | 차단 | `01_user_access.sql`, `access.js` |
| 5 | anon 의 confirm-docs 업로드 | 실패 | `04_confirm_docs_storage_rls.sql` |
| 6 | 인증 사용자 업로드(Edge 경유) | 성공 + 서명URL | `upload-confirm-doc/index.ts` |
| 7 | 잘못된 MIME/확장자 업로드 | 415 거부 | `upload-confirm-doc`(MIME_EXT) |
| 8 | 과대 용량 업로드 | 413 거부 | `upload-confirm-doc`(MAX_BYTES) |
| 9 | event_seq 경로 조작(`../`) 시도 | 400 거부(정규식) + 서버 경로 생성 | `upload-confirm-doc`(EVENT_SEQ_RE) |
| 10 | D-7 cron: 시크릿 헤더 정상 | 정상 발송 | `cron-d7-alimtalk` |
| 11 | D-7 cron: 시크릿 미설정 | 503 거부(fail-closed) | `cron-d7-alimtalk`(수정본) |
| 12 | D-7 cron: 시크릿 불일치 | 401 | 〃 |
| 13 | 중복 알림톡 방지 | `notice_sent` 로 스킵 | `cron-d7-alimtalk` |
| 14 | resort_master 수정: manage 허용 / sales 거부 | 정책대로 | `03_resort_master_rls.sql` |
| 15 | history 수정·삭제 | 거부(정책 없음) | `03` |
| 16 | `verify_security.sql` 전 항목 | 각 쿼리 "기대값" 일치 | `verify_security.sql` |
| 17 | 기존 대시보드 기본 분석(엑셀→분석) | 정상(인증 무관) | 로컬 확인 완료(위) |

## 테스트 절차 메모
- 1~3,14,15: 각 역할 계정으로 로그인 후 대시보드/직접 REST 호출.
- 5: anon 키로 `POST /storage/v1/object/confirm-docs/...` → 실패 기대.
- 6~9: 로그인 JWT 로 `upload-confirm-doc` 호출, 다양한 입력.
- 10~12: `curl -H "x-cron-secret: ..."` (값 노출 금지) 로 함수 호출.
- 16: SQL Editor 에서 `verify_security.sql` 실행.
