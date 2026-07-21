-- ════════════════════════════════════════════════════════════════
-- 04_confirm_docs_storage_rls.sql — confirm-docs Storage anon 제거 · Private 강제 (멱등)
-- 선행: 01_user_access.sql, Edge Function upload-confirm-doc 배포(권장)
-- ⚠⚠ 데이터/링크 영향(반드시 사전 공지):
--   - 현재 confirm-docs 가 public 버킷이면(=confirm_docs_storage_policy.sql 적용본),
--     이 마이그레이션으로 Private 전환 시 기존 "공개 링크"가 즉시 끊긴다.
--   - anon 직접 업로드가 막히므로, 대시보드의 직접 업로드 방식은
--     반드시 Edge Function(upload-confirm-doc, service_role) 경유로 전환해야 동작한다.
--   - 기존 서명 URL(90일)은 만료 전까지 유효할 수 있으나, 재발급은 Edge Function 경유로.
--   → 운영 적용 전 docs/security/DEPLOYMENT_CHECKLIST.md 의 "confirm-docs 전환" 절 필독.
-- ════════════════════════════════════════════════════════════════

-- 1) 버킷 Private 강제 (public 링크 차단). storage.buckets 데이터 변경(멱등).
update storage.buckets set public = false where id = 'confirm-docs';

-- 2) 기존 anon 정책 전부 제거 (두 버전의 정책명 모두 대응)
drop policy if exists "confirm-docs anon insert" on storage.objects;
drop policy if exists "confirm-docs anon update" on storage.objects;
drop policy if exists "confirm-docs anon select" on storage.objects;

-- 3) 이후 접근 모델:
--    · 업로드/덮어쓰기/서명URL 발급 = Edge Function upload-confirm-doc (service_role, RLS 우회)
--    · service_role 은 정책과 무관하게 동작하므로 storage.objects 에 anon/authenticated 쓰기 정책을 두지 않는다.
--    · (선택) 로그인 사용자가 직접 서명URL 을 만들 필요가 있으면 아래 select 정책만 최소 허용:
-- drop policy if exists "confirm-docs auth select" on storage.objects;
-- create policy "confirm-docs auth select" on storage.objects
--   for select to authenticated using (bucket_id = 'confirm-docs' and public.mt_is_active());
--   ↑ 기본은 두지 않음(Edge Function 단일 경로 권장).

-- 4) 확인용:
--   select id, public from storage.buckets where id='confirm-docs';           -- public=false 기대
--   select policyname from pg_policies where tablename='objects' and schemaname='storage'
--     and policyname ilike 'confirm-docs%';                                    -- anon 정책 0건 기대
