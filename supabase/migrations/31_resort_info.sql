-- ════════════════════════════════════════════════════════════════
-- 31_resort_info.sql — 리조트 정보(담당자 입력 시트) 표  (멱등 · 비파괴)
-- 선행: 04_user_access.sql(mt_has_role · mt_is_admin) · 08_resort_master_shared.sql(mt_actor_name) ·
--       14·16(app_users.areas 섹션)
--
-- 왜 필요한가
--   리조트별 상세 정보(담당 직원 · 지정 항공편 · 수하물 · 출국·체류·귀국일 특이사항 · 객실·시설 ·
--   식사 · 요금 · 유의사항)를 구글 시트 한 장에 손으로 적어 왔다. 열이 리조트, 행이 항목인 표라
--   출발지(인천·부산)별 칸이 어긋나고, 누가 언제 고쳤는지도 남지 않았다(2026-09-17 · Min
--   「툴 페이지 안에서 각자 담당자가 직접 입력할 섹션을」). 도구함 「리조트 정보」 화면에서
--   담당자가 직접 입력하고, 리조트마다 한 행(jsonb)으로 저장한다. 누가·언제는 서버가 박고
--   스냅샷 이력을 남긴다.
--
-- 구조
--   resort_info(resort_key pk, data jsonb, version, updated_at, updated_by, updated_by_id)
--   data = { origins:['icn','pus'], items:{ 항목키: '값' | {icn:'',pus:'',tae:''} }, extra:[{label,value}] }
--   resort_key = 리조트 마스터 key(yamanami_golf · ganji · …) 와 '_common'(전 리조트 공통)
--   낙관적 잠금 — version 이 읽은 값과 같을 때만 저장한다(shared/store.js saveResortInfo).
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고
--        execute_sql 로 이 파일 내용을 그대로 돌린다) · 2026-09-17 실행.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 표 ────────────────────────────────────────────────────────
create table if not exists public.resort_info (
  resort_key    text primary key,
  data          jsonb       not null default '{}'::jsonb,
  version       bigint      not null default 1,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  updated_by_id uuid references auth.users(id) on delete set null,
  constraint resort_info_key_shape check (resort_key ~ '^[a-z0-9_]{1,40}$')
);

create table if not exists public.resort_info_history (
  id            bigint generated always as identity primary key,
  resort_key    text        not null,
  data          jsonb       not null,
  version       bigint,
  changed_at    timestamptz not null default now(),
  changed_by    text,
  changed_by_id uuid references auth.users(id) on delete set null
);

create index if not exists resort_info_history_key_idx
  on public.resort_info_history (resort_key, changed_at desc);

comment on table public.resort_info is
  '리조트 정보(담당자 입력 시트). 리조트마다 한 행 · data 는 tools/resortinfo 화면의 ITEMS 키로 된 jsonb · '
  '누가·언제는 트리거가 박는다. 구글 「리조트 정보 시트」를 대체한다(2026-09-17).';

-- ── 2) 저장 스탬프 (08 의 mt_rm_stamp 와 같은 꼴) ─────────────────
create or replace function public.mt_ri_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), new.updated_by);
    return new;
  end;
$$;

drop trigger if exists trg_ri_stamp on public.resort_info;
create trigger trg_ri_stamp before insert or update on public.resort_info
  for each row execute function public.mt_ri_stamp();

-- ── 3) 스냅샷 이력 (트리거만 쓴다 · 리조트마다 최근 100벌) ──────────
create or replace function public.mt_ri_archive()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if tg_op = 'UPDATE' and new.data is not distinct from old.data then
      return null;                                  -- 값이 그대로면 남기지 않는다
    end if;

    insert into public.resort_info_history (resort_key, data, version, changed_by, changed_by_id)
    values (new.resort_key, new.data, new.version, new.updated_by, new.updated_by_id);

    delete from public.resort_info_history
     where resort_key = new.resort_key
       and id in (select id from public.resort_info_history
                   where resort_key = new.resort_key order by id desc offset 100);

    return null;
  end;
$$;

drop trigger if exists trg_ri_archive on public.resort_info;
create trigger trg_ri_archive after insert or update on public.resort_info
  for each row execute function public.mt_ri_archive();

-- ── 4) RLS ───────────────────────────────────────────────────────
alter table public.resort_info         enable row level security;
alter table public.resort_info_history enable row level security;

drop policy if exists ri_select  on public.resort_info;
drop policy if exists ri_insert  on public.resort_info;
drop policy if exists ri_update  on public.resort_info;
drop policy if exists rih_select on public.resort_info_history;

-- 조회·저장: 운영진 전원. air 를 빼지 않는다 — 지정 항공편·수하물 칸은 항공팀이 적는다.
create policy ri_select on public.resort_info
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

create policy ri_insert on public.resort_info
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','air','manage']));

create policy ri_update on public.resort_info
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','air','manage']))
  with check (public.mt_has_role(array['admin','sales','air','manage']));

-- 삭제 정책은 만들지 않는다 — 리조트가 없어져도 행은 두고 화면 목록(RESORTS)에서만 뺀다.

-- 이력: 읽기만. insert/update/delete 정책 없음(트리거가 유일한 작성자)
create policy rih_select on public.resort_info_history
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- ── 5) 테이블 권한 ──────────────────────────────────────────────
revoke all on public.resort_info         from anon;
revoke all on public.resort_info_history from anon;

do $$
begin
  execute 'revoke all on sequence public.resort_info_history_id_seq from anon';
exception when undefined_table then null;
end $$;

grant select, insert, update on public.resort_info         to authenticated;
grant select                 on public.resort_info_history to authenticated;

-- ── 6) 섹션 — 활동 중인 계정 전원에게 「리조트 정보」 화면을 연다 ───
-- 각자 담당 리조트를 직접 적는 화면이라 역할과 무관하게 모두 연다.
-- 이후 새 계정은 shared/access.js 의 역할 기본값(manage·sales·air)에 들어 있다.
update public.app_users
   set areas = array_append(areas, 'resortinfo')
 where active
   and not ('resortinfo' = any(coalesce(areas, '{}'::text[])));
