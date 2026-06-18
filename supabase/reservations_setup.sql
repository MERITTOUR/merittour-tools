-- 자동발송용 예약 데이터 + 발송 로그
-- 대시보드 ⑦ 연동 설정의 [Supabase 동기화] 버튼이 reservations 에 upsert 한다.
-- D-7 자동발송 cron(Edge Function)이 이 데이터를 읽어 발송하고 notice_sent 에 기록한다.

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

alter table public.reservations enable row level security;
alter table public.notice_sent  enable row level security;

-- 대시보드(anon)에서 동기화: reservations 읽기/업서트 허용. (사이트는 비밀번호 게이트로 보호됨)
drop policy if exists "reservations anon read"   on public.reservations;
drop policy if exists "reservations anon insert" on public.reservations;
drop policy if exists "reservations anon update" on public.reservations;
create policy "reservations anon read"   on public.reservations for select to anon using (true);
create policy "reservations anon insert" on public.reservations for insert to anon with check (true);
create policy "reservations anon update" on public.reservations for update to anon using (true) with check (true);

-- RLS 정책과 별개로 테이블 레벨 권한도 필요 (없으면 42501 permission denied)
grant select, insert, update on public.reservations to anon;

-- notice_sent 는 서버(service_role)만 접근(정책 없음 → anon 차단). cron 함수는 service_role 로 동작.
