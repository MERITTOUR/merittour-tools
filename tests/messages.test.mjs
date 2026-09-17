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

test('2027 발송 문안 — 알림톡 템플릿 · 고객아이디 치환값 · 치환 뒤 1,000자 안 · 안내문의 날짜·주소', () => {
  const n = load('sales/notice2027.js').MT_NOTICE_2027;
  const t = n.tabs.find(x => x.key === 'alimtalk');
  assert.ok(t, '알림톡 탭');
  assert.ok(t.body.startsWith('[메리트투어] 2027 시즌 골프 패키지 예약 안내\n'), '첫 줄 = 제목');
  assert.ok(t.body.includes('· 회원님 아이디: #{고객아이디}'), '고객아이디 치환값이 없다');
  assert.deepEqual([...n.template.variables], ['#{고객아이디}'], '치환값 목록');
  // 치환 뒤 길이 — 아이디는 영문 성 + 휴대폰번호(최대 20자 잡음)
  const filled = t.body.replace(/#\{고객아이디\}/g, 'HONGGILDONG01012345678');
  assert.ok(filled.length <= 1000, '치환 뒤 ' + filled.length + '자 — 1,000자를 넘는다');
  assert.ok(bytes(filled) <= 2000, '대체 문자로 갈 때 ' + bytes(filled) + '바이트 — 2,000바이트를 넘는다');
  for (const s of ['2026년 10월 12일(월) 오전 10시', '2026년 11월 30일(월) 오전 10시', 'www.merittour.co.kr', 'https://merittour.github.io/2027/', '02-365-9800']) {
    assert.ok(t.body.includes(s), '문안에 「' + s + '」 가 없다');
  }
  assert.ok(!t.body.includes('HONG01012345678'), '아이디가 치환값인데 예시 아이디가 남아 있다');
  // 링크가 묻히지 않게 — 안내문 주소는 세부(■ 줄)보다 앞에, 밖에 적는 세부는 오픈 일시·아이디까지만(Min 2026-09-17)
  assert.ok(t.body.indexOf('https://merittour.github.io/2027/') < t.body.indexOf('■'), '안내문 주소가 세부 내용 뒤에 있다');
  assert.ok(!/1차|회차|포틴힐즈|개편 작업/.test(t.body), '안내문에 있는 세부(회차·확인 사항·개편)를 밖에 다시 적었다');
  assert.ok(filled.length <= 500, '치환 뒤 ' + filled.length + '자 — 짧게(500자 안) 유지한다');
  for (const b of BANNED) assert.ok(!t.body.includes(b), '쓰지 않는 말 「' + b + '」');
  assert.equal(n.template.buttons[0].url, 'https://merittour.github.io/2027/', '버튼 주소');
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
