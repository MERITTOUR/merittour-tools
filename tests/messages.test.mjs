/* 고객 안내 문안 — 카카오톡·메일 문안이 코드 한 자리에서 관리되고, 화면마다 붙어 있는지.
 *
 * 문안이 화면마다 따로 적히면 누가 보내느냐에 따라 안내가 달라진다(2026-09-17 · Min).
 * 자료실은 tools/library/index.html 의 MSG 가 단일 출처다.
 * 영업 허브의 발송 문안 카드(2027 예약 안내 · 쿠쥬 프라이빗 타운 희망 일정 접수)는 2026-09-17 발송 뒤 지웠다 —
 * 허브가 지운 파일을 다시 부르지 않는지만 본다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function load(file) {
  const w = {};
  vm.runInNewContext(read(file), { window: w, navigator: {}, setTimeout, clearTimeout });
  return w;
}
// 손님 안내에 쓰지 않는 말(merittour.github.io CLAUDE.md 「기간 이름」 절)
const BANNED = ['회원 우선', '추가예약', '추가 예약', '일반 예약', '회원예약제', '자유예약'];

test('copybox — open·close·bytesEucKr 를 내놓고, 불러올 때 DOM 을 건드리지 않는다', () => {
  const w = load('shared/copybox.js');
  assert.equal(typeof w.MT_COPYBOX.open, 'function');
  assert.equal(typeof w.MT_COPYBOX.close, 'function');
  assert.equal(w.MT_COPYBOX.isOpen(), false);
  assert.equal(w.MT_COPYBOX.bytesEucKr('가a'), 3);
});

test('자료실 — 카드마다 문안 줄이 있고, 문안 데이터(MSG)에 그 키가 있다', () => {
  const html = read('tools/library/index.html');
  const rows = [...html.matchAll(/class="msg-row" data-msg="([a-z0-9_]+)"/g)].map(m => m[1]);
  assert.deepEqual(rows, ['ewrc2', 'longstay_individual', 'nonmember_individual', 'longstay_corporate', 'nonmember_corporate', 'transfer']);
  for (const k of rows) assert.match(html, new RegExp('^\\s+' + k + ': \\{', 'm'), 'MSG 에 ' + k + ' 가 없다');
  const pairs = [...html.matchAll(/class="dl-row" data-pair="([a-z0-9_]+)"/g)].map(m => m[1]);
  for (const k of pairs) assert.ok(rows.includes(k), '원본 양식 카드 ' + k + ' 에 문안 줄이 없다');
  assert.match(html, /<script src="\.\.\/\.\.\/shared\/copybox\.js"><\/script>/, '복사 상자를 안 부른다');
});

test('자료실 문안 — 카드에 적힌 계좌·금액과 같은 값을 말한다', () => {
  const html = read('tools/library/index.html');
  const script = html.slice(html.indexOf('const CO = {'));
  for (const s of ['817201-04-109230', '109-890042-63604', '330,000원', '700만원', '5,000만원', '(04001) 서울특별시 마포구 월드컵북로 15']) {
    assert.ok(script.includes(s), '문안에 「' + s + '」 가 없다');
    assert.ok(html.slice(0, html.indexOf('const CO = {')).includes(s), '카드에 「' + s + '」 가 없다');
  }
  for (const b of BANNED) assert.ok(!script.includes(b), '문안에 쓰지 않는 말 「' + b + '」');
});

test('영업 허브 — 지운 발송 문안(파일·카드·복사 상자 호출)을 다시 부르지 않는다', () => {
  const hub = read('sales/index.html');
  assert.ok(!/notice2027\.js|notice_longstay2027\.js/.test(hub), '지운 문안 파일을 script 로 부른다');
  assert.ok(!/data-notice=/.test(hub), '발송 문안 카드가 남아 있다');
  assert.ok(!/copybox\.js|MT_COPYBOX/.test(hub), '허브에는 복사 상자를 쓰는 곳이 없다');
  for (const f of ['sales/notice2027.js', 'sales/notice_longstay2027.js']) {
    assert.ok(!fs.existsSync(path.join(ROOT, f)), f + ' 이 아직 있다');
  }
});
