-- ════════════════════════════════════════════════════════════════
-- 16_sections_for_all.sql — 섹션 권한을 owner·admin 에게도 적용  (멱등 · 비파괴)
--
-- 14 는 owner·admin 을 목록과 무관하게 통과시켰다. 「권한을 하나씩 더해 주다
-- 빠뜨리는 사고를 막는다」는 뜻이었지만, 그 바람에 **마스터 계정은 섹션을
-- 정할 수가 없었다** — 계정 관리 화면에서 자기 칸이 잠겨 보였다.
--
-- 이제 섹션은 **모두에게 똑같이** 적용된다. 역할은 기본값만 정하고,
-- 다 열고 싶으면 다 체크한다.
--
-- 잠길 걱정은 없다 — admin/ 과 admin/users/ 는 섹션이 아니라 **역할**로 열린다
-- (guard.js 에 data-section 이 없다). 전부 꺼도 계정 관리 화면에는 들어가서
-- 다시 켤 수 있다. 이 성질이 깨지면 마스터가 자기 손으로 잠긴다 —
-- admin 쪽 화면에 data-section 을 붙이지 말 것.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       14 다음이면 언제 실행해도 된다. 재실행해도 안전하다.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 먼저 채우고 나서 규칙을 바꾼다 ───────────────────────────
-- 순서가 중요하다. 함수를 먼저 바꾸면 채우기 전까지 owner 도 모든 섹션에서
-- 막힌다. 지금 비어 있는 owner·admin 에게 전 섹션을 넣어 준 뒤에 바꾼다.
update public.app_users
   set areas = array['sales','manage','air','dashboard','booking','register',
                     'inquiry','insurance','library','imgtoolkit','weather']
 where role in ('owner','admin') and areas = '{}' and read_areas = '{}';

-- ── 2) 우회 없는 판정 ───────────────────────────────────────────
-- 14 의 네 함수에서 `u.role in ('owner','admin') or` 만 걷어낸다.
-- 나머지(active 확인, 쓰기는 읽기를 포함)는 그대로다.
create or replace function public.mt_has_area(p_area text)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active and p_area = any(u.areas)
  );
$$;

create or replace function public.mt_can_read_area(p_area text)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active and p_area = any(u.areas || u.read_areas)
  );
$$;

create or replace function public.mt_has_any_area(p_areas text[])
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active and u.areas && p_areas
  );
$$;

create or replace function public.mt_can_read_any_area(p_areas text[])
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active and (u.areas || u.read_areas) && p_areas
  );
$$;

-- ※ mt_is_admin() · mt_is_owner() · mt_has_role() 은 건드리지 않는다.
--   계정 관리·마스터 저장 같은 **역할** 판정은 그대로여야 한다.
--   섹션을 다 꺼도 계정 관리에 들어갈 수 있는 것이 이 함수들 덕분이다.

-- ── 3) 확인 ─────────────────────────────────────────────────────
-- select email, role, active, array_length(areas,1) as 쓰기, array_length(read_areas,1) as 읽기
--   from public.app_users order by role, email;
