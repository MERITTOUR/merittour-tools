# 확정서 링크 · 알림톡 일괄 발송 셋업 가이드

대시보드 **⑦ 확정서 생성**의 "링크 생성"과 "알림톡 일괄 발송"을 실제로 켜는 방법.

> ⚠ 이 문서는 예전에 **「버킷을 public 으로 두고 anon 에 insert/update 허용」** 을
> 빠른 시작으로 안내했다. anon 키는 public 저장소(`shared/supabase-config.js`)에
> 원문으로 있으므로, 그대로 두면 **누구나 손님 확정서를 올리고 내려받을 수 있다.**
> 지금은 **private 버킷 + 로그인 사용자 정책 + 서명 링크**로 바뀌었다.
> 아래 내용이 현재 코드 기준이다.

---

## 1. Supabase Storage 버킷 (링크용)

1. Supabase 콘솔 → **Storage** → **New bucket**
   - 이름: `confirm-docs`
   - **Public bucket 을 체크하지 않는다** (private 유지)
2. 정책은 콘솔에서 손으로 만들지 말고 `migrations/12_reservations_auth.sql` 로 건다.
   - `authenticated` 에게만 insert/update/select 를 열고, 역할은 `mt_has_role()` 로 본다.
   - anon 정책은 `migrations/13_lock_anon.sql` 이 닫았다. **다시 열지 말 것.**

- 파일 경로 규칙: `{kind}/{행사번호}.jpg` (예: `confirm/24-0001.jpg`)
- 링크는 **서명 링크(90일 만료)** 다 — `DOC_LINK_TTL` 상수. 공개 URL 이 아니다.
- 업로드·서명 요청 모두 **로그인한 사람의 토큰**으로 나간다(`docAuthHeaders`).
  토큰이 없으면 보내지 않고 오류를 띄운다 — 조용히 anon 으로 흘러가지 않는다.

---

## 2. 알림톡 Edge Function (알리고)

함수 코드: `supabase/functions/send-alimtalk/index.ts`

### 배포
```bash
supabase functions deploy send-alimtalk
```
> `--no-verify-jwt` 를 **붙이지 않는다.** 함수 안에서도 호출자의 토큰을
> `/auth/v1/user` 로 직접 확인한다(`requireUser`). 예전에는 검사가 아예 없어서
> 주소만 알면 누구나 손님에게 알림톡을 쏠 수 있었다.
> `SUPABASE_URL`·`SUPABASE_ANON_KEY` 가 비어 있으면 **통과가 아니라 거절**한다.

### 환경변수(secrets)
```bash
supabase secrets set \
  ALIGO_API_KEY=... \
  ALIGO_USER_ID=... \
  ALIGO_SENDER_KEY=...   # 카카오 채널 발신프로필키 \
  ALIGO_SENDER=025551234 # 발신번호(숫자만) \
  ALIGO_TPL_CONFIRM=...  # 확정서 템플릿코드 \
  ALIGO_TPL_QUOTE=...    # 견적서 템플릿코드(없으면 생략) \
  ALIGO_TPL_ITINERARY=... # 일정표 템플릿코드(없으면 생략) \
  ALIGO_TEST_MODE=N
```

### 카카오 템플릿 (필수, 사전 승인 며칠 소요)
- 알리고/카카오 비즈메시지에서 **확정서 안내 템플릿**을 등록·승인받아야 한다.
- 승인된 템플릿 본문과 함수의 `buildMessage()` 문구가 **글자 단위로 일치**해야 발송된다. 템플릿을 바꾸면 `index.ts`의 `buildMessage()`도 같이 수정.
- 변수: 고객명·행사번호·출발일·상품·링크. 링크는 **웹링크 버튼**으로 들어간다.
- 승인 전이라도 함수는 `failover(SMS/LMS)`로 대체발송하도록 되어 있다.

---

## 3. 접속 설정 — 입력할 칸이 없다

예전에는 ⑦ 확정서 → 🔗 연동 설정에서 URL·키·버킷·알림톡 주소를 **PC 마다** 넣었다
(`mt_doc_cfg`). 그 칸은 없앴다. 안 채운 PC 는 링크가 안 열리는 것으로 끝나지 않고,
`analyze()` 끝의 자동 동기화가 **조용히 건너뛰어져 D-7 알림톡이 낡은 자료로 나갔다.**

지금은 전부 코드에 있다:

| 항목 | 출처 |
|---|---|
| Supabase URL · anon key | `shared/supabase-config.js` |
| Storage 버킷명 | `DOC_CFG.bucket` = `confirm-docs` |
| 알림톡 Edge Function URL | `MT_SB.URL + '/functions/v1/send-alimtalk'` |
| 입금계좌 · 문의전화 | `commonMaster.docAcct` (서버 마스터) |

입금계좌·문의전화가 서버 마스터로 간 이유도 같다 — **손님 문서에 찍히는 값**이라
PC 마다 다르면 안 된다. 안 넣은 PC 에서 뽑은 확정서는 계좌가
「별도 안내드립니다」로, 문의 전화는 **빈칸**으로 나갔다.

---

## 동작 요약
1. 대시보드를 열면 등록된 달이 자동으로 합쳐져 분석된다.
2. ⑦에서 보낼 팀 체크 → **선택 링크 생성**(Storage 업로드 → 서명 링크 90일).
3. **알림톡 일괄 발송** → Edge Function이 대표자 번호로 알리고 알림톡 전송(링크 버튼 포함).
4. 개별 건은 행의 **미리보기**에서 JPG 이미지 복사(카톡·메일 Ctrl+V) 또는 링크 복사.
