-- ════════════════════════════════════════════════════════════════
-- 07_data_registry_block.sql — 등록소에 블록표(호텔별 예약현황) 추가
--                              (신규 컬럼만 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql, 05_data_registry.sql
--
-- 목적: 지금은 직원마다 엠클릭 「호텔별 예약현황」을 각자 붙여넣는다. 같은 달을
--       한 사람만 붙여넣으면 전 직원이 같은 잔여를 보도록 등록소에 함께 담는다.
--
-- 왜 예약리스트와 같은 행(period)에 두는가:
--   잔여 = 보유 − 사용 이고, 사용은 블록표에서, 보유·팀 정보는 마스터·예약리스트에서
--   온다. 같은 달 데이터가 따로 놀면 어떤 조합으로 계산했는지 알 수 없다.
-- ════════════════════════════════════════════════════════════════

alter table public.data_registry
  add column if not exists block_rows  jsonb,        -- blkParse() 결과 [{hotel,room,day,used}]
  add column if not exists block_raw   text,         -- 붙여넣은 원문(파서 문제 재현용)
  add column if not exists block_month text,         -- 표가 실제로 가리키는 달 'YYYY-MM'
  add column if not exists block_by    text,         -- 등록자 표시명
  add column if not exists block_at    timestamptz;  -- 등록 시각

comment on column public.data_registry.block_rows is
  '엠클릭 호텔별 예약현황 파싱 결과. 원문이 아니라 파싱 결과를 정본으로 둔다 — 원문만 두면 파서가 바뀔 때 과거 달의 잔여가 조용히 달라진다.';
comment on column public.data_registry.block_raw is
  '붙여넣은 원문. 파싱이 틀렸을 때 재현하려면 원본이 필요하다.';
comment on column public.data_registry.block_month is
  '표가 가리키는 달. period 와 다르면 7월 표를 8월에 올린 것이므로 등록 페이지에서 막는다.';

-- 사용 0인 달도 정상 등록 상태다(예약이 아직 없는 달). 그래서 기본값을 빈 배열로 두지 않고
-- null 로 남겨 「아직 안 올림(null)」과 「올렸는데 사용 0([])」을 구분한다.
-- 이 구분이 없으면 다음 달 미등록을 「사용 0」으로 오해해 월 경계 연박이 잘못 계산된다.

-- 목록 화면에서 「블록표 있음」을 빠르게 표시하기 위한 인덱스
create index if not exists data_registry_has_block_idx
  on public.data_registry ((block_rows is not null));

-- 권한·RLS 는 05 에서 테이블 단위로 이미 설정됨(컬럼 추가라 그대로 적용된다).
