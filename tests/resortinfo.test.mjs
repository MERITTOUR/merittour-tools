/* 리조트 정보(tools/resortinfo) — 목록·섹션·정책이 서로 어긋나지 않게 묶어 둔다.
 *
 * 화면의 RESORTS 는 대시보드 리조트 마스터(RESORT_DEFAULTS)의 key·name 을 그대로 쓴다.
 * 한쪽만 바꾸면 같은 숙소가 두 화면에서 다른 이름으로 보인다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const RE = /\{\s*key:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)',\s*region:\s*'([^']+)'/g;
const list = src => [...src.matchAll(RE)].map(m => [m[1], m[2]]);

test('리조트 정보 화면의 리조트 목록 = 대시보드 리조트 마스터 (key · name)', () => {
  const dash = list(read('tools/dashboard/index.html'));
  const page = list(read('tools/resortinfo/index.html')).filter(([k]) => !k.startsWith('_'));
  assert.ok(dash.length >= 15, '대시보드 RESORT_DEFAULTS 를 못 읽었다 — 정규식이 형식을 못 따라간다');
  // 리조트 정보는 대시보드 마스터 한 줄을 상품별로 나눠 적을 수 있다(미야자키 · 2026-11-18) — 마스터 이름은 블록·웹오픈 조정 키라 그대로 둔다
  const SPLITS = { miyazaki: [['miyazaki', '미야자키 국제공항CC 상품'], ['miyazaki_city', '미야자키 시내 상품']] };
  assert.deepEqual(page, dash.flatMap(([k, n]) => SPLITS[k] || [[k, n]]));
});

test('「전 리조트 공통」 항목이 목록 끝에 있다', () => {
  const page = list(read('tools/resortinfo/index.html'));
  assert.deepEqual(page[page.length - 1], ['_common', '전 리조트 공통']);
});

test('섹션 resortinfo — SECTIONS · 기본 역할 · 허브 카드 · 화면 가드가 한 벌이다', () => {
  const acc = read('shared/access.js');
  const sec = acc.match(/key:\s*'resortinfo',\s*label:\s*'([^']+)',\s*path:\s*'tools\/resortinfo\/'/);
  assert.ok(sec, 'SECTIONS 에 resortinfo 가 없다');
  assert.match(acc, /ALL_KEYS = \[[^\]]*'resortinfo'/, 'ALL_KEYS 에 없다');
  for (const role of ['manage', 'sales', 'air']) {
    assert.match(acc, new RegExp(role + ':\\s*\\{ areas: \\[[^\\]]*\'resortinfo\''), role + ' 기본 섹션에 resortinfo 가 없다');
  }
  const hub = read('sales/index.html');
  const card = hub.match(/data-section="resortinfo"[\s\S]{0,300}?tool-card-title">([^<]+)</);
  assert.ok(card, '영업 허브에 리조트 정보 카드가 없다');
  assert.equal(card[1].trim(), sec[1], '허브 카드 이름과 섹션 label 이 다르다');
  assert.match(read('tools/resortinfo/index.html'), /guard\.js" data-section="resortinfo"/, '화면이 섹션 가드를 안 건다');
});

test('31 — resort_info 는 운영진 전원(air 포함)에게 열고 anon 은 닫으며, 전 계정에 섹션을 넣는다', () => {
  const sql = read('supabase/migrations/31_resort_info.sql');
  for (const p of ['ri_select', 'ri_insert', 'ri_update']) {
    const m = sql.match(new RegExp('create policy ' + p + ' on public\\.resort_info[\\s\\S]*?;'));
    assert.ok(m, p + ' 정책이 없다');
    assert.match(m[0], /'air'/, p + ' 이 항공팀을 뺐다 — 지정 항공편·수하물 칸은 항공팀이 적는다');
  }
  assert.doesNotMatch(sql, /create policy \w+ on public\.resort_info\s+for delete/, '삭제 정책은 두지 않는다');
  assert.match(sql, /revoke all on public\.resort_info\s+from anon/);
  assert.match(sql, /array_append\(areas, 'resortinfo'\)/, '기존 계정에 섹션을 넣지 않는다');
});

test('화면 항목 키는 서로 다르고, 출발지 키는 icn·pus·tae 다', () => {
  const src = read('tools/resortinfo/index.html');
  const keys = [...src.matchAll(/\{\s*k:\s*'([a-z0-9_]+)',\s*l:/g)].map(m => m[1]);
  assert.ok(keys.length >= 30, '항목을 못 읽었다');
  assert.equal(new Set(keys).size, keys.length, '항목 키가 겹친다 — 저장된 값이 서로 덮어쓴다');
  assert.match(src, /\{k:'icn', l:'인천'\}, \{k:'pus', l:'부산\(김해\)'\}, \{k:'tae', l:'대구'\}/);
});

/* 일본 입국 안내 문안(tools/entry · 2026-10-17) — 리조트 정보의 「일본 입국 신고용 숙소 정보」 네 칸을 읽어 손님께 보낼 글을 만든다. */
test('일본 입국 안내 문안(tools/entry) — 리조트 목록 = 리조트 정보 화면(공통 제외) · 섹션 가드 · 항목 키 · 허브 카드 · 문안', () => {
  const ri = read('tools/resortinfo/index.html');
  const en = read('tools/entry/index.html');
  const riList = list(ri).filter(([k]) => !k.startsWith('_'));
  const enList = list(en);
  assert.ok(enList.length >= 15, '입국 안내 화면의 RESORTS 를 못 읽었다');
  assert.deepEqual(enList, riList, '입국 안내 화면과 리조트 정보 화면의 리조트 목록이 다르다');
  assert.match(en, /guard\.js" data-section="resortinfo"/, '입국 안내 화면이 resortinfo 섹션 가드를 안 건다');
  for (const k of ['entry_name_en', 'entry_postal', 'entry_address', 'entry_phone']) {
    assert.match(ri, new RegExp("\\{\\s*k:\\s*'" + k + "',"), '리조트 정보 화면에 ' + k + ' 항목이 없다');
    assert.ok(en.includes("k:'" + k + "'"), '입국 안내 화면이 ' + k + ' 를 안 읽는다');
  }
  const hub = read('sales/index.html');
  const card = hub.match(/href="\.\.\/tools\/entry\/"[^>]*data-section="resortinfo"[\s\S]{0,300}?tool-card-title">([^<]+)</);
  assert.ok(card, '영업 허브에 입국 안내 카드가 없다(또는 resortinfo 섹션이 아니다)');
  assert.equal(card[1].trim(), '일본 입국 안내 문안');
  for (const s of ['■ 일본 입국 안내', 'Visit Japan Web 사전 등록을 권장드립니다', 'https://www.vjw.digital.go.jp/', '일본 도착 공항에서 종이 신고서 작성이 가능합니다',
                   '■ 일본 입국 신고용 숙소 정보', "'우편번호 : '", "'주소 : '", "'전화 : '"]) {
    assert.ok(en.includes(s), '문안에 「' + s + '」 가 없다');
  }
});

test('37 — 입국 신고용 숙소 정보 시드는 야마나미 리조트 6행에 병합하고, 담당자가 적은 값을 덮지 않는다', () => {
  const sql = read('supabase/migrations/37_resort_info_entry_seed.sql');
  for (const k of ['yamanami_golf', 'yamanami_bessou', 'yamanami_dome', 'yamanami_hinoki_cabin', 'yamanami_hinoki_family', 'kuzu']) {
    assert.ok(sql.includes("('" + k + "'"), k + ' 행이 없다');
  }
  assert.match(sql, /ASO YAMANAMI RESORT HOTEL & GOLF CLUB/);
  assert.match(sql, /869-2702/);
  assert.match(sql, /630 Ori, Ubuyama, Aso District, Kumamoto/);
  assert.match(sql, /\+81-967-25-2331/);
  assert.match(sql, /coalesce\(excluded\.data->'items', '\{\}'::jsonb\) \|\| coalesce\(resort_info\.data->'items'/, '저장된 값이 이기는 병합(excluded || existing)이 아니다');
  assert.match(sql, /is distinct from coalesce\(resort_info\.data->'items'/, '바뀐 것이 없으면 건드리지 않는 조건이 없다');
  assert.doesNotMatch(sql, /\bdelete\b/i, '시드가 지우는 문장을 가진다');
});

test('38 — 숙소 소개(2027 안내문) 시드는 guide_desc 만 병합하고, 담당자가 적은 값을 덮지 않는다', () => {
  const sql = read('supabase/migrations/38_resort_info_guide_desc_seed.sql');
  const ui = read('tools/resortinfo/index.html');
  assert.match(ui, /k:'guide_desc'/, '화면에 guide_desc 칸이 없다');
  for (const k of ['yamanami_golf', 'yamanami_bessou', 'yamanami_hinoki_cabin', 'yamanami_hinoki_family', 'yamanami_dome', 'ganji', 'shizu', 'fourteen_golf']) {
    assert.ok(sql.includes("('" + k + "'"), k + ' 행이 없다');
  }
  const keys = [...sql.matchAll(/\{"([a-z_]+)":/g)].map(m => m[1]);
  assert.ok(keys.length > 0 && keys.every(k => k === 'guide_desc'), 'guide_desc 말고 다른 항목을 건드린다');
  assert.match(sql, /coalesce\(excluded\.data->'items', '\{\}'::jsonb\) \|\| coalesce\(resort_info\.data->'items'/, '저장된 값이 이기는 병합(excluded || existing)이 아니다');
  assert.match(sql, /is distinct from coalesce\(resort_info\.data->'items'/, '바뀐 것이 없으면 건드리지 않는 조건이 없다');
  assert.doesNotMatch(sql, /\bdelete\b/i, '시드가 지우는 문장을 가진다');
});

test('39 — 미야자키 분리는 miyazaki_city 가 없을 때만 돌고, 지우지 않는다', () => {
  const sql = read('supabase/migrations/39_resort_info_miyazaki_split.sql');
  assert.match(sql, /where not exists \(select 1 from public\.resort_info where resort_key = 'miyazaki_city'\)/, '한 번만 도는 조건이 없다');
  assert.match(sql, /where resort_key = 'miyazaki' and exists \(select 1 from ins\)/, '① 행 갱신이 분리와 묶여 있지 않다');
  assert.doesNotMatch(sql, /\bdelete\b/i, '지우는 문장을 가진다');
});


/* 운영 상태(2026-11-21) — 키는 옛 이름 bookable 그대로(저장본 호환) · 값 O·later·offline·X · 목록의 「빈칸」은 core:true 항목만 센다 */
test('운영 상태 — bookable 키 · 네 값 · 핵심 칸 · 40 SQL', () => {
  const src = read('tools/resortinfo/index.html');
  const m = src.match(/\{\s*k:'bookable',[^\n]*opts:\[([^\n]*)\]\],/);
  assert.ok(m, 'bookable 항목(값·이름 짝 opts)을 못 읽었다');
  for (const v of ["'O'", "'later'", "'offline'", "'X'"]) assert.ok(m[1].includes('[' + v + ','), '운영 상태 값 ' + v + ' 가 없다');
  const core = [...src.matchAll(/\{\s*k:\s*'([a-z_]+)',[^\n]*core:true/g)].map(x => x[1]).sort();
  assert.deepEqual(core, ['baggage_group', 'entry_address', 'flight_in', 'flight_out', 'staff']);
  assert.match(src, /FREE_OPEN = Date\.parse\('2026-11-30T10:00:00\+09:00'\)/, '상시예약 오픈 시각이 바뀌었다');
  const sql = read('supabase/migrations/40_resort_info_status.sql');
  assert.match(sql, /\('nilai', 'offline'\)/, '닐라이는 2027 운영 · 온라인 미오픈(offline)');
  assert.match(sql, /in \('', 'O'\)/, '담당자가 고친 값은 덮지 않는다');
});

/* 변경 이력 · 담당 직원 제안(2026-11-21) — 이력은 읽기만(트리거가 쓴다) · 되돌리기는 폼에만 불러오고 저장은 사람이 누른다 */
test('변경 이력 — 저장소 로더 · 화면 버튼 · 되돌리기는 저장하지 않는다 · 담당 직원 제안 목록', () => {
  const store = read('shared/store.js');
  assert.match(store, /function loadResortInfoHistory\(key\)[\s\S]{0,200}resort_info_history\?resort_key=eq\./);
  assert.match(store, /loadResortInfoHistory: loadResortInfoHistory/);
  const src = read('tools/resortinfo/index.html');
  assert.match(src, /id="btnHist"/);
  const restore = src.match(/querySelectorAll\('\[data-restore\]'\)[\s\S]*?\}\);\s*\}\);/);
  assert.ok(restore, '되돌리기 처리부를 못 읽었다');
  assert.doesNotMatch(restore[0], /doSave|saveResortInfo/, '되돌리기가 바로 저장하면 안 된다 — 폼에 불러오고 사람이 「저장」');
  assert.match(src, /list="riStaffList"/);
  assert.match(src, /<datalist id="riStaffList">/);
});

/* 입국 신고 정보 특수문자 빼기(2026-11-22) — 리조트 정보 화면과 입국 안내 문안이 같은 규칙(en = 영문·숫자·띄어쓰기 · num = 숫자) */
test('입국 신고 네 칸 — clean 규칙이 두 화면에 같고 41 SQL 이 있다', () => {
  const ri = read('tools/resortinfo/index.html'), en = read('tools/entry/index.html');
  for (const src of [ri, en]) {
    assert.match(src, /k:'entry_name_en',[^\n]*clean:'en'/);
    assert.match(src, /k:'entry_address',[^\n]*clean:'en'/);
    assert.match(src, /k:'entry_postal',[^\n]*clean:'num'/);
    assert.match(src, /k:'entry_phone',[^\n]*clean:'num'/);
    assert.ok(src.includes("v.replace(/[^0-9]/g, '')") && src.includes("v.replace(/[^A-Za-z0-9 ]/g, ' ')"), 'cleanVal 규칙이 다르다');
  }
  assert.doesNotMatch(ri, /hint:'예: ASO YAMANAMI RESORT HOTEL & GOLF CLUB'/, '입력 예시에 특수문자가 남아 있다');
  const sql = read('supabase/migrations/41_resort_info_entry_clean.sql');
  assert.match(sql, /'\[\^A-Za-z0-9 \]'/);
  assert.match(sql, /'입국 주소 메모'/);
});
