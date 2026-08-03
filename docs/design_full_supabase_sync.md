# 완전연동 설계안 — 마스터 서버화 + 변경 이력

## 1. 한 줄 결론

**값은 서버에 하나만 두고(리조트 마스터 + 개인 업무값), 바꾼 사람은 게이트 이름이 아니라 로그인 계정으로 서버가 박고, 「누가·언제·무엇을 얼마에서 얼마로」를 항목 단위 서버 이력에 남긴다.** 개인별 JSON 내보내기/불러오기는 그 배선이 끝난 뒤 같은 커밋에서 걷어낸다 — 먼저 지우면 지금 유일한 공유 수단이 사라진다.

지금 상태를 한 문장으로: `shared/store.js:206-227` 에 `loadMaster`/`saveMaster` 가 낙관적 잠금까지 갖춰 있는데 **저장소 전체에서 호출이 0건**이고(`tools/dashboard/index.html` 의 MT_STORE 사용은 1811·1855·1913·1946·2049 다섯 곳, 전부 `data_registry` 용), `supabase/resort_master_setup.sql` 의 정책은 전부 `to anon` 이라 **그대로 배선하면 0행이 돌아오고 그 0행이 「그 사이 다른 분이 저장했습니다」로 위장된다.**

---

## 2. 분류표

판정 기준: **① 이 값이 달라지면 재고·요금·잔여·손님 발송물이 달라지는가 → 서버. ② 기기 고유 상태인가 → 개인유지. ③ 읽는 곳도 쓰는 곳도 없거나 서버가 대체했는가 → 폐기.**

### 2-1. 리조트 마스터 축

| 키/기능 | 판정 | 한 줄 이유 |
|---|---|---|
| `mt_notify_resortMaster` | **서버** | `rooms`·`roomExceptions` 가 `blkSyncFromResort()`(:5810-5822) → `blkBlockOn` 으로 잔여 계산의 분모가 된다. PC마다 다르면 없는 방을 판다 |
| `mt_notify_commonMaster` | **서버**(같은 행) | 환율·항공요금·패키지 프리셋·`memberPax`. `calcExpected`·정산·요금달력에 직접 들어간다 |
| `mt_doc_acct`(입금계좌·문의전화) | **서버**(`commonMaster.docAcct` 로 흡수) | 안 넣은 PC 에서 뽑은 확정서는 「입금 계좌는 별도 안내드립니다」로 나가고, `inquiryTel` 은 폴백조차 없어 푸터가 빈칸으로 나간다 |
| `mt_notify_changeLog` | **서버**(신규 `mt_change_log`) + 로컬 링버퍼 **폐기** | 레코드(:4495)에 「누가」가 없고, 100건 링버퍼이고, `importMaster`(:4852)가 남의 이력을 앞에 붙여 내 기록을 밀어낸다 |
| 「이력 비우기」(`clearChangeLog` :4516, 버튼 :5344) | **폐기** | 지울 수 있으면 이력이 아니다. 서버 이력에는 delete 정책을 만들지 않는다 |
| `importMaster`(:885-886, :4825-4863) | **폐기**(서버 배선과 같은 커밋에서) | 서버 단일 출처가 되는 순간 「석 달 전 JSON 한 개로 전 직원 단가·보유를 되돌리는 버튼」이 된다 |
| `exportMaster`(:884, :4810) | **개인유지**(성격 변경) | 배포 수단에서 백업·감사용 내려받기로 격하. 안내문 :891 은 함께 교체 |
| `resetResortMaster`(:887, :4781-4789) | **서버 의미로 이관** | 지우지 않는다 — `ROOMS_BEFORE_RENAME`/`sameRooms` 때문에 보유를 한 번이라도 손댄 마스터는 새 룸 구조를 못 따라가고, 그 탈출구가 이것뿐이다. owner 전용 + 스냅샷 이력 + 2단계 확인으로 바꾼다 |
| `loadResortMaster` catch 기본값 복귀(:4760) | **수정 필수** | 파싱 실패 한 번 → 조용한 기본값 복귀 → 자동 저장(:882 「입력 즉시 자동 저장」)과 만나면 확인 없이 전사 초기화 |
| `mt_notify_mgmtMigrated`·`mt_notify_airfareCodeMigrated` | **폐기** | 읽기 경로(`loadResortMaster`)가 `saveResortMaster()` 를 부른다(:4755-4759, :4767-4775). 서버 배선 시 **새 PC·시크릿창이 페이지를 열기만 해도 공유 마스터에 쓰기가 나가고**, `if(!r.mgmt) r.mgmt=50000` 이 면제 숙소의 0을 되살린다 |
| `MASTER_CODE_OWNED`(:4699) + `RESORT_DEFAULTS` 병합 | **유지** | `name`·`region`·`golf`·`holes` 는 UI 에 수정 수단이 없고 `name` 은 블록 매칭 조인 키다. 서버 값으로 얼리면 코드 리네임이 영영 반영 안 된다 |
| `ROOMS_BEFORE_RENAME`·`FIELD_BEFORE_FIX`·`ALIAS_MOVED`(:4704-4719) | **시드 시 1회 → 코드에서 제거** | 공유 행에 매 로드 적용 코드가 남으면 옛 JS 캐시 PC 와 새 JS PC 가 같은 행을 서로 되돌린다(특히 `ALIAS_MOVED` 는 조건 없이 매번 적용) |
| `aliases` 합집합 병합(:4734-4737) | **시드까지 유지 → 이후 서버 값이 정답** | 지금은 새 표준 별칭을 배포하는 유일한 길이라 먼저 지우면 오연결이 늘어난다. 서버 단일 행이 되면 사본이 하나라 합집합이 필요 없어진다 |
| `resort_master` RLS(`to anon`) | **교체** | `store.js:35-41` 은 예외 없이 사용자 JWT 로 나가 역할이 `authenticated` 다. anon 정책은 매칭되지 않아 0행 |
| `resort_master_history` | **유지 + 트리거로 기록** | `saveMaster` 는 본체만 PATCH 하고 이력에 한 줄도 안 넣는다. 되돌리기 축은 이것뿐이다 |

### 2-2. 개인 업무값 축 (예약·정산·잔여)

