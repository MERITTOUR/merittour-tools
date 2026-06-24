/* shared/util.js (MT 네임스페이스) 단위 테스트 — Node 빌트인, 의존성 0.
   브라우저 전용 함수(showToast 등)는 제외하고 순수 함수만 검증한다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MT = require('../shared/util.js');

test('pad2 — 한 자리 0 채움', () => {
  assert.equal(MT.pad2(5), '05');
  assert.equal(MT.pad2(12), '12');
});

test('num — 콤마·기호 제거 후 숫자', () => {
  assert.equal(MT.num('1,234원'), 1234);
  assert.equal(MT.num('12.5'), 12.5);
  assert.equal(MT.num('-3'), -3);
  assert.equal(MT.num(''), 0);
  assert.equal(MT.num('abc'), 0);
  assert.equal(MT.num(null), 0);
});

test('escHtml — & < > 만 이스케이프', () => {
  assert.equal(MT.escHtml('<a>&'), '&lt;a&gt;&amp;');
  assert.equal(MT.escHtml(null), '');
});

test('escAttr — 따옴표까지 이스케이프', () => {
  assert.equal(MT.escAttr('"&<>'), '&quot;&amp;&lt;&gt;');
});

test('parseLocalDate / normalizeDate — 다양한 입력 → YYYY-MM-DD', () => {
  assert.equal(MT.normalizeDate('2026-05-01'), '2026-05-01');
  assert.equal(MT.normalizeDate('2026.5.1'), '2026-05-01');   // 점 구분·한자리
  assert.equal(MT.normalizeDate('2026/05/01'), '2026-05-01'); // 슬래시 구분
  assert.equal(MT.normalizeDate(45292), '2024-01-01');        // 엑셀 시리얼
  assert.equal(MT.normalizeDate(''), '');
  assert.equal(MT.parseLocalDate(''), null);
});

test('fmtDate / fmtDateShort — 표시 포맷', () => {
  assert.equal(MT.fmtDate('2026-05-01'), '2026.05.01');
  assert.equal(MT.fmtDateShort('2026-05-01'), '5/1');
});

test('getWD / isWeekend — 요일', () => {
  assert.equal(MT.getWD('2026-05-01'), '금');   // 금요일
  assert.equal(MT.isWeekend('2026-05-02'), true);  // 토요일
  assert.equal(MT.isWeekend('2026-05-01'), false);
});

test('monthsBetween — 일자 보정 포함', () => {
  assert.equal(MT.monthsBetween('2026-01-15', '2026-07-10'), 5); // 일자 모자라 -1
  assert.equal(MT.monthsBetween('2026-01-15', '2026-07-20'), 6);
  assert.equal(MT.monthsBetween('', '2026-07-20'), null);
});

test('cleanPhone / fmtPhone — 전화번호', () => {
  assert.equal(MT.cleanPhone('010-1234-5678'), '01012345678');
  assert.equal(MT.fmtPhone('01012345678'), '010-1234-5678');
  assert.equal(MT.fmtPhone('0212345678'), '021-234-5678');
});
