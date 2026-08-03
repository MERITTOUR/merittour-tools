-- ════════════════════════════════════════════════════════════════
-- 09_change_log.sql — 변경 이력 (누가·언제·무엇을 얼마에서 얼마로)
--                     (신규 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql (mt_has_role), 08_resort_master_shared.sql (mt_actor_name)
--       — 08 을 먼저 실행하지 않으면 mt_mcl_stamp 가 없는 함수를 부른다.
--
-- 왜 한 테이블인가
--   축별로 나누면 「오늘 누가 무엇을 바꿨나」를 보려고 다섯 번 질의해야 한다.
--   scope 한 칼럼으로 합치고 인덱스 셋만 둔다.
--
-- 왜 스냅샷(resort_master_history)만으로 안 되는가
--   스냅샷은 「무엇으로 되돌리나」에 답하고, 이 표는 「누가 무엇을 무엇으로
--   바꿨나」에 답한다. 19개 숙소 × 25필드를 클라이언트가 매번 diff 하게 만들면
--   이력이 쌓일수록 못 쓰게 된다. 둘은 택일이 아니라 2층이다.
--
-- 왜 before_val/after_val 을 따로 두는가
--   지금 화면 이력은 '₩1,200,000'·'(자동 12000)'·'(없음)'·'3건' 처럼 표시용으로
--   가공된 문자열이라 기계가 되돌릴 수 없다. 표시용과 원본값을 분리해 둔다.
--   (되돌리기 기능 자체는 지금 만들지 않는다 — 룸타입 삭제 한 번이 rooms·roomMeta·
--    roomAlias·roomExceptions 넷을 동시에 바꾸므로 값 하나만 되돌리면 없는 룸타입에
--    보유가 붙는다. 되돌리기는 스냅샷 통짜 단위로만 제공한다.)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.mt_change_log (
  id           bigint generated always as identity primary key,
  scope        text not null
               check (scope in ('master','common','booking','settle','verify','block','registry')),
  target       text not null default '',   -- 숙소명 / 행사번호 / 출발월 …
  field        text not null default '',   -- 항목 라벨(사람이 읽는 말)
  before_text  text,                       -- 표시용(지금 화면이 쓰던 값 그대로)
  after_text   text,
  before_val   jsonb,                      -- 가공 전 원본(나중에 되돌리기를 만들 때 쓴다)
  after_val    jsonb,
  path         text,                       -- 예: 'resort.yamanami_golf.rooms.트윈'
  ref_version  bigint,                     -- 그 시점 resort_master.version
  actor_id     uuid references auth.users(id) on delete set null,
  actor_name   text,
  changed_at   timestamptz not null default now()
);

comment on table public.mt_change_log is
  '전 직원 공유 변경 이력. append-only — update/delete 정책을 만들지 않는다. '
  'actor_id/actor_name/changed_at 은 클라이언트가 보낸 값을 무시하고 트리거가 박는다.';

create index if not exists mcl_at_idx
  on public.mt_change_log (changed_at desc);
create index if not exists mcl_scope_target_idx
  on public.mt_change_log (scope, target, changed_at desc);
create index if not exists mcl_actor_idx
  on public.mt_change_log (actor_id, changed_at desc);

-- ── 작성자 스탬프 ───────────────────────────────────────────────
create or replace function public.mt_mcl_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.actor_id   := auth.uid();
    new.actor_name := coalesce(public.mt_actor_name(), '');
    new.changed_at := now();
    return new;
  end;
$$;

drop trigger if exists trg_mcl_stamp on public.mt_change_log;
create trigger trg_mcl_stamp before insert on public.mt_change_log
  for each row execute function public.mt_mcl_stamp();

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.mt_change_log enable row level security;

drop policy if exists mcl_select on public.mt_change_log;
create policy mcl_select on public.mt_change_log
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- 이력을 감추면 다시 물어보게 된다 — 읽기는 air 포함 전원.
drop policy if exists mcl_insert on public.mt_change_log;
create policy mcl_insert on public.mt_change_log
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage'])
              and actor_id = auth.uid());

-- update/delete 정책은 만들지 않는다. 오등록 정정도 삭제가 아니라
-- 반대 방향 기록으로 남긴다. 지울 수 있으면 이력이 아니다.

revoke all on public.mt_change_log from anon;
grant select, insert on public.mt_change_log to authenticated;
