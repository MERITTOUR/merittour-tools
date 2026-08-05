-- ════════════════════════════════════════════════════════════════
-- 10_shared_overlays.sql — 개인 PC 에만 있던 업무값의 서버 그릇
--                          (신규 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql (mt_has_role), 08_resort_master_shared.sql (mt_actor_name)
--       — 08 을 먼저 실행하지 않으면 mt_actor_stamp 가 없는 함수를 부른다.
--
-- 담는 것
--   mt_event_overlay  행사 단위 덧칠 — 구분·호텔Y·명단Y·비고·팀명·실제호텔명·요금 보정
--   mt_pax_overlay    인원 단위 덧칠 — 보험 제외
--   mt_settle_adjust  정산 조정  (기존 localStorage 키 "eventSeq#idx" 를 두 칼럼으로)
--   mt_settle_deduction 정산 공제
--   mt_block_override 웹 오픈 수량(구 오버부킹 보정)
--
-- 왜 행사 단위 덧칠을 한 표에 모으는가
--   전부 eventSeq 하나를 키로 하는 같은 성격의 값이고, 표를 나누면 예약 한 줄을
--   그리려고 다섯 번 조인하게 된다.
-- ════════════════════════════════════════════════════════════════

-- ── 공용 작성자 스탬프 ──────────────────────────────────────────
create or replace function public.mt_actor_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), '');
    return new;
  end;
$$;

-- ── 1) 행사 단위 덧칠 ───────────────────────────────────────────
create table if not exists public.mt_event_overlay (
  event_seq      text primary key,
  status         text check (status is null or status in ('견적','대기','확정','정산')),
  hotel_y        boolean,
  list_y         boolean,
  remark         text,
  team_name      text,
  doc_hotel_name text,
  yen_etc        numeric,
  krw_etc        numeric,
  pkg_price      numeric,
  updated_at     timestamptz not null default now(),
  updated_by_id  uuid references auth.users(id) on delete set null,
  updated_by     text
);

comment on column public.mt_event_overlay.status is
  '엠클릭 구분 덮어쓰기. 취소로는 바꿀 수 없다(화면 화이트리스트와 같은 제약). '
  '확정서 대상·정산 대상·D-7 자동발송 대상을 정하므로 개인 PC 에 두면 안 된다.';

-- ── 2) 인원 단위 덧칠 ───────────────────────────────────────────
create table if not exists public.mt_pax_overlay (
  event_seq     text not null,
  pax_idx       int  not null,
  ins_excluded  boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (event_seq, pax_idx)
);

-- ── 3) 정산 조정 ────────────────────────────────────────────────
create table if not exists public.mt_settle_adjust (
  event_seq     text not null,
  pax_idx       int  not null,
  air_cost      numeric,
  air_src       text,
  ins           numeric,
  ins_src       text,
  local_rate    numeric,
  trans_fee     numeric,
  ex_stay       boolean not null default false,
  ex_trans      boolean not null default false,
  ex_mgmt       boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (event_seq, pax_idx)
);

-- ── 4) 정산 공제 ────────────────────────────────────────────────
create table if not exists public.mt_settle_deduction (
  id            text primary key,
  type          text not null,
  amount        numeric not null default 0,
  label         text,
  grp           text,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text
);

comment on table public.mt_settle_deduction is
  '쿠폰·포인트·선납 공제. 실정산액 = 체재+송영 − 공제 이므로 현지에 실제로 보내는 '
  '송금액을 정한다. 공제 행이 없는 PC 는 그만큼 더 보낸다.';

-- ── 5) 웹 오픈 수량 (구 오버부킹 보정) ──────────────────────────
create table if not exists public.mt_block_override (
  hotel         text not null,
  room          text not null,
  ymd           date not null,
  qty_delta     int  not null default 0,
  memo          text,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (hotel, room, ymd)
);

comment on table public.mt_block_override is
  '웹 오픈 수량 조정. 실제 보유 변경은 리조트 마스터의 기간 예외로 넣어야 한다 — '
  '이 표는 온라인 노출 수량 전용이고 화면 문구도 그렇게 고쳐 적는다.';

-- ── 트리거·RLS·권한 (다섯 표 공통) ──────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['mt_event_overlay','mt_pax_overlay','mt_settle_adjust',
                           'mt_settle_deduction','mt_block_override']
  loop
    execute format('drop trigger if exists trg_%s_stamp on public.%I', t, t);
    execute format('create trigger trg_%s_stamp before insert or update on public.%I '
                   'for each row execute function public.mt_actor_stamp()', t, t);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format('create policy %s_select on public.%I for select to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''air'',''manage'']))', t, t);

    execute format('drop policy if exists %s_insert on public.%I', t, t);
    execute format('create policy %s_insert on public.%I for insert to authenticated '
                   'with check (public.mt_has_role(array[''admin'',''sales'',''manage'']))', t, t);

    execute format('drop policy if exists %s_update on public.%I', t, t);
    execute format('create policy %s_update on public.%I for update to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''manage''])) '
                   'with check (public.mt_has_role(array[''admin'',''sales'',''manage'']))', t, t);

    execute format('drop policy if exists %s_delete on public.%I', t, t);
    execute format('create policy %s_delete on public.%I for delete to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''manage'']))', t, t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
