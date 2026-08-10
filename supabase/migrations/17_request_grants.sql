-- ════════════════════════════════════════════════════════════════
-- 17_request_grants.sql — 초대할 때 권한을 미리 정해 둔다  (멱등 · 비파괴)
--
-- 지금까지의 순서
--   신청 → owner 가 초대 → 본인이 비밀번호 설정(air·비활성으로 생성)
--        → **그제서야** owner 가 다시 들어와 역할·섹션을 정하고 승인
--
-- 순서가 뒤집혀 있다. owner 가 두 번 손을 대야 하고, 그 사이에는 로그인은
-- 되는데 아무것도 못 여는 계정이 떠 있다. 본인은 왜 안 되는지 모른다.
--
-- 바꾼 순서
--   신청 → owner 가 **역할·섹션을 정하면서** 초대
--        → 본인이 비밀번호 설정 → 정해 둔 권한이 그대로 입혀지고 바로 쓸 수 있다
--
-- owner 가 권한을 안 정하고 초대만 했다면 예전대로 air·비활성으로 남는다
-- (그때는 계정 관리에서 승인하면 된다). 정해 둔 것이 있을 때만 자동으로 연다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
-- ════════════════════════════════════════════════════════════════

-- ── 1) 신청함에 「정해 둔 권한」 칸 ──────────────────────────────
alter table public.access_requests
  add column if not exists grant_role       text,
  add column if not exists grant_areas      text[] not null default '{}',
  add column if not exists grant_read_areas text[] not null default '{}',
  add column if not exists applied_at       timestamptz;

comment on column public.access_requests.grant_role is
  '초대할 때 정해 둔 역할. 비워 두면 예전처럼 air·비활성으로 생성된다.';
comment on column public.access_requests.applied_at is
  '가입이 끝나 권한이 실제로 입혀진 시각.';

do $$ begin
  alter table public.access_requests
    add constraint access_requests_grant_role_check
    check (grant_role is null or grant_role in ('owner','admin','manage','sales','air'));
exception when duplicate_object then null; end $$;

-- 가입까지 끝난 신청은 목록에서 빠져야 한다. status 에 joined 를 더한다.
alter table public.access_requests drop constraint if exists access_requests_status_check;
alter table public.access_requests
  add constraint access_requests_status_check
  check (status in ('pending','invited','rejected','joined'));

-- ── 2) 가입하는 순간 정해 둔 권한을 입힌다 ──────────────────────
-- 04 의 mt_on_auth_user_created 가 app_users 에 줄을 넣은 **뒤에** 돈다.
-- 04 를 고치지 않는 이유 — 그 트리거는 auth.users 에 걸려 있고, 여기서 하려는
-- 일은 app_users 가 이미 있어야 가능하다. 따로 두는 편이 순서가 분명하다.
create or replace function public.mt_apply_access_request()
  returns trigger language plpgsql security definer set search_path = public as $$
  declare r public.access_requests%rowtype;
  begin
    select * into r
      from public.access_requests
     where lower(email) = lower(new.email)
       and status = 'invited'
     order by created_at desc
     limit 1;

    if not found or r.grant_role is null then
      return new;               -- 정해 둔 것이 없으면 예전대로 air·비활성
    end if;

    update public.app_users
       set role       = r.grant_role,
           areas      = r.grant_areas,
           read_areas = r.grant_read_areas,
           -- 신청서에 적어 낸 이름을 쓴다. 이메일 아이디보다 낫다.
           name       = coalesce(nullif(btrim(r.name), ''), name),
           active     = true    -- owner 가 이미 판단했다. 두 번 묻지 않는다.
     where id = new.id;

    update public.access_requests
       set status = 'joined', applied_at = now()
     where id = r.id;

    return new;
  end;
$$;

drop trigger if exists trg_app_users_apply_request on public.app_users;
create trigger trg_app_users_apply_request
  after insert on public.app_users
  for each row execute function public.mt_apply_access_request();

-- ── 3) 확인 ─────────────────────────────────────────────────────
-- select email, name, dept, status, grant_role,
--        array_length(grant_areas,1) as 쓰기, applied_at
--   from public.access_requests order by created_at desc;
