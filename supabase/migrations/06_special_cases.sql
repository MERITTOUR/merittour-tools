-- ════════════════════════════════════════════════════════════════
-- 06_special_cases.sql — 특이사항(항공·보험 등) 전직원 공유 관리 (신규 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql, 05_data_registry.sql(mt_touch_updated_at 재사용)
-- 목적: 정상 예약 흐름 밖에서 생기는 특이사항(사고·보험요청·항공 변경 등)을 전직원이
--       공유·관리한다. 등록 예약(event_no)에 느슨하게 연결 → 대시보드에서 역표시(배지).
-- 개인정보 원칙: 주민등록번호 뒷자리 저장 금지. 생년월일(6자리) + 성별(남/여)만 보관.
--               증권번호 등 원본은 공유폴더 위치를 ref_note 에 텍스트로 남긴다.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.special_cases (
  id              uuid primary key default gen_random_uuid(),
  category        text not null default '기타'
                  check (category in ('항공','보험','기타')),
  status          text not null default '진행중'
                  check (status in ('미해결','진행중','완료')),
  event_no        text,                     -- 연결 행사/예약번호(없으면 독립 건)
  customer_name   text,
  customer_birth  text,                     -- 생년월일 6자리 'YYMMDD' (주민 뒷자리 미저장)
  customer_gender text check (customer_gender in ('남','여')),  -- 성별만(뒷자리 첫 숫자 파생)
  customer_phone  text,
  title           text not null,            -- 한 줄 요약
  body            text,                     -- 본문(자유 기술)
  follow_up       text,                     -- 후속조치/알림(담당이 볼 액션)
  ref_note        text,                     -- 참조(증권번호·공유폴더 위치 등)
  assignee        text,                     -- 담당
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.special_cases is
  '특이사항 공유 관리(항공/보험/기타). 예약(event_no)에 느슨 연결. 주민 뒷자리 미저장.';

create index if not exists idx_sc_event  on public.special_cases (event_no);
create index if not exists idx_sc_status on public.special_cases (status);
create index if not exists idx_sc_cat    on public.special_cases (category);

alter table public.special_cases enable row level security;

-- 조회: 운영진 전원(공유가 목적)
drop policy if exists sc_select on public.special_cases;
create policy sc_select on public.special_cases
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- 등록: 활성 운영진 전원(누구나 특이사항 기록 가능)
drop policy if exists sc_insert on public.special_cases;
create policy sc_insert on public.special_cases
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','air','manage']));

-- 수정: 활성 운영진 전원(협업 갱신). 필요 시 작성자/담당 제한으로 좁힐 수 있음.
drop policy if exists sc_update on public.special_cases;
create policy sc_update on public.special_cases
  for update to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']))
  with check (public.mt_has_role(array['admin','sales','air','manage']));

-- 삭제: admin 만
drop policy if exists sc_delete on public.special_cases;
create policy sc_delete on public.special_cases
  for delete to authenticated
  using (public.mt_is_admin());

revoke all on public.special_cases from anon;
grant select, insert, update, delete on public.special_cases to authenticated;

-- updated_at 자동 갱신(05 에서 만든 공용 함수 재사용)
drop trigger if exists trg_sc_touch on public.special_cases;
create trigger trg_sc_touch before update on public.special_cases
  for each row execute function public.mt_touch_updated_at();