| 키 | 판정 | 한 줄 이유 |
|---|---|---|
| `mt_edit_overrides`(구분·호텔Y·명단Y·비고) | **서버** | `status` 가 확정서 목록(:7677·7692)·정산 필터(:8133)·대기 전환 점검(:7095)을 정하고, `docSyncSupabase`(:7996-8010)가 `확정/정산` 팀만 `reservations` 로 올려 **D-7 자동 알림톡 대상까지 로컬 값이 좌우한다.** 잔여 계산에는 안 들어감(정정) |
| ↑ 만료 없는 stale | **함께 처리** | eventSeq 키로 무기한 남아 `analyze()` 마다 다시 덮는다. 엠클릭 원본이 확정→대기로 내려가도 그 PC 는 영원히 확정으로 본다 |
| `mt_settle_adjust` | **서버** | `ad.localRate`·`transFee`·`exStay/exTrans/exMgmt`·`airCost`·`ins` 가 마스터·항공요금표를 덮어 실지급액을 만든다(:8176-8192) |
| `mt_settle_ded` | **서버** | `실정산액 = stayAll+transAll−ded`(:8940, :8965) — 현지에 실제로 보내는 송금액이다. 공제 행이 없는 PC 는 그만큼 더 보낸다 |
| `mt_notify_blkOver` | **서버** | 문구는 「내 PC 전용」(:1286)인데 매트릭스 잔여(:6595)·선택 합계(:6527)·현황 엑셀(:6810·6820)·현황 PNG(:6855)에 전부 실린다. `blkSetOver` 는 `over>0` 만 저장해 **잔여를 늘리기만 한다** |
| ↑ `blkPoolCapOn` 미반영(:5881-5891) | **함께 처리** | 출발 일정 조회·손님 공지 PNG·요금달력의 잔여와 블록 현황표의 잔여가 이미 서로 다르다. 올리면서 두 경로 기준을 하나로 맞춘다 |
| `mt_notify_insExclude` | **서버**(우선순위 중) | 정산 금액은 안 갈린다(제외 0·미입력 0 둘 다 합계 0). 갈리는 것은 보험 탭의 가입/제외 표시와 「보험 미입력」 경고 — 작업 목록이 사람마다 다르다 |
| `mt_notify_vAdjust` | **서버**(우선순위 중) | `pkgPrice` 가 `expected` 를 통째로 대체(:3374-3380)해 요금 관리 탭의 일치/큰 차이 판정을 바꾼다. `vcalApply`(:4171)는 여러 팀 판매가를 한 번에 정하는 업무 결정인데 한 대에만 남는다 |
| `mt_notify_teamAssign` | **서버**(우선순위 낮음) | 예약 탭 표시·필터·정렬에만 쓰이고 재고·요금에 무영향. 다만 「팀 미지정」 필터가 사실상 작업 큐라 사람마다 남은 일이 다르다. 태스크 #9 전제 |
| `mt_doc_hotelName` | **서버**(우선순위 낮음) | 확정서는 이 값을 **읽지 않는다**(정정 — `hotelLabelFor` 는 호출처 0). ⑤ 숙소 탭 입력 현황(N/M)만 갈린다. 서버화와 함께 확정서에 배선할지 제거할지 결정 필요 |
| `mt_notify_ticketDone` | **폐기** | 값을 쓰는 코드가 저장소에 0건인데 :4409 가 읽어 「발권완료 ✓」 도장을 찍는다. 읽기(:4409)·저장(:5672)까지 함께 제거 |
| `mt_notify_blkMonths` | **폐기**(로컬 영속) | 서버가 원본인데 사본이 남는다. `vcalLoadMonths` 는 과거 달만 정리하고 **미래 달은 영원히 남으며**, `regLoadEdgeBlocks`(:2046)는 `!vcalBlocks[ym]` 필터라 **캐시된 옆 달을 다시 안 받는다** → 옛 표(사용량 적음)로 잔여가 실제보다 많게 나온다. 로드마다 비우고 채우기 + 엣지 달 매번 재수신 |
| `mt_notify_blkPaste`·`mt_notify_blkMonth` | **개인유지** | 서버 값의 사본이 아니라 **업로드 초안 버퍼**다(`regUpBlock` 이 이 DOM 에서 읽는다). `BLK_STORE.month` 는 `blkLoad`(:5831)의 blkOver 형식 마이그레이션도 쓴다. 단 버그 2건 수정 필수 — ① `blk-month` change 핸들러(:6134-6136)에서도 저장, ② `regApplyBlocks`(:2031-2034)가 DOM 을 덮을 때 두 키도 갱신 |
| `mt_agency_filter` | **영속 폐기**(세션 한정 + 기본값 전체) | 기본값이 `일반`만이라 새 PC 는 여행사 확정 팀이 확정서 목록(:7692)에 뜨지 않아 `docBulkSend` 수신자에서 조용히 빠진다. 정산 합계(:8134)·요금 검증 대상(:3425·3440)도 이 값이 정한다. 산출물에 「무엇을 켜고 뽑았는지」 기록 |

### 2-3. 신원·설정 축

