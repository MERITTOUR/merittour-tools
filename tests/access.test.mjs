import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AUTH = require('../shared/access.js');

/* ── 테스트용 의존 갈아 끼우기 ───────────────────────────────── */
let now = 1_700_000_000_000;        // 고정 시각
let routes = [];                    // [{match, status, body}]
let calls = [];                     // 실제로 나간 요청
let gone = [];                      // 리다이렉트

function memStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _dump: () => Object.fromEntries(m)
  };
}

function reset() {
  routes = []; calls = []; gone = [];
  now = 1_700_000_000_000;
  AUTH._dep.storage = memStore();
  AUTH._dep.config = { URL: 'https://x.supabase.co', ANON_KEY: 'anon-key' };
  AUTH._dep.now = () => now;
  AUTH._dep.go = url => gone.push(url);
  AUTH._dep.fetch = async (url, opt) => {
    calls.push({ url, method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null,
                 auth: opt.headers.Authorization });
    const r = routes.find(x => url.includes(x.match));
    if (!r) return { ok: false, status: 404, text: async () => JSON.stringify({ msg: 'no route: ' + url }) };
    return { ok: r.status >= 200 && r.status < 300, status: r.status,
             text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  };
}
const route = (match, status, body) => routes.push({ match, status, body });
const SEC = () => Math.floor(now / 1000);

const USER = { id: 'u1', email: 'a@b.c', name: '최민창', role: 'owner', active: true };

test('설정이 비어 있으면 무엇을 해도 사람 말로 막힌다', async () => {
  reset();
  AUTH._dep.config = { URL: '', ANON_KEY: '' };
  assert.equal(AUTH.configured(), false);
  await assert.rejects(() => AUTH.login('a@b.c', 'pw'), /supabase-config\.js/);
});

test('로그인 성공 → 세션 저장 + 역할 조회', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200,
        { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [USER]);

  const u = await AUTH.login('a@b.c', 'pw');
  assert.equal(u.role, 'owner');
  const s = AUTH.session();
  assert.equal(s.access_token, 'AT');
  assert.equal(s.expires_at, SEC() + 3600);
  // app_users 조회는 anon 키가 아니라 사용자 토큰으로 나가야 RLS 가 본인 행을 준다
  const meCall = calls.find(c => c.url.includes('/rest/v1/app_users'));
  assert.equal(meCall.auth, 'Bearer AT');
});

test('me — 내 id 로 좁혀 조회한다 (남의 행을 받지 않도록)', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200,
        { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1' } });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');
  const meCall = calls.find(c => c.url.includes('/rest/v1/app_users'));
  // owner·admin 은 전체 행이 보이므로, 필터 없는 limit=1 은 남의 역할을 내 역할로 보이게 한다
  assert.match(meCall.url, /id=eq\.u1/);
});

test('me — id 를 못 얻어도 로그아웃시키지 않는다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200,
        { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });   // user 없음 · JWT 아님
  route('/rest/v1/app_users', 200, [USER]);
  const u = await AUTH.login('a@b.c', 'pw');
  assert.equal(u.role, 'owner');                       // 조회는 되어야 한다
  const meCall = calls.find(c => c.url.includes('/rest/v1/app_users'));
  assert.ok(!/id=eq\./.test(meCall.url));               // 좁히지 못했을 뿐
});

test('비밀번호가 틀리면 안내 문구가 한국어', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 400, { error_description: 'Invalid login credentials' });
  await assert.rejects(() => AUTH.login('a@b.c', 'nope'), /이메일 또는 비밀번호가 맞지 않습니다/);
  assert.equal(AUTH.session(), null);
});

test('프로젝트 정지(5xx)는 그렇게 읽히는 문구로', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 503, {});
  await assert.rejects(() => AUTH.login('a@b.c', 'pw'), /정지 상태일 수 있습니다/);
});

test('만료가 가까우면 refresh 로 갱신한다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');

  routes = [];
  route('/auth/v1/token?grant_type=refresh_token', 200,
        { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 });

  now += 3600 * 1000;                       // 만료 시점으로 이동
  const t = await AUTH.token();
  assert.equal(t, 'AT2');
  assert.equal(AUTH.session().refresh_token, 'RT2');
});

