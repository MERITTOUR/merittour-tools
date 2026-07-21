-- ════════════════════════════════════════════════════════════════
-- 01_user_access.sql — 사용자 권한 테이블 + 역할 헬퍼 (신규 · 멱등 · 비파괴)
-- 기준 브랜치: claude/security-hardening
-- 실행: Supabase SQL Editor에서 01→02→03→04 순서로 수동 실행.
--       운영 적용 전 docs/security/DEPLOYMENT_CHECKLIST.md 확인.
-- 성격: 생성/추가만. 기존 테이블/데이터 변경 없음(비파괴).
-- ════════════════════════════════════════════════════════════════

-- 1) 권한 테이블 : auth.users 와 1:1. 자가가입 OFF(초대는 Supabase Auth Admin에서),
--    이 테이블에 행이 있고 active=true 여야 실제 접근 허용.
create table if not exists public.user_access (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  name        text,
  role        text not null default 'sales'
              check (role in ('admin','sales','air','manage')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) 역할 헬퍼 (security definer + search_path 고정 + execute 최소화)
--    definer 이므로 RLS 를 우회하여 호출자 본인의 역할만 안전하게 반환 → 정책에서 재귀 없이 사용.
create or replace function public.mt_role()
  returns text language sql stable security definer set search_path = public as $$
  select role from public.user_access where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.mt_is_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.user_access
                   where user_id = auth.uid() and active), false);
$$;

create or replace function public.mt_has_role(roles text[])
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = any(roles) from public.user_access
                   where user_id = auth.uid() and active), false);
$$;

create or replace function public.mt_is_active()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.user_access
                   where user_id = auth.uid()), false);
$$;

-- 함수 실행 권한 최소화: anon/public 회수, authenticated 에만 부여
revoke execute on function public.mt_role()            from public, anon;
revoke execute on function public.mt_is_admin()        from public, anon;
revoke execute on function public.mt_has_role(text[])  from public, anon;
revoke execute on function public.mt_is_active()       from public, anon;
grant  execute on function public.mt_role()            to authenticated;
grant  execute on function public.mt_is_admin()        to authenticated;
grant  execute on function public.mt_has_role(text[])  to authenticated;
grant  execute on function public.mt_is_active()       to authenticated;

-- 3) RLS
alter table public.user_access enable row level security;

-- 본인 행 조회 / admin 전체 조회
drop policy if exists ua_select on public.user_access;
create policy ua_select on public.user_access
  for select to authenticated
  using (user_id = auth.uid() or public.mt_is_admin());

-- 초대/역할변경/비활성화 = admin 만 (insert/update/delete)
drop policy if exists ua_admin_write on public.user_access;
create policy ua_admin_write on public.user_access
  for all to authenticated
  using (public.mt_is_admin())
  with check (public.mt_is_admin());

-- 4) 테이블 권한 : anon 차단, authenticated 만 (행 접근은 위 RLS 로 통제)
revoke all on public.user_access from anon;
grant  select, insert, update, delete on public.user_access to authenticated;

-- ⚠ 최초 admin 지정(수동, 별도 실행 권장):
--   Supabase Auth 에서 관리자 계정 초대 → 그 user_id 로 아래 1회 실행.
--   (자동 실행하지 말 것 — 실제 uuid/email 확인 후 운영자가 직접)
-- insert into public.user_access (user_id, email, name, role, active)
-- values ('<AUTH_USER_UUID>', '<admin@merittour.co.kr>', '관리자', 'admin', true)
-- on conflict (user_id) do update set role='admin', active=true, updated_at=now();
