# 엠클릭 데이터 등록소 — Supabase 공유 설계안

> 상태: **결정 완료 · 0단계 착수** · 대상: `tools/register/`(신규) · `tools/dashboard/` · `shared/store.js`(신규) · `supabase/`
>
> 목표: 직원 한 명이 엠클릭 파일을 올리면 **전 직원이 같은 데이터를 본다.** 지금은 각자 자기 PC에 올려 각자 분석한다.

---

## 1. 지금 어디까지 와 있나

착수 전에 저장소 실제 상태를 확인했다. 문서보다 코드가 우선이므로 아래는 전부 파일에서 확인한 것이다.

| 것 | 상태 | 근거 |
|---|---|---|
| `data_registry` 테이블(예약리스트·일행별예약) | **스키마 완성** | `supabase/migrations/05_data_registry.sql` |
| `special_cases` 테이블 | **스키마 완성** | `supabase/migrations/06_special_cases.sql` |
| `resort_master` 공유(버전·이력 포함) | **스키마 완성** | `supabase/resort_master_setup.sql` |
| `reservations` + 알림톡 발송 | **스키마 완성 · 일부 가동** | `supabase/reservations_setup.sql`, `functions/` |
| **블록표(호텔별 예약현황) 저장소** | **스키마 작성됨(미실행)** | `supabase/migrations/07_data_registry_block.sql` |
| `shared/store.js` 데이터 접근 모듈 | **없음** | `shared/`에 `core.css`·`gate.js`·`util.js`뿐 |
| 등록 페이지 `tools/register/` | **없음** | |
| 대시보드 ↔ 등록소 연결 | **없음** | 대시보드는 파일 업로드 → `analyze()` 뿐 |
| 대시보드 ↔ Supabase | **확정서 스토리지만** | `DOC_CFG.supabaseUrl/Key`로 REST 직접 호출 |

### 1-1. 막고 있는 것 — 인증

`05_data_registry.sql` 첫 줄에 이렇게 적혀 있다.

```
-- 선행: 01_user_access.sql (mt_has_role/mt_is_admin/mt_is_active 헬퍼)
```

**그런데 `01_user_access.sql`이 저장소에 없었다.** `migrations/`에는 `05`와 `06`만 있고 `mt_has_role`을 정의하는 SQL이 어디에도 없어, 05를 실행할 수 없는 상태였다(존재하지 않는 함수를 참조하는 정책이라 생성에서 막힌다).

> **→ 이 커밋에서 `supabase/migrations/01_user_access.sql`을 작성했다.** 아직 실행 전이다.

그리고 `data_registry`의 정책은 전부 `to authenticated` + `mt_has_role(...)`이다.

```sql
revoke all on public.data_registry from anon;
grant select, insert, update, delete on public.data_registry to authenticated;
```

**anon(로그인 없음)은 읽지도 쓰지도 못한다.** 지금 도구함은 `shared/gate.js`의 비밀번호 가림막만 있고 **Supabase 로그인은 없다.** 그래서 등록소는 **로그인이 붙기 전까지 한 줄도 동작하지 않는다.**

