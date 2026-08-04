-- ════════════════════════════════════════════════════════════════
-- 11_registry_actor.sql — 등록소의 「누가」를 로그인 계정으로 못 박는다
--                         (트리거 추가 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql, 05_data_registry.sql, 07_data_registry_block.sql
--
-- 지금 서버에 남는 이름(uploader_name·block_by)은 게이트 화면에서 본인이 타이핑한
-- 자유 문자열이다. uploaded_by uuid 컬럼(05:18)은 있는데 값을 넣는 코드가 없다.
-- 재업로드 시 이름이 안 실리면 기존 값이 그대로 남아, 자료를 바꾼 사람은 B 인데
-- 이력에는 A 가 올린 것으로 남는다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.mt_dr_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.uploaded_by   := auth.uid();
    new.uploader_name := coalesce(public.mt_actor_name(), nullif(new.uploader_name, ''), '');
    -- 블록표를 이번에 새로 올린 경우에만 등록자를 갈아 끼운다.
    if new.block_at is not null
       and (tg_op = 'INSERT' or new.block_at is distinct from old.block_at) then
      new.block_by := new.uploader_name;
    end if;
    return new;
  end;
$$;

drop trigger if exists trg_dr_stamp on public.data_registry;
create trigger trg_dr_stamp before insert or update on public.data_registry
  for each row execute function public.mt_dr_stamp();
