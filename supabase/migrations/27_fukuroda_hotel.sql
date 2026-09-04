-- ════════════════════════════════════════════════════════════════
-- 27_fukuroda_hotel.sql — 「골프텔」을 「호텔」로: 후쿠로다노타키CC 골프텔 → 후쿠로다노타키CC 호텔
--                          (멱등 · 비파괴)
--
-- 2026-09 결정(Min) — 손님 안내문·예약 화면·확정서에서 「골프텔」이라는 말을 쓰지 않는다.
-- 리조트 마스터 name 이 바뀌므로 mt_block_override(hotel, room, ymd 가 기본키)에
-- 저장된 웹 오픈 수량 조정 행을 같이 옮긴다 — 안 옮기면 옛 이름으로 남아 영영
-- 매칭되지 않고, 잔여가 조정 전 값으로 돌아간다(없는 방을 파는 쪽으로 틀린다).
--
-- 엠클릭 별칭(aliases)의 「○○CC 골프텔」은 엠클릭이 쓰는 표기라 그대로 둔다 —
-- 붙여넣은 표를 마스터에 맞추는 열쇠다. 바꿔야 하는 것은 화면에 보이는 이름뿐이다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고
--        execute_sql 로 이 파일 내용을 그대로 돌린다)
-- ════════════════════════════════════════════════════════════════

-- ── 바꾸기 전에 보기 (실행해도 아무것도 안 바뀐다) ──
--   select hotel, count(*) from public.mt_block_override
--    where hotel in ('후쿠로다노타키CC 골프텔','후쿠로다노타키CC 호텔')
--    group by hotel order by hotel;

do $$
declare
  olds text[] := array['후쿠로다노타키CC 골프텔'];
  new_name text := '후쿠로다노타키CC 호텔';
  i int;
  moved int;
  clashed int;
begin
  for i in 1 .. array_length(olds, 1) loop
    /* 새 이름 자리에 이미 행이 있으면 기본키가 겹쳐 update 가 통째로 실패한다.
       겹치는 옛 행을 먼저 지운다 — 새 이름 쪽이 최신이므로 그쪽을 남긴다. */
    delete from public.mt_block_override o
     where o.hotel = olds[i]
       and exists (select 1 from public.mt_block_override n
                    where n.hotel = new_name and n.room = o.room and n.ymd = o.ymd);
    get diagnostics clashed = row_count;

    update public.mt_block_override
       set hotel = new_name
     where hotel = olds[i];
    get diagnostics moved = row_count;

    if moved > 0 or clashed > 0 then
      raise notice '% → % : % 행 옮김%', olds[i], new_name, moved,
        case when clashed > 0 then format(' (겹쳐서 버린 옛 행 %s)', clashed) else '' end;
    end if;
  end loop;
end $$;

-- ── 확인 ─────────────────────────────────────────────────────────
-- 옛 이름이 하나도 안 남아야 한다(0행이 정상):
--   select hotel, count(*) from public.mt_block_override
--    where hotel = '후쿠로다노타키CC 골프텔' group by hotel;
