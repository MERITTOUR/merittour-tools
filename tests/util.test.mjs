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

/* ── 호텔 블록 · 기간별 보유 예외 ── */
const EXC = [
  { id: 'x1', room: '트윈', from: '2026-08-01', to: '2026-08-31', qty: 20 },
  { id: 'x2', room: '트윈', from: '2026-09-14', to: '2026-09-14', qty: 9 },
  { id: 'x3', room: '패밀리룸', from: '2026-08-10', to: '2026-08-12', qty: 0 },
];
const BASE = { '트윈': 15, '패밀리룸': 19 };

test('roomCapOn — 예외 없는 날은 기본 보유', () => {
  assert.equal(MT.roomCapOn(BASE, EXC, '트윈', '2026-07-31').qty, 15);
  assert.equal(MT.roomCapOn(BASE, EXC, '트윈', '2026-07-31').exc, null);
});

test('roomCapOn — 기간 예외 적용 + 경계일 포함', () => {
  assert.equal(MT.roomCapOn(BASE, EXC, '트윈', '2026-08-01').qty, 20);  // 시작일
  assert.equal(MT.roomCapOn(BASE, EXC, '트윈', '2026-08-31').qty, 20);  // 종료일
  assert.equal(MT.roomCapOn(BASE, EXC, '트윈', '2026-09-01').qty, 15);  // 기간 밖
});

test('roomCapOn — 겹치면 짧은 기간이 이김', () => {
  const wide = { id: 'w', room: '트윈', from: '2026-09-01', to: '2026-09-30', qty: 30 };
  const exc = [wide, ...EXC];
  assert.equal(MT.roomCapOn(BASE, exc, '트윈', '2026-09-13').qty, 30);  // 넓은 것만 걸림
  assert.equal(MT.roomCapOn(BASE, exc, '트윈', '2026-09-14').qty, 9);   // 하루짜리가 이김
  // 등록 순서를 뒤집어도 결과가 같아야 한다
  assert.equal(MT.roomCapOn(BASE, exc.slice().reverse(), '트윈', '2026-09-14').qty, 9);
});

test('roomCapOn — 수량 0은 유효(그 기간 판매 불가)', () => {
  assert.equal(MT.roomCapOn(BASE, EXC, '패밀리룸', '2026-08-11').qty, 0);
  assert.equal(MT.roomCapOn(BASE, EXC, '패밀리룸', '2026-08-13').qty, 19);
});

test('roomCapOn — 룸타입 미등록이면 null, 예외만 있으면 그 값', () => {
  assert.equal(MT.roomCapOn(BASE, EXC, '스위트', '2026-08-01'), null);
  const only = [{ id: 'o', room: '스위트', from: '2026-08-01', to: '2026-08-05', qty: 3 }];
  assert.equal(MT.roomCapOn(BASE, only, '스위트', '2026-08-03').qty, 3);
  assert.equal(MT.roomCapOn(BASE, only, '스위트', '2026-08-06'), null);
});

test('roomExcValid — 종료<시작·수량 결측은 무효', () => {
  assert.equal(MT.roomExcValid({ room: '트윈', from: '2026-08-10', to: '2026-08-01', qty: 5 }), false);
  assert.equal(MT.roomExcValid({ room: '트윈', from: '2026-08-01', to: '2026-08-10', qty: null }), false);
  assert.equal(MT.roomExcValid({ room: '트윈', from: '2026-08-01', to: '2026-08-10', qty: 0 }), true);
  // 무효 예외는 조회에서 무시된다
  assert.equal(MT.roomCapOn(BASE, [{ id: 'z', room: '트윈', from: '2026-08-10', to: '2026-08-01', qty: 99 }], '트윈', '2026-08-05').qty, 15);
});

