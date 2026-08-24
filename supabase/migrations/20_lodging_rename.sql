-- ════════════════════════════════════════════════════════════════
-- 20_lodging_rename.sql — 야마나미 숙소 이름 변경에 저장된 값을 맞춘다
--                          (멱등 · 비파괴)
--
-- 2026-08 확정 — 야마나미 리조트 안 숙소는 리조트 이름을 떼고 각자 이름을 쓴다.
--   야마나미 프레스티지          → 프레스티지 하우스
--   야마나미 히노키빌라 - 캐빈    → 히노키 캐빈
--   야마나미 히노키빌라 - 패밀리  → 소보 패밀리
--   야마나미 프라이빗 레지던스    → 쿠주 프라이빗 레지던스
--   야마나미 포레스트 돔         → 돔스테이
--   야마나미 호텔(본관)          그대로
--
-- 왜 SQL 이 필요한가 — mt_block_override 는 (hotel, room, ymd) 가 기본키이고
-- hotel 에 숙소 **이름**이 그대로 들어간다. 코드에서 이름만 바꾸면 저장돼 있던
-- 웹 오픈 수량 조정 행이 옛 이름으로 남아 **영영 매칭되지 않는다.**
-- 화면에는 조정이 사라진 것처럼 보이고, 잔여가 조정 전 값으로 돌아간다 —
-- 즉 **없는 방을 파는 쪽으로** 틀린다.
--
-- resort_master 는 손댈 것이 없다. name 은 MASTER_CODE_OWNED 라 코드가 이기고
-- (저장본이 덮어쓰지 못한다), 배포하면 모든 PC 에 새 이름이 내려간다.
--
-- ⚠ 실행 순서 — 이 SQL 과 코드 배포는 **어느 쪽이 먼저여도 된다.**
--   먼저 실행하면 잠깐 새 이름 행을 옛 코드가 못 읽고,
--   나중에 실행하면 잠깐 옛 이름 행을 새 코드가 못 읽는다.
--   어느 쪽이든 조정값이 잠시 안 보일 뿐 데이터는 잃지 않는다.
--   되도록 가까운 시각에 함께 하는 것이 좋다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
-- ════════════════════════════════════════════════════════════════

-- ── 바꾸기 전에 무엇이 얼마나 있는지 본다 (실행해도 아무것도 안 바뀐다) ──
--   select hotel, count(*) from public.mt_block_override
--    where hotel in ('야마나미 프레스티지','야마나미 히노키빌라 - 캐빈',
--                    '야마나미 히노키빌라 - 패밀리','야마나미 프라이빗 레지던스',
--                    '야마나미 포레스트 돔')
--    group by hotel order by hotel;

do $$
declare
  m text[][] := array[
    ['야마나미 프레스티지',          '프레스티지 하우스'],
    ['야마나미 히노키빌라 - 캐빈',    '히노키 캐빈'],
    ['야마나미 히노키빌라 - 패밀리',  '소보 패밀리'],
    ['야마나미 프라이빗 레지던스',    '쿠주 프라이빗 레지던스'],
    ['야마나미 포레스트 돔',         '돔스테이']
  ];
  i int;
  moved int;
  clashed int;
begin
  for i in 1 .. array_length(m, 1) loop
    /* 새 이름 자리에 이미 행이 있으면(두 번 실행했거나 사람이 손으로 넣었으면)
       기본키가 겹쳐 update 가 통째로 실패한다. 겹치는 것만 먼저 세어 두고
       옛 행을 지운다 — 새 이름 쪽이 최신이므로 그쪽을 남기는 것이 맞다. */
    delete from public.mt_block_override o
     where o.hotel = m[i][1]
       and exists (select 1 from public.mt_block_override n
                    where n.hotel = m[i][2] and n.room = o.room and n.ymd = o.ymd);
    get diagnostics clashed = row_count;

    update public.mt_block_override
       set hotel = m[i][2]
     where hotel = m[i][1];
    get diagnostics moved = row_count;

    if moved > 0 or clashed > 0 then
      raise notice '% → % : % 행 옮김%', m[i][1], m[i][2], moved,
        case when clashed > 0 then format(' (겹쳐서 버린 옛 행 %s)', clashed) else '' end;
    end if;
  end loop;
end $$;

-- ── 확인 ─────────────────────────────────────────────────────────
-- 옛 이름이 하나도 안 남아야 한다(0행이 정상):
--   select hotel, count(*) from public.mt_block_override
--    where hotel like '야마나미 히노키빌라%' or hotel like '야마나미 프레스티지%'
--       or hotel like '야마나미 프라이빗%'   or hotel like '야마나미 포레스트%'
--    group by hotel;
--
-- 새 이름으로 옮겨 왔는지:
--   select hotel, count(*) from public.mt_block_override
--    where hotel in ('프레스티지 하우스','히노키 캐빈','소보 패밀리',
--                    '쿠주 프라이빗 레지던스','돔스테이')
--    group by hotel order by hotel;
