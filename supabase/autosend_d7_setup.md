# 출발 D-7 항공/PNR 알림톡 자동발송 셋업

아무도 사이트를 켜지 않아도, 매일 서버가 **출발 7일 전(D-7)** 팀을 찾아 항공/PNR 알림톡을
자동 발송한다. 중복발송은 `notice_sent` 기록으로 막는다.

전체 그림: **대시보드 [동기화] → Supabase DB → 매일 cron → 알리고 발송**

---

## 1. DB 테이블 만들기
Supabase 콘솔 → SQL Editor → `supabase/reservations_setup.sql` 실행.
- `reservations` (예약 데이터, anon 업서트 허용)
- `notice_sent` (발송 로그, 서버 전용)

## 2. 대시보드에서 데이터 올리기
⑦ 확정서 생성 → 🔗 연동 설정 → **[↻ Supabase 동기화]**
- 분석된 **확정·정산** 팀이 `reservations` 에 upsert 된다.
- 출발일·연락처·출발편/귀국편·PNR·여정이 함께 올라간다(자동발송이 이 값을 사용).
- 새 예약/변경이 생기면 다시 눌러 최신화. (※ 자동 동기화 아님 — 버튼 방식)

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
> `CRON_SECRET` 은 cron 외 호출을 막는 용도(아래 스케줄 헤더와 동일하게).

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
