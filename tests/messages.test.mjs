/* 고객 안내 문안 — 카카오톡·메일·문자 문안이 코드 한 자리에서 관리되고, 화면마다 붙어 있는지.
 *
 * 문안이 화면마다 따로 적히면 누가 보내느냐에 따라 안내가 달라진다(2026-09-17 · Min).
 * 자료실은 tools/library/index.html 의 MSG, 2027 발송 문안은 sales/notice2027.js 가 단일 출처다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const bytes = s => [...s].reduce((n, c) => n + (c.charCodeAt(0) <= 0x7f ? 1 : 2), 0);   // 문자 길이 감각(한글 2바이트)
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

test('2027 발송 문안 — 인사 + 안내문 주소만 · 카카오톡 1,000자 · 문자 2,000바이트 안', () => {
  const n = load('sales/notice2027.js').MT_NOTICE_2027;
  const kakao = n.tabs.find(t => t.key === 'kakao');
  const lms = n.tabs.find(t => t.key === 'lms');
  assert.ok(kakao && lms, '카카오톡·문자 두 탭');
  assert.ok(kakao.body.startsWith('[메리트투어] 2027 시즌 골프 패키지 예약 안내\n'), '카카오톡 첫 줄 = 제목');
  assert.ok(kakao.body.length <= 1000, '카카오톡 ' + kakao.body.length + '자 — 1,000자를 넘는다');
  assert.ok(bytes(lms.body) <= 2000, '문자 본문 ' + bytes(lms.body) + '바이트 — 2,000바이트를 넘는다');
  assert.ok(bytes(lms.subject) <= 40, '문자 제목 ' + bytes(lms.subject) + '바이트 — 40바이트를 넘는다');
  for (const t of [kakao, lms]) {
    for (const s of ['회원님, 안녕하십니까. 메리트투어입니다.', '지난 2026년 한 해 보내 주신 성원에 깊이 감사드립니다.', '▶ 전 지역 상품·요금·환율·예약 절차 안내문(전문)', 'https://merittour.github.io/2027/']) {
      assert.ok(t.body.includes(s), t.label + ' 에 「' + s + '」 가 없다');
    }
    // 일정·로그인 방법은 안내문에 있다 — 문안에 다시 적지 않는다(두 곳이 어긋난다)
    assert.ok(!/10월 12일|HONG01012345678/.test(t.body), t.label + ' 에 안내문 내용이 다시 적혀 있다');
    for (const b of BANNED) assert.ok(!t.body.includes(b), t.label + ' 에 쓰지 않는 말 「' + b + '」');
  }
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

test('영업 허브 — 발송 문안 카드가 복사 상자와 notice2027 를 부른다', () => {
  const hub = read('sales/index.html');
  assert.match(hub, /id="card-notice2027"/);
  assert.match(hub, /<script src="\.\.\/shared\/copybox\.js"><\/script>/);
  assert.match(hub, /<script src="notice2027\.js"><\/script>/);
});
