/* 닐라이 견적·확정서(tools/nilai) — 계산 · 문서 · 알림톡 문안 · 섹션 배선이 서로 어긋나지 않게 묶어 둔다.
 *
 * 손님에게 나가는 숫자(박수 · 총액 · 예약금 · 잔금 기한)와 알림톡 문안(Edge Function 의 buildMessage 와
 * 글자 단위로 같아야 발송된다)은 화면이 아니라 여기서 잡는다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const N = createRequire(import.meta.url)(path.join(ROOT, 'tools/nilai/nilai-logic.js'));

const sample = () => Object.assign(N.blank('confirm', new Date(2026, 9, 1)), {
  docNo: N.docNo('2026-10-01', 1), repName: '홍길동', phone: '010-1234-5678', pax: 4,
  dep: '2027-03-10', ret: '2027-03-14', pricePP: 1890000, flightOut: 'KE671', flightIn: 'KE672',
  extras: [{ label: '싱글룸 추가', amount: 200000, qty: 1 }], discount: 100000
});

test('계산 — 3박 5일(야간 비행) · 2인 1실 · 라운딩 = 박수 · 총액 · 예약금 · 잔금 기한(출발 30일 전)', () => {
  const c = N.calc(sample());
  assert.equal(c.days, 5); assert.equal(c.nights, 3); assert.equal(c.stay, '3박 5일');
  assert.equal(c.rooms, 2); assert.equal(c.rounds, 3);
  assert.equal(c.base, 1890000 * 4);
  assert.equal(c.total, 1890000 * 4 + 200000 - 100000);
  assert.equal(c.deposit, 300000 * 4);
  assert.equal(c.balance, c.total - c.deposit);
  assert.equal(N.ymd(c.dueDate), '2027-02-08');
  assert.equal(c.productName, '말레이시아 닐라이스프링스 골프 3박 5일');
});

test('계산 — 담당자가 적은 박수·객실·라운딩이 자동값을 이긴다 · 빈 입력은 0 으로 죽지 않는다', () => {
  const c = N.calc(Object.assign(sample(), { nights: 4, rooms: 3, rounds: 2 }));
  assert.equal(c.nights, 4); assert.equal(c.rooms, 3); assert.equal(c.rounds, 2);
  const z = N.calc(N.blank('quote'));
  assert.equal(z.total, 0); assert.equal(z.days, 0); assert.equal(z.period, '');
});

test('문서번호 — NS-연월일-순번 두 자리', () => {
  assert.equal(N.docNo('2026-10-01', 1), 'NS-261001-01');
  assert.equal(N.docNo('2026-12-31', 12), 'NS-261231-12');
  assert.match(N.docNo(new Date(2027, 0, 5), 0), /^NS-270105-01$/);
});

test('일정 — 일수만큼 · 첫날 출국 · 마지막 날 귀국 · 직접 입력이 있으면 그 줄', () => {
  const d = sample();
  const it = N.itinerary(d);
  assert.equal(it.length, 5);
  assert.match(it[0].text, /^인천 출발 \(KE671\)/);
  assert.match(it[4].text, /\(KE672\) → 인천 도착$/);
  assert.match(it[1].text, /라운딩 · 닐라이스프링스CC/);
  assert.equal(it[0].date, '03.10 (수)');
  d.itin = '출발\n라운딩 A\n라운딩 B\n자유\n귀국';
  assert.deepEqual(N.itinerary(d).map(r => r.text), ['출발', '라운딩 A', '라운딩 B', '자유', '귀국']);
});

test('빠진 값 — 대표자 · 휴대폰 · 인원 · 출발일 · 귀국일 · 1인 요금', () => {
  assert.deepEqual(N.validate(N.blank('confirm')), ['대표자 성함', '휴대폰 번호', '인원', '출발일', '귀국일', '1인 요금']);
  assert.deepEqual(N.validate(sample()), []);
  assert.deepEqual(N.validate(Object.assign(sample(), { ret: '2027-03-01' })), ['귀국일이 출발일보다 앞섭니다']);
});

test('문서 HTML — 핵심 값이 찍히고 undefined·NaN 이 없다 · 견적서는 첫 유의사항이 「발행일 기준」', () => {
  const d = sample();
  const h = N.buildHtml(d, { logoSrc: 'data:image/svg+xml;base64,PHN2Zy8+' });
  for (const s of ['확 정 서', 'NS-261001-01', '홍길동', '010-1234-5678', '3박 5일', '7,660,000원', '1,200,000원', '6,460,000원', '2027.02.08', '국민은행 817201-04-109230', 'KE671', 'Nilai Springs']) {
    assert.ok(h.includes(s), '문서에 없다: ' + s);
  }
  assert.ok(!/undefined|NaN/.test(h));
  assert.ok(h.includes('class="doc"'), 'html2canvas 대상 .doc 이 없다');
  const q = N.buildHtml(Object.assign(sample(), { kind: 'quote' }));
  assert.ok(q.includes('견 적 서') && q.includes('본 견적은 발행일 기준'));
  assert.ok(!q.includes('<script'), '손님 문서에 스크립트가 들어가면 안 된다');
  const x = N.buildHtml(Object.assign(sample(), { repName: '<b>x</b>' }));
  assert.ok(x.includes('&lt;b&gt;x&lt;/b&gt;'), '입력값은 이스케이프한다');
});

test('알림톡 문안 = Edge Function send-alimtalk 의 buildMessage 와 글자 단위로 같다', () => {
  const ts = read('supabase/functions/send-alimtalk/index.ts');
  const body = ts.match(/function buildMessage[\s\S]*?return \[([\s\S]*?)\]\.join\("\\n"\)/);
  assert.ok(body, 'index.ts 의 buildMessage 를 못 읽었다');
  const lines = [...body[1].matchAll(/`([^`]*)`/g)].map(m => m[1]);
  const d = sample();
  const label = '확정서', r = N.recipient(d, 'https://x/y');
  const expect = lines.map(l => l.replace('${label}', label).replace('${r.name}', r.name).replace('${r.eventNo}', r.eventNo).replace('${r.dep}', r.dep).replace('${r.prod}', r.prod)).join('\n');
  assert.equal(N.alimtalk(d), expect);
  assert.deepEqual(r, { phone: '01012345678', name: '홍길동', eventNo: 'NS-261001-01', dep: '2027-03-10', prod: '말레이시아 닐라이스프링스 골프 3박 5일', link: 'https://x/y' });
  assert.match(N.smsText(d, 'https://x/y'), /확정서 확인: https:\/\/x\/y/);
});

test('섹션 배선 — access.js(SECTIONS · 역할 기본값 sales·manage) · 허브 카드 이름 · 화면 가드 · 34 의 섹션 부여', () => {
  const acc = read('shared/access.js');
  const sec = acc.match(/key: 'nilai',\s*label: '([^']+)',\s*path: 'tools\/nilai\/'/);
  assert.ok(sec, 'SECTIONS 에 nilai 가 없다');
  assert.match(acc, /ALL_KEYS = \[[^\]]*'nilai'/);
  for (const role of ['manage', 'sales']) {
    assert.match(acc, new RegExp(role + ':\\s*\\{ areas: \\[[^\\]]*\'nilai\''), role + ' 기본 섹션에 nilai 가 없다');
  }
  assert.ok(!/air:\s*\{ areas: \[[^\]]*'nilai'/.test(acc), '항공팀 기본 섹션에는 넣지 않는다');
  const hub = read('sales/index.html');
  const card = hub.match(/data-section="nilai"[\s\S]{0,300}?tool-card-title">([^<]+)</);
  assert.ok(card, '영업 허브에 닐라이 카드가 없다');
  assert.equal(card[1].trim(), sec[1], '허브 카드 이름과 섹션 label 이 다르다');
  const page = read('tools/nilai/index.html');
  assert.match(page, /guard\.js" data-section="nilai"/, '화면이 섹션 가드를 안 건다');
  assert.match(page, /<script src="nilai-logic\.js"><\/script>/, '화면이 계산 모듈을 안 부른다');
  const sql = read('supabase/migrations/34_nilai_docs.sql');
  assert.match(sql, /array_append\(areas, 'nilai'\)[\s\S]*role in \('owner', 'admin', 'manage', 'sales'\)/);
  for (const p of ['nd_select', 'nd_insert', 'nd_update']) assert.match(sql, new RegExp('create policy ' + p + ' on public\\.nilai_docs[\\s\\S]*?mt_has_role\\(array\\[\'admin\',\'sales\',\'manage\'\\]\\)'));
  assert.match(sql, /revoke all on public\.nilai_docs from anon/);
  assert.ok(!/create policy nd_delete/.test(sql), '삭제 정책은 두지 않는다');
});
