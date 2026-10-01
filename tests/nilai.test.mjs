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
  eventNo: '24-0001', repName: '홍길동', phone: '010-1234-5678', pax: 4,
  dep: '2027-03-10', ret: '2027-03-14',
  fares: [{ label: '투어비(항공료 포함)', amount: 1890000, qty: '' }, { label: '싱글룸 추가', amount: 200000, qty: 1 }], discount: 100000
});

test('계산 — 3박 5일(밤 비행 귀국) · 2인 1실 · 라운딩 = 박수 · 총합계 · 예약금 · 잔금 기한(출발 30일 전) · 체크인/아웃 · 상품명', () => {
  const c = N.calc(sample());
  assert.equal(c.days, 5); assert.equal(c.nights, 3); assert.equal(c.stay, '3박 5일');
  assert.equal(c.rooms, 2); assert.equal(c.rounds, 3);
  assert.deepEqual(c.fares.map(f => [f.label, f.amount, f.qty]), [['투어비(항공료 포함)', 1890000, 4], ['싱글룸 추가', 200000, 1]]);
  assert.equal(c.total, 1890000 * 4 + 200000 - 100000);
  assert.equal(c.deposit, 300000 * 4);
  assert.equal(c.balance, c.total - c.deposit);
  assert.equal(N.ymd(c.dueDate), '2027-02-08');
  assert.equal(N.ymd(c.checkIn), '2027-03-10'); assert.equal(N.ymd(c.checkOut), '2027-03-13'); assert.equal(N.ymd(c.inDepDate), '2027-03-13');
  assert.equal(c.productName, '[3박 5일] 닐라이스프링스CC 골프 투어 - 대한항공');
  assert.equal(c.period, '2027.03.10 ~ 2027.03.14 (3박 5일)');
});

test('계산 — 엠클릭 예약 30003171 과 같은 값(6박 8일 · 요금 두 줄 · 총합계 20,760,000)', () => {
  const d = Object.assign(N.blank('confirm'), { repName: 'x', phone: '010', pax: 12, dep: '2026-11-25', ret: '2026-12-02',
    fares: [{ label: '투어비(항공료117만원 포함)', amount: 2120000, qty: 8 }, { label: '투어비(항공료 불포함)', amount: 950000, qty: 4 }] });
  const c = N.calc(d);
  assert.equal(c.stay, '6박 8일'); assert.equal(c.total, 20760000); assert.equal(c.productName, '[6박 8일] 닐라이스프링스CC 골프 투어 - 대한항공');
  assert.deepEqual(N.flights(d).map(f => [f.no, f.depDate, f.depTime, f.from, f.to, f.arrDate, f.arrTime]),
    [['KE427', '2026-11-25', '16:40', 'ICN', 'KUL', '2026-11-25', '22:25'], ['KE428', '2026-12-01', '23:55', 'KUL', 'ICN', '2026-12-02', '07:15']]);
  const it = N.itinerary(d);
  assert.equal(it.length, 8);
  assert.equal(it[0].lines[0], '인천국제공항 2터미널 출국장, 대한항공 카운터 개별수속'); assert.equal(it[0].meals, '석식 : 불포함'); assert.equal(it[0].hotel, '닐라이스프링스 리조트 호텔');
  assert.match(it[6].lines.join(' / '), /쿠알라룸푸르 국제공항에서 인천국제공항으로 출발 \(KE428 23:55\)/); assert.equal(it[6].hotel, '');
  assert.deepEqual(it[7].lines, ['인천국제공항 도착 (07:15)']);
  assert.equal(it.filter(r => /라운딩/.test(r.lines[0])).length, 6, '라운딩 날 = 박수');
});