test('refresh 가 실패하면 세션을 버린다 — 만료된 토큰으로 계속 시도하지 않는다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 10 });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');

  routes = [];
  route('/auth/v1/token?grant_type=refresh_token', 401, { msg: 'expired' });
  now += 20 * 1000;
  assert.equal(await AUTH.token(), null);
  assert.equal(AUTH.session(), null);
});

test('can — owner 는 무엇을 물어도 통과, 비활성은 전부 차단', () => {
  const owner  = { role: 'owner',  active: true };
  const sales  = { role: 'sales',  active: true };
  const air    = { role: 'air',    active: true };
  const frozen = { role: 'owner',  active: false };

  assert.equal(AUTH.can(owner, ['admin']), true);      // owner 는 admin 을 물어도 통과
  assert.equal(AUTH.can(sales, ['admin','sales']), true);
  assert.equal(AUTH.can(sales, ['admin']), false);
  assert.equal(AUTH.can(air, ['admin','sales']), false);
  assert.equal(AUTH.can(air, []), true);               // 역할 제한 없으면 활성이면 통과
  assert.equal(AUTH.can(frozen, ['admin']), false);    // 비활성은 owner 여도 차단
  assert.equal(AUTH.can(null, ['air']), false);
});

test('require — 세션 없으면 로그인으로 보낸다', async () => {
  reset();
  const res = await AUTH.require(['admin'], { loginUrl: '/login/' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-session');
  assert.deepEqual(gone, ['/login/']);
});

test('require — 승인 대기 계정은 사유를 알려주고 리다이렉트하지 않는다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [{ ...USER, role: 'air', active: false }]);
  await AUTH.login('a@b.c', 'pw');

  const res = await AUTH.require(['air']);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'pending');
  assert.match(res.message, /승인/);
  assert.deepEqual(gone, []);        // 로그인은 돼 있으니 로그인 화면으로 보내면 안 된다
});

test('require — 권한 부족은 forbidden', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [{ ...USER, role: 'air' }]);
  await AUTH.login('a@b.c', 'pw');

  const res = await AUTH.require(['admin', 'sales']);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'forbidden');
  assert.deepEqual(gone, []);
});

test('require — 통과하면 사용자를 준다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [{ ...USER, role: 'sales' }]);
  await AUTH.login('a@b.c', 'pw');

  const res = await AUTH.require(['admin', 'sales']);
  assert.equal(res.ok, true);
  assert.equal(res.user.role, 'sales');
});

test('역할 캐시는 5분 뒤 다시 물어본다 — 승급·정지가 오래 안 먹으면 곤란하다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 99999 });
  route('/rest/v1/app_users', 200, [{ ...USER, role: 'air' }]);
  await AUTH.login('a@b.c', 'pw');

  const before = calls.filter(c => c.url.includes('app_users')).length;
  await AUTH.me();                                  // 캐시 — 요청이 늘면 안 된다
  assert.equal(calls.filter(c => c.url.includes('app_users')).length, before);

  now += 6 * 60 * 1000;                             // 5분 지남
  routes = routes.filter(r => !r.match.includes('app_users'));
  route('/rest/v1/app_users', 200, [{ ...USER, role: 'admin' }]);
  const u = await AUTH.me();
  assert.equal(u.role, 'admin');                    // 승급이 반영된다
});

test('초대 링크 해시로 세션을 세우고 비밀번호를 정한다', async () => {
  reset();
  const got = AUTH.adoptHash('#access_token=IT&refresh_token=IR&expires_in=3600&type=invite');
  assert.equal(got.type, 'invite');
  assert.equal(AUTH.session().access_token, 'IT');

  route('/auth/v1/user', 200, { id: 'u1' });
  await AUTH.setPassword('newpw1234');
  const put = calls.find(c => c.url.includes('/auth/v1/user'));
  assert.equal(put.method, 'PUT');
  assert.equal(put.auth, 'Bearer IT');
  assert.deepEqual(put.body, { password: 'newpw1234' });
});

test('해시에 토큰이 없으면 아무것도 하지 않는다', () => {
  reset();
  assert.equal(AUTH.adoptHash(''), null);
  assert.equal(AUTH.adoptHash('#error=access_denied'), null);
  assert.equal(AUTH.session(), null);
});

test('로그아웃은 서버 호출이 실패해도 로컬 세션을 지운다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');

  routes = [];                       // logout 라우트 없음 → 404
  await AUTH.logout();
  assert.equal(AUTH.session(), null);
});

