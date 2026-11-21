-- ════════════════════════════════════════════════════════════════
-- 40_resort_info_status.sql — 리조트 정보(tools/resortinfo) 「운영 상태 (2027)」 값 넣기  (여러 번 돌려도 같음 · 비파괴)
-- 선행: 31 · 33 · 39
--
-- 왜 — 「예약 가능 여부」(키 bookable · O/X)를 「운영 상태 (2027)」 네 값으로 넓혔다(2026-11-21 · Min 「운영중인지 아닌지는 눌러보기 전에 알면 좋을 듯」).
--   O = 판매 중 · later = 상시예약 오픈 예정(11/30 10:00 부터 화면이 저절로 「판매 중」으로 보인다) · offline = 오프라인 접수 · 온라인 미오픈 · X = 2027 미운영.
--   시드(33)가 모두 「O」로 넣어 두어 실제와 다른 네 곳만 고친다:
--     아소 프레스티지(yamanami_bessou) · 무츠키 료칸(mutsuki) = later — 상시예약 기간 오픈(2026-10-08 · 2026-09-07 결정)
--     쿠쥬 프라이빗 타운(kuzu) = offline — 2026-10-07 온라인 예약에서 빼고 오프라인 접수
--     닐라이스프링스(nilai) = offline — 2027 운영함 · 온라인만 아직 안 열었다(2026-11-21 · Min 「2027년 오픈하는 거 맞아. 온라인에 아직 오픈하지 못한 것 뿐」)
-- 어떻게 — 값이 아직 「O」이거나 비어 있을 때만 바꾼다(담당자가 이미 다른 값으로 고쳤으면 그대로) · 바뀐 행만 version 을 올린다.
--
-- 실행: 프로젝트 Merittour-hub · execute_sql 로 이 파일 내용을 그대로 돌린다(apply_migration 쓰지 말 것) · 2026-11-21 실행.
-- ════════════════════════════════════════════════════════════════

update public.resort_info r
set data = jsonb_set(r.data, '{items,bookable}', to_jsonb(v.st)),
    version = r.version + 1,
    updated_by = '운영 상태 정리(2027)'
from (values ('yamanami_bessou', 'later'), ('mutsuki', 'later'), ('kuzu', 'offline'), ('nilai', 'offline')) as v(k, st)
where r.resort_key = v.k
  and coalesce(r.data->'items'->>'bookable', '') in ('', 'O');
