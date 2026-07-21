-- ════════════════════════════════════════════════════════════════
-- 03_resort_master_rls.sql — resort_master(+history) anon 제거 → authenticated (멱등)
-- 선행: 01_user_access.sql
-- ⚠ 영향: 현재 대시보드의 resort_master Supabase 동기화는 CLAUDE.md 상 "미적용"으로 기재.
--         (마스터 배포는 JSON export/import) → 클라이언트 실호출 여부 `확인 필요`.
--         실제 호출이 없다면 이 변경의 클라이언트 영향은 없음. 호출 중이면 로그인 필요.
-- ════════════════════════════════════════════════════════════════

alter table public.resort_master         enable row level security;
alter table public.resort_master_history enable row level security;

-- 1) 기존 anon 정책 제거
drop policy if exists rm_anon_select  on public.resort_master;
drop policy if exists rm_anon_insert  on public.resort_master;
drop policy if exists rm_anon_update  on public.resort_master;
drop policy if exists rmh_anon_select on public.resort_master_history;
drop policy if exists rmh_anon_insert on public.resort_master_history;

-- 2) anon GRANT 회수
revoke select, insert, update, delete on public.resort_master         from anon;
revoke select, insert                 on public.resort_master_history from anon;
revoke usage, select on sequence public.resort_master_history_id_seq  from anon;

-- 3) resort_master : 조회는 로그인 전원, 수정은 admin/manage
grant select, insert, update on public.resort_master to authenticated;

drop policy if exists rm_select on public.resort_master;
create policy rm_select on public.resort_master
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

drop policy if exists rm_write_insert on public.resort_master;
create policy rm_write_insert on public.resort_master
  for insert to authenticated
  with check (public.mt_has_role(array['admin','manage']));

drop policy if exists rm_write_update on public.resort_master;
create policy rm_write_update on public.resort_master
  for update to authenticated
  using (public.mt_has_role(array['admin','manage']))
  with check (public.mt_has_role(array['admin','manage']));
-- 삭제 정책 없음 → 단일행 보호(삭제 차단).

-- 4) history : 읽기(전원) / 추가(admin·manage)만. 수정·삭제 정책 없음 → 무결성 보존.
grant select, insert on public.resort_master_history to authenticated;
grant usage, select on sequence public.resort_master_history_id_seq to authenticated;

drop policy if exists rmh_select on public.resort_master_history;
create policy rmh_select on public.resort_master_history
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

drop policy if exists rmh_insert on public.resort_master_history;
create policy rmh_insert on public.resort_master_history
  for insert to authenticated
  with check (public.mt_has_role(array['admin','manage']));
-- update/delete 정책 없음 → history 수정·삭제 금지(요구사항).
