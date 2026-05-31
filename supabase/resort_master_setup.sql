-- ════════════════════════════════════════════════════════════════
-- MERITTOUR 사내 도구함 — 리조트 마스터 공유 (Supabase)
-- SQL Editor 에 그대로 붙여넣고 [Run] 한 번 실행하세요.
-- 테이블 2개(마스터 본체 + 변경 이력) + RLS 권한을 한 번에 설정합니다.
-- 재실행해도 안전합니다(if not exists / drop policy if exists).
-- ════════════════════════════════════════════════════════════════

-- 1) 마스터 본체 : 항상 id = 1 한 행만 사용
create table if not exists public.resort_master (
  id          smallint primary key default 1,
  data        jsonb       not null default '{}'::jsonb,  -- { resortMaster:[...], commonMaster:{...} }
  version     bigint      not null default 1,            -- 낙관적 잠금용 (저장 시 +1)
  updated_at  timestamptz not null default now(),
  updated_by  text,                                      -- 마지막 수정자(이름)
  constraint resort_master_single_row check (id = 1)     -- 한 행 강제
);

-- 2) 변경 이력 : 저장될 때마다 한 줄씩 누적 (전체 변경 목록 표시용)
create table if not exists public.resort_master_history (
  id          bigint generated always as identity primary key,
  data        jsonb       not null,    -- 저장 직후 스냅샷
  version     bigint,                  -- 그 시점 버전
  changed_at  timestamptz not null default now(),
  changed_by  text                     -- 수정자(이름)
);

-- 조회 속도: 최신 이력부터
create index if not exists resort_master_history_changed_at_idx
  on public.resort_master_history (changed_at desc);

-- 3) 초기 행 1개 보장 (없을 때만 생성)
insert into public.resort_master (id, data, version, updated_by)
values (1, '{}'::jsonb, 1, null)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════
-- 4) RLS : 게이트 통과자(anon)에게 읽기·쓰기 허용
--    publishable 키 = anon 역할. 이 두 테이블에만 정책을 엽니다.
-- ════════════════════════════════════════════════════════════════
alter table public.resort_master         enable row level security;
alter table public.resort_master_history enable row level security;

-- 기존 정책이 있으면 정리(재실행 안전)
drop policy if exists rm_anon_select  on public.resort_master;
drop policy if exists rm_anon_insert  on public.resort_master;
drop policy if exists rm_anon_update  on public.resort_master;
drop policy if exists rmh_anon_select on public.resort_master_history;
drop policy if exists rmh_anon_insert on public.resort_master_history;

-- 마스터 : 읽기 / 쓰기(insert·update) 허용, 삭제는 막음
create policy rm_anon_select on public.resort_master
  for select to anon using (true);
create policy rm_anon_insert on public.resort_master
  for insert to anon with check (true);
create policy rm_anon_update on public.resort_master
  for update to anon using (true) with check (true);

-- 이력 : 읽기 / 추가만 허용 (수정·삭제 불가 → 이력 무결성)
create policy rmh_anon_select on public.resort_master_history
  for select to anon using (true);
create policy rmh_anon_insert on public.resort_master_history
  for insert to anon with check (true);

-- 5) 테이블 권한 (자동 노출을 꺼두셨더라도 동작하도록 명시적 GRANT)
grant select, insert, update on public.resort_master         to anon;
grant select, insert          on public.resort_master_history to anon;
grant usage, select on sequence public.resort_master_history_id_seq to anon;
