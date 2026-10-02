-- ════════════════════════════════════════════════════════════════
-- 36_nilai_settings.sql — 닐라이 견적·확정서 기본 문안 설정(항목형 · 2026-10-02 · Min 「문안 항목형으로 진행해줘」)
-- 선행: 34_nilai_docs.sql(mt_has_role · mt_actor_name 은 그 전부터)
--
-- 왜 — 참고 사항·취소및환불정보·유의사항을 항목(조건 포함) 단위로 두고, 담당자가 「기본 문안 설정」에서 고치면 이후 문서에 적용되게.
--   한 행(key 'clauses')에 { incl, excl, meeting, items:[…] } 를 jsonb 로 둔다. 없으면 화면이 nilai-logic.js 의 기본값을 쓴다.
-- 누가 보나 — admin · sales · manage 만(nilai_docs 와 같다). anon 0. 삭제 정책 없음(「기본값으로 되돌리기」는 update).
-- version — 트리거가 1씩 올린다. 화면은 version=eq.N 조건으로 PATCH 해 먼저 저장한 사람을 이긴다(0행이면 다시 불러온다).
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub(또는 MCP execute_sql · apply_migration 은 쓰지 않는다) · 2026-10-02 실행.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.nilai_settings (
  key           text        primary key,
  data          jsonb       not null default '{}'::jsonb,
  version       bigint      not null default 1,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  updated_by_id uuid references auth.users(id) on delete set null
);

comment on table public.nilai_settings is
  '닐라이 견적·확정서(tools/nilai) 기본 문안 설정 — key ''clauses'' 한 행: 참고 사항·취소·유의사항 항목(조건 포함) + 포함/불포함/미팅 기본값. '
  '담당자가 고치면 이후 문서에 적용 · 보낸 내역은 그때 문안을 스냅샷으로 따로 든다(2026-10-02).';

create or replace function public.mt_ns_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if tg_op = 'INSERT' then
      new.version := 1;
    else
      new.version := coalesce(old.version, 1) + 1;
    end if;
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), new.updated_by);
    return new;
  end;
$$;

revoke execute on function public.mt_ns_stamp() from public, anon, authenticated;

drop trigger if exists trg_ns_stamp on public.nilai_settings;
create trigger trg_ns_stamp before insert or update on public.nilai_settings
  for each row execute function public.mt_ns_stamp();

alter table public.nilai_settings enable row level security;

drop policy if exists ns_select on public.nilai_settings;
drop policy if exists ns_insert on public.nilai_settings;
drop policy if exists ns_update on public.nilai_settings;

create policy ns_select on public.nilai_settings
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','manage']));

create policy ns_insert on public.nilai_settings
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage']));

create policy ns_update on public.nilai_settings
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

revoke all on public.nilai_settings from anon;
grant select, insert, update on public.nilai_settings to authenticated;
