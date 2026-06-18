# 확정서 링크 · 알림톡 일괄 발송 셋업 가이드

대시보드 **⑦ 확정서 생성**의 "링크 생성"과 "알림톡 일괄 발송"을 실제로 켜는 방법.
프론트(대시보드)는 이미 완성되어 있고, 아래 백엔드만 연결하면 동작한다.

---

## 1. Supabase Storage 버킷 (링크용)

1. Supabase 콘솔 → **Storage** → **New bucket**
   - 이름: `confirm-docs`
   - **Public bucket** 체크 (공개 링크로 열리게)
2. 업로드 권한: 대시보드는 anon key로 `POST`(upsert) 한다. 버킷 정책(RLS)에서 anon 의 `insert`/`update`/`select`를 허용하거나, 운영 정책에 맞게 조정한다.
   - 빠른 시작: 버킷을 public 으로 두고 Storage 정책에서 `confirm-docs` 의 insert/update 를 anon 에 허용.

파일 경로 규칙: `{kind}/{행사번호}.html` (예: `confirm/24-0001.html`)
공개 URL: `https://<프로젝트>.supabase.co/storage/v1/object/public/confirm-docs/confirm/24-0001.html`

---

## 2. 알림톡 Edge Function (알리고)

함수 코드: `supabase/functions/send-alimtalk/index.ts`

### 배포
```bash
supabase functions deploy send-alimtalk --no-verify-jwt
```
> 대시보드(정적 페이지)에서 직접 호출하므로 `--no-verify-jwt`. 공개 노출이 부담되면
> 함수 안에서 별도 공유 토큰을 검사하도록 보강할 것.

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

## 3. 대시보드 연동 설정

⑦ 확정서 생성 → **🔗 연동 설정** 펼치고 입력(이 PC에 저장됨):

| 항목 | 값 |
|---|---|
| Supabase URL | `https://<프로젝트>.supabase.co` |
| Supabase anon key | 프로젝트 anon public key |
| Storage 버킷명 | `confirm-docs` |
| 알림톡 Edge Function URL | `https://<프로젝트>.supabase.co/functions/v1/send-alimtalk` |

- Supabase URL·anon key만 넣으면 **링크 생성**이 켜진다.
- Edge Function URL까지 넣으면 **알림톡 일괄 발송**이 사이트에서 바로 동작한다.
- Edge Function URL을 비워두면, 일괄 발송 버튼은 **알리고 일괄발송 엑셀**(`confirm_aligo_*.xlsx`)을 내보내 콘솔 업로드로 대체한다.

---

## 동작 요약
1. 직원이 엠클릭 파일 업로드 → 분석.
2. ⑦에서 보낼 팀 체크 → **선택 링크 생성**(Storage 업로드 → 공개 URL).
3. **알림톡 일괄 발송** → Edge Function이 대표자 번호로 알리고 알림톡 전송(링크 버튼 포함).
4. 개별 건은 행의 **미리보기**에서 JPG 이미지 복사(카톡·메일 Ctrl+V) 또는 링크 복사.
