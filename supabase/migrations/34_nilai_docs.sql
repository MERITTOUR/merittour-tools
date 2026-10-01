-- ════════════════════════════════════════════════════════════════
-- 34_nilai_docs.sql — 닐라이스프링스 견적서·확정서 보관함  (멱등 · 비파괴)
-- 선행: 04_user_access.sql(mt_has_role) · 08_resort_master_shared.sql(mt_actor_name) · 14·16(app_users.areas)
--
-- 왜 필요한가
--   말레이시아 닐라이스프링스는 엠클릭 예약 데이터가 없는 상품이라 대시보드 ⑦ 확정서(teams 기반)로는
--   문서를 만들 수 없다. 도구함 「닐라이 견적·확정서」(tools/nilai) 가 폼 입력으로 문서를 만들고,
--   같은 길(confirm-docs 버킷 → 90일 서명 링크 → send-alimtalk)로 보낸다. 누가 어떤 문서를 만들어
--   언제 보냈는지가 PC 가 아니라 서버에 남아야 다른 직원이 다시 열어 재발송할 수 있다
--   (2026-10-01 · Min 「기본정보를 넣어두고 … 입력하면 그 폼대로 나오고 그걸 그대로 알리고로 발송」).
--
-- 구조
--   nilai_docs(id, doc_no unique, kind quote|confirm, data jsonb(폼 입력 전체), link(서명 링크), link_expires_at,
--              sent_at, sent_by, created_*, updated_*, version)
--   data 에는 손님 이름·휴대폰이 들어간다 — 운영진(admin·sales·manage)만 읽고 쓴다. anon 은 전부 닫는다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고 execute_sql 로 그대로 돌린다)
-- ════════════════════════════════════════════════════════════════

-- ── 1) 표 ────────────────────────────────────────────────────────
create table if not exists public.nilai_docs (
  id              bigint generated always as identity primary key,
  doc_no          text        not null unique,
  kind            text        not null default 'confirm',
  data            jsonb       not null default '{}'::jsonb,
  link            text,
  link_expires_at timestamptz,
  sent_at         timestamptz,
  sent_by         text,
  version         bigint      not null default 1,
  created_at      timestamptz not null default now(),
  created_by      text,
  created_by_id   uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  updated_by_id   uuid references auth.users(id) on delete set null,
  constraint nilai_docs_kind_shape   check (kind in ('quote', 'confirm')),
  constraint nilai_docs_no_shape     check (doc_no ~ '^NS-[0-9]{6}-[0-9]{2,3}$')
);

create index if not exists nilai_docs_updated_idx on public.nilai_docs (updated_at desc);

comment on table public.nilai_docs is
  '닐라이스프링스 견적서·확정서 보관함(tools/nilai). data 는 폼 입력 전체(손님 이름·휴대폰 포함) · '
  'link 는 confirm-docs 버킷의 90일 서명 링크 · sent_at 은 send-alimtalk 발송 요청 시각. 누가·언제는 트리거가 박는다(2026-10-01).';

-- ── 2) 저장 스탬프 (31 의 mt_ri_stamp 와 같은 꼴) ─────────────────
create or replace function public.mt_nd_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if tg_op = 'INSERT' then
      new.created_at    := now();
      new.created_by_id := auth.uid();
      new.created_by    := coalesce(public.mt_actor_name(), new.created_by);
      new.version       := 1;
    else
      new.created_at    := old.created_at;
      new.created_by    := old.created_by;
      new.created_by_id := old.created_by_id;
      new.version       := coalesce(old.version, 1) + 1;
    end if;
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), new.updated_by);
    return new;
  end;
$$;

-- 트리거 함수는 아무도 직접 못 부른다(24_lock_functions 와 같은 규칙 · 발화에는 EXECUTE 가 필요 없다)
revoke execute on function public.mt_nd_stamp() from public, anon, authenticated;

drop trigger if exists trg_nd_stamp on public.nilai_docs;
create trigger trg_nd_stamp before insert or update on public.nilai_docs
  for each row execute function public.mt_nd_stamp();

-- ── 3) RLS — 운영진(admin·sales·manage)만. 항공팀은 손님 문서를 만들지 않는다 ──
alter table public.nilai_docs enable row level security;

drop policy if exists nd_select on public.nilai_docs;
drop policy if exists nd_insert on public.nilai_docs;
drop policy if exists nd_update on public.nilai_docs;

create policy nd_select on public.nilai_docs
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','manage']));

create policy nd_insert on public.nilai_docs
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage']));

create policy nd_update on public.nilai_docs
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

-- 삭제 정책은 만들지 않는다 — 손님에게 보낸 문서는 지우지 않고 남긴다.

-- ── 4) 테이블 권한 ──────────────────────────────────────────────
revoke all on public.nilai_docs from anon;
do $$
begin
  execute 'revoke all on sequence public.nilai_docs_id_seq from anon';
exception when undefined_table then null;
end $$;
grant select, insert, update on public.nilai_docs to authenticated;

-- ── 5) 섹션 — 영업·관리·마스터 계정에 「닐라이 견적·확정서」 화면을 연다 ───
-- 이후 새 계정은 shared/access.js 의 역할 기본값(manage·sales)에 들어 있다. 항공팀은 넣지 않는다.
update public.app_users
   set areas = array_append(areas, 'nilai')
 where active
   and role in ('owner', 'admin', 'manage', 'sales')
   and not ('nilai' = any(coalesce(areas, '{}'::text[])));
