-- 확정서 링크용 Storage 버킷 정책
-- 사전: Storage에서 public 버킷 'confirm-docs' 를 먼저 생성할 것.
-- 대시보드는 anon key로 HTML을 업로드(upsert)한다. (사이트는 비밀번호 게이트로 보호됨)
-- public 버킷이라 읽기(공개 링크)는 정책 없이 가능하고, 아래는 anon 쓰기 허용.

create policy "confirm-docs anon insert"
on storage.objects for insert to anon
with check (bucket_id = 'confirm-docs');

create policy "confirm-docs anon update"
on storage.objects for update to anon
using (bucket_id = 'confirm-docs')
with check (bucket_id = 'confirm-docs');

-- 더 엄격히 가려면: 위 anon 정책을 빼고, 업로드를 Edge Function(service_role)에서
-- 처리하도록 바꾸면 anon key로의 직접 쓰기를 막을 수 있다.
