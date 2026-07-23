# 05 · 출력물 · 저장 · Supabase (Output & Storage)

> 기준: `tools/dashboard/index.html` + `supabase/`. ✅ 코드 확정 / ⚠ 실사용 확인 필요.

## A. 출력물(대시보드) ✅
| 출력물 | 형식 | 생성 |
|---|---|---|
| 마스터 배포 파일 | JSON `메리트투어_마스터_YYYYMMDD.json` | `exportMaster` / `importMaster` |
| PNR 안내 알리고 양식 | XLSX `PNR안내_알리고양식_{today}.xlsx` | `exportAligo`(예약·항공 탭) |
| 확정서/견적서/일정표 | JPG `{eventNo}_{kind}.jpg`(canvas→JPEG 0.92) | `docBuildHtmlV7`→`docRenderToCanvas` |
| 확정서 HTML 단건 / ZIP 일괄 | `.html` / `confirm_{kind}_{ymd}.zip`(JSZip) | `docGenerateZip` |
| 확정서 알림톡 알리고 엑셀 | XLSX `confirm_aligo_{kind}_{ymd}.xlsx`(링크 포함) | `docExportAligo` (Edge Function 미설정 시 폴백) |
| 정산표 / 항공원가 입력틀 | XLSX | `settleExportXlsx` / `settleAirTplExport` |
| 호텔블록 현황 / 예약가능일정 | PNG `블록현황_{month}.png` / `예약가능일정_{ym}.png` | 캔버스 렌더 |
| 항공발권 안내문 / 대기전환 안내 | JPG | `openTicketNotice` 등 |
- 렌더는 오프스크린 iframe(`doc-render-frame`)+canvas. 고객 발송물은 JPG(원칙 일치). ⚠ 일부 다운로드 파일명 한글 사용(마스터 JSON·안내문 JPG·알리고 XLSX).

## B. localStorage 전수 ✅ (개인 PC별, 원본 엑셀은 저장 안 함)
| 키 | 내용 |
|---|---|
| `mt_agency_filter` | 거래유형 필터 선택 |
| `mt_edit_overrides` | 예약 수기 수정(구분·호텔·명단·비고) |
| `mt_notify_teamAssign` | 팀 수동 배정(`teamAuto`보다 우선) |
| `mt_notify_ticketDone` | 발권완료 표시 |
| `mt_notify_insExclude` | 보험 개인 제외 |
| `mt_notify_vAdjust` | 요금관리 수기값(엔화기타·원화기타·패키지가) |
| `mt_doc_hotelName` | 확정서용 실제 호텔명 |
| `mt_notify_resortMaster` | 리조트 마스터(단가·정원·출발패턴 등) |
| `mt_notify_commonMaster` | 공통 마스터(월별 환율·항공요금) |
| `mt_notify_changeLog` | 마스터 변경 이력(최대 100) |
| `mt_notify_mgmtMigrated`·`mt_notify_airfareCodeMigrated` | 1회성 마이그레이션 플래그 |
| `mt_settle_adjust`·`mt_settle_ded` | 정산 개별조정·공제 |
| `mt_notify_blkMaster/blkPools/blkAlias/blkOver/blkPaste/blkMonth` | 호텔블록 마스터·풀·별칭·오버라이드·붙여넣기 원문·선택월 |
| `mt_doc_cfg` | 연동 설정(Supabase URL/Key/bucket/aligoEndpoint) |
| `mt_doc_acct` | 확정서 입금계좌·문의전화 |
| (게이트) `mt-gate-ok`·`mt-user-name` | 통과기록(30일)·이름 |
| (inquiry) `merittour_inquiry_v1_2` | 예약가능일자 도구 설정 |
- **핵심**: 마스터는 개인 PC localStorage에만. 공유는 JSON 내보내기/불러오기 수동. → 기기 간 불일치·백업 부재 위험.

## C. Supabase 사용 항목 ✅ / ⚠
> **모두 "설정/배포해야 켜지는 조건부·향후 기능".** 상시 무조건 동작하는 것 없음. 실제 가동 여부는 각 PC `mt_doc_cfg` 입력 상태 + 서버 배포 상태에 달려 있어 **코드만으로 확인 불가(⚠)**.

| 자산 | 코드 정의(✅) | 클라이언트 호출 근거 | 판정 |
|---|---|---|---|
| `reservations` upsert | 테이블 15컬럼(PK `event_seq`)·anon RLS·GRANT | `docSyncSupabase()` + analyze 종료 시 자동(단 `docCfgReady()` 게이트) | ⚠ 연동설정 PC만 |
| `notice_sent` | PK `(event_seq,notice_type)`, 서버 전용(정책 없음=anon 차단) | 클라 접근 없음(정상) | ⚠ cron 전용 |
| confirm-docs 업로드 | JPG 업로드 + 90일 서명URL(`DOC_LINK_TTL`) | `docUploadSupabase()`(게이트) | ⚠ 연동설정 PC만 |
| `resort_master` 테이블 | 단일행 jsonb + version + history(무결성) | **클라 호출 0건** | 🔎 정의만 존재(미가동 인프라). 마스터는 여전히 localStorage+JSON |
| `send-alimtalk` Edge Fn | kind(confirm/quote/itinerary) 알림톡, **요청 무인증**, CORS 기본 `*` | `docBulkSend()`(`aligoEndpoint` 입력 시만), 미입력 시 엑셀 폴백 | ⚠ 선택적 편의기능 |
| `cron-d7-alimtalk` Edge Fn | D-7 확정·정산 팀 조회→알리고 발송→notice_sent, **CRON_SECRET fail-open**(미설정 시 무인증), `--no-verify-jwt` | 서버(cron) 전용 | ⚠ 배포+시크릿+템플릿승인+cron등록+데이터동기화 전부 충족해야 가동 |

### ⚠ Storage 정책 파일 상충 (인수인계 주의)
- `confirm_docs_storage.sql`(**Private** + anon 3정책 select 포함) = **현재 코드(90일 서명URL)와 일치**.
- `confirm_docs_storage_policy.sql`(**Public** + 2정책, select 없음) = **구버전/폐기 대상**. 순서 실행 시 정책 덮어써짐 — `_policy.sql` 사용 금지 권고.

### ⚠ 보안 주의(코드로 확정)
- `reservations`/`resort_master`에 anon 광범위 write 허용 — 방어선은 비번 게이트뿐. anon key는 정적 자산/localStorage에 노출.
- `send-alimtalk` 완전 무인증 + CORS `*`, `cron-d7-alimtalk` CRON_SECRET 미설정 시 무인증 → URL 노출 시 제3자 발송 가능. (보안 하드닝은 별도 미머지 브랜치에 준비만 됨 — 운영 미반영)
