import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const STORE = require('../shared/store.js');

let routes = [], calls = [], token = 'AT';

function reset() {
  routes = []; calls = []; token = 'AT';
  STORE._dep.config = { URL: 'https://x.supabase.co', ANON_KEY: 'anon-key' };
  STORE._dep.auth = { token: async () => token };
  STORE._dep.fetch = async (url, opt) => {
    calls.push({
      url, method: opt.method || 'GET',
      body: opt.body ? JSON.parse(opt.body) : null,
      auth: opt.headers.Authorization, prefer: opt.headers.Prefer || ''
    });
    const r = routes.find(x => url.includes(x.m) && (!x.method || x.method === (opt.method || 'GET')));
    if (!r) return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'no route' }) };
    return { ok: r.s >= 200 && r.s < 300, status: r.s, text: async () => JSON.stringify(r.b ?? null) };
  };
}
const route = (m, s, b, method) => routes.push({ m, s, b, method });

test('설정이 비어 있으면 사람 말로 막는다', async () => {
  reset();
  STORE._dep.config = { URL: '', ANON_KEY: '' };
  await assert.rejects(() => STORE.listPeriods(), /supabase-config\.js/);
});

test('로그인 안 돼 있으면 요청을 보내지 않는다', async () => {
  reset();
  token = null;
  await assert.rejects(() => STORE.listPeriods(), /로그인이 필요합니다/);
  assert.equal(calls.length, 0);
});

test('목록은 무거운 원본을 안 받는다 — 요약 컬럼만', async () => {
  reset();
  route('/data_registry?select=', 200, [{
    period: '2026-07', team_count: 142, pax_count: 512, res_files: 3, ilhaeng_files: 1,
    uploader_name: '김대웅', updated_at: '2026-07-28T01:00:00Z',
    block_month: '2026-07', block_at: '2026-07-28T01:00:00Z', block_by: '김대웅'
  }]);
  const list = await STORE.listPeriods();
  assert.equal(list[0].period, '2026-07');
  assert.equal(list[0].teamCount, 142);
  assert.equal(list[0].hasBlock, true);
  const url = calls[0].url;
  assert.ok(!url.includes('res_json'), '목록에 res_json 을 요청하면 안 된다');
  assert.ok(!url.includes('block_rows'), '목록에 block_rows 를 요청하면 안 된다');
  assert.equal(calls[0].auth, 'Bearer AT');
});

test('블록표를 안 올린 달은 hasBlock=false', async () => {
  reset();
  route('/data_registry?select=', 200, [{ period: '2026-08', team_count: 0, pax_count: 0, block_at: null }]);
  const list = await STORE.listPeriods();
  assert.equal(list[0].hasBlock, false);
});

test('load — 없는 달은 null', async () => {
  reset();
  route('/data_registry?period=eq.', 200, []);
  assert.equal(await STORE.load('2099-01'), null);
});

test('load — blockRows 의 null 과 [] 를 구분해 넘긴다', async () => {
  reset();
  route('/data_registry?period=eq.', 200, [{ period: '2026-07', res_json: [{ a: 1 }], ilhaeng_json: [], block_rows: null }]);
  const a = await STORE.load('2026-07');
  assert.equal(a.blockRows, null, '아직 안 올림은 null 이어야 한다');

  reset();
  route('/data_registry?period=eq.', 200, [{ period: '2026-08', res_json: [], ilhaeng_json: [], block_rows: [] }]);
  const b = await STORE.load('2026-08');
  assert.deepEqual(b.blockRows, [], '올렸는데 사용 0 은 빈 배열이어야 한다');
});

test('save — 출발월 형식을 먼저 막는다', async () => {
  reset();
  await assert.rejects(() => STORE.save('2026/07', {}), /YYYY-MM/);
  assert.equal(calls.length, 0);
});

test('save — 조건 없이 저장하면 업서트', async () => {
  reset();
  route('/data_registry?on_conflict=period', 201, [{ period: '2026-07' }], 'POST');
  const r = await STORE.save('2026-07', { resRows: [{ a: 1 }], resFiles: 3, teamCount: 10, paxCount: 40, uploaderName: '김대웅' });
  assert.equal(r.ok, true);
  const c = calls[0];
  assert.equal(c.method, 'POST');
  assert.match(c.prefer, /merge-duplicates/);
  assert.equal(c.body[0].res_files, 3);
  assert.equal(c.body[0].uploader_name, '김대웅');
});

test('save — expect 를 주면 그 사이 바뀐 경우 막는다', async () => {
  reset();
  route('/data_registry?period=eq.', 200, [], 'PATCH');       // 0행 = 그 사이 누가 저장함
  await assert.rejects(
    () => STORE.save('2026-07', { teamCount: 1 }, { expect: '2026-07-28T01:00:00Z' }),
    err => err.conflict === true && /다른 분이 같은 달을 등록/.test(err.message)
  );
  assert.match(calls[0].url, /updated_at=eq\./);
});

test('save — expect 가 맞으면 통과', async () => {
  reset();
  route('/data_registry?period=eq.', 200, [{ period: '2026-07' }], 'PATCH');
  const r = await STORE.save('2026-07', { teamCount: 1 }, { expect: '2026-07-28T01:00:00Z' });
  assert.equal(r.ok, true);
});

