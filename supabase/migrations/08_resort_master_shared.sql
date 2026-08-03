-- ════════════════════════════════════════════════════════════════
-- 08_resort_master_shared.sql — 리조트 마스터 서버 공유 전환
--                               (정책 교체 · 트리거 추가 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql, supabase/resort_master_setup.sql
--
-- 왜 필요한가
--   resort_master_setup.sql 은 로그인·역할이 붙기 전에 쓴 파일이라 정책 대상이
--   전부 anon 이다. shared/store.js 는 예외 없이 로그인 사용자 토큰으로 나가므로
--   PostgREST 안에서 역할이 authenticated 가 되고, anon 정책은 매칭되지 않는다.
--   그대로 배선하면 select 는 0행, PATCH 도 0행이 되는데 saveMaster 는 0행을
--   낙관적 잠금 충돌로 해석해 「그 사이 다른 분이 마스터를 저장했습니다」를 띄운다.
--   권한 문제가 충돌로 위장되면 새로고침만 반복하게 되고 원인에 닿지 못한다.
--
--   또 anon 키는 public 저장소(shared/supabase-config.js)에 원문으로 있다.
--   지금 정책은 using(true)/with check(true) 라 브라우저 없이도 덮어쓸 수 있다.
--
--   updated_at 은 default now() 뿐이라 PATCH 로는 갱신되지 않는다. 대표가 요구한
--   「누가 언제」 중 「언제」가 최초 생성 시각에 굳는다 — 트리거로 서버가 박는다.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 테이블 보장 (새 프로젝트에서도 이 파일 하나로 선다) ─────────
create table if not exists public.resort_master (
  id          smallint primary key default 1,
  data        jsonb       not null default '{}'::jsonb,
  version     bigint      not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint resort_master_single_row check (id = 1)
);

create table if not exists public.resort_master_history (
  id          bigint generated always as identity primary key,
  data        jsonb       not null,
  version     bigint,
  changed_at  timestamptz not null default now(),
  changed_by  text
);

alter table public.resort_master
  add column if not exists updated_by_id uuid references auth.users(id) on delete set null;

alter table public.resort_master_history
  add column if not exists changed_by_id uuid references auth.users(id) on delete set null,
  add column if not exists note          text;

create index if not exists resort_master_history_changed_at_idx
  on public.resort_master_history (changed_at desc);

insert into public.resort_master (id, data, version, updated_by)
values (1, '{}'::jsonb, 1, null)
on conflict (id) do nothing;

comment on table public.resort_master is
  '리조트 마스터 단일 행(id=1). data = { resortMaster:[...], commonMaster:{...} }. '
  'data.resortMaster 가 비어 있으면 아직 시드 전 — 화면은 편집을 잠그고 owner 시드를 기다린다.';

-- ── 2) 표시명 헬퍼 ──────────────────────────────────────────────
-- 클라이언트가 보낸 이름은 믿지 않는다. 게이트 이름은 자유 입력이라 진위가 없다.
create or replace function public.mt_actor_name()
  returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(nullif(u.name, ''), u.email)
    from public.app_users u where u.id = auth.uid();
$$;

grant execute on function public.mt_actor_name() to authenticated;

-- ── 3) 저장 스탬프 (누가·언제를 서버가 박는다) ────────────────────
create or replace function public.mt_rm_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), new.updated_by);
    return new;
  end;
$$;

drop trigger if exists trg_rm_stamp on public.resort_master;
create trigger trg_rm_stamp before insert or update on public.resort_master
  for each row execute function public.mt_rm_stamp();

-- ── 4) 스냅샷 이력 (되돌리기용) ─────────────────────────────────
-- 클라이언트에는 insert 권한을 주지 않는다. 직접 쓸 수 있으면 「내가 안 바꿨다」를
-- 지어낼 수 있어 이력의 존재 이유가 사라진다. 오직 이 트리거만 쓴다.
create or replace function public.mt_rm_archive()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if tg_op = 'UPDATE' and new.data is not distinct from old.data then
      return null;                                  -- 값이 그대로면 남기지 않는다
    end if;

    insert into public.resort_master_history (data, version, changed_by, changed_by_id)
    values (new.data, new.version, new.updated_by, new.updated_by_id);

    -- 스냅샷은 되돌리기용이라 최근 것이 중요하다. 항목 단위 「누가 무엇을」은
    -- mt_change_log 가 영구 보관하므로 여기서는 최근 500벌만 남긴다.
    delete from public.resort_master_history
     where id in (select id from public.resort_master_history order by id desc offset 500);

    return null;
  end;
$$;

drop trigger if exists trg_rm_archive on public.resort_master;
create trigger trg_rm_archive after insert or update on public.resort_master
  for each row execute function public.mt_rm_archive();

-- ── 5) RLS 교체 ─────────────────────────────────────────────────
alter table public.resort_master         enable row level security;
alter table public.resort_master_history enable row level security;

drop policy if exists rm_anon_select  on public.resort_master;
drop policy if exists rm_anon_insert  on public.resort_master;
drop policy if exists rm_anon_update  on public.resort_master;
drop policy if exists rmh_anon_select on public.resort_master_history;
drop policy if exists rmh_anon_insert on public.resort_master_history;

drop policy if exists rm_select on public.resort_master;
drop policy if exists rm_insert on public.resort_master;
drop policy if exists rm_update on public.resort_master;
drop policy if exists rmh_select on public.resort_master_history;

-- 조회: 운영진 전원(air 포함) — 항공 담당도 단가를 봐야 견적을 읽는다
create policy rm_select on public.resort_master
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- 저장: admin/manage/sales. 영업을 빼면 안 된다 — 「숙소 미등록」 별칭 연결과
-- 기간 예외는 블록 현황 표 안에서 영업이 매일 해소한다. 막으면 버튼은 보이는데
-- 저장만 조용히 0행이 된다.
create policy rm_update on public.resort_master
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

-- 단일 행이라 평소엔 쓰지 않는다. 행이 사라졌을 때 복구용.
create policy rm_insert on public.resort_master
  for insert to authenticated
  with check (public.mt_is_admin());

-- 삭제 정책은 만들지 않는다.

-- 이력: 읽기만. insert/update/delete 정책 없음(트리거가 유일한 작성자)
create policy rmh_select on public.resort_master_history
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- ── 6) 테이블 권한 ──────────────────────────────────────────────
revoke all on public.resort_master         from anon;
revoke all on public.resort_master_history from anon;

do $$
begin
  execute 'revoke all on sequence public.resort_master_history_id_seq from anon';
exception when undefined_table then null;
end $$;

grant select, insert, update on public.resort_master         to authenticated;
grant select                 on public.resort_master_history to authenticated;