| 항목 | 판정 | 한 줄 이유 |
|---|---|---|
| 이력·업로드의 「누가」 출처 | **폐기 → `auth.uid()`** | `MT_USER.get()`(gate.js:60-65)은 게이트에서 본인이 타이핑한 자유 문자열이고 `gate.js:13` 이 스스로 「진위 보장 X」라고 적었다. 공용 PC 앞사람 이름 잔류, 재업로드 시 남의 이름 유지(`store.js:152` 의 `if(payload.uploaderName)`)가 실제 사고 |
| `data_registry.uploaded_by` | **서버 트리거로 채움** | 컬럼(05:18)은 있는데 값을 넣는 코드가 저장소에 0건 |
| `mt-user-name` | **개인유지**(표시용 격하) | 게이트 화면 인사말로만. 이력의 주체로 쓰지 않는다 |
| `mt-gate-ok` | **개인유지** | 기기별이 맞다 |
| `mt-auth-session`·`mt-auth-me` | **개인유지** | 기기별이 맞다. 단 `access.js:226` 의 `me()` 에 **`id=eq.` 필터가 없다** — owner/admin 은 전체 행이 보이므로 `order` 없는 `limit=1` 이 남의 행을 줄 수 있다(버그, 수정 필요) |
| `mt_doc_cfg` | **폐기 → 코드 상수** | URL·anon key 는 `shared/supabase-config.js:22,26` 에 이미 있다. 미설정 PC 는 `analyze()` 끝 :2429 자동 동기화가 **조용히** 건너뛰어져 D-7 자동발송이 낡은 데이터로 나간다. `aligoEndpoint` 는 빠뜨리면 알림톡이 엑셀로 강등되므로 `MT_SB.URL + '/functions/v1/send-alimtalk'` 로 유도 |
| `mt_translate_cfg` | **폐기 → 코드 상수** | 같은 패턴 중 업무 영향이 가장 작은 곁가지. 단 `functions/translate` 의 `--no-verify-jwt` 를 먼저 걷어내야 한다(인증 없는 LLM 프록시 주소를 public 저장소에 평문으로 올리게 된다) |
| `mt_notify_blkMaster`·`blkPools`·`blkAlias` | **폐기** | 선언만 있고 읽지도 쓰지도 않는다 |
| 루트 `auth.js` + 허브 4곳 구글 로그인 껍데기 | **폐기** | 네 파일 모두 주석 처리라 로드되지 않고 `CONFIG.ENABLED:false` 로 이중으로 죽어 있다. 헤더 DOM(`#userInfo`·`#logoutBtn`)까지 함께 제거 |
| `tools/inquiry/` 3종 키 | **폐기** | `admin/index.html:100` 이 살아 있는 링크로 연결 중이고, 자기 PC 의 몇 달 전 `state.blocks` 로 손님 안내문을 만든다. 잔여를 말하는 화면이 두 개면 안 된다 |
| `admin/index.html` 「시스템 관리 안내」(:212-223) | **폐기/재작성** | `auth.js` 의 `ALLOWED_EMAILS` 에 넣으라는 거짓 절차. 죽은 링크 `tools/saizen/`·`tools/aligo/` 도 함께 |
| `supabase/confirm_docs_storage_policy.sql` | **폐기** | 참조 0건, `confirm_docs_storage.sql` 의 진부분집합 |
| 허브 4곳 역할 가드 | **지금 손대지 말 것** | `can()` 은 계층이 아니라 평면 멤버십이라 `require(['sales'])` 가 air·manage·admin 을 잠근다. 별건으로 재설계 |
| `send-alimtalk`·`cron-d7-alimtalk` 인증 | **fail-closed 로 수정**(기능 유지) | 시크릿 미설정이면 열리는 방향이라 최악의 기본값. 폐기는 아니다 — `docBulkSend`(:8061)가 실제로 쓴다 |
| `tools/booking/` | **유지 + 2줄 추가** | 시연 배너·워터마크는 이미 있다(:1571·2048). 없는 것은 `gate.js` 와 `noindex` 뿐. 실제 회사 계좌번호가 색인될 수 있다 |
| `special_cases` | **이미 괜찮음** | 죽은 스키마가 아니라 아직 안 만든 화면(태스크 #6) |
| insurance·imgtoolkit·weather·library·register | **이미 괜찮음** | 개인 상태 없음 |

---

## 3. 마이그레이션 SQL

기존 `supabase/migrations/` 스타일(멱등·비파괴·`mt_has_role` 사용)을 따른다. **`reservations`·`confirm-docs` 의 anon 개방은 이 파일들에 넣지 않았다** — 코드 재배선보다 먼저 잠그면 D-7 자동 동기화가 조용히 멎기 때문이다(6절 참조).

### 3-1. `supabase/migrations/08_resort_master_shared.sql`

```sql
-- ════════════════════════════════════════════════════════════════
-- 08_resort_master_shared.sql — 리조트 마스터 서버 공유 전환
--                               (정책 교체 · 트리거 추가 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql, supabase/resort_master_setup.sql
--
-- 왜 필요한가
--   resort_master_setup.sql 은 로그인·역할이 붙기 전에 쓴 파일이라 정책 대상이
--   전부 anon 이다. shared/store.js 는 예외 없이 로그인 사용자 토큰으로 나가므로
--   PostgREST 안에서 역할이 authenticated 가 되고, anon 정책은 매칭되지 않는다.
--   그대로 배선하면 select 는 0행, PATCH 도 0행이 되는데 saveMaster 는 0행을
--   낙관적 잠금 충돌로 해석해 「그 사이 다른 분이 마스터를 저장했습니다」를 띄운다.
--   권한 문제가 충돌로 위장되면 새로고침만 반복하게 되고 원인에 닿지 못한다.
--
--   또 anon 키는 public 저장소(shared/supabase-config.js)에 원문으로 있다.
--   지금 정책은 using(true)/with check(true) 라 브라우저 없이도 덮어쓸 수 있다.
--
--   updated_at 은 default now() 뿐이라 PATCH 로는 갱신되지 않는다. 대표가 요구한
--   「누가 언제」 중 「언제」가 최초 생성 시각에 굳는다 — 트리거로 서버가 박는다.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 테이블 보장 (새 프로젝트에서도 이 파일 하나로 선다) ─────────
create table if not exists public.resort_master (
  id          smallint primary key default 1,
  data        jsonb       not null default '{}'::jsonb,
  version     bigint      not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint resort_master_single_row check (id = 1)
);

create table if not exists public.resort_master_history (
  id          bigint generated always as identity primary key,
  data        jsonb       not null,
  version     bigint,
  changed_at  timestamptz not null default now(),
  changed_by  text
);

alter table public.resort_master
  add column if not exists updated_by_id uuid references auth.users(id) on delete set null;

alter table public.resort_master_history
  add column if not exists changed_by_id uuid references auth.users(id) on delete set null,
  add column if not exists note          text;

create index if not exists resort_master_history_changed_at_idx
  on public.resort_master_history (changed_at desc);

insert into public.resort_master (id, data, version, updated_by)
values (1, '{}'::jsonb, 1, null)
on conflict (id) do nothing;

comment on table public.resort_master is
  '리조트 마스터 단일 행(id=1). data = { resortMaster:[...], commonMaster:{...} }. '
  'data.resortMaster 가 비어 있으면 아직 시드 전 — 화면은 편집을 잠그고 owner 시드를 기다린다.';

-- ── 2) 표시명 헬퍼 ──────────────────────────────────────────────
-- 클라이언트가 보낸 이름은 믿지 않는다. 게이트 이름은 자유 입력이라 진위가 없다.
create or replace function public.mt_actor_name()
  returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(nullif(u.name, ''), u.email)
    from public.app_users u where u.id = auth.uid();
$$;

grant execute on function public.mt_actor_name() to authenticated;

-- ── 3) 저장 스탬프 (누가·언제를 서버가 박는다) ────────────────────
create or replace function public.mt_rm_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), new.updated_by);
    return new;
  end;
$$;

drop trigger if exists trg_rm_stamp on public.resort_master;
create trigger trg_rm_stamp before insert or update on public.resort_master
  for each row execute function public.mt_rm_stamp();

-- ── 4) 스냅샷 이력 (되돌리기용) ─────────────────────────────────
-- 클라이언트에는 insert 권한을 주지 않는다. 직접 쓸 수 있으면 「내가 안 바꿨다」를
-- 지어낼 수 있어 이력의 존재 이유가 사라진다. 오직 이 트리거만 쓴다.
create or replace function public.mt_rm_archive()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if tg_op = 'UPDATE' and new.data is not distinct from old.data then
      return null;                                  -- 값이 그대로면 남기지 않는다
    end if;

    insert into public.resort_master_history (data, version, changed_by, changed_by_id)
    values (new.data, new.version, new.updated_by, new.updated_by_id);

    -- 스냅샷은 되돌리기용이라 최근 것이 중요하다. 항목 단위 「누가 무엇을」은
    -- mt_change_log 가 영구 보관하므로 여기서는 최근 500벌만 남긴다.
    delete from public.resort_master_history
     where id in (select id from public.resort_master_history order by id desc offset 500);

    return null;
  end;
$$;

drop trigger if exists trg_rm_archive on public.resort_master;
create trigger trg_rm_archive after insert or update on public.resort_master
  for each row execute function public.mt_rm_archive();

-- ── 5) RLS 교체 ─────────────────────────────────────────────────
alter table public.resort_master         enable row level security;
alter table public.resort_master_history enable row level security;

drop policy if exists rm_anon_select  on public.resort_master;
drop policy if exists rm_anon_insert  on public.resort_master;
drop policy if exists rm_anon_update  on public.resort_master;
drop policy if exists rmh_anon_select on public.resort_master_history;
drop policy if exists rmh_anon_insert on public.resort_master_history;

drop policy if exists rm_select on public.resort_master;
drop policy if exists rm_insert on public.resort_master;
drop policy if exists rm_update on public.resort_master;
drop policy if exists rmh_select on public.resort_master_history;

-- 조회: 운영진 전원(air 포함) — 항공 담당도 단가를 봐야 견적을 읽는다
create policy rm_select on public.resort_master
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- 저장: admin/manage/sales. 영업을 빼면 안 된다 — 「숙소 미등록」 별칭 연결과
-- 기간 예외는 블록 현황 표 안에서 영업이 매일 해소한다. 막으면 버튼은 보이는데
-- 저장만 조용히 0행이 된다.
create policy rm_update on public.resort_master
  for update to authenticated
  using      (public.mt_has_role(array['admin','sales','manage']))
  with check (public.mt_has_role(array['admin','sales','manage']));

-- 단일 행이라 평소엔 쓰지 않는다. 행이 사라졌을 때 복구용.
create policy rm_insert on public.resort_master
  for insert to authenticated
  with check (public.mt_is_admin());

-- 삭제 정책은 만들지 않는다.

-- 이력: 읽기만. insert/update/delete 정책 없음(트리거가 유일한 작성자)
create policy rmh_select on public.resort_master_history
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- ── 6) 테이블 권한 ──────────────────────────────────────────────
revoke all on public.resort_master         from anon;
revoke all on public.resort_master_history from anon;

do $$
begin
  execute 'revoke all on sequence public.resort_master_history_id_seq from anon';
exception when undefined_table then null;
end $$;

grant select, insert, update on public.resort_master         to authenticated;
grant select                 on public.resort_master_history to authenticated;
```

### 3-2. `supabase/migrations/09_change_log.sql`

```sql
-- ════════════════════════════════════════════════════════════════
-- 09_change_log.sql — 변경 이력 (누가·언제·무엇을 얼마에서 얼마로)
--                     (신규 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql
--
-- 왜 한 테이블인가
--   축별로 나누면 「오늘 누가 무엇을 바꿨나」를 보려고 다섯 번 질의해야 한다.
--   scope 한 칼럼으로 합치고 인덱스 셋만 둔다.
--
-- 왜 스냅샷(resort_master_history)만으로 안 되는가
--   스냅샷은 「무엇으로 되돌리나」에 답하고, 이 표는 「누가 무엇을 무엇으로
--   바꿨나」에 답한다. 19개 숙소 × 25필드를 클라이언트가 매번 diff 하게 만들면
--   이력이 쌓일수록 못 쓰게 된다. 둘은 택일이 아니라 2층이다.
--
-- 왜 before_val/after_val 을 따로 두는가
--   지금 화면 이력은 '₩1,200,000'·'(자동 12000)'·'(없음)'·'3건' 처럼 표시용으로
--   가공된 문자열이라 기계가 되돌릴 수 없다. 표시용과 원본값을 분리해 둔다.
--   (되돌리기 기능 자체는 지금 만들지 않는다 — 룸타입 삭제 한 번이 rooms·roomMeta·
--    roomAlias·roomExceptions 넷을 동시에 바꾸므로 값 하나만 되돌리면 없는 룸타입에
--    보유가 붙는다. 되돌리기는 스냅샷 통짜 단위로만 제공한다.)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.mt_change_log (
  id           bigint generated always as identity primary key,
  scope        text not null
               check (scope in ('master','common','booking','settle','verify','block','registry')),
  target       text not null default '',   -- 숙소명 / 행사번호 / 출발월 …
  field        text not null default '',   -- 항목 라벨(사람이 읽는 말)
  before_text  text,                       -- 표시용(지금 화면이 쓰던 값 그대로)
  after_text   text,
  before_val   jsonb,                      -- 가공 전 원본(나중에 되돌리기를 만들 때 쓴다)
  after_val    jsonb,
  path         text,                       -- 예: 'resort.yamanami_golf.rooms.트윈'
  ref_version  bigint,                     -- 그 시점 resort_master.version
  actor_id     uuid references auth.users(id) on delete set null,
  actor_name   text,
  changed_at   timestamptz not null default now()
);

comment on table public.mt_change_log is
  '전 직원 공유 변경 이력. append-only — update/delete 정책을 만들지 않는다. '
  'actor_id/actor_name/changed_at 은 클라이언트가 보낸 값을 무시하고 트리거가 박는다.';

create index if not exists mcl_at_idx
  on public.mt_change_log (changed_at desc);
create index if not exists mcl_scope_target_idx
  on public.mt_change_log (scope, target, changed_at desc);
create index if not exists mcl_actor_idx
  on public.mt_change_log (actor_id, changed_at desc);

-- ── 작성자 스탬프 ───────────────────────────────────────────────
create or replace function public.mt_mcl_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.actor_id   := auth.uid();
    new.actor_name := coalesce(public.mt_actor_name(), '');
    new.changed_at := now();
    return new;
  end;
$$;

drop trigger if exists trg_mcl_stamp on public.mt_change_log;
create trigger trg_mcl_stamp before insert on public.mt_change_log
  for each row execute function public.mt_mcl_stamp();

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.mt_change_log enable row level security;

drop policy if exists mcl_select on public.mt_change_log;
create policy mcl_select on public.mt_change_log
  for select to authenticated
  using (public.mt_has_role(array['admin','sales','air','manage']));

-- 이력을 감추면 다시 물어보게 된다 — 읽기는 air 포함 전원.
drop policy if exists mcl_insert on public.mt_change_log;
create policy mcl_insert on public.mt_change_log
  for insert to authenticated
  with check (public.mt_has_role(array['admin','sales','manage'])
              and actor_id = auth.uid());

-- update/delete 정책은 만들지 않는다. 오등록 정정도 삭제가 아니라
-- 반대 방향 기록으로 남긴다. 지울 수 있으면 이력이 아니다.

revoke all on public.mt_change_log from anon;
grant select, insert on public.mt_change_log to authenticated;
```

### 3-3. `supabase/migrations/10_shared_overlays.sql` (2단계용)

```sql
-- ════════════════════════════════════════════════════════════════
-- 10_shared_overlays.sql — 개인 PC 에만 있던 업무값의 서버 그릇
--                          (신규 · 멱등 · 비파괴)
-- 선행: 04_user_access.sql
--
-- 담는 것
--   mt_event_overlay  행사 단위 덧칠 — 구분·호텔Y·명단Y·비고·팀명·실제호텔명·요금 보정
--   mt_pax_overlay    인원 단위 덧칠 — 보험 제외
--   mt_settle_adjust  정산 조정  (기존 localStorage 키 "eventSeq#idx" 를 두 칼럼으로)
--   mt_settle_deduction 정산 공제
--   mt_block_override 웹 오픈 수량(구 오버부킹 보정)
--
-- 왜 행사 단위 덧칠을 한 표에 모으는가
--   전부 eventSeq 하나를 키로 하는 같은 성격의 값이고, 표를 나누면 예약 한 줄을
--   그리려고 다섯 번 조인하게 된다.
-- ════════════════════════════════════════════════════════════════

-- ── 공용 작성자 스탬프 ──────────────────────────────────────────
create or replace function public.mt_actor_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    new.updated_at    := now();
    new.updated_by_id := auth.uid();
    new.updated_by    := coalesce(public.mt_actor_name(), '');
    return new;
  end;
$$;

-- ── 1) 행사 단위 덧칠 ───────────────────────────────────────────
create table if not exists public.mt_event_overlay (
  event_seq      text primary key,
  status         text check (status is null or status in ('견적','대기','확정','정산')),
  hotel_y        boolean,
  list_y         boolean,
  remark         text,
  team_name      text,
  doc_hotel_name text,
  yen_etc        numeric,
  krw_etc        numeric,
  pkg_price      numeric,
  updated_at     timestamptz not null default now(),
  updated_by_id  uuid references auth.users(id) on delete set null,
  updated_by     text
);

comment on column public.mt_event_overlay.status is
  '엠클릭 구분 덮어쓰기. 취소로는 바꿀 수 없다(화면 화이트리스트와 같은 제약). '
  '확정서 대상·정산 대상·D-7 자동발송 대상을 정하므로 개인 PC 에 두면 안 된다.';

-- ── 2) 인원 단위 덧칠 ───────────────────────────────────────────
create table if not exists public.mt_pax_overlay (
  event_seq     text not null,
  pax_idx       int  not null,
  ins_excluded  boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (event_seq, pax_idx)
);

-- ── 3) 정산 조정 ────────────────────────────────────────────────
create table if not exists public.mt_settle_adjust (
  event_seq     text not null,
  pax_idx       int  not null,
  air_cost      numeric,
  air_src       text,
  ins           numeric,
  ins_src       text,
  local_rate    numeric,
  trans_fee     numeric,
  ex_stay       boolean not null default false,
  ex_trans      boolean not null default false,
  ex_mgmt       boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (event_seq, pax_idx)
);

-- ── 4) 정산 공제 ────────────────────────────────────────────────
create table if not exists public.mt_settle_deduction (
  id            text primary key,
  type          text not null,
  amount        numeric not null default 0,
  label         text,
  grp           text,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text
);

comment on table public.mt_settle_deduction is
  '쿠폰·포인트·선납 공제. 실정산액 = 체재+송영 − 공제 이므로 현지에 실제로 보내는 '
  '송금액을 정한다. 공제 행이 없는 PC 는 그만큼 더 보낸다.';

-- ── 5) 웹 오픈 수량 (구 오버부킹 보정) ──────────────────────────
create table if not exists public.mt_block_override (
  hotel         text not null,
  room          text not null,
  ymd           date not null,
  qty_delta     int  not null default 0,
  memo          text,
  updated_at    timestamptz not null default now(),
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by    text,
  primary key (hotel, room, ymd)
);

comment on table public.mt_block_override is
  '웹 오픈 수량 조정. 실제 보유 변경은 리조트 마스터의 기간 예외로 넣어야 한다 — '
  '이 표는 온라인 노출 수량 전용이고 화면 문구도 그렇게 고쳐 적는다.';

-- ── 트리거·RLS·권한 (다섯 표 공통) ──────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['mt_event_overlay','mt_pax_overlay','mt_settle_adjust',
                           'mt_settle_deduction','mt_block_override']
  loop
    execute format('drop trigger if exists trg_%s_stamp on public.%I', t, t);
    execute format('create trigger trg_%s_stamp before insert or update on public.%I '
                   'for each row execute function public.mt_actor_stamp()', t, t);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format('create policy %s_select on public.%I for select to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''air'',''manage'']))', t, t);

    execute format('drop policy if exists %s_insert on public.%I', t, t);
    execute format('create policy %s_insert on public.%I for insert to authenticated '
                   'with check (public.mt_has_role(array[''admin'',''sales'',''manage'']))', t, t);

    execute format('drop policy if exists %s_update on public.%I', t, t);
    execute format('create policy %s_update on public.%I for update to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''manage''])) '
                   'with check (public.mt_has_role(array[''admin'',''sales'',''manage'']))', t, t);

    execute format('drop policy if exists %s_delete on public.%I', t, t);
    execute format('create policy %s_delete on public.%I for delete to authenticated '
                   'using (public.mt_has_role(array[''admin'',''sales'',''manage'']))', t, t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
```

### 3-4. `supabase/migrations/11_registry_actor.sql` (2단계용)

```sql
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
```

---

## 4. 구현 순서

각 단계는 **그것만 배포돼도 안전한** 단위로 끊었다. 직원들이 쓰는 중에 배포된다.

### 0단계 — 서버화 전에 반드시 먼저 고칠 것 (코드만, SQL 없음)

**(a) 무엇을**
1. `loadResortMaster` 의 쓰기 제거 — `mt_notify_mgmtMigrated`(:4755-4759)·`mt_notify_airfareCodeMigrated`(:4767-4775) 블록에서 `saveResortMaster()` 호출을 뺀다. 두 플래그 키도 함께 폐기.
2. `loadResortMaster` catch(:4760)의 조용한 기본값 복귀를 제거하고, 파싱 실패를 화면에 드러낸다.
3. Ctrl+S(:5770)의 `saveResortMaster()` — 실제 변경(dirty)이 있을 때만 저장하도록 바꾼다.
4. `access.js:226` 의 `me()` 에 `id=eq.<sub>` 필터 추가.
5. `blk-month` change 핸들러(:6134-6136)에서 `BLK_STORE.month` 저장 + `regApplyBlocks`(:2031-2034)에서 두 키 갱신.
6. `mt_notify_ticketDone` 읽기(:4409)·저장(:5672) 제거, 죽은 키 3종(`blkMaster`/`blkPools`/`blkAlias`) 제거.
7. `tools/booking/index.html` head 에 `gate.js` + `noindex` 두 줄.

**(b) 왜 이 순서인가**
1·2·3 을 안 고치고 마스터를 서버에 붙이면 **읽기가 곧 쓰기가 된다** — 새 PC·시크릿창·브라우저 데이터를 지운 직원이 대시보드를 열기만 해도 공유 마스터에 PATCH 가 나가고, `if(!r.mgmt) r.mgmt=50000` 이 면제 숙소의 0을 되살린다. 본인은 아무것도 안 했는데 이력에 「○○ 님이 마스터를 저장함」이 찍히고, 그 순간 편집 중이던 사람의 저장이 충돌로 튕긴다. 이건 서버화의 부작용이 아니라 서버화의 **전제 조건**이다.

**(c) 배포 안전성**: 전부 로컬 동작 축소·버그 수정이라 지금 쓰는 사람에게 보이는 변화가 없다. `ticketDone` 만 옛 PC 에서 ✓ 도장이 사라지는데, 그건 아무도 못 지우던 유령이었다.

### 1단계 — SQL 08·09 실행 (서버만, 코드 배포 없음)

**(a)** `08_resort_master_shared.sql`, `09_change_log.sql` 을 Supabase SQL Editor 에서 순서대로 실행.

**(b) 왜 먼저인가**: 스키마·정책이 없는데 코드를 붙이면 첫 저장이 0행으로 막히고, 그 0행이 「그 사이 다른 분이 저장했습니다」로 위장돼 원인 추적이 불가능해진다. 정책을 먼저 맞춰 두면 그 함정이 애초에 생기지 않는다.

**(c) 배포 안전성**: `resort_master` 를 부르는 코드가 지금 0건이므로 정책을 바꿔도 화면에 영향이 없다. `mt_change_log` 는 신규 표다. **다만 실행 직후 콘솔에서 `resort_master` 정책 목록이 `rm_select`/`rm_update`/`rm_insert` 셋으로 바뀌었는지 눈으로 확인할 것** — 이 파일 실행 여부에 대한 저장소 기록이 서로 어긋나 있다(04 주석은 「이미 실행됨」, `docs/design_supabase_registry.md:239` 는 04 미실행). **확인 필요.**

### 2단계 — 마스터 **읽기만** 배선 + owner 시드 버튼

**(a)**
- `loadResortMaster()` 를 둘로 나눈다: `masterFromPayload(data)`(순수 병합, 쓰기 없음) + `masterLoadServer()`(비동기).
- 부팅: localStorage 캐시로 즉시 그리고, `MT_STORE.loadMaster()` 응답이 오면 **통째로 갈아 끼운다.** 서버 `version` 을 전역에 보관.
- 서버가 미시드(`data.resortMaster` 가 없거나 길이 0)면 상단에 「서버 마스터가 아직 비어 있습니다 — 지금 보이는 값은 이 PC 값입니다」를 적고 **마스터 편집 칸을 잠근다.**
- owner 에게만 「이 PC 값을 서버 마스터로 등록」 버튼. 누르면 시드 1회 실행(5절 참조).
- 화면에 「마지막 저장: ○○○ · 시각」을 적는다.

**(b) 왜**: 읽기와 쓰기를 같은 배포에 넣으면, 배선 버그 하나가 곧바로 전 직원 마스터 훼손이 된다. 읽기만 먼저 붙여 서버 값이 제대로 오는지, 병합이 기존 화면과 같은 숫자를 내는지 확인한 뒤에 쓰기를 붙인다.

**(c) 배포 안전성**: 서버가 미시드인 동안에는 지금과 똑같이 동작한다(로컬 값 + 잠긴 편집). 시드 전에는 아무것도 달라지지 않으므로 배포 시점을 고를 필요가 없다.

### 3단계 — 마스터 **쓰기** 배선 + 이력 서버 기록

**(a)**
- `saveResortMaster()` → 디바운스(2초) 후 `MT_STORE.saveMaster(data, version, ...)`. 필드 하나마다 PATCH 를 보내지 않는다 — 지금 호출부가 28곳이라 칸마다 나가면 단일 행에서 거의 매번 충돌한다.
- **충돌과 권한을 가른다**: 0행이면 서버 `version` 을 다시 읽어 **같으면 「권한이 없습니다」, 다르면 「그 사이 다른 분이 저장했습니다」**. 지금 `store.js:222-226` 은 무조건 충돌로 말한다.
- 충돌 시: 서버 값을 다시 받아 **내가 바꾼 필드만 얹어 재시도**하고, 그래도 실패하면 어느 칸이 왜 안 저장됐는지 그 줄에 적는다. 「새로고침 후 다시 저장」은 방금 타이핑한 값을 버리라는 말이라 그대로 두면 같은 숫자를 두세 번 입력하게 된다.
- `logChange()` → `mt_change_log` INSERT. **마스터 PATCH 가 성공한 뒤에만** 넣는다. `before_text`/`after_text` 는 지금 값 그대로, `before_val`/`after_val`/`path` 를 함께 채운다.
- `clearChangeLog()` 와 「이력 비우기」 버튼(:5344) 제거, 화면은 「기간·대상·사람 필터」로 대체. 링버퍼(`CHLOG_MAX`) 제거.
- `resetResortMaster` 는 owner 전용 + 숙소명 타이핑 확인 + 이력 1행(`field='마스터 전체 초기화'`).

**(b) 왜**: 이력을 값보다 먼저 붙이면 「A 가 체재비를 15,000 으로 바꿨다」는 이력이 서버에 남는데 B 화면 값은 그대로라 이력과 화면이 어긋난다. 값과 이력은 같은 저장 시점에 함께 올라가야 한다.

**(c) 배포 안전성**: 시드가 끝난 뒤에만 쓰기가 열린다(미시드면 편집 잠금이 유지된다). 배포 중 열려 있던 탭은 옛 JS 로 로컬에만 저장하는데, 그 값은 다음 새로고침에서 서버 값으로 덮인다 — 조용히 사라지므로 **배포 직후 「마스터를 고치는 중이면 새로고침하고 다시 확인해 주세요」를 한 번 공지할 것.**

### 4단계 — 개인별 배포 수단 정리

**(a)** `importMaster` + 파일 input(:885-886) + 함수(:4825-4863) 제거, 안내문(:891) 을 「마스터는 서버에 하나만 있습니다. 바꾸면 전 직원에게 바로 반영됩니다」로 교체. `exportMaster` 는 백업용으로 문구만 바꿔 남긴다. `docs/dashboard_tech_spec.md:46·78·180` 과 CLAUDE.md 「마스터 배포 흐름」 절도 함께 고친다.

**(b) 왜 3단계 뒤인가**: import 는 지금 마스터 공유의 유일한 실동작 경로다. 서버 쓰기가 서기 전에 지우면 배포 수단이 0이 된다.

**(c) 배포 안전성**: 안전하다. 다만 **되돌리기 어려운 변경**이므로(직원들이 쓰던 버튼이 사라진다) 배포 전에 한 줄 공지.

### 5단계 — 개인 업무값 이관 (SQL 10·11 + 코드)

손님에게 조용히 틀린 값이 나가는 순서대로:

1. `mt_edit_overrides` → `mt_event_overlay` (+ stale 처리: 서버 원본이 바뀌면 오버라이드를 자동 해제할지, 「원본과 다름」으로 드러낼지 결정 — **업무 판단 필요**)
2. `mt_notify_blkOver` → `mt_block_override` (+ `blkPoolCapOn` 에도 반영해 두 잔여 경로 기준을 하나로)
3. `mt_settle_adjust`·`mt_settle_ded` → `mt_settle_adjust`·`mt_settle_deduction`
4. `mt_notify_insExclude` → `mt_pax_overlay`
5. `mt_notify_vAdjust`·`mt_notify_teamAssign`·`mt_doc_hotelName` → `mt_event_overlay`
6. `11_registry_actor.sql` 실행 + `store.js:152` 의 `uploaderName` 전송을 `MT_AUTH.me()` 기반으로 바꾸거나 아예 빼기(서버가 박으므로)

각 항목마다 **첫 실행 시 localStorage 값을 서버로 한 번 올리는 것을 자동으로 하지 말 것** — 여러 PC 가 서로 다른 값을 밀어 넣는다. 「이 PC 값을 서버로 올리기」 버튼을 두고 한 사람이 한 번 누르게 한다.

### 6단계 — 설정값 코드화

`mt_doc_cfg`(URL·key·bucket → 코드 상수, `aligoEndpoint` → `MT_SB.URL + '/functions/v1/send-alimtalk'`), `mt_translate_cfg` → 코드 상수. `docAcct` → `commonMaster.docAcct`.

`translate` 는 `--no-verify-jwt` 를 걷어내고 토큰 검증을 붙인 **뒤에** 주소를 코드에 넣는다. `send-alimtalk`·`cron-d7-alimtalk` 도 이때 fail-closed 로 고친다(시크릿 없으면 열리는 게 아니라 막히도록).

### 7단계 — 정리

`tools/inquiry/` 리다이렉트화 + `admin/index.html:100` 카드 제거, `admin/index.html:212-223` 안내 재작성 + 죽은 링크 2개(`saizen`·`aligo`), 허브 4곳 죽은 구글 로그인 블록 + 헤더 DOM + 루트 `auth.js` 삭제, `confirm_docs_storage_policy.sql` 삭제, 루트 setup 파일 3종에 01·02·03 번호를 붙여 `migrations/` 로 흡수.

---

## 5. 되돌릴 수 없는 위험 — 마이그레이션 전략

### 5-1. 서버 값과 로컬 값 중 누가 이기나

**시드 이후에는 서버가 항상 이긴다.** localStorage 는 첫 화면을 그리기 위한 마지막-정상-사본(캐시)일 뿐이고, 서버 응답이 오면 그 순간 통째로 갈아 끼운다.

그리고 **로컬 → 서버 방향의 자동 쓰기를 한 군데도 만들지 않는다.** 사람이 값을 실제로 고쳤을 때만 저장한다. 0단계에서 읽기 경로의 쓰기를 먼저 없애는 이유가 이것이다.

### 5-2. 첫 배포 때 서버가 비어 있으면

서버 행은 **이미 존재하고 `data='{}'` 다**(`resort_master_setup.sql:32-34`). 즉 `loadMaster()` 는 null 이 아니라 `{data:{}, version:1}` 을 준다. **「행이 없다」로 판정하면 영원히 오지 않는다** — `data.resortMaster` 가 배열이 아니거나 길이 0 이면 미시드로 본다.

미시드 상태에서:
- 화면은 로컬 값 + 코드 기본값으로 평소처럼 돌되, 상단에 「서버 마스터가 아직 비어 있습니다 — 지금 보이는 값은 이 PC 값입니다」를 적는다.
- **마스터 편집 칸을 잠근다.** 저장할 곳이 정해지지 않았는데 고치면 어디로 가는지 알 수 없다.
- owner 에게만 「이 PC 값을 서버 마스터로 등록」 버튼을 보인다. 그 한 번이 시드다.

**자동 시드는 절대 하지 않는다.** 자동으로 하면 ① 여러 대의 PC 가 각자 자기 값을 밀어 넣고 마지막에 연 사람이 이기며, ② 누구 값이 살아 있는지 아무도 모르고, ③ 브라우저 데이터를 지운 PC 는 **코드 기본값(그린피 0, 조·중·석식 0, mgmt 50,000)** 을 밀어 넣어 전 직원 견적을 망친다.

### 5-3. 시드 시 딱 한 번 하고 코드에서 빼는 것

`ROOMS_BEFORE_RENAME` · `FIELD_BEFORE_FIX` · `ALIAS_MOVED` · mgmt 50,000 승격 · 항공요금 IATA 변환.

이유: 공유 행에 매 로드 적용하는 코드가 남아 있으면, GitHub Pages 캐시로 **옛 JS 를 돌리는 PC 와 새 JS 를 돌리는 PC 가 같은 행을 서로 되돌린다.** `ROOMS_BEFORE_RENAME`·`FIELD_BEFORE_FIX` 는 「옛 기본값과 정확히 같을 때만」 올리는 단방향이라 그 자체로는 튀지 않지만, `ALIAS_MOVED` 는 조건 없이 매 로드 적용돼 실제로 튄다(옛 코드의 `def.aliases` 에 남은 「관내별장」이 합집합으로 되살아나 같은 별칭이 두 숙소에 붙는다).

**반대로 `MASTER_CODE_OWNED` 병합과 `RESORT_DEFAULTS` 행 집합 병합은 남긴다.** `name`·`region`·`golf`·`holes` 는 UI 에 수정 수단이 없어 코드가 계속 소유자이고, `name` 은 블록 매칭 조인 키라 서버 값으로 얼려 두면 코드에서 숙소명을 바꿔도 아무에게도 반영되지 않는다. 새 숙소·새 필드도 코드 기본값에서 와야 한다.

`aliases` 합집합은 시드까지만 유지하고, 시드 후 서버 값이 정답(삭제=삭제)으로 바꾸면서 `ALIAS_MOVED` 를 함께 뺀다. 이때 「같은 별칭이 두 숙소에 걸림」 경고를 넣는다 — `deriveBlkAlias` 가 마지막 등록 숙소로 조용히 덮어쓴다.

`ROOMS_BEFORE_RENAME` 의 `sugadaira_mansion:{}` 는 「옛 기본값」과 「사용자가 룸타입을 전부 지운 상태」를 구분하지 못한다. 시드 시점에 사람이 눈으로 확인하고 넘길 것.

### 5-4. 조용히 틀린 값이 손님에게 나가는 경로

| # | 경로 | 언제 터지나 | 막는 법 |
|---|---|---|---|
| 1 | **RLS 0행 → 「다른 분이 저장했습니다」** | 08 을 실행하지 않고 3단계를 배포 | 08 을 반드시 먼저. `saveMaster` 0행 시 version 재조회로 권한/충돌 구분 |
| 2 | **읽기 경로가 쓰기** (`mgmtMigrated`) | 0단계를 건너뛰고 서버화 | 0단계 필수. 면제 숙소 mgmt 0 이 50,000 으로 되살아나 전 직원 견적이 틀린다 |
| 3 | **catch 기본값 복귀 + 자동 저장**(:4760·:882) | 서버 응답이 깨진 JSON 일 때 | 0단계 필수. 확인 창 없이 전사 초기화가 된다 |
| 4 | **importMaster 로 과거 JSON 복원** | 4단계 전에 3단계만 배포 | 3·4를 같은 릴리스로 묶는다 |
| 5 | **`vcalBlocks` 유령 캐시** | 이미 발생 중 | `regLoadEdgeBlocks` 의 `!vcalBlocks[ym]` 필터를 없애고 매 로드 clear-then-fill. 옛 표(사용량 적음)로 잔여가 실제보다 **많게** 나온다 |
| 6 | **`docAcct` 미입력 확정서** | 이미 발생 중 | 6단계. `inquiryTel` 은 폴백이 없어 「예약 문의」 밑이 공백으로 나간다 |
| 7 | **`agencySel` 기본 「일반만」** | 이미 발생 중 | 기본값을 전체로, 영속 제거. 여행사 확정 팀이 `docBulkSend` 수신자에서 조용히 빠진다 |
| 8 | **`mt_doc_cfg` 미설정 PC 의 분석** | 이미 발생 중 | 6단계. `analyze()` 끝 :2429 자동 동기화가 조용히 건너뛰어져 D-7 알림톡이 낡은 데이터로 나간다 |
| 9 | **`blkOver` 가 잔여를 늘리기만 함** | 이미 발생 중 | 5단계-2. `blkSetOver` 는 `over>0` 만 저장하고, 현황 엑셀·PNG 에 실려 공유된다 |

### 5-5. 되돌리는 법

`resort_master_history` 스냅샷(최근 500벌)으로 **통짜 롤백**한다. 값 하나만 되돌리는 기능은 만들지 않는다 — 룸타입 삭제 한 번이 `rooms`·`roomMeta`·`roomAlias`·`roomExceptions` 넷을 동시에 바꾸는데(:5617-5625) 그중 한 줄만 되돌리면 없는 룸타입에 보유가 붙어 없는 방을 파는 상태가 만들어진다.

---

## 6. 지금 손대지 말아야 할 것

1. **`importMaster`/`exportMaster` 를 먼저 지우기.** 지금 마스터 공유의 유일한 실동작 경로다. 서버 쓰기(3단계)와 같은 릴리스에서만 지운다.
2. **`aliases` 합집합 병합만 먼저 폐기하기.** 지금은 새 표준 별칭을 배포하는 유일한 길이다. 먼저 지우면 저장본이 통째로 이겨 새 별칭이 영영 안 들어가고 「숙소 미등록」이 늘어난다. 서버 단일 행이 선 뒤에 뺀다.
3. **`blk-paste`/`blk-month` localStorage 지우기.** 서버 값의 사본이 아니라 업로드 초안 버퍼다. `BLK_STORE.month` 는 `blkLoad`(:5831)의 `blkOver` 형식 마이그레이션도 쓴다. 필요한 것은 삭제가 아니라 동기화 버그 2건 수정이다.
4. **허브 4곳에 `require([...])` 한 줄 걸기.** `can()`(access.js:300-305)은 계층이 아니라 평면 멤버십이라 `require(['sales'])` 가 air·manage·admin 을 잠근다. 초대 기본 역할이 `air` 이고 루트가 전원을 `/sales/` 로 보내므로 **대부분의 직원이 입구에서 막힌다.** 또 `deny()` 는 `onDeny` 가 없으면 forbidden 에 아무 동작도 안 해 화면이 가려지지도 않는다. 별건으로 재설계.
5. **`reservations`·`confirm-docs` 의 anon 정책 먼저 잠그기.** `docUploadSupabase`(:7955-7979)·`docSyncSupabase`(:8015-8022)는 `store.js` 를 안 거치고 `DOC_CFG.supabaseKey`(anon)로 나간다. 먼저 잠그면 :8023 이 silent 오류를 삼켜 **D-7 자동 동기화가 아무 표시 없이 멎는다.** 6단계에서 코드를 사용자 토큰으로 재배선한 뒤에 잠근다. (그래서 이 항목을 08~11 SQL 에 넣지 않았다.)
6. **`send-alimtalk` Edge Function 폐기.** `docBulkSend`(:8061)가 실제로 쓴다. 필요한 것은 삭제가 아니라 진입부 시크릿 검사 추가다.
7. **`tools/booking/` 폐기.** 시연 배너·워터마크가 이미 있고 엠클릭 시스템사 전달용 상호작용 사양이다(대응 문서 없음). `gate.js` + `noindex` 두 줄만 추가.
8. **`resort_master_history` 폐기.** 대표가 요구한 이력의 되돌리기 축이고, 배포된 스키마다. 스냅샷과 항목 이력은 서로 다른 질문에 답한다.
9. **`resetResortMaster` 버튼만 지우기.** 이것보다 위험한 것이 :4760 의 무확인 catch 복귀와 `importMaster` 다. 게다가 `ROOMS_BEFORE_RENAME`/`sameRooms` 때문에 보유를 한 번이라도 손댄 마스터는 새 룸 구조를 못 따라가고, 그 유일한 탈출구가 이 버튼이다.
10. **값 단위 되돌리기(undo) 만들기.** 5-5 참조.
11. **마스터 저장을 admin 만으로 좁히기.** 영업이 블록 현황 표 안에서 매일 별칭 연결·기간 예외를 해소한다. 좁히면 버튼은 보이는데 저장만 조용히 0행이 된다.

---

## 7. 확인 필요 (추측하지 않았다)

1. **`resort_master_setup.sql` 이 운영 프로젝트에 실제로 실행됐는지.** `04_user_access.sql:15` 은 「이미 실행됨」, `docs/design_supabase_registry.md:239` 는 04 미실행이라 적어 두 기록이 어긋난다. 콘솔에서 정책 목록을 직접 볼 것.
2. **`authenticated` 에 `public.resort_master` 기본 GRANT 가 남아 있는지.** 08 실행 전 증상이 「0행」인지 「403 permission denied」인지가 갈린다(어느 쪽이든 08 이 해결). 08 이후에는 명시 GRANT 가 있으므로 무관.
3. **`send-alimtalk` / `cron-d7-alimtalk` 의 시크릿이 실제로 설정돼 있는지.** 저장소만으로는 알 수 없다.
4. **`reservations` 에 실제 손님 데이터가 얼마나 들어 있는지.** 각 PC 의 `mt_doc_cfg` 를 채운 사람이 동기화를 눌러야만 행이 생긴다.
5. **`hotelLabelFor`(:3408) 를 확정서에 배선할지 제거할지.** 지금은 호출처 0 인 죽은 코드이고, 시내 호텔 실제 호텔명이 손님 문서에 나가야 하는지가 업무 판단이다.
6. **`mt_edit_overrides` 의 stale 처리 방식.** 엠클릭 원본이 확정→대기로 내려갔을 때 오버라이드를 자동 해제할지, 「원본과 다름」으로 드러내고 사람이 정하게 할지.