> **이 설계의 1번 선행 조건은 로그인이다.** (할 일 #8 「로그인 페이지 + access.js 활성 배선」, #1 「보안작업 운영 반영」)

---

## 2. 무엇을 서버로 옮기나

세 덩어리다. 성격이 달라서 저장 방식도 다르다.

| 데이터 | 성격 | 키 | 이미 있나 |
|---|---|---|---|
| **예약리스트 + 일행별예약** | 월 단위로 통째 교체 | 출발월 `YYYY-MM` | ✅ `data_registry` |
| **블록표(호텔별 예약현황)** | 월 단위로 통째 교체 | 출발월 `YYYY-MM` | ❌ **추가 필요** |
| **리조트 마스터** | 상시 편집·충돌 가능 | 단일 행 + 버전 | ✅ `resort_master` |

### 2-1. 블록표 저장소 — `07_data_registry_block.sql`

`data_registry`에 컬럼을 더했다. **같은 달의 세 데이터가 함께 움직여야** 잔여 계산이 맞기 때문이다.

```sql
alter table public.data_registry
  add column if not exists block_rows  jsonb,        -- blkParse() 결과
  add column if not exists block_raw   text,         -- 붙여넣은 원문(재현용)
  add column if not exists block_month text,         -- 표가 가리키는 달(검증용)
  add column if not exists block_by    text,
  add column if not exists block_at    timestamptz;
```

- **파싱 결과를 정본으로 둔다**(원문이 아니라 `blkParse()`가 만든 `[{hotel,room,day,used}]`).
  원문만 두면 파서가 바뀔 때 과거 달의 잔여가 조용히 달라진다.
- **원문도 남긴다** — 파싱이 틀렸을 때 재현하려면 원본이 필요하다.
- `block_month`를 따로 두는 이유: 7월 표를 8월 칸에 잘못 붙여넣는 사고를 서버에서 잡기 위함.
- **기본값을 빈 배열이 아니라 `null`로 뒀다.** 「아직 안 올림(null)」과 「올렸는데 사용 0(`[]`)」을 구분해야 한다 — 이 구분이 없으면 다음 달 미등록을 사용 0으로 오해해 **월 경계 연박이 잘못 계산된다.**

> **주의** — 블록표는 「그날 실제로 나간 객실 수」다. 예약리스트의 **인원**에서 환산한 추정치로 대체할 수 없다(홀수 인원 단독 사용·임의배정·현장 조정 때문). 잔여는 손님에게 나가는 값이라 추정치로 바꾸면 없는 방을 팔게 된다. **붙여넣기는 계속 정본으로 두고, 서버에 공유만 한다.**

---

## 3. 흐름

```
[등록 페이지  tools/register/]
   ① 로그인 (Supabase Auth)
   ② 출발월 선택               ← 2026-07
   ③ 예약리스트 여러 개 업로드   ← 500행 분할분을 브라우저에서 병합
   ④ 일행별예약 업로드
   ⑤ 블록표 붙여넣기
   ⑥ 미리보기 — 팀 수 · 인원 · 숙소 수 · 이전 등록본과의 차이
   ⑦ [등록]  → data_registry upsert (period 기준)

[대시보드  tools/dashboard/]
   업로드 칸 대신 「등록소에서 불러오기」
   월 목록 → 선택 → analyze() → 지금과 똑같이 동작
```

**핵심: 대시보드의 `analyze()` 이후 로직은 손대지 않는다.** 입력을 파일에서 서버로 바꾸는 것뿐이다. 그래야 지금 잘 도는 6개 탭이 안 깨진다.

### 3-1. `shared/store.js`

`util.js`와 같은 UMD 형태. 브라우저 전역 `MT_STORE` + Node `require`.

```js
MT_STORE.login(email, pw)            → 세션
MT_STORE.listPeriods()               → [{period, teamCount, paxCount, uploaderName, updatedAt, hasBlock}]
MT_STORE.load(period)                → {resRows, ilhaengRows, blockRows, blockMonth, meta}
MT_STORE.save(period, payload)       → {ok, version}
MT_STORE.loadMaster() / saveMaster(data, version)
```

- 네트워크·인증·에러 처리를 여기 한 곳에 모은다. 대시보드는 순수 함수만 부른다.
- **Supabase JS SDK를 쓰지 않고 REST를 직접 호출**한다 — 이미 확정서 쪽이 그렇게 돌고 있고(`DOC_CFG`), CDN 의존을 하나 더 늘릴 이유가 없다.

---

## 4. 중복 · 최신본 · 충돌

### 4-1. 같은 달을 다시 올리면
`period`가 기본키라 **업서트 = 통째 교체**다. 부분 병합은 하지 않는다.

이유: 예약리스트는 500행씩 분할되고 일행별예약은 월 단위라, 서버에서 행 단위로 병합하면 「어느 파일이 최신인가」를 서버가 알아야 한다. **병합은 브라우저(등록 페이지)에서 끝내고 서버는 완성본만 받는다.**

### 4-2. 덮어쓰기 사고 방지
등록 직전 미리보기에서 **이전 등록본과의 차이**를 보여주고 확인을 받는다.

```
2026-07 이미 등록됨 (김대웅 · 2일 전)
   팀   142 → 138   (-4)
   인원 512 → 498   (-14)
   숙소  14 →  14
   ⚠ 팀이 4건 줄어듭니다. 분할 파일을 빠뜨리지 않았는지 확인해 주세요.
```

**줄어드는 방향일 때만 경고를 띄운다.** 늘어나는 건 정상(추가 예약)이고, 줄어드는 건 파일 누락일 때가 많다.

### 4-3. 동시 등록
두 명이 같은 달을 동시에 올리면 나중 것이 이긴다. `updated_at`으로 감지해 **저장 직전에 다시 확인**한다.

```
등록 시작 시점의 updated_at 을 들고 있다가, 저장 요청에 조건으로 건다.
   PATCH ...?period=eq.2026-07&updated_at=eq.<처음 읽은 값>
0행이 갱신되면 → 그 사이 누가 올린 것. 다시 읽고 차이를 보여준 뒤 재확인.
```

`resort_master`는 이미 `version` 컬럼으로 같은 걸 한다 — 방식을 맞춘다.

### 4-4. 보관 기간
지난 달을 무한정 쌓을 이유가 없다. **13개월 보관**(전년 동월 비교용) 후 정리. 정리는 수동 버튼으로 두고 자동 삭제는 하지 않는다 — 자동 삭제는 사고가 조용하다.

---

## 5. 대시보드 전환 — 한 번에 바꾸지 않는다

업로드를 없애면 서버가 잠깐 안 될 때 아무 일도 못 한다. **둘 다 남긴다.**

```
① 등록소에서 불러오기   ← 기본
② 파일 직접 업로드      ← 접어둠(우회용)
```

- 등록소에서 불러온 상태에는 **「2026-07 · 김대웅 · 2일 전 등록」** 배지를 화면 위에 고정한다. 내가 보고 있는 게 언제 누구 것인지 모르면 잔여를 믿을 수 없다.
- 파일로 직접 올린 상태에는 **「내 PC 파일 · 공유 안 됨」**을 같은 자리에 띄운다.

### 5-1. 마스터도 같이
지금 리조트 마스터는 「내보내기 JSON → 각자 불러오기」다. `resort_master` 테이블이 이미 있으므로, 등록소가 붙는 김에 마스터도 서버에서 읽게 한다.

- 저장은 **admin만**, 읽기는 전원.
- 코드 소유 항목(`MASTER_CODE_OWNED`)은 서버에서 읽어도 **기본값으로 되돌린다** — 지금 localStorage에서 하는 것과 같은 규칙. 안 그러면 서버 저장본이 코드의 숙소명 변경을 영원히 덮는다.

---

## 6. 보안

지금 확정서 쪽은 **anon 키를 localStorage에 두고 REST를 직접 호출**한다. 사이트가 비밀번호 가림막 뒤에 있다는 전제인데, GitHub Pages라 **소스가 공개**다.

- 등록소는 그 방식을 쓰면 안 된다. `data_registry`가 `anon` 차단으로 설계된 이유다.
- **로그인(Supabase Auth) + 역할(admin/sales/air/manage)** 이 전제다.
- `01_user_access.sql`(`mt_has_role` 등)을 **저장소에 넣었다.** 없으면 05를 실행할 수 없고, 나중에 누가 재현하지도 못한다.
- 확정서 쪽 anon 키 사용도 같이 정리 대상이다(별건, 이 설계 범위 밖으로 두되 기록은 남긴다).

---

## 7. 비용

- 예약리스트 한 달치 = 수백 팀 × 컬럼 수십 개 → JSONB로 **수 MB 수준**. 13개월 보관해도 수십 MB.
- Supabase 무료 티어는 DB 500MB. **용량만 보면 무료로도 된다.**
- 유료가 필요한 지점은 용량이 아니라 **① 일시정지(무료는 7일 미접속 시 프로젝트 정지) ② 백업 ③ 사용자 수**다.
- **무료로 결정됨.** 정지 대응은 9-1 참고.

---

## 8. 단계

각 단계는 **그 단계만으로 쓸모가 있어야 한다.** 중간에 멈춰도 손해가 없게.

| # | 할 일 | 끝났다고 볼 기준 |
|---|---|---|
| **0a** | `01_user_access.sql` 작성 ✅ · `07_data_registry_block.sql` 작성 ✅ | 저장소에 있음 (이 커밋) |
| **0b** | Supabase 재연동 후 01 → 05 → 06 → 07 실행 + 첫 owner 승격 | `mt_has_role` 호출 성공, `app_users`·`data_registry` 조회 가능 |
| **1** | 로그인 페이지 + `access.js` | 직원 계정으로 로그인 → 역할 확인됨 |
| **2** | `shared/store.js` | Node 테스트에서 `listPeriods()`·`load()`·`save()` 동작 |
| **3** | 정지 방지(keep-alive) + 연결 실패 안내 | 7일 무접속 후에도 프로젝트가 살아 있음 |
| **4** | 등록 페이지 `tools/register/` | 파일 올려 한 달치 등록 → 목록에 뜸 |
| **5** | 대시보드 「등록소에서 불러오기」 | 등록본으로 `analyze()` → 지금과 같은 결과 |
| **6** | 마스터 서버 공유 | admin 저장 → 다른 PC에서 새로고침만으로 반영 |
| **7** | 검증 + 문서화 | 실제 엑셀로 등록→불러오기 왕복, `npm run verify` |

**0b가 안 되면 그 뒤는 전부 못 한다.** 지금 막혀 있는 지점이 여기다 — Supabase 프로젝트 재연동.

---

## 9. 결정된 것 (2026-07-30)

| # | 결정 |
|---|---|
| 1 | **요금제 — 무료** |
| 2 | **로그인 — 이메일 발급** (Supabase Auth 초대 → 비밀번호 설정) |
| 3 | **역할 5단계** — `owner`(슈퍼 마스터) · `admin`(관리자) · `manage` · `sales` · `air` |
| 4 | **블록표도 등록소에 담는다** |
| 5 | `01_user_access.sql` **미실행** — 이 커밋에서 작성함. Supabase 프로젝트가 정지 상태라 재연동 중 |

### 9-1. 무료 티어 — 정지가 반복된다

무료 프로젝트는 **7일간 요청이 없으면 정지**된다. 지금 재연동 중인 것도 그 때문이다. 등록소가 붙으면 **정지 = 전 직원이 데이터를 못 읽는 상태**가 되므로 그냥 두면 안 된다.

대응 두 가지:

1. **깨우기 요청을 자동으로 보낸다** — GitHub Actions에서 하루 한 번 REST 엔드포인트를 친다. 15줄이면 되고 비용이 없다. 다만 Supabase가 이 방식을 막으면 소용없다.
   ```yaml
   # .github/workflows/supabase-keepalive.yml (제안)
   on: { schedule: [{ cron: '0 3 * * *' }] }   # 매일 12시(KST)
   run: curl -fsS "$SUPABASE_URL/rest/v1/data_registry?select=period&limit=1" \
          -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
   ```
   `SUPABASE_URL`·`SUPABASE_ANON_KEY`를 저장소 Secrets에 넣어야 한다.
2. **정지되면 화면에 그렇게 뜨게 한다** — `shared/store.js`가 연결 실패를 잡아 「등록소에 연결할 수 없습니다 · 파일 직접 업로드로 진행하세요」를 띄운다. 조용히 빈 화면이 되면 안 된다.

**정지가 실제로 업무를 막기 시작하면 Pro로 올리는 게 맞다.** 지금은 무료로 가되 위 두 가지를 함께 넣는다.

### 9-2. 역할 설계

```
owner   슈퍼 마스터 — 계정 발급·역할 변경·삭제. mt_has_role 이 무엇을 물어도 참
admin   관리자      — 리조트 마스터 저장, 등록소 삭제, 전 계정 조회
manage  관리        — 등록소 등록·수정
sales   영업        — 등록소 등록·수정
air     항공        — 읽기 전용
```

- `mt_has_role()`이 **owner를 항상 참으로 처리**한다. 권한을 하나씩 더해 주다 빠뜨리는 사고를 막기 위함이다.
- 새 계정은 **`air` · 비활성**으로 자동 생성되고 owner가 승인·승급한다. 초대만 받으면 바로 데이터가 보이는 상태를 만들지 않는다.
- 헬퍼는 전부 `security definer`다. 정책 안에서 `app_users`를 읽는데 호출자 권한으로 읽으면 RLS를 다시 타면서 무한 재귀가 난다.

### 9-3. 첫 owner 만들기

`01_user_access.sql` 맨 아래에 절차를 적어 뒀다. 요약하면 콘솔에서 초대 → 비밀번호 설정 → SQL 한 줄로 승격.

```sql
update public.app_users
   set role = 'owner', active = true, name = '최민창'
 where email = 'cmc338@naver.com';
```

---

## 10. 이 설계가 하지 않는 것

- **엠클릭 붙여넣기를 없애지 않는다.** 3절 주의 참고 — 블록표는 실제 배정 결과라 추정으로 대체할 수 없다.
- **`analyze()` 내부를 건드리지 않는다.** 입력 경로만 바꾼다.
- **자동 동기화(실시간 구독)를 넣지 않는다.** 새로고침으로 충분하고, 실시간은 충돌 처리를 크게 만든다. 필요해지면 그때 붙인다.
