# MERITTOUR 사내 도구함 — 설정 가이드

부서별로 분리된 메리트투어 사내 도구함입니다. Phase 1A(로그인 없음 + URL 분리)로 즉시 운영, 나중에 Phase 1B(Google 로그인)로 무중단 전환 가능.

**저장소 위치**: `MERITTOUR/merittour-tools`
**공개 URL**: `https://merittour.github.io/merittour-tools/`

---

## 📁 파일 구조

```
MERITTOUR/merittour-tools/
├── index.html                ← 루트 안내 (외부인 봐도 정보 노출 없음)
├── auth.js                   ← 공통 로그인 스크립트 (현재 비활성)
├── robots.txt                ← 검색엔진 차단
├── README.md                 ← 이 문서
│
├── admin/index.html          ← 시스템 관리자 (전체 도구 + 사내 자료실 + 개발 메모)
├── sales/index.html          ← 영업팀 (영업·항공·관리 공통 접근, 도구함 메인)
├── air/index.html            ← 항공팀 전용 (현재 빈 영역)
├── manage/index.html         ← 관리팀 전용 (현재 빈 영역)
│
├── shared/                   ← 공통 디자인 엔진 (모든 페이지가 참조)
│   ├── core.css              ← 색·폰트·공통 컴포넌트(헤더/카드/버튼/배지) 토큰
│   └── util.js               ← 공통 유틸 함수 (날짜·전화 포맷, 토스트 등)
│
├── tools/                    ← 실제 도구 파일 (공유 자산)
│   ├── hub/index.html        ← 통합 점검 — 엠클릭 엑셀 한 번에 올려 손익·미수·예약 운영 점검
│   ├── insurance/index.html  ← 보험코드매칭 — DB손보 PDF + 예약 엑셀 → 행사별 보험료 산출
│   ├── inquiry/index.html    ← 예약가능일자 안내 (v1.2)
│   ├── notify/index.html     ← 고객 안내 발송 — APIS → 출국 1주일 전 알림톡 일괄발송
│   ├── imgtoolkit/index.html ← 이미지 툴킷 — WebP 변환·리사이즈·압축
│   └── weather/index.html    ← 리조트 날씨 — 현지 3시간 예보 + 안내문 복사
│
└── cards/                    ← 사내 자료실 — 직원 명함 PNG (15명)
```

## 🌐 URL 매핑

| URL | 누가 | 무엇이 보이나 |
|---|---|---|
| `https://merittour.github.io/merittour-tools/` | 외부 / 일반 방문자 | "사내 전용" 안내 한 줄, 부서 URL 미노출 |
| `https://merittour.github.io/merittour-tools/admin/` | 대표님 | 전체 도구 + 사내 자료실 + 부서 진입점 + 개발 메모 |
| `https://merittour.github.io/merittour-tools/sales/` | 영업·항공·관리 직원 | 영업 도구 + 외부 시스템·시트 + 참고 자료 |
| `https://merittour.github.io/merittour-tools/air/` | 항공팀 | 항공팀 전용 (현재 빈 영역) |
| `https://merittour.github.io/merittour-tools/manage/` | 관리팀 | 관리팀 전용 (현재 빈 영역) |

각 직원에게는 **자기 부서 URL만** 알려주면 됩니다. URL 모르면 들어갈 수 없으므로 사실상 분리 효과.

---

## 🔗 통합 점검 ↔ 보험코드매칭 연동

**통합 점검(`tools/hub/`)**은 엠클릭에서 받은 엑셀 4~5개(예약리스트·행사별마감현황·일행별예약·현지도착·APIS)를 한 번에 드롭존에 던지면 행사번호로 묶어 손익·미수·예약 운영을 한 화면에서 점검합니다.

**보험코드매칭(`tools/insurance/`)**으로 DB손보 PDF + 예약 엑셀을 매칭해 받은 결과 엑셀을 통합 점검 드롭존에 같이 던지면, 결과 안의 "행사별요약" 시트가 자동 인식돼 행사별 보험료가 통합 점검 화면에 자동으로 표시됩니다(별도 조작 없음).

