-- ════════════════════════════════════════════════════════════════
-- 15_access_requests.sql — 계정 신청함 + 이메일 동기화  (멱등 · 비파괴)
--
-- ① 계정 신청함
--    지금은 로그인 화면이 「계정 발급·승인은 관리자에게 문의해 주세요」라고만
--    적어 둔다. 어디로 어떻게 문의하는지가 없어서, 신규 직원은 결국 아는 사람에게
--    카톡으로 묻는다. 신청을 받아 두는 자리를 만든다.
--
--    흐름 — 직원이 로그인 화면에서 신청 → 여기 한 줄 → owner 가 admin/users/ 에서
--    보고 Supabase 콘솔에서 초대(메일 발송) → 직원이 링크로 비밀번호 설정 →
--    app_users 에 air·비활성 생성 → owner 가 승인·섹션 지정.
--
-- ② app_users.email 동기화
--    04 의 트리거는 가입 **시점에** email 을 한 번 복사할 뿐이다. 그래서 콘솔에서
--    로그인 이메일을 바꾸면 auth.users 만 바뀌고 app_users.email 은 옛 주소로
--    남는다 — 계정 관리 화면이 계속 옛 주소를 보여 준다. 갱신 트리거를 단다.
--
-- ⚠ anon 예외 — 13_lock_anon.sql 은 anon 노출을 0 으로 닫았고 「anon 대상 정책이
--    남아 있는 표」 질의가 빈 결과여야 한다고 적어 두었다. 이 파일이 **의도적으로
--    한 건**을 남긴다: access_requests 의 insert 하나. 로그인 전에 쓰는 폼이라
--    다른 방법이 없다. 대신
--      · select · update · delete 는 anon 에게 주지 않는다(써넣기만 된다)
--      · 형식·길이를 with check 로 막고 status 는 pending 으로 고정한다
--      · 같은 주소의 대기 신청은 하나만 남긴다
--    13 의 점검 질의에서 이 한 줄이 나오는 것은 정상이다.
--
-- 실행: Supabase 콘솔 → SQL Editor → 프로젝트 Merittour-hub
-- ════════════════════════════════════════════════════════════════

-- ── 1) 신청함 ───────────────────────────────────────────────────
create table if not exists public.access_requests (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text not null,
  dept       text,
  note       text,
  status     text not null default 'pending'
             check (status in ('pending','invited','rejected')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

comment on table public.access_requests is
  '계정 신청함. 로그인 전 화면에서 anon 이 insert 만 할 수 있다(13 의 anon 0 원칙에 대한 의도된 예외).';

-- 같은 주소로 대기 중인 신청은 하나만. 두 번 눌러도 줄이 늘지 않는다.
create unique index if not exists access_requests_pending_email_idx
  on public.access_requests (lower(email)) where status = 'pending';

create index if not exists access_requests_status_idx
  on public.access_requests (status, created_at desc);

-- ── 2) RLS ──────────────────────────────────────────────────────
alter table public.access_requests enable row level security;

-- 신청은 로그인 전에 쓴다. **써넣기만** 된다 — 읽기는 주지 않는다.
-- with check 로 형식과 길이를 막는다. 서버에서 막지 않으면 화면 검사는
-- 개발자 도구로 그냥 지나칠 수 있다.
drop policy if exists ar_insert_anon on public.access_requests;
create policy ar_insert_anon on public.access_requests
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and handled_at is null
    and handled_by is null
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'
    and length(email) between 5 and 120
    and length(btrim(name)) between 1 and 40
    and (dept is null or length(dept) <= 40)
    and (note is null or length(note) <= 300)
  );

-- 목록을 보고 처리하는 것은 owner·admin 만.
drop policy if exists ar_select_admin on public.access_requests;
create policy ar_select_admin on public.access_requests
  for select to authenticated using (public.mt_is_admin());

drop policy if exists ar_update_admin on public.access_requests;
create policy ar_update_admin on public.access_requests
  for update to authenticated
  using (public.mt_is_admin()) with check (public.mt_is_admin());

drop policy if exists ar_delete_owner on public.access_requests;
create policy ar_delete_owner on public.access_requests
  for delete to authenticated using (public.mt_is_owner());

revoke all on public.access_requests from anon;
grant insert on public.access_requests to anon;
grant select, insert, update, delete on public.access_requests to authenticated;

-- ── 3) app_users.email 을 auth 와 맞춘다 ────────────────────────
-- 콘솔에서 로그인 이메일을 바꿔도 app_users 는 옛 주소로 남던 것을 고친다.
create or replace function public.mt_on_auth_user_updated()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if new.email is distinct from old.email then
      update public.app_users set email = new.email where id = new.id;
    end if;
    return new;
  end;
$$;

drop trigger if exists trg_auth_user_updated on auth.users;
create trigger trg_auth_user_updated
  after update of email on auth.users
  for each row execute function public.mt_on_auth_user_updated();

-- 지금까지 어긋나 있던 것 한 번 맞추기
update public.app_users a
   set email = u.email
  from auth.users u
 where u.id = a.id and a.email is distinct from u.email;

-- ── 4) 확인 ─────────────────────────────────────────────────────
-- select email, role, active from public.app_users order by email;
-- select email, name, dept, status, created_at from public.access_requests order by created_at desc;
