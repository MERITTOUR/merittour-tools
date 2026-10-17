-- ════════════════════════════════════════════════════════════════
-- 37_resort_info_entry_seed.sql — 리조트 정보(tools/resortinfo) 「일본 입국 신고용 숙소 정보」 초안  (멱등 · 비파괴)
-- 선행: 31_resort_info.sql · (33_resort_info_seed_2027.sql 로 행이 이미 있다 — 없어도 만든다)
--
-- 왜 — 손님이 Visit Japan Web·종이 신고서의 숙소 칸에 적는 값(영문명 · 우편번호 · 영문 주소 · 전화)을 리조트마다 두고,
--   영업 허브 「일본 입국 안내 문안」(tools/entry)이 그 값으로 발송 문안을 만든다(2026-10-17 · Min 「sales에 각 리조트 별 주소도
--   바로 손님한테 안내 나갈 수 있게 양식 만들어줘 · 기존꺼 보내줘볼게」). Min 이 쓰던 안내문의 아소 야마나미 값만 옮겼다 —
--   리조트 안 숙소 6곳(야마나미 호텔 · 아소 프레스티지 · 돔스테이 · 히노키 스테이 · 소보 테라스 · 쿠쥬 프라이빗 타운)은 같은 리조트 주소.
--   다른 리조트의 주소는 넣지 않는다 — 손님이 신고서에 적는 값이라 담당자가 공식 표기를 확인해 화면에서 입력한다(추측으로 채우지 않는다).
-- 어떻게 — 행이 없으면 만들고, 있으면 항목을 병합한다(같은 키는 담당자가 적은 값이 이긴다 · 바뀐 것이 없으면 건드리지 않는다 · version 그대로).
--   재실행해도 같은 결과. 삭제는 하지 않는다. 항목 키는 화면 GROUPS 'entry' 의 k 와 같다(entry_name_en · entry_postal · entry_address · entry_phone).
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
--       (schema_migrations 표가 없는 프로젝트다 — apply_migration 을 쓰지 말고 execute_sql 로 이 파일 내용을 그대로 돌린다) · 2026-10-17 실행.
-- ════════════════════════════════════════════════════════════════

with seed (resort_key, items) as (
  values
    ('yamanami_golf',          $j${"entry_name_en": "ASO YAMANAMI RESORT HOTEL & GOLF CLUB", "entry_postal": "869-2702", "entry_address": "630 Ori, Ubuyama, Aso District, Kumamoto", "entry_phone": "+81-967-25-2331"}$j$::jsonb),
    ('yamanami_bessou',        $j${"entry_name_en": "ASO YAMANAMI RESORT HOTEL & GOLF CLUB", "entry_postal": "869-2702", "entry_address": "630 Ori, Ubuyama, Aso District, Kumamoto", "entry_phone": "+81-967-25-2331"}$j$::jsonb),
    ('yamanami_dome',          $j${"entry_name_en": "ASO YAMANAMI RESORT HOTEL & GOLF CLUB", "entry_postal": "869-2702", "entry_address": "630 Ori, Ubuyama, Aso District, Kumamoto", "entry_phone": "+81-967-25-2331"}$j$::jsonb),
    ('yamanami_hinoki_cabin',  $j${"entry_name_en": "ASO YAMANAMI RESORT HOTEL & GOLF CLUB", "entry_postal": "869-2702", "entry_address": "630 Ori, Ubuyama, Aso District, Kumamoto", "entry_phone": "+81-967-25-2331"}$j$::jsonb),
    ('yamanami_hinoki_family', $j${"entry_name_en": "ASO YAMANAMI RESORT HOTEL & GOLF CLUB", "entry_postal": "869-2702", "entry_address": "630 Ori, Ubuyama, Aso District, Kumamoto", "entry_phone": "+81-967-25-2331"}$j$::jsonb),
    ('kuzu',                   $j${"entry_name_en": "ASO YAMANAMI RESORT HOTEL & GOLF CLUB", "entry_postal": "869-2702", "entry_address": "630 Ori, Ubuyama, Aso District, Kumamoto", "entry_phone": "+81-967-25-2331"}$j$::jsonb)
)
insert into public.resort_info (resort_key, data, version, updated_by)
select s.resort_key, jsonb_build_object('origins', '["icn","pus"]'::jsonb, 'items', s.items, 'extra', '[]'::jsonb), 1, '입국 신고용 숙소 정보 초안'
from seed s
on conflict (resort_key) do update
set data = jsonb_set(coalesce(resort_info.data, '{}'::jsonb), '{items}',
                     coalesce(excluded.data->'items', '{}'::jsonb) || coalesce(resort_info.data->'items', '{}'::jsonb)),
    version    = resort_info.version + 1,
    updated_by = '입국 신고용 숙소 정보 초안(병합)'
where (coalesce(excluded.data->'items', '{}'::jsonb) || coalesce(resort_info.data->'items', '{}'::jsonb))
        is distinct from coalesce(resort_info.data->'items', '{}'::jsonb);
