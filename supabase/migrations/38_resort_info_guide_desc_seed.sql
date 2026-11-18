-- ════════════════════════════════════════════════════════════════
-- 38_resort_info_guide_desc_seed.sql — 리조트 정보(tools/resortinfo) 「숙소 소개 (2027 안내문)」 초안  (멱등 · 비파괴)
-- 선행: 31_resort_info.sql
--
-- 왜 — 2027 예약 안내문(merittour.github.io/2027/)의 숙소 카드 설명 문구를 리조트 정보에서도 참고할 수 있게 한다
--   (2026-11-18 · Min 「리조트 정보에 이 내용들 참고할 수 있게 넣어줘」 · 아소 프레스티지 · 히노키 스테이 · 소보 테라스 · 돔스테이 카드 캡처).
--   안내문 카드 17장의 lg-desc 를 옮겼다 — 「상시예약 기간 오픈」 칩 · NEW 배지 · 간지호텔의 「위 라운딩 안내」 같은 안내문 안 표현만 정리했다.
--   무츠키 료칸 · 구마모토 시내 · 닐라이는 안내문에 카드가 없어 넣지 않았다. 문구의 기준은 안내문이다 — 바뀌면 안내문을 먼저 고친다.
-- 어떻게 — 37 과 같은 병합(같은 키는 담당자가 적은 값이 이긴다 · 바뀐 것이 없으면 건드리지 않는다). 재실행해도 같은 결과. 삭제는 하지 않는다.
--   항목 키 = 화면 GROUPS 'basic' 의 guide_desc.
--
-- 실행: 프로젝트 Merittour-hub · execute_sql 로 이 파일 내용을 그대로 돌린다(apply_migration 쓰지 말 것).
-- ════════════════════════════════════════════════════════════════

with seed (resort_key, items) as (
  values
    ('yamanami_golf', $j${"guide_desc": "골프장과 호텔이 한 곳에 있는 일체형 리조트의 본관 · 창밖으로 펼쳐지는 아소산 전경 · 2인 1실 트윈 · 대욕장 · 노래방 · 당구장 · 빨래방 · 골프숍 · 가성비 좋은 정통 골프 리조트"}$j$::jsonb),
    ('yamanami_bessou', $j${"guide_desc": "아소 코스 속, 오붓하게 소중한 분들과 함께 머무는 8인 별장 · 1동 · 야마나미 호텔에서 250m · 호텔 이동용 카트 제공 · 취사 불가 · 상시예약 기간(11월 30일(월) 오전 10시)부터 예약"}$j$::jsonb),
    ('yamanami_hinoki_cabin', $j${"guide_desc": "편백으로 지은 2인 별장 · 3동 · 야마나미 호텔에서 100m · 호텔 이동용 카트 제공 · 취사 불가"}$j$::jsonb),
    ('yamanami_hinoki_family', $j${"guide_desc": "네 분만을 위한 4인 독채 별장 · 1동 · 야마나미 호텔에서 50m · 취사 불가 · 2027 신규"}$j$::jsonb),
    ('yamanami_dome', $j${"guide_desc": "아소 코스 옆 아늑한 2인 돔형 숙소 · 4동 · 야마나미 호텔에서 200m · 호텔 이동용 카트 제공 · 취사 불가"}$j$::jsonb),
    ('kuzu', $j${"guide_desc": "장기숙박 이용권 회원님 전용 · 쿠쥬 코스 옆 2025년 신축 별장형 롯지 · 침실 · 주방 · 세탁기를 갖춘 단독주택 · 2인 1동 · 야마나미 호텔에서 차로 2분 · 호텔 이동 송영 서비스 제공 · 취사 불가"}$j$::jsonb),
    ('ganji', $j${"guide_desc": "쿠쥬 고겐(구주 고원)에 있는 온천 호텔 · 쿠쥬고겐CC와 아소 야마나미CC 두 곳을 도는 일정(쿠쥬고겐CC는 골프장 사정에 따라 아소 야마나미CC로 바뀔 수 있음 · 2027 쿠쥬고겐CC 라운딩이 없는 날짜는 안내문 구마모토 라운딩 안내 참고) · 호텔 온천 외에 가까운 아카가와 온천도 이용 가능(입욕료 별도)"}$j$::jsonb),
    ('shizu', $j${"guide_desc": "700년 넘게 이어온 만간지 온천을 그대로 쓰는 일본 전통 료칸 · 다다미 객실 2인 1실 · 본관과 개인온천이 있는 별채 두 종류(예약을 따로 받습니다) · 아소 야마나미 리조트에서 차로 30분, 조용한 산촌"}$j$::jsonb),
    ('fourteen_golf', $j${"guide_desc": "트윈(2인) · 패밀리룸(4인) · 2명은 패밀리룸 예약 불가(트윈룸으로)"}$j$::jsonb),
    ('fourteen_caravan', $j${"guide_desc": "트윈(2인)"}$j$::jsonb),
    ('akiba', $j${"guide_desc": "2인 1실 · 투숙객 전용 온천탕 무료 이용"}$j$::jsonb),
    ('shirosato', $j${"guide_desc": "시로사토CC 호텔 · 골프장 안 숙소 · 2인 1실"}$j$::jsonb),
    ('fukuroda', $j${"guide_desc": "골프장 안 숙소 · 2인 1실"}$j$::jsonb),
    ('sugadaira_onsen', $j${"guide_desc": "2026년과 같은 숙소 · 고원 온천 호텔 · 온천 시설 이용 · 2인 1실 · 스가다이라 그린CC까지 차로 약 15분 · 운영 5월 11일 ~ 10월 27일(숙박일자 기준)"}$j$::jsonb),
    ('sugadaira_mansion', $j${"guide_desc": "2026년과 같은 숙소 · 레지던스형 맨션 · 2인 1실 · 스가다이라 그린CC까지 차로 약 25분 · 운영 7월 22일 ~ 9월 2일(숙박일자 기준)"}$j$::jsonb),
    ('miyazaki', $j${"guide_desc": "국제공항CC 호텔 — 골프장 안 호텔 · ① 5박 / ② 2박(일 · 월) · 2인 1실\n미야자키 시내 호텔 — 선프라자호텔 또는 메인호텔 · ② 3박(화 · 수 · 목) · 2인 1실"}$j$::jsonb)
)
insert into public.resort_info (resort_key, data, version, updated_by)
select s.resort_key, jsonb_build_object('origins', '["icn","pus"]'::jsonb, 'items', s.items, 'extra', '[]'::jsonb), 1, '2027 안내문 숙소 소개 초안'
from seed s
on conflict (resort_key) do update
set data = jsonb_set(coalesce(resort_info.data, '{}'::jsonb), '{items}',
                     coalesce(excluded.data->'items', '{}'::jsonb) || coalesce(resort_info.data->'items', '{}'::jsonb)),
    version    = resort_info.version + 1,
    updated_by = '2027 안내문 숙소 소개 초안(병합)'
where (coalesce(excluded.data->'items', '{}'::jsonb) || coalesce(resort_info.data->'items', '{}'::jsonb))
        is distinct from coalesce(resort_info.data->'items', '{}'::jsonb);