test('링크 오류를 사람 말로 — 해시·쿼리 양쪽에서 읽는다', () => {
  assert.match(AUTH.linkError('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired', ''), /만료/);
  assert.match(AUTH.linkError('', '?error_code=otp_expired&error_description=Token+has+expired'), /만료/);
  assert.match(AUTH.linkError('#error=access_denied&error_description=Invalid+token', ''), /이미 사용되었거나/);
  assert.equal(AUTH.linkError('', ''), null);
  assert.equal(AUTH.linkError('#access_token=AT&type=invite', ''), null, '정상 링크를 오류로 보면 안 된다');
});

test('token_hash 형식 초대도 세션이 선다', async () => {
  reset();
  route('/auth/v1/verify', 200, { access_token: 'IT', refresh_token: 'IR', expires_in: 3600 });
  const r = await AUTH.verifyTokenHash('invite', 'TH1');
  assert.equal(r.type, 'invite');
  assert.equal(AUTH.session().access_token, 'IT');
  const c = calls.find(x => x.url.includes('/auth/v1/verify'));
  assert.equal(c.method, 'POST');
  assert.deepEqual(c.body, { type: 'invite', token_hash: 'TH1' });
});

test('token_hash 가 만료면 세션을 세우지 않는다', async () => {
  reset();
  route('/auth/v1/verify', 401, { error_description: 'Token has expired' });
  await assert.rejects(() => AUTH.verifyTokenHash('invite', 'OLD'), /만료/);
  assert.equal(AUTH.session(), null);
});

test('계정 목록 — 승인 대기가 먼저 오게 요청한다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');

  calls.length = 0;
  const list = await AUTH.listUsers();
  assert.equal(list.length, 1);
  const c = calls.find(x => x.url.includes('app_users'));
  assert.match(c.url, /order=active\.asc/, '승인 대기(active=false)가 위로 와야 한다');
  assert.equal(c.auth, 'Bearer AT');
});

test('계정 저장 — 바꾼 값만 보낸다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, [{ id: 'u2', email: 'x@y.z', role: 'sales', active: true }]);
  await AUTH.login('a@b.c', 'pw');

  calls.length = 0;
  const saved = await AUTH.updateUser('u2', { active: true, role: 'sales' });
  assert.equal(saved.id, 'u2');
  const c = calls.find(x => x.method === 'PATCH');
  assert.match(c.url, /id=eq\.u2/);
  assert.deepEqual(c.body, { role: 'sales', active: true });
  assert.ok(!('name' in c.body), '건드리지 않은 값은 보내지 않는다');
});