OP가 통합 점검 화면에서 입력하는 메모(확정서/견적서 체크, 비고 3분류, 방배정, 골프 조편성 등)는 브라우저(localStorage)에 저장되며, 향후 Firebase 단계에서 부서 간 실시간 공유로 확장됩니다.

---

## 🎨 디자인 시스템 (shared 공통 엔진)

모든 부서 페이지와 도구는 `shared/core.css`의 토큰을 참조합니다. **색이나 폰트를 바꾸려면 `shared/core.css`의 `:root` 한 곳만 고치면 전 도구에 반영됩니다.**

- **톤**: 차콜 `#353C48` · 카키 `#6E6F4B` · 화이트. 라이트 전용(다크 모드 없음).
- **폰트**: Noto Sans KR(본문) + JetBrains Mono(숫자·배지).
- **헤더 통일**: 좌측 `MERITTOUR · INTERNAL TOOLS · [도구명 배지]`, 우측 끝 `← 영업 도구` 버튼.
- **상태색**: 충분=초록 / 주의=노랑 / 부족=빨강. 연한 배경 위 글자는 진한 변형(`green-dark`·`amber-dark`·`red-dark`)을 써서 가독성 확보.

### shared 링크 경로 (위치별로 다름)

| 파일 위치 | core.css 링크 경로 |
|---|---|
| 루트 `index.html` | `shared/core.css` |
| 부서 `admin/`, `sales/` 등 | `../shared/core.css` |
| 도구 `tools/{도구명}/` | `../../shared/core.css` |

> 도구 색이 검정·기본색으로 깨져 보이면 십중팔구 이 링크 경로가 틀렸거나 `shared/`가 누락된 경우입니다.

---

## ✅ Phase 1A 셋업 (완료)

현재 다음이 완료되어 정상 운영 중입니다:

- [x] `merittour-tools` 저장소 생성 (Public)
- [x] 부서별 페이지 4벌 배포 (admin/sales/air/manage)
- [x] 루트 안내 페이지
- [x] 도구 6종 배포 (통합 점검 · 보험코드매칭 · 예약가능일자 안내 · 고객 안내 발송 · 이미지 툴킷 · 리조트 날씨)
- [x] 공통 디자인 엔진 `shared/` 도입 (차콜·카키 톤 통일, 헤더 통일, 가독성 보정)
- [x] GitHub Pages 활성화
- [x] robots.txt로 검색엔진 차단
- [x] 직원 명함 cards 폴더 통합

---

## 🛠 일상 관리

### 새 도구 추가

1. `tools/{도구명}/index.html` 경로로 도구 파일 업로드
2. 도구 `<head>`에 공통 엔진 링크 추가: `<link rel="stylesheet" href="../../shared/core.css">`
3. 해당 부서 페이지(예: `sales/index.html`)의 `tool-grid`에 카드 추가
4. 커밋 → 자동 배포 (1~2분)

### 도구 업데이트

`tools/{도구명}/index.html` 파일을 새 버전으로 덮어쓰기. 부서 페이지는 손댈 필요 없음.

### 색·톤 변경 (전 도구 일괄)

`shared/core.css`의 `:root` 토큰만 수정 → 모든 부서 페이지·도구에 한 번에 반영. 도구 파일은 건드릴 필요 없음.

### 부서 페이지 도구 추가

각 부서의 `index.html` 안 `tool-grid` 영역에 카드 한 장 복사해서 붙여넣기. admin 페이지에도 동일 카드를 추가해두면 시스템 관리자가 어디 어느 도구가 있는지 한눈에 봅니다.

### 개발 메모 갱신 (admin 페이지)

`admin/index.html`의 `<div class="notes-section">` 영역을 직접 편집해서 commit.

### 명함 추가/교체

- `cards/{이름}.png` 경로로 업로드 (덮어쓰면 자동 교체)
- 파일명 규칙: 영문 소문자, 하이픈 (예: `daewoong-kim.png`)
- 양면 명함이면 `daewoong-kim-front.png`, `daewoong-kim-back.png`처럼 분리

---

## 🔐 Phase 1B 전환 (나중에 — Google 로그인 활성화)

### STEP 1 · OAuth Client ID 발급

