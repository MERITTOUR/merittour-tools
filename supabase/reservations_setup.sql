-- ════════════════════════════════════════════════════════════════
-- reservations_setup.sql — 표만 만든다 (정책·권한은 여기 없다)
--
-- ⚠ 예전에는 이 파일이 anon 에게 reservations 를 using(true) 로 열었다.
--   anon 키는 public 저장소(shared/supabase-config.js)에 원문으로 있으므로,
--   그 정책이 살아 있으면 브라우저 없이도 손님 예약을 읽고 쓸 수 있다.
--   12_reservations_auth.sql 이 로그인 사용자에게 열고,
--   13_lock_anon.sql 이 anon 을 닫았다 — 그 부분을 여기서 지웠다.
--   이 파일을 다시 돌려도 그 둘이 되돌려지지 않게 하기 위해서다.
--
-- 정책·권한을 고칠 일이 있으면 migrations/12·13 을 고칠 것.
-- ════════════════════════════════════════════════════════════════

-- 자동발송용 예약 데이터 + 발송 로그
-- 대시보드 ⑦ 확정서의 [↻ 지금 동기화]가 reservations 에 upsert 한다(로그인 토큰으로).
-- D-7 자동발송 cron(Edge Function)이 service_role 로 이 데이터를 읽어 발송하고
-- notice_sent 에 기록한다.

create table if not exists public.reservations (
  event_seq  text primary key,
  event_no   text,
  rep_name   text,
  rep_phone  text,
  status     text,
  dep        date,
  arr        date,
  prod_name  text,
  origin     text,
  dest       text,
  dep_flight text,
  ret_flight text,
  pnr        text,
  pax        int,
  updated_at timestamptz default now()
);

create table if not exists public.notice_sent (
  event_seq   text,
  notice_type text,                 -- 예: 'd7_pnr'
  sent_at     timestamptz default now(),
  result      jsonb,
  primary key (event_seq, notice_type)
);

-- RLS 는 반드시 켜 둔다. Supabase 는 public 스키마 신규 표에 anon·authenticated
-- grant 를 기본으로 주기 때문에, RLS 가 꺼져 있으면 정책이 없어도 통째로 열린다.
alter table public.reservations enable row level security;
alter table public.notice_sent  enable row level security;

-- notice_sent 는 정책을 만들지 않는다 → service_role 만 접근(cron 함수). 정상이다.
