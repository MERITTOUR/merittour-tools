-- ════════════════════════════════════════════════════════════════
-- 32_app_users_self_policy.sql — app_users 수정 정책의 무한 재귀 제거 + 발급 순서 보정  (멱등 · 비파괴)
-- 선행: 04_user_access.sql · 14_app_user_sections.sql · 15_access_requests.sql · 25_rls_initplan.sql
--
-- 무엇이 잘못됐나
--   14 의 au_update_self WITH CHECK 가 app_users 를 서브쿼리로 다시 읽는다
--   (role = (select u.role from app_users u where u.id = auth.uid()) …). RLS 가 걸린 표의 정책식 안에서
--   같은 표를 읽으면 PostgreSQL 이 정책을 다시 펼치다 「infinite recursion detected in policy for relation
--   app_users」(42P17) 를 낸다. UPDATE 는 허용 정책 전부의 식을 한꺼번에 펼치므로 owner 가 au_write_owner 로
--   들어와도 이 식이 따라붙어 **authenticated 의 app_users UPDATE 가 전부 500** 이었다.
--   2026-09-17 계정 관리 화면의 「승인」·「저장」이 「서버에 연결할 수 없습니다」로 실패한 것이 이것이다
--   (PostgREST 로그: PATCH /app_users → 500 · 42P17). 25 는 auth.uid() 를 (select auth.uid()) 로 감쌌을 뿐
--   같은 식을 그대로 두었고, 16·31 처럼 SQL 로 돌린 UPDATE 는 postgres 역할이라 RLS 를 타지 않아 눈에 띄지 않았다.
--
-- 고치는 법
--   비교 대상(본인 행의 role·active·areas·read_areas)을 SECURITY DEFINER 함수 안에서 읽는다. 함수 안의 SELECT 는
--   정의자 권한이라 RLS 를 타지 않고, SECURITY DEFINER SQL 함수는 인라인되지 않아 정책식이 다시 app_users 를
--   펼치지 않는다. 뜻은 14 그대로 — 본인은 표시명(name)만 바꿀 수 있고 role·active·areas·read_areas 는
--   저장된 값과 같아야 한다.
--
-- 덤 — 신청함 순서
--   15 의 mt_apply_access_request 는 app_users INSERT 때만 신청함의 권한을 입힌다. 콘솔에서 먼저 Invite 하고
--   그다음 [발급함] 을 누르면(2026-09-17 실제 순서) 입힐 것이 없어 air·비활성으로 남았다. access_requests 가
--   invited 로 바뀔 때 이미 계정이 있으면 그 자리에서 입히고 joined 로 넘긴다 — 어느 쪽이 먼저든 결과가 같다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고 execute_sql 로 그대로 돌린다)
--       · 2026-09-17 실행.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 본인 행 비교 함수 (RLS 를 타지 않는다) ────────────────────
create or replace function public.mt_self_unchanged(p_role text, p_active boolean, p_areas text[], p_read_areas text[])
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid()
       and u.role   is not distinct from p_role
       and u.active is not distinct from p_active
       and coalesce(u.areas,      '{}'::text[]) = coalesce(p_areas,      '{}'::text[])
       and coalesce(u.read_areas, '{}'::text[]) = coalesce(p_read_areas, '{}'::text[])
  );
$$;

revoke execute on function public.mt_self_unchanged(text, boolean, text[], text[]) from public, anon;
grant  execute on function public.mt_self_unchanged(text, boolean, text[], text[]) to authenticated;

-- ── 2) 정책 다시 만들기 ──────────────────────────────────────────
drop policy if exists au_update_self on public.app_users;
create policy au_update_self on public.app_users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and public.mt_self_unchanged(role, active, areas, read_areas));

-- ── 3) [발급함] 이 Invite 뒤에 눌려도 권한이 입혀지게 ──────────────
create or replace function public.mt_apply_access_request_on_invite()
  returns trigger language plpgsql security definer set search_path = public as $$
  declare uid uuid;
  begin
    if new.status <> 'invited' or new.grant_role is null then return new; end if;

    select id into uid from public.app_users
     where lower(email) = lower(new.email)
     order by created_at desc limit 1;
    if uid is null then return new; end if;        -- 아직 계정이 없다 → 15 의 INSERT 트리거가 맡는다

    update public.app_users
       set role       = new.grant_role,
           areas      = coalesce(new.grant_areas,      '{}'::text[]),
           read_areas = coalesce(new.grant_read_areas, '{}'::text[]),
           name       = coalesce(nullif(btrim(new.name), ''), name),
           active     = true                        -- owner 가 이미 판단했다. 두 번 묻지 않는다.
     where id = uid;

    new.status     := 'joined';
    new.applied_at := now();
    return new;
  end;
$$;

-- 트리거 함수는 아무도 RPC 로 부르지 못하게(24 와 같은 규칙) — 트리거로만 돈다.
revoke execute on function public.mt_apply_access_request_on_invite() from public, anon, authenticated;

drop trigger if exists trg_access_requests_apply_on_invite on public.access_requests;
create trigger trg_access_requests_apply_on_invite
  before update on public.access_requests
  for each row execute function public.mt_apply_access_request_on_invite();
