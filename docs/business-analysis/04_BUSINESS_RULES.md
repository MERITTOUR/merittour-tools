# 04 · 업무 규칙 (Business Rules — 요금·환율·항공·정산·보험)

> 기준: `tools/dashboard/index.html`, `tools/insurance/index.html`. ✅ 코드 확정 / 🔎 확인 필요.

## 1. 예약 상태 ✅
- `t.status` = 엑셀 `구분` 원문. 유효 4종 `견적·대기·확정·정산`. **취소는 분리**(`cancelledTeams`, `cancCd`도 제외 조건).
- 신호색(`tag-status-*`): 견적 노랑 · 대기 보라 · 확정 파랑 · 정산 초록 · 취소 빨강.

## 2. 거래유형(일반/여행사 B2B) ✅
- `isAgency = /^\s*여행사/.test(상품명)` (상품명이 "여행사"로 시작).
- 전역 필터 `agencySel`(기본 `Set(['일반'])`, localStorage `mt_agency_filter`), `agencyOk(t)`·`agencyBadge(t)`. 토글 시 6개 탭 재렌더.

## 3. 상품 파싱 ✅
`parseProduct(name)` → `{accom, roomType, region, golf, nights, isAgency}`. 숙소 키워드 체인(야마나미·쿠주힐즈·포틴힐즈·아키바·무츠키·시로사토·후쿠로다·간지·시즈노야도·스가다이라·미야자키·구마모토시내·닐라이·국제공항), 룸타입(소형트윈/패밀리룸/트윈), `nights = /(\d+)박/`.

## 4. 요금 규칙 ✅
- **회원관리비(mgmt)**: 단일 출처 = **리조트 마스터 숙소별 `mgmt`**(기본 50,000원, `RESORT_DEFAULTS[].mgmt`). 면제 숙소는 0 입력. 정산 단계 `exMgmt` 체크로 개인별 면제.
  - `COMMON_DEFAULTS.mgmtKRW=50000`(전역)·UI 입력은 **레거시, 실계산 미사용**(계산은 항상 숙소별 `u.mgmt`).
  - 1회성 마이그레이션: 과거 mgmt=0 → 5만원 보정, `mt_notify_mgmtMigrated` 플래그.
- **단가 구조(RESORT_DEFAULTS 필드)**: `stay`(체재비 ¥/인박) · `transfer`(송영 ¥/인) · `mgmt`(₩/인) · `greenWeekday/greenWeekend`(그린피) · `add9h` · `bfast/lunch/dinner` · `arrCode`(도착 IATA) · `rooms` · `aliases` · `assign`(임의배정) · `holes` · `depart`.
  - ✅ 현재 **그린피·식사 단가는 전부 0**(스키마만 존재). 실계산에 쓰이는 값은 `stay`·`transfer`·`mgmt`·`arrCode`.
- 예상판매: `stayTotal = stay×pax×nights`, `transferTotal = transfer×pax`, `mgmtTotal = mgmt×pax`.
- **현지정산단가 `localRate`**: 미설정 시 `체재비 − ¥1,000` 자동(`stay>0`일 때). → **체재마진(¥) = nights × (stay − localRate)**.

## 5. 환율 규칙 ✅ / 🔎
- 구조: `commonMaster.monthlyRates = { "YYYY-MM": 환율 }`(100엔당 원).
- 적용: `rateForMonth(depDate)` = **출발일의 YYYY-MM**로 조회. **미등록 월 → 0**(정산에서 `missRate` 플래그).
- 환산: `yenKRW = round(yenSum × rate / 100)`.
- 🔎 **"출국 2달 전 월 1일자 하나은행 현찰 살 때"는 코드 로직이 아니라 UI 안내 문구·관행.** 자동 날짜 상수(`FX_REFERENCE_DATE` 등) 없음 — 사람이 그 기준으로 판단해 월별 테이블에 수동 입력.
- ⚠ 고객 안내문(`asoyamanami2027reservation.html`)은 "**세 달 전**" 기준 → **대시보드(2달) vs 안내문(3달) 불일치**(08 질문).

## 6. 항공요금 매칭 ✅
- 테이블 `commonMaster.airfares[]`: `{month, airline, origin, dest, nights, flightOut, flightIn, tripType, fare, cost}`. `fare`=고객 안내가, `cost`=발권 원가.
- IATA 정규화 `airportCode()`(한글명→코드, 3자코드 통과, 부분매칭). 
- 매칭 `airfareFor(t)`: 도착지 = **숙소 `arrCode` 우선 → APIS `dest`**. 단계 완화: (월×출발지×도착지×박수) → 도착지 무시 → 출발지만.
- 발권원가 `airCostFor(t)`(`cost>0`일 때).

## 7. 정산 계산 ✅
- 값 우선순위: **개인 입력 > 일괄 입력 > 테이블(원가)/마스터(현지단가)**.
- 저장: `settleAdjust`(`"eventSeq#idx"→{airCost,airSrc,ins,insSrc,localRate,transFee,exStay,exTrans,exMgmt}`), `settleDed`(공제 배열).
- 개인 행: `stayYen = exStay?0:nights×localRate`, `transYen = exTrans?0:transFee`, `mgmt = exMgmt?0:u.mgmt`, `marginYen = nights×max(stay−localRate,0)`. 항공원가 = 개별→지상만(0)→테이블→미등록.
- 팀 집계: `groundKRW = round(groundYen×rate/100)`, `airProfit = 안내가합 − 원가합`, **알선수익 `broker = 판매금액 − 원가합 − groundKRW − 보험합`**, `수수료 fee = round(broker/1.1)`, `vat = broker − fee`(부가세 10% 역산), `총수수료 = fee + marginKRW`.
- 공제(`settleDed`) 6종(보증금 쿠폰·장기숙박 쿠폰·야마나미 이용권·포인트·싱글차지 선납·기타 선납) → **실정산액 = gross − Σ공제**.
- 항공원가 업로드 매칭 키: `[행사번호, 성함, 생년6]`(폴백 `[행사번호,성함]`).

## 8. 패키지 프리셋 ✅
`commonMaster.pkgPresets[] = {accom, nights, price}`(숙소+박수→1인 원화 총액). 우선순위: **팀 직접입력(`vAdjust.pkgPrice`) > 마스터 프리셋**. 프리셋 적용 시 분해식(체재+항공+관리비+환율)을 우회하고 `expected = pkgUnit×pax`(벳푸 박수별·나가노 기간별 단일가 대응).

## 9. 보험 매칭(tools/insurance) ✅
- 입력: 일행별예약 엑셀 + DB손보 가입증명서 PDF(둘 다 있어야 실행).
- 매칭 2단계: ① `이름|bd6` 정확 매칭(미사용분 우선) → ② 실패분 중 `source='cert'`(이름 추출 실패 단일 PDF)만 `bd6` 폴백.
- 결과 3분류: `matched` / `onlyExcel` / `onlyPdf`. 개인별 `plan`(보험코드 B0X)·`premium`(보험료)·`gender` 병합, 보험료 합계 집계.
- 🔎 **보험 도구 ↔ 대시보드 정산 자동연동 없음**(별도 HTML). 정산의 개인 보험료(`ad.ins`)는 수동/개별 입력, `insIsExcluded`로 제외 판정만.
