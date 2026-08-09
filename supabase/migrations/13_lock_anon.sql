-- ════════════════════════════════════════════════════════════════
-- 13_lock_anon.sql — anon 에 열려 있던 손님 데이터 경로를 닫는다
--                    (⚠ 12 를 실행하고 **동작을 확인한 뒤에** 실행할 것)
-- 선행: 12_reservations_auth.sql + 로그인 토큰으로 배선된 대시보드 배포
--
-- 왜 이제야 닫나
--   anon 키는 public 저장소(shared/supabase-config.js)에 원문으로 있다.
--   지금 정책은 using(true)/with check(true) 라, 그 키만 있으면 브라우저 없이도
--   손님 예약(reservations)을 읽고 쓰고, 확정서 JPG 를 올리고 내려받을 수 있다.
--
--   그런데 먼저 닫으면 대시보드의 자동 동기화가 **조용히** 멎어 D-7 알림톡이
--   낡은 자료로 나간다. 그래서 ① 코드를 로그인 토큰으로 바꾸고
--   ② 12 로 authenticated 를 열고 ③ 도는 것을 확인한 뒤 ④ 여기서 닫는다.
--
-- 실행 전 확인
--   대시보드 ⑦ 확정서 → [↻ 지금 동기화] 에서 「N팀 동기화됨」이 떠야 한다.
--   빨간 「동기화 실패」가 뜨면 12 부터 다시 확인할 것.
-- ════════════════════════════════════════════════════════════════

-- ── 1) reservations ─────────────────────────────────────────────
drop policy if exists "reservations anon read"   on public.reservations;
drop policy if exists "reservations anon insert" on public.reservations;
drop policy if exists "reservations anon update" on public.reservations;

revoke all on public.reservations from anon;

-- ── 2) confirm-docs 버킷 ────────────────────────────────────────
drop policy if exists "confirm-docs anon insert" on storage.objects;
drop policy if exists "confirm-docs anon update" on storage.objects;
drop policy if exists "confirm-docs anon select" on storage.objects;

-- ── 3) 남아 있는 anon 노출 점검 ─────────────────────────────────
-- 실행 뒤 아래 두 질의가 **빈 결과**여야 한다.
--
--   -- anon 대상 정책이 남아 있는 표
--   select schemaname, tablename, policyname
--     from pg_policies
--    where 'anon' = any(roles)
--      and schemaname in ('public','storage');
--
--   -- anon 에 테이블 권한이 남아 있는 곳
--   select table_schema, table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee = 'anon' and table_schema = 'public';
--
-- 무언가 남아 있으면 그 표가 anon 키만으로 열린다는 뜻이다.
-- (notice_sent 는 원래 정책이 없어 service_role 만 접근한다 — 정상.)
