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
