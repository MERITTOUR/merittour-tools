-- ════════════════════════════════════════════════════════════════
-- 18_air_same_as_others.sql — 항공팀도 영업·관리와 똑같이 쓴다  (멱등 · 비파괴)
--
-- 지금까지 air 는 **읽기 전용**이었다. 조회 정책에는 들어 있는데
-- insert/update/delete 정책에는 빠져 있어서, 항공팀 계정으로 열면
-- 화면에는 입력칸과 버튼이 그대로 보이는데 저장만 조용히 0행이 됐다.
-- (PostgREST 는 RLS 로 막혀도 오류가 아니라 0행을 준다)
--
-- 항공팀도 예약·블록·확정서를 만지는 같은 팀이다. 세 팀을 다르게 둘 이유가
-- 없다는 판단으로 **영업·관리·항공을 같은 층으로 맞춘다.**
--
-- 바뀌는 것 = 쓰기 정책 다섯 곳의 역할 목록에 'air' 를 더하는 것뿐이다.
--   05 data_registry        insert · update
--   08 resort_master        update
--   09 mt_change_log        insert
--   10 오버레이 5표          insert · update · delete
--   12 reservations         insert · update
--      storage confirm-docs  insert · update
--
-- 바뀌지 않는 것
--   · 조회 정책 — 원래부터 air 가 들어 있었다.
--   · owner/admin 전용 — data_registry 삭제(mt_is_admin), resort_master 삭제·복구,
--     계정 관리(app_users), 신청함 처리. 여기는 그대로 둔다.
--   · mt_change_log 는 여전히 update/delete 정책이 없다 — 이력은 지울 수 없다.
--
-- ⚠ 실행 순서 — **이 SQL 을 먼저 실행하고 코드를 나중에 배포한다.**
--   반대로 하면 화면은 열리는데 서버가 막아 「저장이 안 된다」가 된다.
--   (16 을 코드 먼저 내보냈다가 같은 일을 겪었다)
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
-- ════════════════════════════════════════════════════════════════

-- ── 1) 엠클릭 업로드 자료 (05) ──────────────────────────────────
drop policy if exists dr_insert on public.data_registry;
create policy dr_insert on public.data_registry
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','air','manage']));

drop policy if exists dr_update on public.data_registry;
create policy dr_update on public.data_registry
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','air','manage']))
  with check (public.mt_has_role(array['admin','sales','air','manage']));
-- dr_delete 는 그대로 mt_is_admin() — 올린 자료를 지우는 것은 마스터만.

-- ── 2) 리조트 마스터 (08) ───────────────────────────────────────
drop policy if exists rm_update on public.resort_master;
create policy rm_update on public.resort_master
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','air','manage']))
  with check (public.mt_has_role(array['admin','sales','air','manage']));
-- rm_insert(행 복구)는 그대로 mt_is_admin(). 삭제 정책은 원래 없다.

-- ── 3) 변경 이력 (09) ───────────────────────────────────────────
-- 이력을 못 남기면 항공팀이 고친 것만 「누가 했는지」가 빈다.
drop policy if exists mcl_insert on public.mt_change_log;
create policy mcl_insert on public.mt_change_log
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','air','manage'])
              and actor_id = auth.uid());
-- update/delete 정책은 여전히 만들지 않는다. 지울 수 있으면 이력이 아니다.

-- ── 4) 오버레이 5표 (10) ────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['mt_event_overlay','mt_pax_overlay','mt_settle_adjust',
                           'mt_settle_deduction','mt_block_override']
  loop
    execute format('drop policy if exists %s_insert on public.%I', t, t);
    execute format('create policy %s_insert on public.%I for insert to authenticated '
                   'with check (public.mt_has_role(array[''admin'',''sales'',''air'',''manage'']))', t, t);

    execute format('drop policy if exists %s_update on public.%I', t, t);
    execute format('create policy %s_update on public.%I for update to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''air'',''manage''])) '
                   'with check (public.mt_has_role(array[''admin'',''sales'',''air'',''manage'']))', t, t);

    execute format('drop policy if exists %s_delete on public.%I', t, t);
    execute format('create policy %s_delete on public.%I for delete to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''air'',''manage'']))', t, t);
  end loop;
end $$;

-- ── 5) 예약 · 확정서 (12) ───────────────────────────────────────
drop policy if exists "reservations auth insert" on public.reservations;
create policy "reservations auth insert" on public.reservations
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','air','manage']));

drop policy if exists "reservations auth update" on public.reservations;
create policy "reservations auth update" on public.reservations
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','air','manage']))
  with check (public.mt_has_role(array['admin','sales','air','manage']));
-- 삭제 정책은 여전히 없다. 손님 예약을 화면에서 지울 일이 없다.

drop policy if exists "confirm-docs auth insert" on storage.objects;
create policy "confirm-docs auth insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'confirm-docs'
              and public.mt_has_role(array['admin','sales','air','manage']));

drop policy if exists "confirm-docs auth update" on storage.objects;
create policy "confirm-docs auth update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'confirm-docs' and public.mt_has_role(array['admin','sales','air','manage']))
  with check (bucket_id = 'confirm-docs' and public.mt_has_role(array['admin','sales','air','manage']));

-- ── 6) 이미 있는 항공팀 계정의 섹션을 읽기 → 읽기+쓰기 로 올린다 ──
-- 14 가 air 를 read_areas 로만 채워 뒀다. 그대로 두면 서버는 열렸는데
-- 화면이 「읽기」로 남아 여전히 못 고친다. 영업과 같은 목록으로 맞춘다.
-- 마스터가 계정마다 따로 정해 둔 것이 있으면 건드리지 않는다
-- (areas 가 비어 있고 read_areas 가 14 의 기본값 그대로인 줄만 손댄다).
update public.app_users
   set areas      = array['sales','air','dashboard','booking',
                          'insurance','library','imgtoolkit','weather'],
       read_areas = '{}'
 where role = 'air'
   and coalesce(array_length(areas, 1), 0) = 0
   and read_areas @> array['air','dashboard','booking','weather','library']
   and read_areas <@ array['air','dashboard','booking','weather','library'];

-- ── 7) 확인 ─────────────────────────────────────────────────────
-- air 가 빠진 쓰기 정책이 하나도 없어야 한다(0행이 정상):
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname in ('public','storage')
--      and cmd in ('INSERT','UPDATE','DELETE')
--      and coalesce(qual,'') || coalesce(with_check,'') like '%mt_has_role%'
--      and coalesce(qual,'') || coalesce(with_check,'') not like '%air%'
--    order by tablename, policyname;
--
-- 항공팀 계정의 섹션:
--   select email, role, areas, read_areas from public.app_users where role = 'air';
