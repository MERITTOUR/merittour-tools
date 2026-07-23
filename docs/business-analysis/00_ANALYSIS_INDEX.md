# 00 · 업무자료 분석 인덱스 (Business Analysis Handover)

> 목적: **메리트투어 Tools를 운영 배포하기 위한 것이 아니라**, 메리트투어의 업무·M클릭 데이터 구조·업무 규칙·출력물·야마나미(SaiZen) 시스템 연결 가능 항목을 **코드 근거로** 파악하기 위한 분석 문서 모음.
> 브랜치: `claude/business-analysis-handover` (기준: `main` = `e6b61fc`) · 성격: **문서 전용, 소스 무수정·무배포·Supabase 무변경**
> 표기 규칙: **✅ 코드로 확정** · **🔎 코드 기반 추정** · **⚠ 실사용 확인 필요 / 향후 기능**

---

## 문서 구성
| 파일 | 내용 |
|---|---|
| `00_ANALYSIS_INDEX.md` | 본 인덱스 · 분석 범위 · 최상위 결론 |
| `01_TOOL_INVENTORY.md` | 저장소 전체 도구 목록 · 목적 · 입출력 · 저장 · 게이트 · 실사용 판정 |
| `02_BUSINESS_FLOW.md` | 대시보드 업무 흐름(업로드→분석→섹션)과 전체 업무 동선 |
| `03_MCLICK_INPUT_MAPPING.md` | M클릭 입력 2종 · 읽는 시트 · **컬럼 키 전수** · 핵심 식별자(eventSeq) |
| `04_BUSINESS_RULES.md` | 요금·환율·항공매칭·정산·상품파싱·거래유형·보험 매칭 규칙 |
| `05_OUTPUT_AND_STORAGE.md` | 출력물 전수 · localStorage 항목 · Supabase 사용 항목 · 저장 위치 |
| `06_SAIZEN_INTEGRATION_POINTS.md` | 야마나미(SaiZen)로 전달 가능한 데이터 · 연결 후보 |
| `07_DUPLICATE_DATA_AND_MANUAL_WORK.md` | 두 시스템 중복 관리 데이터 · 수기 입력/오버레이 항목 |
| `08_ACTUAL_USAGE_QUESTIONS.md` | 실제 담당자 확인이 필요한 질문 목록 |
| `09_AI_MANUAL_SOURCE_INDEX.md` | 직원 매뉴얼·SOP로 재사용 가능한 규칙 색인 |

## 분석한 소스 파일 (근거)
- `tools/dashboard/index.html` (7,439줄, 주력) · `tools/insurance/index.html` (858줄)
- `tools/booking/index.html` (5,009줄) · `tools/booking/asoyamanami2027reservation.html` (388줄)
- `tools/golfweather/index.html` · `tools/imgtoolkit/index.html` · `tools/inquiry/index.html` (3,228줄) · `tools/library/index.html` · `tools/weather/index.html`
- `shared/gate.js` · `shared/util.js` · `shared/core.css`
- `sales/index.html` · `admin/index.html` · `air/index.html` · `manage/index.html` · 루트 `index.html` · 루트 `auth.js`
- `supabase/`: `reservations_setup.sql` · `resort_master_setup.sql` · `confirm_docs_storage.sql` · `confirm_docs_storage_policy.sql` · `cron_d7_schedule.sql` · `functions/cron-d7-alimtalk/index.ts` · `functions/send-alimtalk/index.ts` · 셋업 문서 2종

> ⚠ **SaiZen(야마나미 운영관리 시스템) 소스는 이 저장소에 없어 미분석.** 06 문서의 SaiZen 쪽 항목은 메리트투어 코드에서 도출한 "전달 가능 데이터"이며, 실제 연결 스키마는 SaiZen 담당 확인 필요.

---

## 최상위 결론 (코드로 확정된 큰 그림)

1. **정적 GitHub Pages + 클라이언트 전용.** 모든 도구가 브라우저 내에서 동작(단일 HTML·CDN 라이브러리). 서버 상시 연동은 없음.
2. **주력은 대시보드(통합 업무 허브).** M클릭 엑셀 2종(예약리스트 + 일행별예약)을 `eventSeq`로 결합해 예약·항공·요금·검수·확정서·정산을 한 화면에서 처리.
3. **원본 예약 데이터는 저장되지 않음(메모리 전용).** 새로고침 시 재업로드 필요. localStorage에는 **마스터·수기 오버레이·설정·필터**만 저장(개인 PC별).
4. **Supabase는 전부 "설정/배포해야 켜지는 조건부·향후 기능".** ✅ 코드는 완비돼 있으나, 클라이언트는 연동 설정(`mt_doc_cfg`)이 입력된 PC에서만 동작. `resort_master` 테이블은 정의만 있고 클라이언트 호출 0건. → **알림톡·confirm-docs·예약 동기화·D-7 자동발송의 실제 가동 여부는 코드만으로 확인 불가(⚠).**
5. **문서 vs 코드 불일치 다수 발견**(inquiry "폐지" 표기 vs 현역, 환율 "2달 전" vs 고객안내문 "3달 전", confirm-docs public vs private 등) → 08 문서에 질문으로 정리.
6. **야마나미 관련 데이터는 메리트투어 쪽에 풍부**(예약·인원·항공시각·PNR·명단·송영·숙소 배정·블록 재고) → SaiZen 연결의 핵심 후보(06 문서).
