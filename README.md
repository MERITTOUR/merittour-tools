# MERITTOUR 사내 도구함 — 설정 가이드

부서별로 분리된 사내 도구함입니다. Phase 1A(로그인 없음 + URL 분리)로 즉시 운영 가능, 나중에 Phase 1B(Google 로그인)로 무중단 전환 가능.

---

## 📁 파일 구조

```
merittour.github.io/
├── index.html              ← 루트 안내 (외부인 봐도 정보 노출 없음)
├── auth.js                 ← 공통 로그인 스크립트 (현재 비활성)
├── robots.txt              ← 검색엔진 차단
├── README.md               ← 이 문서
│
├── admin/index.html        ← 시스템 관리자 (전체 도구 + 개발 메모)
├── sales/index.html        ← 영업팀 (영업·항공·관리 공통 접근)
├── air/index.html          ← 항공팀 전용
├── manage/index.html       ← 관리팀 전용
│
└── tools/                  ← 실제 도구 파일 (공유 자산)
    ├── inquiry/index.html  ← 예약가능일자 안내 도구
    ├── aligo/index.html    ← (Aligo 알림톡 도구, 추후)
    └── saizen/index.html   ← (SaiZen v13.4, 추후)
```

## 🌐 URL 매핑

| URL | 누가 | 무엇이 보이나 |
|---|---|---|
| `https://merittour.github.io/` | 외부 / 일반 방문자 | "사내 전용" 안내 한 줄, 부서 URL 미노출 |
| `https://merittour.github.io/admin/` | 대표님 | 모든 도구 + 부서 진입점 + 개발 메모 |
| `https://merittour.github.io/sales/` | 영업·항공·관리 직원 | 영업 도구 + 참고 자료 |
| `https://merittour.github.io/air/` | 항공팀 | 항공팀 전용 (현재 빈 영역) |
| `https://merittour.github.io/manage/` | 관리팀 | 관리팀 전용 (현재 빈 영역) |

각 직원에게는 **자기 부서 URL만** 알려주면 됩니다. URL 모르면 들어갈 수 없으므로 사실상 분리 효과.

---

## 🚀 Phase 1A 셋업 (지금 진행)

### STEP 1 · 저장소 만들기

1. GitHub → `MERITTOUR` Organization → **New repository**
2. **Repository name**: `merittour.github.io` (정확히 이 이름)
3. **Public** 선택 (GitHub Free에서 Pages 무료 사용)
4. **Add a README file** 체크 → **Create repository**

### STEP 2 · 파일 업로드

저장소 페이지 → **Add file → Upload files** → 받은 파일을 폴더 구조 그대로 드래그:

```
업로드할 항목:
  ├── index.html          (루트 안내 페이지)
  ├── auth.js             (공통 로그인 - 지금은 비활성)
  ├── robots.txt          (검색엔진 차단)
  ├── README.md           (이 문서)
  ├── admin/index.html
  ├── sales/index.html
  ├── air/index.html
  ├── manage/index.html
  └── tools/inquiry/index.html  ← merittour_inquiry_v1.2.3.html을 리네임
```

> 💡 GitHub 웹UI에서 폴더 통째로 드래그하면 폴더 구조가 유지됩니다.
> 또는 파일 추가 시 경로에 `tools/inquiry/index.html`처럼 입력해도 됩니다.

### STEP 3 · GitHub Pages 활성화

1. 저장소 → **Settings** → **Pages**
2. **Source**: `Deploy from a branch` / Branch: `main` / Folder: `/ (root)` → **Save**
3. 1~2분 후 ✅ **Your site is live at https://merittour.github.io/** 표시

### STEP 4 · 부서별 URL 직원 분배

```
📨 대표님 (본인): https://merittour.github.io/admin/
📨 영업팀:      https://merittour.github.io/sales/
📨 항공팀:      https://merittour.github.io/air/
📨 관리팀:      https://merittour.github.io/manage/
```

직원은 자기 URL을 즐겨찾기에 추가만 하면 끝.

---

## 🛠 일상 관리

### 새 도구 추가

1. `tools/{도구명}/index.html` 경로로 도구 파일 업로드
2. 해당 부서 페이지(예: `sales/index.html`)에서 카드의 `disabled` 클래스 제거
3. 커밋 → 자동 배포 (1~2분)

### 도구 업데이트

`tools/{도구명}/index.html` 파일을 새 버전으로 덮어쓰기. 부서 페이지는 손댈 필요 없음.

### 부서 페이지 도구 추가

각 부서의 `index.html` 안에서 `tool-grid` 영역에 카드 한 장 복사해서 붙여넣기. admin 페이지에 동일 카드를 추가해두면 시스템 관리자가 어디 어느 도구가 있는지 한눈에 봅니다.

### 개발 메모 갱신 (admin 페이지)

`admin/index.html`의 `<div class="notes-section">` 영역을 직접 편집해서 commit. "최근 작업"·"다음 할 일" 리스트를 운영자가 수동으로 관리.

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

> 💡 부서별 차등 권한이 필요하면 (예: 관리팀만 manage에 들어가게) `auth.js`에 role 매핑 로직을 추가해야 합니다. 그건 Phase 1B 가시는 시점에 함께 만들어드릴 수 있습니다.

---

## ❓ 트러블슈팅

**Q. URL 들어가면 404**
A. 저장소 이름이 정확히 `merittour.github.io`인지 확인. Settings → Pages에서 "Your site is live at..." 메시지 확인. 파일은 main 브랜치 root에.

**Q. 도구 카드 클릭해도 안 열림**
A. `tools/inquiry/index.html`이 실제로 그 경로에 있는지 저장소에서 직접 확인. `tools` 폴더가 누락되어 있으면 도구 카드 링크가 깨집니다.

**Q. 도구가 부서 페이지에서는 보이는데 admin에서는 안 보임 (또는 반대)**
A. 각 부서 페이지(`admin/`, `sales/` 등)에 도구 카드를 따로 등록해야 합니다. 한 곳 추가 시 나머지에도 동기화 필요.

**Q. 직원이 다른 부서 URL을 알아내면 들어갈 수 있나요?**
A. Phase 1A에서는 가능합니다 (URL만으로 접근 통제). 보안이 중요해지면 Phase 1B로 전환해서 role 기반으로 차단하세요.

---

문의: 시스템 관리자 / 02-365-9800