test('roomExcSpan — 하루짜리는 1일', () => {
  assert.equal(MT.roomExcSpan({ room: '트윈', from: '2026-09-14', to: '2026-09-14', qty: 9 }), 1);
  assert.equal(MT.roomExcSpan({ room: '트윈', from: '2026-08-01', to: '2026-08-31', qty: 20 }), 31);
});

test('roomExcConflicts — 같은 길이로 겹치면 경고', () => {
  const a = { id: 'a', room: '트윈', from: '2026-08-01', to: '2026-08-10', qty: 5 };
  const b = { id: 'b', room: '트윈', from: '2026-08-05', to: '2026-08-14', qty: 7 };  // 같은 10일, 겹침
  const c = { id: 'c', room: '트윈', from: '2026-08-05', to: '2026-08-06', qty: 7 };  // 짧음 → 승부남
  assert.deepEqual(MT.roomExcConflicts([a, b]).sort(), ['a', 'b']);
  assert.deepEqual(MT.roomExcConflicts([a, c]), []);
  assert.deepEqual(MT.roomExcConflicts([]), []);
});

/* ── 인원 → 객실 배정 ── */
const T2 = { name: '2인실', pax: 2 };
const T4 = { name: '4인실', pax: 4 };
const TY = [T2, T4];
const plan = p => p.rooms.map(r => `${r.name}x${r.count}`).join('+');

test('roomsNeeded — 2인 1실이 기본', () => {
  assert.equal(MT.roomsNeeded(4, 2), 2);
  assert.equal(MT.roomsNeeded(3, 2), 2);   // 3명이면 2실 (1자리 빔)
  assert.equal(MT.roomsNeeded(4, 4), 1);
  assert.equal(MT.roomsNeeded(4, 0), null);
  assert.equal(MT.roomsNeeded(0, 2), null);
});

test('emptyBeds — 빈자리 수', () => {
  assert.equal(MT.emptyBeds(2, 2), 0);
  assert.equal(MT.emptyBeds(1, 2), 1);     // 2인실에 1명
  assert.equal(MT.emptyBeds(2, 4), 2);     // 4인실에 2명
  assert.equal(MT.emptyBeds(3, 4), 1);
});

test('roomPlans — 2명은 2인실 하나뿐', () => {
  const p = MT.roomPlans(2, TY);
  assert.equal(p.length, 1);
  assert.equal(plan(p[0]), '2인실x1');
});

test('roomPlans — 4명은 4인실 1개 또는 2인실 2개', () => {
  const p = MT.roomPlans(4, TY).map(plan);
  assert.deepEqual(p, ['4인실x1', '2인실x2']);   // 방 적은 순
});

test('roomPlans — 8명(회원권 8인) 조합', () => {
  const p = MT.roomPlans(8, TY).map(plan);
  assert.deepEqual(p, ['4인실x2', '4인실x1+2인실x2', '2인실x4']);
});

test('roomPlans — 홀수는 딱 떨어지지 않아 조합 없음', () => {
  assert.deepEqual(MT.roomPlans(3, TY), []);
  assert.deepEqual(MT.roomPlans(5, TY), []);
});

test('roomPlans — exact:false면 빈자리 허용', () => {
  const p = MT.roomPlans(3, TY, { exact: false });
  assert.ok(p.length > 0);
  assert.equal(plan(p[0]), '4인실x1');      // 4인실 1개, 1자리 빔
  assert.equal(p[0].empty, 1);
});

test('roomPlans — 2인실만 있는 숙소는 짝수만', () => {
  assert.deepEqual(MT.roomPlans(4, [T2]).map(plan), ['2인실x2']);
  assert.deepEqual(MT.roomPlans(3, [T2]), []);
});

test('bookablePax — 온라인에서 고를 수 있는 인원', () => {
  assert.deepEqual(MT.bookablePax(TY, 10), [2, 4, 6, 8, 10]);
  assert.deepEqual(MT.bookablePax([T4], 12), [4, 8, 12]);   // 4인실만이면 4의 배수
  assert.deepEqual(MT.bookablePax([], 10), []);
});
