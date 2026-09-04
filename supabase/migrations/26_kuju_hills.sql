-- ════════════════════════════════════════════════════════════════
-- 26_kuju_hills.sql — 2인 독채 10동 이름을 「쿠주힐즈」로  (멱등 · 비파괴)
--
--   야마나미 프라이빗 레지던스  ┐
--   쿠주 프라이빗 레지던스      ┴→  쿠주힐즈
--
-- 2026-09 결정(Min) — 2026-08 의 「쿠주 프라이빗 레지던스」를 되돌린다. 회원권 이름
-- (쿠주힐즈 롱스테이)·엠클릭 상품명·가입 서류(tools/library)가 전부 「쿠주힐즈」라
-- 숙소만 다른 이름을 달고 있었다. 포틴힐즈처럼 「-힐즈」까지가 고유명이라 붙여 쓴다.
--
-- 왜 두 이름을 다 받나 — 20 을 이미 실행했으면 저장된 행이 「쿠주 프라이빗 레지던스」로
-- 있고, 아직 안 했으면 「야마나미 프라이빗 레지던스」로 있다. 둘 다 받아 두면 20 을
-- 돌렸든 안 돌렸든, 20 을 나중에 돌리든 결과가 같아진다.
-- (21_aso_prestige.sql · 22_hinoki_stay.sql · 23_sobo_terrace.sql 과 같은 방식이다)
--
-- 20 은 고치지 않았다. 이미 나간 마이그레이션을 손대면 「어디까지 돌렸는지」가
-- 사람마다 달라진다. 20 → 26 순서로 돌리면 「야마나미 프라이빗 레지던스 →
-- 쿠주 프라이빗 레지던스 → 쿠주힐즈」로 두 번 옮겨 갈 뿐 결과는 같다.
--
-- mt_block_override 는 (hotel, room, ymd) 가 기본키이고 hotel 에 숙소 이름이
-- 그대로 들어간다. 코드에서 이름만 바꾸면 저장된 웹 오픈 수량 조정이 옛 이름으로
-- 남아 영영 매칭되지 않는다 — 잔여가 조정 전 값으로 돌아가고, 그것은 없는 방을
-- 파는 쪽으로 틀린다.
--
-- resort_master 는 손댈 것이 없다. name 은 MASTER_CODE_OWNED 라 코드가 이긴다.
-- 내부 키 kuzu 도 그대로다 — 엠클릭 상품명이 「야마나미 쿠주힐즈」·「구주힐즈」 별칭으로
-- 걸려 있어 키를 바꾸면 매칭이 어긋난다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고
--        execute_sql 로 이 파일 내용을 그대로 돌린다)
-- ════════════════════════════════════════════════════════════════

-- ── 바꾸기 전에 보기 (실행해도 아무것도 안 바뀐다) ──
--   select hotel, count(*) from public.mt_block_override
--    where hotel in ('야마나미 프라이빗 레지던스','쿠주 프라이빗 레지던스','쿠주힐즈')
--    group by hotel order by hotel;

do $$
declare
  olds text[] := array['야마나미 프라이빗 레지던스', '쿠주 프라이빗 레지던스'];
  new_name text := '쿠주힐즈';
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
--    where hotel in ('야마나미 프라이빗 레지던스','쿠주 프라이빗 레지던스') group by hotel;
