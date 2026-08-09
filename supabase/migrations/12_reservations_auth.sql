-- ════════════════════════════════════════════════════════════════
-- 12_reservations_auth.sql — 예약 데이터·확정서 저장을 로그인 사용자에게 연다
--                            (추가만 · 멱등 · 비파괴 · anon 은 아직 그대로 둔다)
-- 선행: 04_user_access.sql
--
-- 왜 「추가만」인가 — 무중단을 위해서다.
--   지금 정책은 reservations·confirm-docs 모두 anon 대상이고, 대시보드도 anon 키로
--   호출해 왔다. 코드를 로그인 토큰으로 바꾸면 역할이 authenticated 가 되어 기존
--   anon 정책과 매칭되지 않는다. 그래서 이 파일은 authenticated 를 **열기만** 하고
--   anon 은 건드리지 않는다. 새 코드가 배포돼 실제로 도는 것을 확인한 뒤
--   13_lock_anon.sql 로 anon 을 닫는다.
--
--   반대로 anon 을 먼저 닫으면, 자동 동기화가 조용히 멎어 D-7 알림톡이 낡은
--   자료로 나간다. 순서를 지키는 이유가 그것이다.
-- ════════════════════════════════════════════════════════════════

-- ── 1) reservations — D-7 자동발송이 읽는 예약 데이터 ─────────────
alter table public.reservations enable row level security;

drop policy if exists "reservations auth read"   on public.reservations;
drop policy if exists "reservations auth insert" on public.reservations;
drop policy if exists "reservations auth update" on public.reservations;

create policy "reservations auth read" on public.reservations
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

create policy "reservations auth insert" on public.reservations
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage']));

create policy "reservations auth update" on public.reservations
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

-- 삭제 정책은 만들지 않는다. 손님 예약을 화면에서 지울 일이 없다.

grant select, insert, update on public.reservations to authenticated;

-- ── 2) confirm-docs 버킷 — 확정서 JPG ────────────────────────────
-- 손님에게 나가는 문서다. 버킷은 private 이고 서명 링크(90일)로만 열린다.
drop policy if exists "confirm-docs auth insert" on storage.objects;
drop policy if exists "confirm-docs auth update" on storage.objects;
drop policy if exists "confirm-docs auth select" on storage.objects;

create policy "confirm-docs auth insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'confirm-docs'
              and public.mt_has_role(array['admin','sales','manage']));

create policy "confirm-docs auth update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'confirm-docs' and public.mt_has_role(array['admin','sales','manage']))
  with check (bucket_id = 'confirm-docs' and public.mt_has_role(array['admin','sales','manage']));

-- 서명 링크 발급에 object 메타 읽기가 필요하다. private 버킷이라
-- 토큰 없는 직접 접근은 여전히 막혀 있다.
create policy "confirm-docs auth select" on storage.objects
  for select to authenticated
  using (bucket_id = 'confirm-docs'
         and public.mt_has_role(array['admin','sales','air','manage']));

-- ── 확인 ────────────────────────────────────────────────────────
-- 실행 뒤 대시보드에서 ⑦ 확정서 → [↻ 지금 동기화] 를 눌러
-- 「N팀 동기화됨」이 뜨는지 보고, 그다음에 13_lock_anon.sql 을 실행할 것.
