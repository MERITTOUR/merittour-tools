-- ════════════════════════════════════════════════════════════════
-- 01_user_access.sql — 사용자·역할 + 접근 헬퍼  (신규 · 멱등 · 비파괴)
--
-- 05_data_registry.sql · 06_special_cases.sql 이 이 파일의 헬퍼
-- (mt_has_role / mt_is_admin / mt_is_active)를 전제로 한다. 이 파일을 먼저 실행할 것.
--
-- 역할 5단계
--   owner   슈퍼 마스터 — 계정 발급·역할 변경·삭제. 모든 권한을 자동으로 가진다
--   admin   관리자      — 리조트 마스터 저장, 등록소 삭제, 전 계정 조회
--   manage  관리        — 등록소 등록·수정
--   sales   영업        — 등록소 등록·수정
--   air     항공        — 읽기 전용
--
-- 실행 순서: 01 → 05 → 06 → 07
-- 재실행해도 안전하다(if not exists / create or replace / drop policy if exists).
-- ════════════════════════════════════════════════════════════════

-- ── 1) 사용자 테이블 ─────────────────────────────────────────────
create table if not exists public.app_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text,                                   -- 화면 표시명(등록자 이름 등)
  role       text not null default 'air'
             check (role in ('owner','admin','manage','sales','air')),
  active     boolean not null default false,         -- 승인제: owner 가 켜 줘야 쓸 수 있다
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_users is
  '도구함 사용자와 역할. auth.users 가입 시 air/비활성으로 자동 생성되고 owner 가 승인·승급한다.';

create index if not exists app_users_role_idx on public.app_users (role) where active;

-- ── 2) 접근 헬퍼 ────────────────────────────────────────────────
-- security definer 로 만든다. 정책 안에서 app_users 를 읽는데, 호출자 권한으로 읽으면
-- app_users 의 RLS 를 다시 타면서 무한 재귀가 난다.

create or replace function public.mt_role()
  returns text
  language sql stable security definer set search_path = public as $$
  select u.role from public.app_users u where u.id = auth.uid() and u.active;
$$;

create or replace function public.mt_is_active()
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users u where u.id = auth.uid() and u.active);
$$;

-- owner 는 어떤 역할을 물어봐도 참이다. 권한을 하나씩 더해 주다 빠뜨리는 사고를 막는다.
create or replace function public.mt_has_role(roles text[])
  returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(public.mt_role() = 'owner' or public.mt_role() = any(roles), false);
$$;

create or replace function public.mt_is_admin()
  returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(public.mt_role() in ('owner','admin'), false);
$$;

create or replace function public.mt_is_owner()
  returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(public.mt_role() = 'owner', false);
$$;

-- ── 3) 가입 시 자동 등록 (air · 비활성) ──────────────────────────
create or replace function public.mt_on_auth_user_created()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    insert into public.app_users (id, email, name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
    on conflict (id) do nothing;
    return new;
  end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.mt_on_auth_user_created();

-- ── 4) updated_at 자동 갱신 ─────────────────────────────────────
-- mt_touch_updated_at 은 05 에서도 만든다(create or replace 라 순서 무관).
create or replace function public.mt_touch_updated_at()
  returns trigger language plpgsql set search_path = public as $$
  begin
    new.updated_at = now();
    return new;
  end;
$$;

drop trigger if exists trg_app_users_touch on public.app_users;
create trigger trg_app_users_touch before update on public.app_users
  for each row execute function public.mt_touch_updated_at();

-- ── 5) RLS ──────────────────────────────────────────────────────
alter table public.app_users enable row level security;

-- 본인 행은 언제나 읽을 수 있다(로그인 직후 내 역할을 알아야 화면을 그린다).
drop policy if exists au_select_self on public.app_users;
create policy au_select_self on public.app_users
  for select to authenticated
  using (id = auth.uid());

-- owner/admin 은 전체 조회 (계정 목록 화면)
drop policy if exists au_select_admin on public.app_users;
create policy au_select_admin on public.app_users
  for select to authenticated
  using (public.mt_is_admin());

-- 본인 표시명만 수정 가능. 역할·활성은 아래 owner 정책으로만 바뀐다.
drop policy if exists au_update_self on public.app_users;
create policy au_update_self on public.app_users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid()
              and role   = (select u.role   from public.app_users u where u.id = auth.uid())
              and active = (select u.active from public.app_users u where u.id = auth.uid()));

-- 계정 승인·역할 변경·삭제는 owner 만
drop policy if exists au_write_owner on public.app_users;
create policy au_write_owner on public.app_users
  for update to authenticated
  using (public.mt_is_owner()) with check (public.mt_is_owner());

drop policy if exists au_insert_owner on public.app_users;
create policy au_insert_owner on public.app_users
  for insert to authenticated
  with check (public.mt_is_owner());

drop policy if exists au_delete_owner on public.app_users;
create policy au_delete_owner on public.app_users
  for delete to authenticated
  using (public.mt_is_owner());

-- ── 6) 테이블 권한 ──────────────────────────────────────────────
revoke all on public.app_users from anon;
grant select, insert, update, delete on public.app_users to authenticated;

grant execute on function public.mt_role(), public.mt_is_active(),
                          public.mt_has_role(text[]), public.mt_is_admin(),
                          public.mt_is_owner()
  to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 첫 owner 만들기 (한 번만, 손으로)
--
-- 1) Supabase 콘솔 → Authentication → Users → [Invite user] 로 본인 이메일 초대
-- 2) 초대 메일의 링크로 비밀번호 설정 (이때 app_users 에 air/비활성으로 한 줄 생김)
-- 3) 아래를 SQL Editor 에서 실행 — 이메일만 본인 것으로 바꾼다
--
--    update public.app_users
--       set role = 'owner', active = true, name = '최민창'
--     where email = 'cmc338@naver.com';
--
-- 이후 계정 추가는 콘솔에서 초대 → owner 가 도구함 화면에서 승인·역할 지정.
-- ════════════════════════════════════════════════════════════════
