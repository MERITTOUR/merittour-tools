-- ════════════════════════════════════════════════════════════════
-- 02_reservations_rls.sql — reservations anon 권한 제거 → authenticated 역할 기반 (멱등)
-- 선행: 01_user_access.sql
-- ⚠ 영향: 대시보드가 현재 anon 키로 reservations 를 upsert/조회한다면,
--         이 마이그레이션 적용 후에는 "로그인(authenticated) + 역할" 없이는 실패한다.
--         → 반드시 클라이언트 Supabase Auth 연결(shared/access.js) 적용과 함께 배포할 것.
--         → 미로그인 상태 대시보드는 동기화 기능만 비활성(기본 분석은 로컬이라 동작).
-- service_role(D-7 cron Edge Function)은 RLS 를 우회하므로 영향 없음(유지).
-- ════════════════════════════════════════════════════════════════

alter table public.reservations enable row level security;

-- 1) 기존 anon 정책 제거
drop policy if exists "reservations anon read"   on public.reservations;
drop policy if exists "reservations anon insert" on public.reservations;
drop policy if exists "reservations anon update" on public.reservations;

-- 2) anon 테이블 권한 회수 (RLS 와 별개로 GRANT 도 제거해야 완전 차단)
revoke select, insert, update, delete on public.reservations from anon;

-- 3) authenticated 권한 + 역할 기반 정책
grant select, insert, update on public.reservations to authenticated;

--   조회: 운영진(admin/sales/air/manage) 전원 — 대시보드 점검 목적
drop policy if exists resv_select on public.reservations;
create policy resv_select on public.reservations
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

--   등록/수정(동기화): admin/sales/manage 만
drop policy if exists resv_insert on public.reservations;
create policy resv_insert on public.reservations
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage']));

drop policy if exists resv_update on public.reservations;
create policy resv_update on public.reservations
  for update to authenticated
  using (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

--   삭제 정책 없음 → 삭제 차단(admin 필요 시 별도 정책 추가). service_role 는 우회.

-- ────────────────────────────────────────────────────────────────
-- notice_sent : 기존 설계대로 정책 없음 = anon/authenticated 차단, service_role(cron)만 접근. 유지.
--   (개인정보 최소화는 06 단계 · cron 함수 참조)
alter table public.notice_sent enable row level security;
revoke all on public.notice_sent from anon;
-- authenticated 에도 굳이 열지 않음(발송 로그는 서버 전용). 필요 시 admin select 만 추가 고려:
-- drop policy if exists ns_admin_select on public.notice_sent;
-- create policy ns_admin_select on public.notice_sent for select to authenticated using (public.mt_is_admin());

-- ⚠ 행(row) 단위 소유 제한(예: sales 담당 팀만) 은 reservations 에 담당자/팀 컬럼이 없어
--   현재 구현 불가 → `확인 필요`(팀/담당 모델 도입 시 owner 컬럼 + 정책 조건 추가).
