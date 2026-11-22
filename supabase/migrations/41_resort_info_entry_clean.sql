-- ════════════════════════════════════════════════════════════════
-- 41_resort_info_entry_clean.sql — 리조트 정보 「일본 입국 신고용 숙소 정보」 네 칸에서 특수문자 빼기  (여러 번 돌려도 같음 · 비파괴)
-- 선행: 31 · 37
--
-- 왜 — 2026-11-22 · Min 「리조트 정보 입력한 곳에 특수문자를 모두 없애줘 ex) aso yamanami resort&hotel의 &」.
--   숙소 영문명(entry_name_en) · 영문 주소(entry_address) = 영문·숫자·띄어쓰기만(그 밖의 글자는 띄어쓰기로 바꾸고 겹친 띄어쓰기는 하나로) ·
--   우편번호(entry_postal) · 전화(entry_phone) = 숫자만. 화면(tools/resortinfo · tools/entry)도 같은 규칙으로 저장·출력할 때 뺀다.
--   스가다이라 맨션 주소 뒤에 붙어 있던 직원 메모(「 / ※맨션 주소를 …」)는 손님 안내문에 나가지 않게 주소에서 떼어 「추가 항목 · 입국 주소 메모」로 옮긴다.
-- 어떻게 — 바뀌는 행만 version 을 올린다(이력 트리거가 옛 값을 남긴다). 다른 칸은 건드리지 않는다.
--
-- 실행: 프로젝트 Merittour-hub · execute_sql 로 이 파일 내용을 그대로 돌린다(apply_migration 쓰지 말 것) · 2026-11-22 실행.
-- ════════════════════════════════════════════════════════════════

with calc as (
  select resort_key, data,
         case when data->'items'->>'entry_address' like '% / ※%'
              then btrim(split_part(data->'items'->>'entry_address', ' / ', 1)) end as addr_cut,
         case when data->'items'->>'entry_address' like '% / ※%'
              then btrim(substr(data->'items'->>'entry_address', strpos(data->'items'->>'entry_address', ' / ') + 3)) end as note
  from public.resort_info
  where data ? 'items'
), cleaned as (
  select resort_key, note,
         (select coalesce(jsonb_object_agg(k, case
                    when k in ('entry_name_en', 'entry_address') and jsonb_typeof(v) = 'string' then
                      to_jsonb(btrim(regexp_replace(regexp_replace(
                        case when k = 'entry_address' and addr_cut is not null then addr_cut else v #>> '{}' end,
                        '[^A-Za-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')))
                    when k in ('entry_postal', 'entry_phone') and jsonb_typeof(v) = 'string' then
                      to_jsonb(regexp_replace(v #>> '{}', '[^0-9]', '', 'g'))
                    else v end), '{}'::jsonb)
            from jsonb_each(data->'items') as e(k, v)) as items2
  from calc
)
update public.resort_info r
set data = jsonb_set(r.data, '{items}', c.items2)
           || case when c.note is not null
                   then jsonb_build_object('extra', coalesce(r.data->'extra', '[]'::jsonb)
                                                    || jsonb_build_array(jsonb_build_object('label', '입국 주소 메모', 'value', c.note)))
                   else '{}'::jsonb end,
    version = r.version + 1,
    updated_by = '입국 신고 정보 특수문자 정리'
from cleaned c
where r.resort_key = c.resort_key
  and c.items2 is distinct from r.data->'items';