test('save — 블록표를 올리면 등록자·시각·대상월이 함께 기록된다', async () => {
  reset();
  route('/data_registry?on_conflict=period', 201, [{}], 'POST');
  await STORE.save('2026-07', { blockRows: [{ hotel: '간지호텔' }], blockRaw: 'x', uploaderName: '김대웅' });
  const b = calls[0].body[0];
  assert.deepEqual(b.block_rows, [{ hotel: '간지호텔' }]);
  assert.equal(b.block_month, '2026-07');
  assert.equal(b.block_by, '김대웅');
  assert.ok(b.block_at, 'block_at 이 있어야 언제 올린 표인지 알 수 있다');
});

test('save — 블록표를 안 주면 블록 컬럼을 아예 건드리지 않는다', async () => {
  reset();
  route('/data_registry?on_conflict=period', 201, [{}], 'POST');
  await STORE.save('2026-07', { resRows: [] });
  const b = calls[0].body[0];
  assert.ok(!('block_rows' in b), '안 올린 회차가 기존 블록표를 지우면 안 된다');
});

test('마스터 저장은 낙관적 잠금 — version 이 어긋나면 막는다', async () => {
  reset();
  route('/resort_master?id=eq.1', 200, [], 'PATCH');
  await assert.rejects(
    () => STORE.saveMaster({ a: 1 }, 7, '최민창'),
    err => err.conflict === true && /마스터를 저장/.test(err.message)
  );
  assert.match(calls[0].url, /version=eq\.7/);
  assert.equal(calls[0].body.version, 8);
});

test('마스터 저장 성공', async () => {
  reset();
  route('/resort_master?id=eq.1', 200, [{ version: 8 }], 'PATCH');
  const r = await STORE.saveMaster({ a: 1 }, 7, '최민창');
  assert.equal(r.version, 8);
});

test('권한 없음(RLS)은 역할 승인 안내로', async () => {
  reset();
  route('/data_registry', 403, { message: 'permission denied for table data_registry' });
  await assert.rejects(() => STORE.listPeriods(), /역할 승인을 요청/);
});

test('프로젝트 정지(5xx)는 그렇게 읽히는 문구로', async () => {
  reset();
  route('/data_registry', 503, {});
  await assert.rejects(() => STORE.listPeriods(), /정지 상태일 수 있습니다/);
});

test('토큰 만료(401)는 다시 로그인 안내로', async () => {
  reset();
  route('/data_registry', 401, {});
  await assert.rejects(() => STORE.listPeriods(), /다시 로그인/);
});

test('diff — 줄어들 때만 경고한다', () => {
  const before = { teamCount: 142, paxCount: 512, hasBlock: true };
  const up = STORE.diff(before, { teamCount: 150, paxCount: 540, blockRows: [] });
  assert.equal(up.team.delta, 8);
  assert.equal(up.warnings.filter(w => /줄어듭니다/.test(w)).length, 0, '늘어나는 건 정상이라 경고하지 않는다');

  const down = STORE.diff(before, { teamCount: 138, paxCount: 498, blockRows: [] });
  assert.equal(down.team.delta, -4);
  assert.match(down.warnings[0], /팀이 4건 줄어듭니다/);
  assert.match(down.warnings[1], /인원이 14명 줄어듭니다/);
});

test('diff — 블록표를 안 올리면 기존 것이 유지된다고 알린다', () => {
  const d = STORE.diff({ teamCount: 10, paxCount: 40, hasBlock: true }, { teamCount: 10, paxCount: 40 });
  assert.ok(d.warnings.some(w => /기존 블록표가 그대로 유지/.test(w)));
});

test('diff — 첫 등록이면 경고가 없다', () => {
  const d = STORE.diff(null, { teamCount: 100, paxCount: 300 });
  assert.equal(d.exists, false);
  assert.deepEqual(d.warnings, []);
});

test('표가 가리키는 달이 다르면 막는다 — 7월 표를 8월에 올리면 잔여가 통째로 틀린다', () => {
  assert.equal(STORE.checkBlockMonth('2026-08', '2026-07').ok, false);
  assert.match(STORE.checkBlockMonth('2026-08', '2026-07').message, /2026-07 인데 2026-08/);
  assert.equal(STORE.checkBlockMonth('2026-07', '2026-07').ok, true);
  assert.equal(STORE.checkBlockMonth('2026-07', '').ok, true);   // 블록표 없이 등록하는 경우
});

test('loadBlock — 옆 달 표만 가볍게 가져온다 (예약 원본은 안 받는다)', async () => {
  reset();
  route('/data_registry?period=eq.', 200, [{
    period: '2026-08', block_raw: '호텔명\t룸타입\t1(토)\n야마나미 호텔\t트윈\t4',
    block_month: '2026-08', block_by: '김대웅', block_at: '2026-07-28T01:00:00Z'
  }]);
  const b = await STORE.loadBlock('2026-08');
  assert.equal(b.blockMonth, '2026-08');
  assert.match(b.blockRaw, /야마나미/);
  const url = calls[0].url;
  assert.ok(!url.includes('res_json'), '예약 원본을 같이 받으면 안 된다');
  assert.ok(!url.includes('ilhaeng_json'), '명단 원본도 받으면 안 된다');
  assert.ok(!/select=\*/.test(url), 'select=* 는 무거운 칸까지 다 가져온다');
});

test('loadBlock — 그 달이 없거나 표를 안 올렸으면 null', async () => {
  reset();
  route('/data_registry?period=eq.', 200, []);
  assert.equal(await STORE.loadBlock('2099-01'), null);

  reset();
  route('/data_registry?period=eq.', 200, [{ period: '2026-08', block_raw: null }]);
  assert.equal(await STORE.loadBlock('2026-08'), null, '달은 있는데 표만 없는 경우도 null');
});
