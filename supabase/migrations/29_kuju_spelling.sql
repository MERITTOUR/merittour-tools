-- ════════════════════════════════════════════════════════════════
-- 29_kuju_spelling.sql — 2인 독채 10동 이름을 「쿠쥬 타운하우스」로  (멱등 · 비파괴)
--
--   야마나미 프라이빗 레지던스  ┐
--   쿠주 프라이빗 레지던스      ┼→  쿠쥬 타운하우스
--   쿠주힐즈                    ┤
--   쿠주 타운하우스             ┘
--
-- 2026-09-09 결정(Min) — 숙소·골프장 이름을 일본어 발음대로 적는다. 久住 = くじゅう → 「쿠쥬」
-- (「쿠주」는 폐기), 久住高原CC 는 「쿠쥬코겐CC」(高原 = こうげん · 탁음 없음). 영문 KUJU TOWNHOUSE ·
-- 내부 키 kuzu · 엠클릭 상품명 「쿠주힐즈」(aliases) 는 그대로다.
--
-- 왜 네 이름을 다 받나 — 20·26·28 을 어디까지 돌렸느냐에 따라 저장된 행이 넷 중 어느 이름으로도
-- 있을 수 있다. 다 받아 두면 앞의 것을 돌렸든 안 돌렸든 결과가 같아진다. (21~23·26~28 과 같은 방식)
--
-- mt_block_override 는 (hotel, room, ymd) 가 기본키이고 hotel 에 숙소 이름이 그대로 들어간다.
-- 코드에서 이름만 바꾸면 저장된 웹 오픈 수량 조정이 옛 이름으로 남아 영영 매칭되지 않는다.
-- resort_master 는 손댈 것이 없다. name 은 MASTER_CODE_OWNED 라 코드가 이긴다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고
--        execute_sql 로 이 파일 내용을 그대로 돌린다) · 2026-09-09 실행 — 옮길 행 0 이었다.
-- ════════════════════════════════════════════════════════════════

-- ── 바꾸기 전에 보기 (실행해도 아무것도 안 바뀐다) ──
--   select hotel, count(*) from public.mt_block_override
--    where hotel in ('야마나미 프라이빗 레지던스','쿠주 프라이빗 레지던스','쿠주힐즈','쿠주 타운하우스','쿠쥬 타운하우스')
--    group by hotel order by hotel;

do $$
declare
  olds text[] := array['야마나미 프라이빗 레지던스', '쿠주 프라이빗 레지던스', '쿠주힐즈', '쿠주 타운하우스'];
  new_name text := '쿠쥬 타운하우스';
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
--    where hotel in ('야마나미 프라이빗 레지던스','쿠주 프라이빗 레지던스','쿠주힐즈','쿠주 타운하우스') group by hotel;