https://console.cloud.google.com/ 에서:
1. **새 프로젝트** 만들기 (이름 자유, 예: `MERITTOUR Tools`)
2. **OAuth 동의 화면** 구성
   - User Type: **외부**
   - 앱 이름: `메리트투어 사내 도구함`
   - 승인된 도메인: `merittour.github.io`
3. **사용자 인증 정보** → **+ OAuth 클라이언트 ID**
   - 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://merittour.github.io`
4. 표시된 **클라이언트 ID** 복사

### STEP 2 · `auth.js` 수정

```javascript
const CONFIG = {
  ENABLED: true,                                                    // ① true로 변경
  CLIENT_ID: '여기에-복사한-id.apps.googleusercontent.com',           // ② Client ID
  ALLOWED_DOMAINS: [
    'merittour.co.kr'                                               // ③ 회사 도메인
  ],
  ALLOWED_EMAILS: [
    'sai@example.com',                                              // ④ 개인 Gmail 직원
    'employee1@gmail.com',
  ],
  ...
};
```

### STEP 3 · 부서 페이지마다 GSI 스크립트 활성화

각 부서의 `index.html`에서 다음 두 줄 주석 해제:

```html
<!-- 변경 전 -->
<!-- <script src="https://accounts.google.com/gsi/client" async defer></script> -->
<!-- <script src="../auth.js"></script> -->

<!-- 변경 후 -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="../auth.js"></script>
```

`admin/`, `sales/`, `air/`, `manage/` 4벌 모두 같은 작업. 커밋 후 1~2분 뒤 로그인 화면 활성화.

> 💡 부서별 차등 권한이 필요하면 (예: 관리팀만 manage에 들어가게) `auth.js`에 role 매핑 로직을 추가해야 합니다. Phase 1B 가시는 시점에 함께 만들어드립니다.

---

## 🌍 추후 확장 가능

| 단계 | 작업 | 효과 |
|---|---|---|
| **커스텀 도메인** | Wix DNS에 CNAME 추가 → `tools.merittour.co.kr` | 깔끔한 메리트투어 정통 도메인 |
| **Mclick API 통합** | 엑셀 업로드 단계 사라짐 | 자동화 완성 |
| **Firebase 통합** | 한 명이 올린 데이터를 전 직원이 실시간 공유 | 진정한 협업 도구화 |
| **정산 편의 도구** | Mclick 엑셀 기반 현지 정산 자동화 | 정산 업무 단축 |
| **SaaS 확장** | 다른 한국 골프 투어 운영사 대상 | 비즈니스 확장 |

---

## ❓ 트러블슈팅

**Q. URL 들어가면 404**
A. 저장소 이름이 정확히 `merittour-tools`인지 확인. Settings → Pages에서 "Your site is live at..." 메시지 확인. 파일은 main 브랜치 root에.

**Q. 도구 카드 클릭해도 안 열림**
A. `tools/{도구명}/index.html`이 실제로 그 경로에 있는지 저장소에서 직접 확인. `tools` 폴더가 누락되어 있으면 도구 카드 링크가 깨집니다.

**Q. 도구 색이 검정·기본색으로 이상하게 나옴**
A. `shared/core.css`가 저장소에 있는지, 그리고 도구 `<head>`의 shared 링크 경로가 맞는지 확인하세요. 도구는 `../../shared/core.css`, 부서 페이지는 `../shared/core.css`, 루트는 `shared/core.css`입니다.

**Q. 도구가 부서 페이지에서는 보이는데 admin에서는 안 보임 (또는 반대)**
A. 각 부서 페이지(`admin/`, `sales/` 등)에 도구 카드를 따로 등록해야 합니다. 한 곳 추가 시 나머지에도 동기화 필요.

**Q. 직원이 다른 부서 URL을 알아내면 들어갈 수 있나요?**
A. Phase 1A에서는 가능합니다 (URL만으로 접근 통제). 보안이 중요해지면 Phase 1B로 전환해서 role 기반으로 차단하세요.

**Q. 명함 메일 서명 URL이 바뀌었나요?**
A. 네. 직원 명함은 `https://merittour.github.io/merittour-tools/cards/{이름}.png`로 호스팅됩니다. 메일 서명에 임베드된 이미지 URL을 새 경로로 변경해야 합니다.

---

문의: 시스템 관리자 / 02-365-9800