test('계정 저장 — RLS 로 막히면 0행이 온다. 성공한 척하면 안 된다', async () => {
  reset();
  route('/auth/v1/token?grant_type=password', 200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
  route('/rest/v1/app_users', 200, []);
  await AUTH.login('a@b.c', 'pw');
  await assert.rejects(() => AUTH.updateUser('u2', { active: true }),
    err => err.forbidden === true && /owner 권한/.test(err.message));
});

test('계정 저장 — 없는 역할은 보내지 않는다', async () => {
  reset();
  await assert.rejects(() => AUTH.updateUser('u2', { role: 'boss' }), /역할 값/);
  assert.equal(calls.length, 0);
});

test('guardChange — 자기 발등을 못 찍게 한다', () => {
  const meOwner = { id: 'me', role: 'owner', active: true };
  const other   = { id: 'o2', role: 'owner', active: true };
  const sales   = { id: 's1', role: 'sales', active: true };

  // 본인
  assert.match(AUTH.guardChange([meOwner, other], meOwner, { role: 'sales' }, 'me'), /본인의 역할/);
  assert.match(AUTH.guardChange([meOwner, other], meOwner, { active: false }, 'me'), /본인 계정은 정지/);
  assert.equal(AUTH.guardChange([meOwner, other], meOwner, { name: '새이름' }, 'me'), null, '이름은 바꿔도 된다');

  // 마지막 owner — 그 사람 말고 활성 owner 가 없을 때만 막는다
  assert.match(AUTH.guardChange([other, sales], other, { role: 'sales' }, 'x'), /마지막 owner/);
  assert.match(AUTH.guardChange([other, sales], other, { active: false }, 'x'), /마지막 owner/);
  assert.equal(AUTH.guardChange([meOwner, other, sales], other, { role: 'sales' }, 'x'), null,
    '다른 활성 owner 가 남아 있으면 막지 않는다');
  assert.match(AUTH.guardChange([{ id: 'o3', role: 'owner', active: false }, other], other, { role: 'sales' }, 'x'),
    /마지막 owner/, '정지된 owner 는 남은 owner 로 세지 않는다');
  assert.equal(AUTH.guardChange([meOwner, other, sales], other, { role: 'admin' }, 'me'), null,
    'owner 가 둘이면 한 명은 내릴 수 있다');
  assert.equal(AUTH.guardChange([meOwner, sales], sales, { role: 'admin' }, 'me'), null,
    'owner 가 아닌 사람은 자유롭게 바꾼다');
  assert.equal(AUTH.guardChange([meOwner, sales], sales, { active: false }, 'me'), null);
});

/* ══ 섹션 권한 ══════════════════════════════════════════════════
   서버(14_app_user_sections.sql 의 mt_has_area / mt_can_read_area)와
   같은 규칙이어야 한다. 어긋나면 화면에서는 보이는데 저장이 막히거나,
   막혀야 할 화면이 열린다. */

const SEC_U = (over = {}) =>
  ({ id: 'u1', email: 'a@b.c', role: 'sales', active: true, areas: [], read_areas: [], ...over });

test('섹션 — 역할 우회는 없다. owner 도 목록에 있어야 열린다', () => {
  /* 16_sections_for_all.sql 과 같은 규칙. 마스터가 자기 섹션을 정할 수 있어야
     해서 우회를 없앴다. 잠기지 않는 이유는 계정 관리 화면이 섹션이 아니라
     역할로 열리기 때문이다(guard.js 에 data-section 이 없다). */
  for (const role of ['owner', 'admin']) {
    const empty = SEC_U({ role });
    assert.equal(AUTH.canReadArea(empty, 'booking'), false);
    assert.equal(AUTH.areaLevel(empty, 'booking'), 'none');

    const given = SEC_U({ role, areas: ['booking'] });
    assert.equal(AUTH.canArea(given, 'booking'), true);
    assert.equal(AUTH.areaLevel(given, 'booking'), 'write');
  }
});

test('역할 기본값 — owner·admin 은 전 섹션이 채워진다', () => {
  for (const role of ['owner', 'admin']) {
    const d = AUTH.defaultsFor(role);
    assert.deepEqual(d.areas.slice().sort(), AUTH.SECTION_KEYS.slice().sort());
    assert.deepEqual(d.read_areas, []);
  }
});

test('섹션 — 쓸 수 있으면 볼 수 있다 (read_areas 에 또 안 적어도 된다)', () => {
  const u = SEC_U({ areas: ['booking'] });
  assert.equal(AUTH.canArea(u, 'booking'), true);
  assert.equal(AUTH.canReadArea(u, 'booking'), true);
  assert.equal(AUTH.areaLevel(u, 'booking'), 'write');
});

test('섹션 — 읽기만 준 곳은 쓰기가 막힌다', () => {
  const u = SEC_U({ read_areas: ['dashboard'] });
  assert.equal(AUTH.canArea(u, 'dashboard'), false);
  assert.equal(AUTH.canReadArea(u, 'dashboard'), true);
  assert.equal(AUTH.areaLevel(u, 'dashboard'), 'read');
});

test('섹션 — 목록에 없으면 없음', () => {
  const u = SEC_U({ areas: ['booking'], read_areas: ['dashboard'] });
  assert.equal(AUTH.areaLevel(u, 'register'), 'none');
});

test('섹션 — 정지된 계정은 목록이 있어도 전부 막힌다', () => {
  const u = SEC_U({ role: 'owner', active: false, areas: ['booking'] });
  assert.equal(AUTH.canArea(u, 'booking'), false);
  assert.equal(AUTH.canReadArea(u, 'booking'), false);
  assert.equal(AUTH.areaLevel(u, 'booking'), 'none');
});

test('cleanAreas — 없는 키는 버리고 중복은 하나로', () => {
  assert.deepEqual(AUTH.cleanAreas(['booking', 'booking', '없는키', '', 'weather']),
                   ['booking', 'weather']);
  assert.deepEqual(AUTH.cleanAreas(null), []);
});

test('defaultsFor — 역할 기본값은 복사본이라 원본이 안 더러워진다', () => {
  const a = AUTH.defaultsFor('sales');
  assert.ok(a.areas.includes('booking'));
  a.areas.push('없는키');
  assert.ok(!AUTH.defaultsFor('sales').areas.includes('없는키'));
  const o = AUTH.defaultsFor('owner');
  o.areas.length = 0;
  assert.ok(AUTH.defaultsFor('owner').areas.length > 0);
});

test('계정 저장 — 섹션도 함께 보내고, 없는 키는 걸러진다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token: 'T', refresh_token: 'R', expires_at: SEC() + 3600, user: { id: 'u1' } });
  await AUTH.login('a@b.c', 'pw').catch(() => {});
  routes.length = 0;
  route('/rest/v1/app_users', 200, [{ id: 'u2', role: 'sales', active: true }]);
  await AUTH.updateUser('u2', { areas: ['booking', '없는키'], read_areas: ['weather'] });
  const patch = calls.find(c => c.method === 'PATCH');
  assert.deepEqual(patch.body.areas, ['booking']);
  assert.deepEqual(patch.body.read_areas, ['weather']);
});

