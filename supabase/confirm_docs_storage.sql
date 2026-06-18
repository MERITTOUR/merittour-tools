-- 확정서 공유 링크: 만료형(Signed URL) 셋업
--
-- 1) Supabase 콘솔 → Storage → 'confirm-docs' 버킷을 만들고 *Private(비공개)* 로 둔다.
--    (이미 public 으로 만들었다면 버킷 설정에서 Public 토글을 끈다 → 기존 public 링크는 끊김, 재발송 필요)
-- 2) 아래 정책 실행. 대시보드는 anon 키로 업로드(insert)하고, 90일 서명 링크를 발급(select)한다.
--    사이트 자체가 비밀번호 게이트로 보호되므로 anon 에 confirm-docs 버킷 접근을 허용한다.

-- 업로드 허용 (대시보드에서 확정서 .html 올리기)
drop policy if exists "confirm-docs anon insert" on storage.objects;
create policy "confirm-docs anon insert" on storage.objects
  for insert to anon with check (bucket_id = 'confirm-docs');

-- 덮어쓰기(x-upsert) 허용
drop policy if exists "confirm-docs anon update" on storage.objects;
create policy "confirm-docs anon update" on storage.objects
  for update to anon using (bucket_id = 'confirm-docs') with check (bucket_id = 'confirm-docs');

-- 서명 링크 발급에 필요 (object 메타 읽기). private 버킷이라 토큰 없는 직접 접근은 여전히 차단됨.
drop policy if exists "confirm-docs anon select" on storage.objects;
create policy "confirm-docs anon select" on storage.objects
  for select to anon using (bucket_id = 'confirm-docs');

-- 참고: 서명 링크(Signed URL)는 만료(기본 90일, DOC_LINK_TTL) 후 자동으로 열리지 않는다.
--       만료된 건은 대시보드에서 [링크 생성]으로 재발급하면 된다.
