-- 25 · RLS 정책의 auth.uid() 를 (select auth.uid()) 로 (2026-09)
--
-- Supabase 성능 권고(0003): 정책 안의 auth.uid() 는 행마다 다시 평가된다. (select …) 로 감싸면
-- 질의당 한 번만 평가된다. 뜻은 같다 — app_users 의 본인 행 정책 둘과 mt_change_log 의 insert 정책.
-- 몇 번을 실행해도 같은 결과다.

alter policy au_select_self on public.app_users
  using (id = (select auth.uid()));

alter policy au_update_self on public.app_users
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role       = (select u.role       from public.app_users u where u.id = (select auth.uid()))
    and active     = (select u.active     from public.app_users u where u.id = (select auth.uid()))
    and areas      = (select u.areas      from public.app_users u where u.id = (select auth.uid()))
    and read_areas = (select u.read_areas from public.app_users u where u.id = (select auth.uid()))
  );

alter policy mcl_insert on public.mt_change_log
  with check (mt_has_role(array['admin','sales','air','manage']) and actor_id = (select auth.uid()));
