/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 로그인 세션 · 역할  (shared/access.js)

   Supabase Auth 를 REST 로 직접 쓴다. SDK 를 CDN 에서 더 받지 않는다
   (확정서 쪽도 이미 REST 직접 호출이고, 의존을 늘릴 이유가 없다).

   역할 5단계 — owner > admin > manage / sales > air   (04_user_access.sql)

   페이지에서 쓰는 법 (<head> 에서 supabase-config.js 다음에):
     <script src="../shared/supabase-config.js"></script>
     <script src="../shared/access.js"></script>
   그리고 본문 스크립트에서:
     MT_AUTH.require(['admin','sales'])        // 통과 못 하면 로그인/안내 화면으로

   ※ shared/gate.js(비밀번호 9800 가림막)는 그대로 둔다. 로그인이 실제로
     검증되기 전에 떼면 그 사이 아무나 들어온다.
   ════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MT_AUTH = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SESSION_KEY = 'mt-auth-session';   // {access_token, refresh_token, expires_at, user}
  var ME_KEY      = 'mt-auth-me';        // {id,email,name,role,active,at}
  var ME_TTL_MS   = 5 * 60 * 1000;       // 역할 캐시 5분 — 승급/정지가 오래 안 먹으면 곤란하다
  var REFRESH_PAD = 60;                  // 만료 60초 전이면 미리 갱신

  var ROLES = ['owner', 'admin', 'manage', 'sales', 'air'];

  /* 주입 가능한 의존 — 브라우저에서는 기본값, 테스트에서는 갈아 끼운다 */
  var dep = {
    fetch:   (typeof fetch === 'function') ? fetch.bind(null) : null,
    storage: (typeof localStorage !== 'undefined') ? localStorage : memStore(),
    config:  (typeof MT_SB !== 'undefined') ? MT_SB
             : (typeof globalThis !== 'undefined' && globalThis.MT_SB) ? globalThis.MT_SB
             : { URL: '', ANON_KEY: '', ready: function () { return false; } },
    now:     function () { return Date.now(); },
    go:      function (url) { if (typeof location !== 'undefined') location.href = url; }
  };
  function memStore() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  function cfgReady() { return !!(dep.config && dep.config.URL && dep.config.ANON_KEY); }
  function base() { return String(dep.config.URL).replace(/\/+$/, ''); }
  function headers(token) {
    var h = { 'apikey': dep.config.ANON_KEY, 'Content-Type': 'application/json' };
    h['Authorization'] = 'Bearer ' + (token || dep.config.ANON_KEY);
    return h;
  }

  function readJSON(key) {
    try { var raw = dep.storage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function writeJSON(key, val) {
    try {
      if (val == null) dep.storage.removeItem(key);
      else dep.storage.setItem(key, JSON.stringify(val));
    } catch (e) { /* 차단 환경이면 세션이 유지되지 않는다 — 매번 로그인 */ }
  }

  /* ── 오류를 사람 말로 ─────────────────────────────────────────── */
  function friendly(status, body) {
    var msg = (body && (body.error_description || body.msg || body.message || body.error)) || '';
    if (status === 400 || status === 401) {
      if (/Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 맞지 않습니다.';
      if (/Email not confirmed/i.test(msg))       return '이메일 인증이 아직 끝나지 않았습니다. 받으신 메일의 링크를 먼저 눌러 주세요.';
      return msg || '로그인에 실패했습니다.';
    }
    if (status === 422) return msg || '입력값을 확인해 주세요.';
    if (status === 429) return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
    if (status >= 500)  return '서버에 연결할 수 없습니다. Supabase 프로젝트가 정지 상태일 수 있습니다.';
    return msg || ('요청에 실패했습니다. (HTTP ' + status + ')');
  }

  function req(path, opts) {
    if (!cfgReady()) {
      return Promise.reject(new Error('Supabase 접속 설정이 비어 있습니다. shared/supabase-config.js 를 채워 주세요.'));
    }
    opts = opts || {};
    return dep.fetch(base() + path, {
      method: opts.method || 'GET',
      headers: headers(opts.token),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) {
          var err = new Error(friendly(r.status, j));
          err.status = r.status; err.body = j;
          throw err;
        }
        return j;
      });
    }, function () {
      throw new Error('네트워크에 연결할 수 없습니다. Supabase 프로젝트가 정지 상태일 수 있습니다.');
    });
  }

  /* ── 세션 ────────────────────────────────────────────────────── */
  function saveSession(s) {
    if (!s || !s.access_token) { writeJSON(SESSION_KEY, null); return null; }
    var rec = {
      access_token:  s.access_token,
      refresh_token: s.refresh_token || '',
      // expires_at 이 오면 그대로, 없으면 expires_in 으로 계산
      expires_at: s.expires_at || Math.floor(dep.now() / 1000) + (Number(s.expires_in) || 3600),
      user: s.user || null
    };
    writeJSON(SESSION_KEY, rec);
    return rec;
  }
  function session() { return readJSON(SESSION_KEY); }
  function expired(s, pad) {
    if (!s || !s.expires_at) return true;
    return Math.floor(dep.now() / 1000) >= (s.expires_at - (pad == null ? REFRESH_PAD : pad));
  }

  /* 유효한 access token 을 준다. 만료가 가까우면 refresh 로 갱신한다. */
  function token() {
    var s = session();
    if (!s) return Promise.resolve(null);
    if (!expired(s)) return Promise.resolve(s.access_token);
    if (!s.refresh_token) { logoutLocal(); return Promise.resolve(null); }
    return req('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: s.refresh_token }
    }).then(function (j) {
      var n = saveSession(j);
      return n ? n.access_token : null;
    }).catch(function () { logoutLocal(); return null; });
  }

  function login(email, password) {
    return req('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: String(email || '').trim(), password: String(password || '') }
    }).then(function (j) {
      saveSession(j);
      writeJSON(ME_KEY, null);          // 역할 캐시는 새로 받는다
      return me(true);
    });
  }

  /* 초대·비밀번호 재설정 링크로 들어온 경우: 해시의 access_token 으로 세션을 세운다.
     Supabase 가 #access_token=...&refresh_token=...&type=invite 형태로 돌려준다. */
  function adoptHash(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h) return null;
    var p = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    if (!p.access_token) return null;
    saveSession(p);
    writeJSON(ME_KEY, null);
    return { type: p.type || '', email: (p.email || '') };
  }

  /* 초대받은 사람이 비밀번호를 정한다 */
  function setPassword(password) {
    return token().then(function (t) {
      if (!t) throw new Error('로그인 정보가 만료되었습니다. 초대 메일의 링크를 다시 눌러 주세요.');
      return req('/auth/v1/user', { method: 'PUT', token: t, body: { password: String(password || '') } });
    });
  }

  function logoutLocal() { writeJSON(SESSION_KEY, null); writeJSON(ME_KEY, null); }
  function logout() {
    var s = session();
    logoutLocal();
    if (!s) return Promise.resolve();
    return req('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(function () {});
  }

  /* ── 내 역할 ─────────────────────────────────────────────────── */
  function me(force) {
    var c = readJSON(ME_KEY);
    if (!force && c && c.at && (dep.now() - c.at) < ME_TTL_MS) return Promise.resolve(c);
    return token().then(function (t) {
      if (!t) return null;
      return req('/rest/v1/app_users?select=id,email,name,role,active&limit=1', { token: t })
        .then(function (rows) {
          var u = (rows && rows[0]) || null;
          if (!u) return null;                     // 아직 app_users 에 행이 없다(트리거 전)
          u.at = dep.now();
          writeJSON(ME_KEY, u);
          return u;
        });
    });
  }

  function rank(role) { var i = ROLES.indexOf(role); return i < 0 ? 99 : i; }
  /* owner 는 무엇을 물어도 통과한다. 서버(mt_has_role)와 같은 규칙이어야
     화면에서는 보이는데 저장이 막히는 어긋남이 안 생긴다. */
  function can(user, roles) {
    if (!user || !user.active) return false;
    if (user.role === 'owner') return true;
    if (!roles || !roles.length) return true;
    return roles.indexOf(user.role) >= 0;
  }

  /* ── 페이지 진입 가드 ────────────────────────────────────────── */
  /* 통과하면 사용자 객체를 준다. 못 하면 사유를 담은 객체를 준다.
     화면 전환(리다이렉트·안내)은 opts.onDeny 가 없을 때만 기본 동작으로 한다. */
  function require_(roles, opts) {
    opts = opts || {};
    var loginUrl = opts.loginUrl || '/merittour-tools/login/';
    return me().then(function (u) {
      if (!u) return deny('no-session', '로그인이 필요합니다.');
      if (!u.active) return deny('pending', '계정이 아직 승인되지 않았습니다. 관리자에게 문의해 주세요.', u);
      if (!can(u, roles)) return deny('forbidden', '이 화면을 볼 권한이 없습니다.', u);
      return { ok: true, user: u };
    }).catch(function (e) {
      return deny('error', e && e.message ? e.message : '확인에 실패했습니다.');
    });

    function deny(reason, message, user) {
      var res = { ok: false, reason: reason, message: message, user: user || null };
      if (typeof opts.onDeny === 'function') opts.onDeny(res);
      else if (reason === 'no-session') dep.go(loginUrl);
      return res;
    }
  }

  return {
    ROLES: ROLES,
    configured: cfgReady,
    login: login,
    logout: logout,
    session: session,
    token: token,
    me: me,
    can: can,
    rank: rank,
    require: require_,
    adoptHash: adoptHash,
    setPassword: setPassword,
    _dep: dep,                 // 테스트에서 fetch/storage/now 를 갈아 끼운다
    _expired: expired,
    _friendly: friendly
  };
});
