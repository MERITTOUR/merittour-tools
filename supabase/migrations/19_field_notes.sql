-- ════════════════════════════════════════════════════════════════
-- 19_field_notes.sql — 현지 전달 완료 표시  (멱등 · 비파괴)
--
-- ③ 데이터 검수 아래 「현지 전달 점검」에서 팀마다 무엇을 보내야 하는지
-- (동성팀 방배정 · 5명 이상 첫날 조편성) 뽑아 주는데, **보냈는지**를
-- 어디에도 남기지 못해 매번 어디까지 했는지 따로 기억해야 했다.
--
-- 개인 PC(localStorage)에 두면 안 된다 — 담당자가 바뀌거나 다른 자리에서
-- 열면 이미 보낸 팀이 다시 「보낼 것」으로 올라온다. 전 직원이 같은 값을
-- 봐야 하는 값이라 서버에 둔다(오버레이 5표와 같은 자리·같은 규칙).
--
-- 팀(event_seq) × 종류(kind) 하나에 한 줄. kind = 'room' | 'flight'.
--   · room   동성팀 방배정 전달
--   · flight 첫날 조편성 전달
-- 앞으로 종류가 늘어도 표는 그대로 쓴다(kind 만 추가).
--
-- 「완료」를 지우는 것은 행을 지우는 것이다 — done=false 로 남기지 않는다.
-- 남기면 「한 번 눌렀다 취소한 것」과 「아예 안 건드린 것」이 구분되지 않고,
-- 그 구분은 아무도 쓰지 않는다.
--
-- ⚠ 실행 순서 — **이 SQL 을 먼저 실행하고 코드를 나중에 배포한다.**
--   반대로 하면 화면에 체크는 보이는데 서버가 없어 저장이 조용히 실패한다.
--   (16 을 코드 먼저 내보냈다가 같은 일을 겪었다)
--   다만 코드는 표가 없어도 죽지 않게 해 뒀다 — 체크만 안 되고 목록은 나온다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
-- ════════════════════════════════════════════════════════════════

create table if not exists public.mt_field_note (
  event_seq     text not null,
  kind          text not null check (kind in ('room','flight')),
  memo          text,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (event_seq, kind)
);

comment on table public.mt_field_note is
  '현지 전달 완료 표시. 행이 있으면 그 팀의 그 종류(room=동성팀 방배정, '
  'flight=첫날 조편성)를 현지에 보냈다는 뜻이다. 취소는 행 삭제 — '
  'done=false 로 남기지 않는다(안 건드린 것과 구분되지 않는다).';

-- 출발일 순으로 훑는 화면이라 event_seq 단독 조회가 잦다
create index if not exists mt_field_note_seq_idx on public.mt_field_note (event_seq);

-- ── 누가·언제 자동 기록 (오버레이 5표와 같은 트리거) ────────────
drop trigger if exists trg_mt_field_note_stamp on public.mt_field_note;
create trigger trg_mt_field_note_stamp
  before insert or update on public.mt_field_note
  for each row execute function public.mt_actor_stamp();

-- ── RLS ─────────────────────────────────────────────────────────
-- 조회는 항공팀까지, 쓰기는 영업·관리·마스터 — 오버레이 5표와 같은 층으로 맞춘다.
-- (18 에서 air 를 쓰기까지 올렸지만, 오버레이 표의 쓰기 정책은 그때도
--  admin/sales/manage 였다. 여기서만 다르게 두면 왜 다른지 아무도 모른다)
alter table public.mt_field_note enable row level security;

drop policy if exists mt_field_note_select on public.mt_field_note;
create policy mt_field_note_select on public.mt_field_note
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

drop policy if exists mt_field_note_insert on public.mt_field_note;
create policy mt_field_note_insert on public.mt_field_note
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage']));

drop policy if exists mt_field_note_update on public.mt_field_note;
create policy mt_field_note_update on public.mt_field_note
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

drop policy if exists mt_field_note_delete on public.mt_field_note;
create policy mt_field_note_delete on public.mt_field_note
  for delete to authenticated
  using (public.mt_has_role(array['admin','sales','manage']));

-- ── 권한 — anon 노출 0 (13_lock_anon.sql 원칙) ──────────────────
revoke all on public.mt_field_note from anon;
grant select, insert, update, delete on public.mt_field_note to authenticated;

-- ── 확인 ─────────────────────────────────────────────────────────
--   select * from public.mt_field_note order by updated_at desc limit 20;
--
-- anon 에 아무 권한도 없어야 한다(0행이 정상):
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'mt_field_note' and grantee = 'anon';