test('require — 섹션 권한이 없으면 무엇이 막혔는지 이름으로 알려 준다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token: 'T', refresh_token: 'R', expires_at: SEC() + 3600, user: { id: 'u1' } });
  route('/rest/v1/app_users', 200, [{ ...SEC_U(), areas: ['weather'] }]);
  await AUTH.login('a@b.c', 'pw');
  const res = await AUTH.require([], { area: 'booking', onDeny: () => {} });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-area');
  assert.match(res.message, /예약/);        // 키가 아니라 사람이 읽는 이름으로
  assert.deepEqual(gone, []);               // 리다이렉트하지 않는다
});

test('require — 섹션 권한이 있으면 통과한다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token: 'T', refresh_token: 'R', expires_at: SEC() + 3600, user: { id: 'u1' } });
  route('/rest/v1/app_users', 200, [{ ...SEC_U(), areas: ['booking'] }]);
  await AUTH.login('a@b.c', 'pw');
  const res = await AUTH.require([], { area: 'booking' });
  assert.equal(res.ok, true);
});

test('me — 14 를 아직 적용 안 한 프로젝트에서도 터지지 않는다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token: 'T', refresh_token: 'R', expires_at: SEC() + 3600, user: { id: 'u1' } });
  route('/rest/v1/app_users', 200, [{ id: 'u1', email: 'a@b.c', role: 'sales', active: true }]);
  const u = await AUTH.login('a@b.c', 'pw');
  assert.deepEqual(u.areas, []);
  assert.deepEqual(u.read_areas, []);
  assert.equal(AUTH.areaLevel(u, 'booking'), 'none');
});

/* ══ 계정 신청 ═════════════════════════════════════════════════ */

test('계정 신청 — 로그인 없이 anon 키로 보낸다', async () => {
  reset();
  route('/rest/v1/access_requests', 201, null);
  const r = await AUTH.requestAccess({ name:'홍길동', email:'hong@merittour.co.kr', dept:'영업' });
  assert.equal(r.ok, true);
  const c = calls.at(-1);
  assert.equal(c.method, 'POST');
  assert.equal(c.auth, 'Bearer anon-key');            // 세션 토큰이 아니라 anon
  assert.equal(c.body.email, 'hong@merittour.co.kr');
  assert.equal(c.body.name, '홍길동');
  assert.equal(c.body.note, null);                    // 빈 값은 null 로
});

test('계정 신청 — 이름·이메일 형식은 보내기 전에 막는다', async () => {
  reset();
  await assert.rejects(() => AUTH.requestAccess({ name:'', email:'a@b.co' }), /이름/);
  await assert.rejects(() => AUTH.requestAccess({ name:'홍', email:'notmail' }), /이메일/);
  assert.equal(calls.length, 0);                      // 요청 자체가 안 나간다
});

test('계정 신청 — 이미 접수된 주소는 「실패」가 아니라 안내로', async () => {
  reset();
  route('/rest/v1/access_requests', 409, { message: 'duplicate key value' });
  await assert.rejects(() => AUTH.requestAccess({ name:'홍', email:'a@b.co' }),
    err => err.duplicate === true && /이미 신청/.test(err.message));
});

