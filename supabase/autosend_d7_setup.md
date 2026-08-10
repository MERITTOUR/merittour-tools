# 출발 D-7 항공/PNR 알림톡 자동발송 셋업

아무도 사이트를 켜지 않아도, 매일 서버가 **출발 7일 전(D-7)** 팀을 찾아 항공/PNR 알림톡을
자동 발송한다. 중복발송은 `notice_sent` 기록으로 막는다.

전체 그림: **대시보드 [동기화] → Supabase DB → 매일 cron → 알리고 발송**

---

## 1. DB 테이블 만들기
Supabase 콘솔 → SQL Editor → `supabase/reservations_setup.sql` 실행(표만 만든다).
- `reservations` (예약 데이터)
- `notice_sent` (발송 로그, 서버 전용 — 정책 없음 → service_role 만)

정책·권한은 `migrations/12_reservations_auth.sql`(로그인 사용자에게 열기) →
동작 확인 → `migrations/13_lock_anon.sql`(anon 닫기) 순서로 건다.
**순서를 뒤집으면 아래 2번 동기화가 조용히 멎어 D-7 알림톡이 낡은 자료로 나간다.**

## 2. 대시보드에서 데이터 올리기
자료를 불러오면 `analyze()` 끝에서 **자동으로** 동기화된다.
손으로 확인·재시도하려면 ⑦ 확정서 생성 → **[↻ 지금 동기화]**.
- 분석된 **확정·정산** 팀이 `reservations` 에 upsert 된다(로그인한 사람의 토큰으로).
- 출발일·연락처·출발편/귀국편·PNR·여정이 함께 올라간다(자동발송이 이 값을 사용).
- 성공하면 「N팀 동기화됨」, 실패하면 **빨간 「동기화 실패」** 가 뜬다.
  자동 실행일 때도 삼키지 않는다 — 예전에는 조용히 건너뛰어 아무도 몰랐다.

## 3. cron Edge Function 배포
```bash
supabase functions deploy cron-d7-alimtalk --no-verify-jwt
supabase secrets set \
  ALIGO_API_KEY=... ALIGO_USER_ID=... ALIGO_SENDER_KEY=... \
  ALIGO_SENDER=0212345678 \
  ALIGO_TPL_PNR=PNR템플릿코드 \
  CRON_SECRET=아무비밀문자열 \
  ALIGO_TEST_MODE=N
```
> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Edge Function에 기본 제공된다.
> 이 함수는 pg_cron 이 JWT 없이 부르므로 `--no-verify-jwt` 가 맞다. 대신
> **`CRON_SECRET` 이 필수다.**
>
> ⚠ 예전 코드는 `if (secret && …)` 라 **시크릿을 안 넣으면 검사를 통째로 건너뛰었다** —
> 주소만 알면 누구나 전 고객에게 D-7 알림톡을 쏠 수 있었다. 지금은 시크릿이 없으면
> 500 으로 막는다. 즉 **안 넣으면 자동발송이 아예 안 나간다.**

## 4. 매일 스케줄 등록
SQL Editor → `supabase/cron_d7_schedule.sql` 에서 `<프로젝트>`·`<CRON_SECRET>` 교체 후 실행.
- 매일 00:00 UTC(=09:00 KST)에 함수 호출.
- 확인: `select * from cron.job;` / 해제: `select cron.unschedule('d7-alimtalk-daily');`

## 5. PNR 템플릿 (카카오 승인 필요)
- 항공/PNR 안내 템플릿 1개(전 항공사 공용, 변수로 처리). 승인 1~2영업일.
- 승인 본문과 `cron-d7-alimtalk/index.ts` 의 `pnrMessage()` 가 **글자 단위로 일치**해야 한다.
- 추천 본문:
  ```
  [메리트투어] #{고객명}님 항공 예약 안내

  · 상품 : #{상품명}
  · 출발/귀국 : #{출발일자} ~ #{도착일자}
  · 여정 : #{출발지} → #{도착지}
  · 출발편 : #{출발편}
  · 귀국편 : #{귀국편}
  · 예약번호(PNR) : #{PNR}

  여권 정보가 정확한지 확인 부탁드립니다.
  ```

---

## 테스트 & 운영 팁
- 배포 직후 수동 호출로 점검(헤더 비밀키 포함):
  ```bash
  curl -X POST 'https://<프로젝트>.supabase.co/functions/v1/cron-d7-alimtalk' \
    -H 'x-cron-secret: <CRON_SECRET>'
  # → {"ok":true,"target":"YYYY-MM-DD","sent":N}
  ```
- `ALIGO_TEST_MODE=Y` 로 먼저 검증(실제 미발송) 후 `N` 으로 전환.
- D-7 정의는 KST 기준. 발송 시각을 바꾸려면 cron 식만 수정(예: `0 1 * * *` = 10:00 KST).
- 연락처(휴대번호 9자리 이상) 없는 팀은 자동 제외된다.
