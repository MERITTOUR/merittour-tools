-- 출발 D-7 항공/PNR 알림톡 자동발송 스케줄 (pg_cron + pg_net)
-- 사전: cron-d7-alimtalk Edge Function 배포 + ALIGO_* / ALIGO_TPL_PNR / CRON_SECRET 시크릿 설정.
-- <프로젝트>, <CRON_SECRET> 를 실제 값으로 교체할 것.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 매일 00:00 UTC = 09:00 KST 실행
select cron.schedule(
  'd7-alimtalk-daily',
  '0 0 * * *',
  $$
  select net.http_post(
    url     := 'https://<프로젝트>.supabase.co/functions/v1/cron-d7-alimtalk',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- 확인:  select * from cron.job;
-- 해제:  select cron.unschedule('d7-alimtalk-daily');
