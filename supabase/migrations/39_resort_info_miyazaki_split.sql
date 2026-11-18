-- ════════════════════════════════════════════════════════════════
-- 39_resort_info_miyazaki_split.sql — 리조트 정보(tools/resortinfo) 미야자키 한 행을 상품 두 개로 나눈다  (한 번만 · 비파괴)
-- 선행: 31 · 33 · 38
--
-- 왜 — 미야자키 2027 은 상품이 둘이다(① 국제공항CC 호텔 5박 · ② 국제공항CC 호텔 2박 + 시내 호텔 3박). 한 행(miyazaki)에 「① … / ② …」로
--   섞어 적던 것을 나눈다(2026-11-18 · Min 「미야자키 국제공항 상품과 시내상품을 두개로 분리해야함」). 화면 이름은 miyazaki = 「미야자키 국제공항CC 상품」,
--   miyazaki_city = 「미야자키 시내 상품」. 대시보드 리조트 마스터는 「미야자키 상품 호텔」 한 줄 그대로다(블록·웹오픈 조정 키).
-- 어떻게 — miyazaki_city 행이 아직 없을 때만 돈다: miyazaki 행을 통째로 복사해 miyazaki_city 를 만들고 ② 값으로 갈아 끼운 뒤,
--   miyazaki 행은 ① 값으로 갈아 끼우고 ② 전용인 체류일 특이사항(day_stay)을 뺀다. 두 상품이 같은 항목(도착 공항 · 항공편 · 수하물 · 체재비 ·
--   송영비 · 출·귀국일 · 단독 사용 요금 · 현지 지불 · 추가 항목)은 담당자가 적은 값 그대로 두 행에 있다. miyazaki_city 가 이미 있으면 아무것도 안 한다.
--
-- 실행: 프로젝트 Merittour-hub · execute_sql 로 이 파일 내용을 그대로 돌린다(apply_migration 쓰지 말 것) · 2026-11-18 실행.
-- ════════════════════════════════════════════════════════════════

with src as (
  select data from public.resort_info where resort_key = 'miyazaki'
), ins as (
  insert into public.resort_info (resort_key, data, version, updated_by)
  select 'miyazaki_city',
         jsonb_set(src.data, '{items}', coalesce(src.data->'items', '{}'::jsonb) || $j${"golf": "국제공항CC 2회 · 레인보우CC 2회 — 18홀 + 9홀 서비스 라운딩(숙소를 옮기는 화요일은 18홀) · 주말·일본 공휴일 18홀 · 출·귀국일 라운딩 없음", "lunch": "레인보우CC 라운딩일(수·목) 클럽식 · 국제공항CC 라운딩일(월·화)과 귀국일은 불포함", "dinner": "불포함 · 도착일 저녁은 크로스몰 개별 식사", "day_stay": {"icn": "화요일 국제공항CC 18홀 후 미야자키 시내 호텔로 이동"}, "patterns": "일→금 5박 6일 — 국제공항CC 호텔 2박(일·월) + 미야자키 시내 호텔 3박(화·수·목) · 운영 2027-03-28(일) ~ 11-28(일) 출발 · 제외 출발일 4/25 · 5/2 · 8/8 · 9/26 · 10/3 · 10/17(그 날은 국제공항CC 상품으로)", "breakfast": "매일 호텔식", "two_bag": "주말·일본 공휴일에 한해 2인 플레이 시 — 국제공항CC 1인 20,000원 · 레인보우CC 1인 10,000원", "guide_desc": "국제공항CC 호텔 — 골프장 안 호텔 · 2박(일 · 월) · 2인 1실\n미야자키 시내 호텔 — 선프라자호텔 또는 메인호텔 · 3박(화 · 수 · 목) · 2인 1실", "room_inventory": "국제공항CC 호텔 2박 + 시내 호텔(선프라자호텔 또는 메인호텔 · 배정 방식 확인 필요) 3박 · 10실(20명) · 2인 1실", "sales_note": "9/24~10/6 미야자키 국민체육대회 기간(9/26 · 10/3 출발) 마감 · 제외 출발일 4/25 · 5/2 · 8/8 · 9/26 · 10/3 · 10/17 · 확인 대기: 크로스몰 1,500엔 식비 지속 여부 · 시내 호텔 배정 방식"}$j$::jsonb),
         1, '미야자키 상품 분리(시내 상품)'
  from src
  where not exists (select 1 from public.resort_info where resort_key = 'miyazaki_city')
  returning resort_key
)
update public.resort_info
set data = jsonb_set(data, '{items}', (coalesce(data->'items', '{}'::jsonb) - 'day_stay') || $j${"golf": "국제공항CC 4회(월~목) — 18홀 + 9홀 서비스 라운딩(9홀 서비스는 확인 필요) · 주말·일본 공휴일 18홀 · 출·귀국일 라운딩 없음", "lunch": "불포함", "dinner": "월~목 호텔식 · 도착일 저녁은 크로스몰 개별 식사", "patterns": "일→금 5박 6일 — 국제공항CC 호텔 5박 · 운영 2027-03-28(일) ~ 11-28(일) 출발 · 시내 상품이 마감인 출발일(9/26 · 10/3)에도 예약 가능", "breakfast": "매일 호텔식", "two_bag": "주말·일본 공휴일에 한해 2인 플레이 시 — 국제공항CC 1인 20,000원", "guide_desc": "국제공항CC 호텔 — 골프장 안 호텔 · 5박 · 2인 1실", "room_inventory": "국제공항CC 호텔 5박 · 10실(20명) · 2인 1실", "sales_note": "9/24~10/6 미야자키 국민체육대회 기간(9/26 · 10/3 출발)은 시내 상품 마감 · 이 상품은 예약 가능(석식 포함 · 중식 불포함) · 확인 대기: 9홀 서비스 · 4/25 · 5/2 · 8/8 · 10/17 출발도 이 상품은 가능한지"}$j$::jsonb),
    version = version + 1,
    updated_by = '미야자키 상품 분리(국제공항CC 상품)'
where resort_key = 'miyazaki' and exists (select 1 from ins);
