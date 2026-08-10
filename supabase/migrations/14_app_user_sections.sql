-- ════════════════════════════════════════════════════════════════
-- 14_app_user_sections.sql — 계정별 섹션 권한  (멱등 · 비파괴)
--
-- 지금까지는 역할 5단계만 있었고, 승인된 계정이면 누구나 모든 도구 화면을
-- 열 수 있었다(shared/guard.js 가 로그인 여부와 active 만 봤다). 역할은 화면
-- 안에서 무엇을 저장할 수 있는지에만 영향을 줬다. 그래서 air(항공·읽기 전용)
-- 계정도 tools/booking · tools/dashboard 에 그냥 들어갔다.
--
-- 여기서 계정마다 「어느 섹션을 볼 수 있는지 / 쓸 수 있는지」를 정한다.
--
--   areas       쓰기 허용 섹션. 읽기는 자동으로 포함된다(쓸 수 있으면 볼 수 있다).
--   read_areas  읽기만 허용할 섹션.
--
-- 사이젠 허브(user_access·has_area)의 설계를 옮기되 세 가지를 고쳤다.
--   1) 사이젠은 has_area 가 role in ('admin','manager') 를, has_any_area 가
--      role='admin' 만 통과시켜 **manager 가 함수마다 다르게 취급**된다.
--      여기서는 우회 규칙을 owner·admin 하나로 통일한다.
--   2) 사이젠 is_admin() 은 active 를 보지 않아 **정지된 관리자도 통과**한다.
--      여기 함수는 전부 active 를 확인한다.
--   3) 사이젠 me_access() 는 등록되지 않은 사용자를 staff·active=true 로 돌려준다.
--      메리트투어는 승인제(가입 시 air·비활성)라 그대로 옮기면 승인제가 무력해진다.
--      여기서는 행이 없으면 아무 권한도 주지 않는다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       04_user_access.sql 다음이면 언제 실행해도 된다. 재실행해도 안전하다.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 컬럼 ─────────────────────────────────────────────────────
alter table public.app_users
  add column if not exists areas      text[] not null default '{}',
  add column if not exists read_areas text[] not null default '{}';

comment on column public.app_users.areas is
  '쓰기 허용 섹션 키. 읽기는 자동 포함. owner·admin 은 이 값과 무관하게 전부 통과한다.';
comment on column public.app_users.read_areas is
  '읽기만 허용할 섹션 키. areas 와 겹쳐도 무해하다.';

-- ── 2) 판정 헬퍼 ────────────────────────────────────────────────
-- security definer 로 만든다. 정책 안에서 app_users 를 읽는데 호출자 권한으로
-- 읽으면 app_users 의 RLS 를 다시 타면서 무한 재귀가 난다(04 와 같은 이유).

-- 쓰기 판정. owner·admin 은 항상 통과 — 권한을 하나씩 더해 주다 빠뜨리는 사고를 막는다.
create or replace function public.mt_has_area(p_area text)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active
       and (u.role in ('owner','admin') or p_area = any(u.areas))
  );
$$;

-- 읽기 판정. 쓸 수 있으면 볼 수 있다 — areas 를 read_areas 에 또 적지 않아도 되게.
create or replace function public.mt_can_read_area(p_area text)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active
       and (u.role in ('owner','admin') or p_area = any(u.areas || u.read_areas))
  );
$$;

-- 여러 섹션 중 하나라도 되면 참. 위 두 함수와 우회 규칙이 같아야 한다.
create or replace function public.mt_has_any_area(p_areas text[])
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active
       and (u.role in ('owner','admin') or u.areas && p_areas)
  );
$$;

create or replace function public.mt_can_read_any_area(p_areas text[])
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users u
     where u.id = auth.uid() and u.active
       and (u.role in ('owner','admin') or (u.areas || u.read_areas) && p_areas)
  );
$$;

-- ── 3) 자기 행 수정 정책 조이기 ─────────────────────────────────
-- 04 의 au_update_self 는 role·active 만 고정하고 있었다. 섹션 컬럼이 생긴
-- 지금 그대로 두면 **본인이 자기 areas 를 채워 넣을 수 있다** — 승인제가 뚫린다.
-- 표시명(name)만 바꿀 수 있게 areas·read_areas 도 함께 묶는다.
drop policy if exists au_update_self on public.app_users;
create policy au_update_self on public.app_users
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role       = (select u.role       from public.app_users u where u.id = auth.uid())
    and active     = (select u.active     from public.app_users u where u.id = auth.uid())
    and areas      = (select u.areas      from public.app_users u where u.id = auth.uid())
    and read_areas = (select u.read_areas from public.app_users u where u.id = auth.uid())
  );

-- 섹션 변경은 owner 만. 04 의 au_write_owner 가 이미 update 전체를 덮으므로
-- 새 정책은 필요 없다(컬럼이 늘어도 같은 정책이 그대로 적용된다).

grant execute on function public.mt_has_area(text),
                          public.mt_can_read_area(text),
                          public.mt_has_any_area(text[]),
                          public.mt_can_read_any_area(text[])
  to authenticated;

-- ── 4) 기존 계정 채우기 ─────────────────────────────────────────
-- 이 파일을 적용하는 순간 모든 계정의 areas 가 비어 있다. 그대로 두면 owner·admin
-- 을 뺀 전원이 모든 화면에서 막힌다. 역할에 맞는 기본값을 한 번만 채워 준다.
-- (이미 손으로 정해 둔 계정은 건드리지 않는다 — 둘 다 비어 있을 때만 채운다)
--
-- 섹션 키는 shared/access.js 의 SECTIONS 와 같아야 한다. 한쪽만 고치면
-- 화면에서는 보이는데 서버가 막는(또는 그 반대) 어긋남이 생긴다.
update public.app_users
   set areas = array['sales','manage','dashboard','booking','register','inquiry',
                     'insurance','library','imgtoolkit','weather']
 where role = 'manage' and areas = '{}' and read_areas = '{}';

update public.app_users
   set areas = array['sales','dashboard','booking','register','inquiry',
                     'insurance','library','imgtoolkit','weather']
 where role = 'sales' and areas = '{}' and read_areas = '{}';

-- 항공은 읽기 전용이 정의다. areas 는 비워 두고 read_areas 로만 연다.
update public.app_users
   set read_areas = array['air','dashboard','booking','weather','library']
 where role = 'air' and areas = '{}' and read_areas = '{}';

-- owner·admin 은 함수가 무조건 통과시키므로 채우지 않는다. 채워 두면 나중에
-- 「admin 인데 areas 가 비었네」 하고 잘못 손대게 된다.

-- ── 5) 확인 ─────────────────────────────────────────────────────
-- select email, role, active, areas, read_areas from public.app_users order by role, email;
