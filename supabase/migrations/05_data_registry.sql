-- ════════════════════════════════════════════════════════════════
-- 05_data_registry.sql — 엠클릭 등록소(월별 데이터 저장) (신규 · 멱등 · 비파괴)
-- 선행: 01_user_access.sql (mt_has_role/mt_is_admin/mt_is_active 헬퍼)
-- 목적: 대시보드 "밖"(등록 페이지)에서 예약리스트 + 일행별예약을 올리면 출발월(period)
--       단위로 서버에 저장한다. 대시보드는 업로드 대신 이 등록소를 읽어 analyze() 를
--       수행 → 전직원이 같은 데이터를 공유(야마나미식 "등록된 데이터").
-- 성격: 생성/추가만. 기존 테이블/데이터 변경 없음(비파괴).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.data_registry (
  period        text primary key,             -- 출발월 'YYYY-MM' (같은 달 재등록 시 업서트)
  res_json      jsonb not null default '[]'::jsonb,  -- 예약리스트 정규화 배열(파싱 원본)
  ilhaeng_json  jsonb not null default '[]'::jsonb,  -- 일행별예약 정규화 배열(파싱 원본)
  team_count    int   not null default 0,      -- 팀(eventSeq) 수
  pax_count     int   not null default 0,      -- 인원 수
  res_files     int   not null default 0,      -- 병합된 예약리스트 파일 수
  ilhaeng_files int   not null default 0,      -- 병합된 일행별예약 파일 수
  uploaded_by   uuid references auth.users(id) on delete set null,
  uploader_name text,                          -- 등록자 표시명(목록에 노출)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.data_registry is
  '엠클릭 월별 등록소: 대시보드가 읽어 분석하는 전직원 공유 데이터(등록 페이지에서 업서트).';

alter table public.data_registry enable row level security;

-- 조회: 운영진 전원(air 포함) — 대시보드가 읽는다
drop policy if exists dr_select on public.data_registry;
create policy dr_select on public.data_registry
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- 등록/수정(업서트): admin/sales/manage (air 는 읽기 전용)
drop policy if exists dr_insert on public.data_registry;
create policy dr_insert on public.data_registry
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage']));

drop policy if exists dr_update on public.data_registry;
create policy dr_update on public.data_registry
  for update to authenticated
  using (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

-- 삭제: admin 만(오등록 정리용)
drop policy if exists dr_delete on public.data_registry;
create policy dr_delete on public.data_registry
  for delete to authenticated
  using (public.mt_is_admin());

-- 테이블 권한: anon 차단, authenticated 만(행 접근은 위 RLS 로 통제)
revoke all on public.data_registry from anon;
grant select, insert, update, delete on public.data_registry to authenticated;

-- updated_at 자동 갱신 공용 트리거 함수(06 에서도 재사용)
create or replace function public.mt_touch_updated_at()
  returns trigger language plpgsql set search_path = public as $$
  begin
    new.updated_at = now();
    return new;
  end;
$$;

drop trigger if exists trg_dr_touch on public.data_registry;
create trigger trg_dr_touch before update on public.data_registry
  for each row execute function public.mt_touch_updated_at();
