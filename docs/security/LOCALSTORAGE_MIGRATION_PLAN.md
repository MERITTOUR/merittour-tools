# LOCALSTORAGE_MIGRATION_PLAN

> 저장소: merittour-tools · 브랜치: `claude/security-hardening` · 기준 커밋: `e6b61fc` · 작성일: 2026-07-21
> ⚠ 이번 작업에서 **즉시 이전은 하지 않는다**. 안전한 순서·영향도만 정리.

---

## 현황
현재 dashboard 데이터는 사용자 PC별 localStorage(`mt_*`)에 분산 저장된다. 근거: `tools/dashboard/index.html`.
문제: 기기 간 불일치, 백업 부재, 담당자 변경 시 유실 위험.

## 분류

### A. 서버 정본으로 이전(공유가 본질) — 우선순위 높음
| 키 | 내용 | 이전 대상 | 비고 |
|---|---|---|---|
| `mt_notify_resortMaster` | 리조트 마스터(단가·환율·항공요금) | `resort_master.data` | 이미 테이블 존재. RLS(admin/manage 쓰기) 적용됨 |
| `mt_notify_commonMaster` | 공통 마스터 | `resort_master.data`(통합 jsonb) | 〃 |
| `mt_notify_changeLog` | 변경 이력 | `resort_master_history` | 무결성(수정·삭제 금지) |
| `mt_notify_blk*`(blkMaster/Pools/Alias/Over/Month/Paste) | 호텔 블록 | 신규 테이블 `hotel_block`(확인 필요) | 스키마 설계 필요 |

### B. 서버 공유 검토(팀 협업 시 이점) — 중간
| 키 | 내용 | 비고 |
|---|---|---|
| `mt_notify_teamAssign` | 팀 지정 | 담당자 공유되면 유용 → 신규 테이블 or reservations 확장 |
| `mt_notify_ticketDone` | 발권 체크 | 〃 |
| `mt_notify_vAdjust` | 요금 조정 | 〃 |
| `mt_notify_insExclude` | 보험 제외 | 〃 |
| `mt_settle_adjust`/`mt_settle_ded` | 정산 조정/공제 | 금액 → 무결성·권한 중요 |
| `mt_edit_overrides` | 수기 편집 오버레이 | 충돌 정책 필요 |
| `mt_doc_hotelName` | 확정서 호텔명 | 소규모 |

### C. 로컬 캐시로 유지 가능 — 이전 불필요
- 서버 정본을 불러온 뒤의 **읽기 캐시**(마스터 사본 등). 정본이 서버면 로컬은 캐시로 강등.

### D. 세션성 / 폐기 가능
| 키 | 판단 |
|---|---|
| `mt_agency_filter` | PC별 UI 필터 → 로컬 유지(개인화) |
| `mt_doc_cfg` | Supabase URL/anon key/bucket/aligo — 인증 도입 후 **불필요/축소**(anon key는 코드 기본값으로) |
| `mt_doc_acct` | 계좌 등 — 내용 확인 후 서버/폐기 결정(확인 필요) |
| `mt_notify_mgmtMigrated`,`mt_notify_airfareCodeMigrated` | 마이그레이션 플래그 → 완료 후 폐기 가능 |
| `mt-gate-ok`,`mt-user-name` | 게이트/이름 — 유지 |
| `mt_auth_session_v1` | (휴면 auth.js) — 정리 대상 |

## 안전한 이전 순서(제안, 단계적)
1. **resort_master 우선**: 이미 테이블·RLS 준비됨. 대시보드에 "서버 저장/불러오기"를 추가하되 **로컬 정본 유지 + 서버는 백업/공유**로 시작(양방향 아님).
2. 안정화 후 **서버를 정본**으로 승격, 로컬은 캐시로.
3. history 연동(변경 시 스냅샷).
4. 이후 B군(정산·팀지정 등) — 금액/무결성이라 권한·충돌정책 확정 후.
5. blk* / settle 는 스키마 설계(신규 테이블) 필요 → 별도 과제.

## 영향도·주의
- 이전 전까지 기존 로컬 동작 유지(회귀 방지).
- 서버 정본 전환 시 **동시 저장 충돌**(resort_master version 낙관적 잠금 활용) UX 필요.
- 개인정보 포함 데이터(정산·명단 관련)는 이전 시 RLS·마스킹·접근로그 동반.
- 각 단계는 되돌릴 수 있게(로컬 백업 유지) 진행.

## 이번 작업 범위
- 계획 수립만. 실제 이전 코드·스키마는 후속 과제(확인/승인 후).
