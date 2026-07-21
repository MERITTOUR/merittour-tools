-- ════════════════════════════════════════════════════════════════
-- verify_security.sql — 보안 적용 후 검증(읽기 전용). 운영 DB에서 안전하게 실행 가능.
-- 각 쿼리 아래 주석에 "정상일 때 기대값" 표기.
-- ════════════════════════════════════════════════════════════════

-- 1) RLS 활성화 여부
select relname, relrowsecurity
from pg_class
where relname in ('reservations','notice_sent','resort_master','resort_master_history','user_access')
order by relname;
-- 기대: 모든 행 relrowsecurity = true

-- 2) anon 정책 존재 여부(있으면 위험). 대상 테이블에 anon 대상 정책 0건 기대.
select schemaname, tablename, policyname, roles
from pg_policies
where schemaname in ('public','storage')
  and (roles::text ilike '%anon%')
  and tablename in ('reservations','resort_master','resort_master_history','objects','user_access')
order by tablename, policyname;
-- 기대: 0건

-- 3) authenticated 정책 존재 여부(있어야 정상)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname='public'
  and tablename in ('reservations','resort_master','resort_master_history','user_access')
order by tablename, policyname;
-- 기대: resv_select/insert/update, rm_select/write_*, rmh_select/insert, ua_select/ua_admin_write 존재

-- 4) Storage 정책(confirm-docs) — anon 정책 없어야 함
select policyname, roles, cmd
from pg_policies
where schemaname='storage' and tablename='objects' and policyname ilike 'confirm-docs%';
-- 기대: anon 대상 정책 0건 (Edge Function service_role 경유이면 정책 자체 0건도 정상)

-- 5) 버킷 public 여부
select id, public from storage.buckets where id='confirm-docs';
-- 기대: public = false

-- 6) 역할 테이블 존재 + 구조
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='user_access' order by ordinal_position;
-- 기대: user_id,email,name,role,active,created_at,updated_at

-- 7) 위험한 anon GRANT 존재 여부(있으면 위험)
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema='public'
  and grantee='anon'
  and table_name in ('reservations','resort_master','resort_master_history','user_access');
-- 기대: 0건 (anon 에 대한 select/insert/update/delete 없음)

-- 8) 함수 execute 권한(anon 에 없어야 함)
select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'execute') as can_exec
from pg_proc p
cross join (select rolname from pg_roles where rolname in ('anon','authenticated')) r
where p.proname in ('mt_role','mt_is_admin','mt_has_role','mt_is_active')
order by p.proname, r.rolname;
-- 기대: anon = false, authenticated = true

-- 9) security definer 함수의 search_path 고정 확인
select proname, proconfig
from pg_proc
where proname in ('mt_role','mt_is_admin','mt_has_role','mt_is_active');
-- 기대: proconfig 에 search_path=public 포함

-- ────────────────────────────────────────────────────────────────
-- 10) (셸에서 실행) 소스에 service_role / secret 키가 없는지 검색:
--   grep -rniE "service_role|sb_secret|SUPABASE_SERVICE_ROLE_KEY *[:=] *['\"][A-Za-z0-9]" \
--     tools/ shared/ auth.js supabase/functions/ | grep -v "Deno.env.get\|env(\|<이름만>"
--   기대: 실제 키 값 매치 0건 (변수명 참조만 존재)
