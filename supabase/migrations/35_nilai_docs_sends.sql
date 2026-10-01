-- ════════════════════════════════════════════════════════════════
-- 35_nilai_docs_sends.sql — 닐라이 견적·확정서 보관함: 행사번호는 선택 입력 · 발송 내역 열  (멱등 · 비파괴)
-- 선행: 34_nilai_docs.sql
--
-- 왜 바꾸나(2026-10-01 · Min)
--   「행사번호는 넣지 않을 거임 → 문서번호 → 행사번호로 수정 · 입력 안 하면 공란으로 나올 거니까 · 입력 항목은 있어야」.
--   34 는 문서번호를 NS-연월일-순번으로 자동 채번하고 unique 로 묶었다. 이제 행사번호는 담당자가 적는
--   선택 항목이라 비어도 되고 겹쳐도 된다(견적서와 확정서가 같은 행사번호를 가질 수 있다). 보관함 열쇠는 행 id.
--   「어떤 사람한테 어떤 내용으로 보냈는지 내역만 남고 내역은 확인할 수 있어야」 → sends(jsonb 배열 · 보낼 때마다
--   누구에게 · 어떻게 · 누가 · 언제 · 문안 · 링크 · 그때의 입력 전체를 덧붙인다 · 화면이 뒤에 붙이고 지우지 않는다).
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub (execute_sql 로 그대로 · apply_migration 금지) · 2026-10-01 실행.
-- ════════════════════════════════════════════════════════════════

alter table public.nilai_docs drop constraint if exists nilai_docs_no_shape;
alter table public.nilai_docs drop constraint if exists nilai_docs_doc_no_key;
alter table public.nilai_docs alter column doc_no drop not null;
alter table public.nilai_docs add column if not exists sends jsonb not null default '[]'::jsonb;

create index if not exists nilai_docs_doc_no_idx on public.nilai_docs (doc_no);

comment on column public.nilai_docs.doc_no is '행사번호 — 담당자가 적는 선택 항목(비어도 · 겹쳐도 된다). 문서·알림톡에 그대로 찍힌다(비면 공란).';
comment on column public.nilai_docs.sends  is '발송 내역 — [{at, by, via(alimtalk|kakao|sms|other), to, name, kind, memo, link, message, data(그때 입력 스냅샷)}] · 뒤에 붙이기만 한다.';