test('계산 — 담당자가 적은 박수·방수·라운딩이 자동값을 이긴다 · 당일 도착이면 박수 = 일수 − 1 · 빈 입력은 0 으로 죽지 않는다', () => {
  const c = N.calc(Object.assign(sample(), { nights: 4, rooms: 3, rounds: 2 }));
  assert.equal(c.nights, 4); assert.equal(c.rooms, 3); assert.equal(c.rounds, 2);
  assert.equal(N.calc(Object.assign(sample(), { inDepOffset: '0' })).nights, 4, '당일 출발이면 박수 = 일수 − 1');
  assert.equal(N.calc(Object.assign(sample(), { outArrOffset: '1' })).nights, 2, '출발편 1일후도착이면 체크인이 하루 늦다');
  assert.equal(N.calc(Object.assign(sample(), { inDepOffset: undefined, inNextDay: false })).nights, 4, '옛 저장분(보정 칸 없음)의 체크박스 값도 읽는다');
  const same = Object.assign(sample(), { inDepOffset: '0' });
  assert.equal(N.flights(same)[1].depDate, '2027-03-14'); assert.equal(N.flights(same)[1].depNote, '');
  assert.equal(N.flights(sample())[1].depNote, '1일전출발'); assert.equal(N.flights(Object.assign(sample(), { outArrOffset: '1' }))[0].arrNote, '1일후도착');
  const itSame = N.itinerary(same);
  assert.match(itSame[itSame.length - 1].lines.join(' / '), /인천국제공항으로 출발.*인천국제공항 도착/, '당일 출발이면 마지막 날에 출발과 도착이 같이');
  const itLate = N.itinerary(Object.assign(sample(), { outArrOffset: '1' }));
  assert.equal(itLate[0].lines.length, 2); assert.match(itLate[1].lines[0], /^쿠알라룸푸르공항 도착/); assert.equal(itLate[0].meals, '불포함');
  const z = N.calc(N.blank('quote'));
  assert.equal(z.total, 0); assert.equal(z.days, 0); assert.equal(z.period, ''); assert.equal(z.productName, '닐라이스프링스CC 골프 투어 - 대한항공');
});

test('행사번호 — 담당자가 적는 선택 항목 · 비우면 문서·알림톡에 공란 · 새 문서 기본 종류는 견적서', () => {
  assert.equal(N.blank().kind, 'quote');
  assert.equal(N.blank().eventNo, '');
  const blank = Object.assign(sample(), { eventNo: '' });
  assert.ok(N.buildHtml(blank).includes('<th>행사번호</th><td></td>'), '행사번호 칸이 공란으로 남아야 한다');
  assert.match(N.alimtalk(blank), /\n· 행사번호 : \n/);
  assert.ok(!/행사번호/.test(N.smsText(blank, '')), '수동 문자는 행사번호가 없으면 그 줄을 뺀다');
  assert.ok(!/NS-\d{6}/.test(N.buildHtml(sample())), '자동 번호(NS-…)는 더 쓰지 않는다');
  assert.equal(typeof N.docNo, 'undefined');
});

test('일정 — 직접 입력이 있으면 그 줄', () => {
  const d = sample(); d.itin = '출발\n라운딩 A\n라운딩 B\n출국\n귀국';
  assert.deepEqual(N.itinerary(d).map(r => r.lines[0]), ['출발', '라운딩 A', '라운딩 B', '출국', '귀국']);
});

test('빠진 값 — 대표자 · 휴대폰 · 인원 · 출발일 · 귀국일 · 요금', () => {
  assert.deepEqual(N.validate(N.blank('confirm')), ['대표자 성함', '휴대폰 번호', '인원', '출발일', '귀국일', '요금']);
  assert.deepEqual(N.validate(sample()), []);
  assert.deepEqual(N.validate(Object.assign(sample(), { ret: '2027-03-01' })), ['귀국일이 출발일보다 앞섭니다']);
});