test('신청 처리 — 상태 값을 검사하고 처리 시각·처리자를 남긴다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c','pw');
  await assert.rejects(() => AUTH.resolveRequest('r1','뭔가'), /상태 값/);
  routes.length = 0;
  route('/rest/v1/access_requests', 200, [{ id:'r1', status:'invited' }]);
  await AUTH.resolveRequest('r1', 'invited');
  const c = calls.at(-1);
  assert.equal(c.method, 'PATCH');
  assert.equal(c.body.status, 'invited');
  assert.equal(c.body.handled_by, 'u1');
  assert.ok(c.body.handled_at);
});

test('신청 처리 — RLS 로 막히면 0행이 온다. 성공한 척하면 안 된다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c','pw');
  routes.length = 0;
  route('/rest/v1/access_requests', 200, []);
  await assert.rejects(() => AUTH.resolveRequest('r1','rejected'),
    err => err.forbidden === true && /owner · admin/.test(err.message));
});

/* ══ 아이디 저장 · 30일 리셋 · 비밀번호 규칙 ═══════════════════ */

test('아이디 저장 — 이메일만 남기고 비밀번호는 어디에도 없다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw1234!!', true);
  assert.equal(AUTH.rememberedEmail(), 'a@b.c');
  const dump = JSON.stringify(AUTH._dep.storage._dump());
  assert.ok(!dump.includes('pw1234'), '저장소 어디에도 비밀번호가 없어야 한다');
});

test('아이디 저장 — 체크를 풀면 지운다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw', true);
  await AUTH.login('a@b.c', 'pw', false);
  assert.equal(AUTH.rememberedEmail(), '');
});

test('로그아웃해도 저장한 아이디는 남는다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  route('/auth/v1/logout', 200, null);
  await AUTH.login('a@b.c', 'pw', true);
  await AUTH.logout();
  assert.equal(AUTH.rememberedEmail(), 'a@b.c');
  assert.equal(AUTH.session(), null);
});

const DAY = 24 * 60 * 60 * 1000;

test('30일이 지나면 토큰이 멀쩡해도 끊는다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');
  now += 29 * DAY;
  assert.ok(await AUTH.token(), '29일째는 아직 살아 있어야 한다');
  now += 2 * DAY;                       // 31일째
  assert.equal(await AUTH.token(), null);
  assert.equal(AUTH.session(), null);
  assert.equal(AUTH.takeExpiredNotice(), true);   // 왜 끊겼는지 남긴다
  assert.equal(AUTH.takeExpiredNotice(), false);  // 한 번 읽으면 지운다
});

test('30일은 마지막 로그인 기준 — refresh 로 갱신해도 늘어나지 않는다', async () => {
  reset();
  route('/auth/v1/token', 200, { access_token:'T', refresh_token:'R', expires_at: SEC()+3600, user:{id:'u1'} });
  route('/rest/v1/app_users', 200, [USER]);
  await AUTH.login('a@b.c', 'pw');
  for (let d = 0; d < 20; d++) {        // 매일 쓰면서 토큰을 갱신해도
    now += 1.5 * DAY;
    routes.length = 0;
    route('/auth/v1/token', 200, { access_token:'T'+d, refresh_token:'R', expires_at: SEC()+3600 });
    await AUTH.token();
  }
  assert.equal(await AUTH.token(), null, '30일이 지나면 끊겨야 한다');
});

test('비밀번호 — 영문·숫자는 필수, 특수문자는 권장', () => {
  assert.equal(AUTH.passwordCheck('abc123').ok, false);        // 8자 미만
  assert.match(AUTH.passwordCheck('abc123').reason, /8자/);
  assert.equal(AUTH.passwordCheck('abcdefgh').ok, false);      // 숫자 없음
  assert.match(AUTH.passwordCheck('abcdefgh').reason, /숫자/);
  assert.equal(AUTH.passwordCheck('12345678').ok, false);      // 영문 없음
  assert.match(AUTH.passwordCheck('12345678').reason, /영문/);

  const plain = AUTH.passwordCheck('abcd1234');
  assert.equal(plain.ok, true);                                // 통과는 시키되
  assert.equal(plain.strong, false);
  assert.match(plain.reason, /특수문자/);                       // 권한다

  const strong = AUTH.passwordCheck('abcd1234!');
  assert.equal(strong.ok, true);
  assert.equal(strong.strong, true);
  assert.equal(strong.reason, '');
});
