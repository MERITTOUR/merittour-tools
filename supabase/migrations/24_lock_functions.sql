-- 24 · 함수 EXECUTE 잠금 + notice_sent 의 anon 잔여 권한 회수 (2026-09)
--
-- Supabase 보안 권고(0028/0029): SECURITY DEFINER 함수 20개가 anon·authenticated 로
-- /rest/v1/rpc/… 에서 호출 가능했다. 원인은 함수의 기본 권한 — PostgreSQL 은 새 함수에
-- PUBLIC EXECUTE 를 준다.
--   · 트리거·이벤트트리거 함수는 시스템이 부르는 것이라 EXECUTE 가 누구에게도 필요 없다.
--     발화 시에는 EXECUTE 검사를 하지 않는다 — 검사는 트리거를 만들 때 한 번뿐이다.
--     auth.users 트리거 둘은 혹시 몰라 supabase_auth_admin 에게만 남긴다.
--   · 판정 함수(mt_is_*, mt_has_*, mt_can_*, mt_role, mt_actor_name)는 RLS 정책 안에서만 쓰인다.
--     정책은 질의하는 역할로 평가되므로 authenticated 에게만 EXECUTE 를 남긴다.
--     코드에서 .rpc() 로 부르는 곳은 없다(2026-09 전수 확인 — rpc( · /rpc/ 0건).
--   · 앞으로 만드는 함수도 PUBLIC EXECUTE 가 붙지 않게 postgres 의 기본 권한을 바꾼다.
-- notice_sent 는 서버 전용(정책 없음)인데 anon 에 REFERENCES·TRIGGER·TRUNCATE 가 남아 있었다
-- (13 이 DML 만 회수했다). RLS 는 TRUNCATE 를 막지 않으므로 전부 회수한다. authenticated 도 같이.
-- 몇 번을 실행해도 같은 결과다.

-- 1) 트리거·이벤트트리거 함수 — 아무도 RPC 로 부르지 못하게
revoke execute on function
  public.mt_actor_stamp(), public.mt_apply_access_request(), public.mt_dr_stamp(), public.mt_mcl_stamp(),
  public.mt_on_auth_user_created(), public.mt_on_auth_user_updated(), public.mt_rm_archive(), public.mt_rm_stamp(),
  public.mt_touch_updated_at(), public.rls_auto_enable()
from public, anon, authenticated;
grant execute on function public.mt_on_auth_user_created(), public.mt_on_auth_user_updated() to supabase_auth_admin;

-- 2) 판정 함수 — 정책 평가용으로 authenticated 만
revoke execute on function
  public.mt_actor_name(), public.mt_can_read_any_area(text[]), public.mt_can_read_area(text),
  public.mt_has_any_area(text[]), public.mt_has_area(text), public.mt_has_role(text[]),
  public.mt_is_active(), public.mt_is_admin(), public.mt_is_owner(), public.mt_role()
from public, anon;
grant execute on function
  public.mt_actor_name(), public.mt_can_read_any_area(text[]), public.mt_can_read_area(text),
  public.mt_has_any_area(text[]), public.mt_has_area(text), public.mt_has_role(text[]),
  public.mt_is_active(), public.mt_is_admin(), public.mt_is_owner(), public.mt_role()
to authenticated;

-- 3) 앞으로 postgres 가 만드는 함수의 기본 권한 — PUBLIC EXECUTE 없이
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- 4) notice_sent — 서버(service_role)만
revoke all on table public.notice_sent from anon, authenticated;