test('문서 HTML — 엠클릭 확정서 구성(회사 정보 · 발신 · 여행정보 · 요금안내 · 상품정보 · 항공정보 · 숙박정보 · 상세일정 · 미팅 · 취소 · 유의사항) · 이스케이프 · undefined 없음', () => {
  const d = sample();
  const h = N.buildHtml(d, { logoSrc: 'data:image/svg+xml;base64,PHN2Zy8+' });
  for (const s of ['확 정 서', 'TEL : 02-365-9800', 'FAX : 02-365-9801', '서울특별시 마포구 월드컵북로 15', '<th>발신</th>', '[3박 5일] 닐라이스프링스CC 골프 투어 - 대한항공', '<th>행사번호</th><td>24-0001</td>', '홍길동 님 / 4명 (성인 4)',
    '판매항목', '투어비(항공료 포함)', '1,890,000', '>7,660,000<', '1,200,000원', '6,460,000원', '2027.02.08', '하나은행 109-890042-62004 (주)메리트투어', '선납하신 예약금',
    '숙박비, 라운딩비(1일 18홀)', '캐디피+캐디팁, 개인비용', '캐디피+캐디팁 비용', 'imigresen-online.imi.gov.my', 'KE427', 'KE428', '닐라이스프링스 리조트 호텔', '트윈 (TWN)',
    '상세일정', '피켓을 든 현지(말레이시아) 직원', '국외여행 표준약관', '환율 변동에 따른 추가 청구나 차액 정산은 없습니다']) {
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
  assert.deepEqual(r, { phone: '01012345678', name: '홍길동', eventNo: '24-0001', dep: '2027-03-10', prod: '[3박 5일] 닐라이스프링스CC 골프 투어 - 대한항공', link: 'https://x/y' });
  assert.match(N.smsText(d, 'https://x/y'), /행사번호 24-0001 · 출발 2027\.03\.10/);
  assert.match(N.smsText(d, 'https://x/y'), /확정서 확인: https:\/\/x\/y/);
});

test('발송 기록 — 누구에게 · 어떻게 · 어떤 문안 · 그때의 입력 스냅샷(뒤에 고쳐도 안 바뀐다)', () => {
  const d = sample();
  const e = N.sendEntry(d, 'kakao', { by: '직원', memo: '메일로도', link: 'https://x/y', at: '2026-10-01T09:00:00.000Z' });
  assert.equal(e.via, 'kakao'); assert.equal(e.to, '01012345678'); assert.equal(e.name, '홍길동'); assert.equal(e.kind, 'confirm');
  assert.equal(e.by, '직원'); assert.equal(e.memo, '메일로도'); assert.equal(e.link, 'https://x/y'); assert.equal(e.at, '2026-10-01T09:00:00.000Z');
  assert.equal(e.message, N.smsText(d, 'https://x/y'));
  assert.equal(N.sendEntry(d, 'alimtalk').message, N.alimtalk(d));
  assert.equal(N.sendEntry(d, '???').via, 'other');
  d.fares[0].amount = 1; d.fares.push({ label: 'x', amount: 1 });
  assert.equal(e.data.fares[0].amount, 1890000); assert.equal(e.data.fares.length, 2, '스냅샷은 원본과 떨어져 있어야 한다');
  assert.deepEqual(Object.keys(N.VIA_LABEL), ['alimtalk', 'kakao', 'sms', 'other']);
});

test('섹션 배선 — access.js(SECTIONS · 역할 기본값 sales·manage) · 허브 카드 이름 · 화면 가드 · 34·35 의 정책', () => {
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
  assert.match(page, /id="nlKind">\s*<label class="on"><input type="radio" name="kind" value="quote" checked> 견적서<\/label>\s*<label><input type="radio" name="kind" value="confirm"> 확정서/, '토글은 견적서가 먼저(2026-10-01 · Min)');
  assert.match(page, /data-k="eventNo"/, '행사번호 입력 칸이 없다');
  assert.ok(!/docNo|NS-연월일|pricePP|nlExtras/.test(page), '옛 입력(자동 번호 · 1인 요금 한 칸)이 남아 있다');
  for (const k of ['airline', 'flightOut', 'flightOutDep', 'flightOutArr', 'flightIn', 'flightInDep', 'flightInArr', 'outArrOffset', 'inDepOffset', 'hotel', 'incl', 'excl', 'ref', 'meeting', 'cancel']) assert.match(page, new RegExp('data-k="' + k + '"'), '입력 칸이 없다: ' + k);
  assert.match(page, /data-k="outArrOffset"><option value="0">_선택_<\/option><option value="1">1일후도착<\/option>/, '출발편 도착 보정은 엠클릭 표현(1일후도착)');
  assert.match(page, /data-k="inDepOffset"><option value="-1">1일전출발<\/option><option value="0">_선택_<\/option>/, '도착편 출발 보정은 엠클릭 표현(1일전출발 · 기본)');
  assert.ok(!/inNextDay|outNextDay|밤 비행이라/.test(page), '헷갈리던 체크박스 표현이 남아 있다');
  for (const id of ['btnRecord', 'recVia', 'recSave', 'nlHist', 'nlFilter']) assert.match(page, new RegExp('id="' + id + '"'), '없다: ' + id + ' (발송 기록 버튼 · 방법 선택 · 내역 패널 · 찾기)');
  const sql = read('supabase/migrations/34_nilai_docs.sql');
  assert.match(sql, /array_append\(areas, 'nilai'\)[\s\S]*role in \('owner', 'admin', 'manage', 'sales'\)/);
  for (const p of ['nd_select', 'nd_insert', 'nd_update']) assert.match(sql, new RegExp('create policy ' + p + ' on public\\.nilai_docs[\\s\\S]*?mt_has_role\\(array\\[\'admin\',\'sales\',\'manage\'\\]\\)'));
  assert.match(sql, /revoke all on public\.nilai_docs from anon/);
  assert.ok(!/create policy nd_delete/.test(sql), '삭제 정책은 두지 않는다');
  const sql35 = read('supabase/migrations/35_nilai_docs_sends.sql');
  assert.match(sql35, /drop constraint if exists nilai_docs_doc_no_key/);
  assert.match(sql35, /alter column doc_no drop not null/);
  assert.match(sql35, /add column if not exists sends jsonb not null default '\[\]'::jsonb/);
});
