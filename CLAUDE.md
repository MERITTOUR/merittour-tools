# MERITTOUR 사내 도구함 — 작업 규칙 (CLAUDE.md)

이 파일은 Claude Code가 이 저장소에서 작업할 때 따라야 할 규칙을 정리한 것이다.
상세한 기술 명세는 `docs/dashboard_tech_spec.md`, 셋업·로드맵은 `docs/project_setup_guide_roadmap.md`를 참고한다.

## 저장소 개요
- 메리트투어(한국 골프 투어 여행사) 사내 자동화 도구함. GitHub Pages로 배포.
- 계정 `cmc338111-crypto`, 저장소 `merittour-tools` (public), 기본 브랜치 `main`.
- 진입점: `/sales/` (영업 도구 허브). 루트 `index.html`은 `/sales/`로 리다이렉트.
- 도구 경로: `tools/{toolname}/index.html`. 현재 도구: dashboard(주력)·insurance·imgtoolkit·weather·library. (inquiry 폴더는 폐지됐으나 잔존)
- 그 외 디렉토리: admin, air, manage, sales, assets, cards, shared, supabase.

## 접근 게이트 (중요)
- 모든 진입점 `index.html`은 `<head>`에서 본문보다 먼저 `shared/gate.js`를 부른다.
  - sales·admin·air·manage: `<script src="../shared/gate.js"></script>`
  - tools/* (2단계): `<script src="../../shared/gate.js"></script>`
  - tools/library/archive (3단계): `<script src="../../../shared/gate.js"></script>`
  - 루트 index.html: 게이트 없음(즉시 sales로 리다이렉트되므로).
- 비밀번호 **9800** (gate.js에 SHA-256 해시로 보관, 원문 비노출). 이름(2글자 이상) + 비번 입력.
- 통과 기록은 sessionStorage(탭 닫으면 재입력), 이름은 localStorage(유지).
- 새 도구·페이지를 추가하면 반드시 게이트 로드 줄을 깊이에 맞게 넣을 것.

## 핵심 작업 원칙
- **코드가 문서보다 우선한다.** 문서가 GitHub 최신본과 다르면 실제 코드 파일을 기준으로 한다.
- **단일 HTML 파일 바이브 코딩.** 외부 라이브러리는 CDN(cdnjs)에서 로드. 로고는 인라인 SVG.
- **설계 먼저 제안 → 확인 → 구현.** 구조·디자인 변경은 먼저 제안하고 확인받은 뒤 구현.
- 데이터 저장은 localStorage. 키 네임스페이스: `mt_notify_*`, `mt_settle_*`, `mt_doc_*`, `mt_edit_*`, `mt_agency_*`.
- 라이트 모드 고정.

## 검증 (납품 전 필수)
1. **JS 문법 검사**: 인라인 `<script>`를 추출해 `new Function(code)`로 파싱 오류 확인.
2. **실제 데이터 스모크 테스트**: jsdom-stub(가짜 DOM) 환경에서 실제 엑셀(예약리스트·일행별예약)을 읽어 `analyze()`를 돌리고 결과를 검증. SheetJS(xlsx)로 파싱.
   - ctx에 MutationObserver/IntersectionObserver/ResizeObserver/atob/btoa/scrollTo 등을 반드시 포함해야 스텁이 끝까지 돈다.
3. 수정 후 바로 끝내지 말고 위 1·2를 거친 뒤 결과를 보고할 것.
4. **CI 자동화**: push/PR마다 `.github/workflows/ci.yml`이 `node scripts/check-syntax.mjs`(인라인 `<script>`+`.js` 문법 검사)와 `node --test tests/**/*.test.mjs`(단위 테스트)를 실행. 로컬 검증은 `npm run verify`.
   - 공통 순수 함수의 단일 진실원은 `shared/util.js`(MT 네임스페이스, UMD — 브라우저 전역+Node require). 새 공통 로직은 여기에 모으고 `tests/util.test.mjs`에 테스트 추가.
   - `package.json`에 `"type":"module"`을 넣지 말 것(.js=CJS·.mjs=ESM 유지).

## 출력·파일 규칙
- 다운로드 파일명은 **반드시 영문** (한글 파일명은 다운로드 실패). 파일 내부 내용은 한글 유지.
- 대용량 한글 HTML 편집은 Python 배치 치환이 str_replace 반복보다 안정적.
- 한글 HTML 읽기는 `errors='replace'` 옵션 필수.

## dashboard 섹션 구조 (코드 기준 = 유일한 정답)
업로드 → ① 리조트 마스터 → ② 호텔 블록 → ③ 데이터 검수 → ④ 요금 관리 → ⑤ 예약 관리 → ⑥ 항공 정보
→ (준비중) 확정서 생성 · 정산 · 보험 · 송영 · 숙소 · 골프 · 식사
- 활성 6개(①~⑥)에 원형 번호. 준비중 7개는 「준비중」 배지(단 analyze 시 unlock되어 클릭·동작).
- 확정서·정산은 기능 완성도 높으나 UI 마감·배포 정책상 준비중으로 분류(추후 활성 승격 예정).
- 과거 ①~⑪ 단일 번호 체계는 폐기됨.

## 엠클릭 데이터 (2종 통합 완료)
- 입력 2종: **예약리스트**(예약현황 탭) + **일행별예약**(탑승자정보 탭). 둘 다 출발일별/예약일별에서 다운로드. **예약리스트는 500행씩 분할**, **일행별예약은 1개월 단위로 명단 인원수와 무관하게 한 번에** 받음 → 여러 달/분할분은 같은 칸에 여러 파일 올리면 자동 병합.
- 결합 키: `eventSeq`(silent join). 표시 키는 행사번호.
- 일행별예약 한 파일에 항공시각 4종·PNR·항공사·출발/귀국편·사전좌석·여권 정보 모두 포함(구 APIS·현지도착 폐지).
- 비고 3종: 비고·현지 비고·기타 비고. 예약리스트 idx 30·31·32.
- PNR은 콤마(전각 ， 포함) 분리 시 전부 기재(첫 개만 쓰면 안 됨).

## 거래유형(일반/여행사 B2B) 전역 필터
- 상품명이 "여행사"로 시작 = B2B(`parseProduct`의 `isAgency`).
- 전 탭 공유 필터 `agencySel`(localStorage `mt_agency_filter`, PC별 기억, 기본 일반만, 다중선택).
- 헬퍼: `agencyOk(t)`, `agencyBadge(t)`. 예약·항공·요금관리·확정서·정산에 칩 필터+배지, 검수는 배지만.

## 요금·환율
- 회원관리비: 리조트 마스터 숙소별 입력값이 단일 출처(기본 50,000원/인, 면제 숙소만 0).
- 환율: 출국 2달 전 월 1일자 하나은행 현찰 살 때 최초 고시. 월별 테이블만 사용(미등록 월은 검증 제외).
- 항공요금 매칭은 IATA 코드 정규화(`airportCode`). 도착지는 숙소 arrCode → APIS 도착지 순.
- 지역명과 실제 공항 다른 상품 주의: 벳푸=후쿠오카(FUK), 이바라키=나리타(NRT), 나가노=니가타(KIJ).

## 디자인 토큰
- dashboard UI: 베이스 #EEF2F8, 액센트 #2E5A88, 헤더 네이비 #1a2332. Pretendard 17px 본문, Noto Serif KR 헤더.
- 구분값 신호색(tag-status-*): 견적 노랑·대기 보라·확정 파랑·정산 초록·취소 빨강.
- 베이지·골드 계열 비선호. 고객 발송물은 JPG, Noto Sans KR.

## 마스터 배포 흐름
- 리조트 마스터(단가·환율·항공요금)는 브라우저 localStorage에만 저장(`mt_notify_resortMaster`).
- 관리자가 입력 완료 → 「마스터 내보내기」 JSON 배포 → 직원은 「마스터 불러오기」 1회 → 이후 각자 엠클릭 파일만 업로드.
- Supabase 자동 동기화는 아직 미적용(supabase/ 폴더에 SQL 인프라만 준비).

## 협업
- 차분하고 정직한 피드백 환영. 과도한 칭찬 불필요. 한국어 존댓말.
