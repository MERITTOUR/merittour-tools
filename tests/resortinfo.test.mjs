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
  assert.deepEqual(page, dash);
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
