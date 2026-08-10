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

   ※ 페이지 진입은 shared/guard.js 가 막는다(<head> 에 한 줄). 예전의
     shared/gate.js(공용 비밀번호 9800 가림막)는 계정 배포가 끝나 없앴다.
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

  /* ── 섹션 ────────────────────────────────────────────────────────
     계정마다 「어느 화면을 볼 수 있는지 / 쓸 수 있는지」의 단위.
     키는 14_app_user_sections.sql 의 값과 **반드시 같아야** 한다. 한쪽만
     고치면 화면에서는 보이는데 서버가 막는(또는 그 반대) 어긋남이 생긴다.

     admin(관리자 화면)은 여기 없다 — 역할로만 연다. 섹션으로 두면 owner 가
     실수로 staff 에게 계정 관리 권한을 줄 수 있다. */
  var SECTIONS = [
    { key: 'sales',      label: '영업 허브',   path: 'sales/' },
    { key: 'manage',     label: '관리 허브',   path: 'manage/' },
    { key: 'air',        label: '항공 허브',   path: 'air/' },
    { key: 'dashboard',  label: '대시보드',    path: 'tools/dashboard/' },
    { key: 'booking',    label: '예약',        path: 'tools/booking/' },
    { key: 'register',   label: '등록소',      path: 'tools/register/' },
    { key: 'inquiry',    label: '문의',        path: 'tools/inquiry/' },
    { key: 'insurance',  label: '보험',        path: 'tools/insurance/' },
    { key: 'library',    label: '자료실',      path: 'tools/library/' },
    { key: 'imgtoolkit', label: '이미지 도구', path: 'tools/imgtoolkit/' },
    { key: 'weather',    label: '날씨',        path: 'tools/weather/' }
  ];
  var SECTION_KEYS = SECTIONS.map(function (s) { return s.key; });

  /* 역할을 고르면 채워 넣을 기본값. owner·admin 은 전부 통과하므로 비워 둔다
     (채워 두면 나중에 「admin 인데 비었네」 하고 잘못 손대게 된다).
     여기서 정한 값은 출발점일 뿐이고, 계정마다 admin/users/ 에서 더하고 뺀다. */
  var DEFAULT_AREAS = {
    owner:  { areas: [], read: [] },
    admin:  { areas: [], read: [] },
    manage: { areas: ['sales', 'manage', 'dashboard', 'booking', 'register', 'inquiry',
                      'insurance', 'library', 'imgtoolkit', 'weather'], read: [] },
    sales:  { areas: ['sales', 'dashboard', 'booking', 'register', 'inquiry',
                      'insurance', 'library', 'imgtoolkit', 'weather'], read: [] },
    air:    { areas: [], read: ['air', 'dashboard', 'booking', 'weather', 'library'] }
  };

  function defaultsFor(role) {
    var d = DEFAULT_AREAS[role] || { areas: [], read: [] };
    return { areas: d.areas.slice(), read_areas: d.read.slice() };
  }
  function cleanAreas(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (k) {
      k = String(k || '');
      if (SECTION_KEYS.indexOf(k) < 0 || seen[k]) return;   // 없는 키는 버린다
      seen[k] = 1; out.push(k);
    });
    return out;
  }

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
      // 메일 링크(초대·재설정)를 확인할 때 나오는 문구. 영어 그대로 두면 읽히지 않는다.
      if (/expired/i.test(msg))                   return '링크가 만료되었습니다. 관리자에게 다시 초대를 요청해 주세요.';
      if (/token.*(invalid|not found)|invalid.*token/i.test(msg)) return '이미 사용되었거나 올바르지 않은 링크입니다. 다시 초대를 요청해 주세요.';
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
    var h = headers(opts.token);
    if (opts.prefer) h['Prefer'] = opts.prefer;
    return dep.fetch(base() + path, {
      method: opts.method || 'GET',
      headers: h,
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

  /* 내 사용자 id. 로그인 응답의 user.id 를 먼저 쓰고, 없으면 access token 의 sub 를 읽는다.
     서명을 검증하는 것이 아니라 「내가 누구인지」를 알아내는 용도다 — 진짜 검증은 서버가 한다.
     둘 다 못 얻으면 빈 문자열을 준다(그때는 조회를 좁히지 않는다 — 예전 동작 그대로). */
  function uid() {
    var s = session();
    if (!s) return '';
    if (s.user && s.user.id) return String(s.user.id);
    var tk = s.access_token;
    if (!tk || typeof atob !== 'function') return '';
    var parts = String(tk).split('.');
    if (parts.length < 3) return '';
    try {
      var b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var j = JSON.parse(decodeURIComponent(escape(atob(b))));
      return j && j.sub ? String(j.sub) : '';
    } catch (e) { return ''; }
  }
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

  /* 메일 링크가 ?token_hash=...&type=invite 로 올 때 (템플릿이 {{ .TokenHash }} 인 경우).
     PKCE 와 달리 브라우저에 미리 저장해 둔 값이 없어도 되므로 그대로 세션이 선다. */
  function verifyTokenHash(type, tokenHash) {
    return req('/auth/v1/verify', {
      method: 'POST', body: { type: String(type || ''), token_hash: String(tokenHash || '') }
    }).then(function (j) {
      saveSession(j);
      writeJSON(ME_KEY, null);
      return { type: String(type || '') };
    });
  }

  /* 메일 링크가 오류를 달고 돌아온 경우를 사람 말로. 해시·쿼리 양쪽을 본다.
     이걸 안 보면 만료된 링크로 들어와도 그냥 로그인 화면이 떠서, 왜 안 되는지 알 수 없다. */
  function linkError(hash, search) {
    var p = {};
    [String(hash || '').replace(/^#/, ''), String(search || '').replace(/^\?/, '')].forEach(function (s) {
      if (!s) return;
      s.split('&').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      });
    });
    if (!p.error && !p.error_code && !p.error_description) return null;
    var d = p.error_description || p.error_code || p.error || '';
    if (/expired/i.test(d)) return '초대 링크가 만료되었습니다. 관리자에게 다시 초대를 요청해 주세요.';
    if (/invalid|already/i.test(d)) return '이미 사용되었거나 올바르지 않은 링크입니다. 다시 초대를 요청해 주세요.';
    if (/otp_disabled|signup.*disabled/i.test(d)) return '가입이 막혀 있습니다. 관리자에게 문의해 주세요.';
    return d || '링크 확인에 실패했습니다.';
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
      // 가능하면 내 id 로 좁힌다. owner·admin 은 app_users 전체 행이 보이므로,
      // 필터도 order 도 없는 limit=1 은 **남의 행**을 줄 수 있다 — 그러면 내 역할이
      // 남의 역할로 보이고, 이력의 「누가」도 틀린 사람이 된다.
      // id 를 못 얻으면 좁히지 않는다. 여기서 null 을 주면 로그인이 돼 있는데도
      // 「세션 없음」으로 로그인 화면에 튕긴다 — 안전한 쪽이 아니라 못 쓰는 쪽이다.
      var id = uid();
      return req('/rest/v1/app_users?'
                 + (id ? 'id=eq.' + encodeURIComponent(id) + '&' : '')
                 + 'select=id,email,name,role,active,areas,read_areas&limit=1', { token: t })
        .then(function (rows) {
          var u = (rows && rows[0]) || null;
          if (!u) return null;                     // 아직 app_users 에 행이 없다(트리거 전)
          // 14 를 아직 적용하지 않은 프로젝트에서는 두 컬럼이 없이 온다. 없으면
          // 빈 배열로 둔다 — undefined 로 두면 아래 indexOf 가 터진다.
          if (!Array.isArray(u.areas))      u.areas = [];
          if (!Array.isArray(u.read_areas)) u.read_areas = [];
          u.at = dep.now();
          writeJSON(ME_KEY, u);
          return u;
        });
    });
  }

  /* ── 계정 관리 (owner 가 쓴다. admin 은 보기만) ────────────────── */
  /* 승인 대기(active=false)를 먼저 준다 — 손이 가야 할 줄이 위로 와야 한다. */
  function listUsers() {
    return token().then(function (t) {
      if (!t) throw new Error('로그인이 필요합니다.');
      return req('/rest/v1/app_users?select=id,email,name,role,active,areas,read_areas,created_at,updated_at'
               + '&order=active.asc,created_at.desc', { token: t });
    }).then(function (rows) { return rows || []; });
  }

  /* 승인·역할·표시명 변경. 화면에서 막는 것은 안내일 뿐이고,
     실제 차단은 서버 RLS(au_write_owner)가 한다. */
  function updateUser(id, patch) {
    patch = patch || {};
    var body = {};
    if (patch.role   !== undefined) body.role   = String(patch.role || '');
    if (patch.active !== undefined) body.active = !!patch.active;
    if (patch.name   !== undefined) body.name   = String(patch.name || '');
    // 없는 섹션 키는 보내기 전에 버린다. 서버가 막아 주지 않는 값이라
    // 오타가 그대로 저장되면 「분명 켰는데 안 열린다」가 된다.
    if (patch.areas      !== undefined) body.areas      = cleanAreas(patch.areas);
    if (patch.read_areas !== undefined) body.read_areas = cleanAreas(patch.read_areas);
    if (!Object.keys(body).length) return Promise.resolve(null);
    if (body.role !== undefined && ROLES.indexOf(body.role) < 0) {
      return Promise.reject(new Error('역할 값이 올바르지 않습니다.'));
    }
    return token().then(function (t) {
      if (!t) throw new Error('로그인이 필요합니다.');
      return req('/rest/v1/app_users?id=eq.' + encodeURIComponent(String(id)), {
        method: 'PATCH', token: t, body: body, prefer: 'return=representation'
      });
    }).then(function (rows) {
      // RLS 로 막히면 오류가 아니라 0행이 돌아온다. 조용히 성공한 척하면 안 된다.
      if (!rows || !rows.length) {
        var e = new Error('저장되지 않았습니다. 계정을 바꾸려면 owner 권한이 필요합니다.');
        e.forbidden = true;
        throw e;
      }
      return rows[0];
    });
  }

  /* ── 계정 신청 (로그인 전) ──────────────────────────────────────
     로그인하지 않은 사람이 쓰므로 토큰 없이 anon 키로 보낸다. 서버는
     insert 만 허용하고 형식·길이도 with check 로 막는다(15_access_requests.sql).
     여기 검사는 사람에게 먼저 알려 주기 위한 것이지 방어선이 아니다. */
  function requestAccess(input) {
    input = input || {};
    var email = String(input.email || '').trim();
    var name  = String(input.name  || '').trim();
    var dept  = String(input.dept  || '').trim();
    var note  = String(input.note  || '').trim();
    if (!name) return Promise.reject(new Error('이름을 적어 주세요.'));
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email)) {
      return Promise.reject(new Error('회사 이메일 주소를 정확히 적어 주세요.'));
    }
    return req('/rest/v1/access_requests', {
      method: 'POST',
      body: { email: email, name: name, dept: dept || null, note: note || null },
      prefer: 'return=minimal'
    }).then(function () { return { ok: true, email: email }; },
      function (e) {
        /* 같은 주소로 이미 대기 중이면 unique 인덱스가 409 를 준다.
           「실패했습니다」로 두면 다시 누르게 되고, 눌러도 계속 실패한다. */
        if (e && (e.status === 409 || /duplicate|unique/i.test(e.message || ''))) {
          var d = new Error('이미 신청이 접수되어 있습니다. 관리자 확인을 기다려 주세요.');
          d.duplicate = true;
          throw d;
        }
        throw e;
      });
  }

  /* 신청 목록 — owner·admin 만 읽힌다(RLS). 대기 중을 먼저 준다. */
  function listRequests() {
    return token().then(function (t) {
      if (!t) throw new Error('로그인이 필요합니다.');
      return req('/rest/v1/access_requests?select=id,email,name,dept,note,status,created_at'
               + '&order=status.asc,created_at.desc&limit=200', { token: t });
    }).then(function (rows) { return rows || []; });
  }

  /* 처리 표시. 초대 메일 자체는 Supabase 콘솔에서 보낸다 —
     여기서 보내려면 service_role 키가 필요한데 그건 코드에 둘 수 없다. */
  function resolveRequest(id, status) {
    if (['invited', 'rejected', 'pending'].indexOf(status) < 0) {
      return Promise.reject(new Error('상태 값이 올바르지 않습니다.'));
    }
    return token().then(function (t) {
      if (!t) throw new Error('로그인이 필요합니다.');
      return req('/rest/v1/access_requests?id=eq.' + encodeURIComponent(String(id)), {
        method: 'PATCH', token: t, prefer: 'return=representation',
        body: {
          status: status,
          handled_at: status === 'pending' ? null : new Date(dep.now()).toISOString(),
          handled_by: status === 'pending' ? null : (uid() || null)
        }
      });
    }).then(function (rows) {
      // RLS 로 막히면 오류가 아니라 0행이 온다(updateUser 와 같은 함정).
      if (!rows || !rows.length) {
        var e = new Error('저장되지 않았습니다. 신청 처리는 owner · admin 만 가능합니다.');
        e.forbidden = true;
        throw e;
      }
      return rows[0];
    });
  }

  /* 자기 발등 찍기 방지 — 화면에서 미리 막고 이유를 말해 준다.
     owner 가 스스로를 내리거나 마지막 owner 를 없애면 아무도 계정을 못 고친다. */
  function guardChange(all, target, patch, meId) {
    var next = {
      role:   patch.role   !== undefined ? patch.role   : target.role,
      active: patch.active !== undefined ? !!patch.active : !!target.active
    };
    if (String(target.id) === String(meId)) {
      if (next.role !== target.role)     return '본인의 역할은 바꿀 수 없습니다. 다른 owner 에게 부탁하세요.';
      if (!next.active && target.active) return '본인 계정은 정지할 수 없습니다.';
    }
    var owners = (all || []).filter(function (u) {
      return u.active && u.role === 'owner' && String(u.id) !== String(target.id);
    });
    var wasOwner = target.active && target.role === 'owner';
    var stillOwner = next.active && next.role === 'owner';
    if (wasOwner && !stillOwner && !owners.length) {
      return '마지막 owner 입니다. 다른 분을 owner 로 올린 뒤에 바꿔 주세요.';
    }
    return null;
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

  /* ── 섹션 판정 ───────────────────────────────────────────────────
     서버(mt_has_area / mt_can_read_area)와 **같은 규칙**이어야 한다.
     owner·admin 은 전부 통과, 그 밖에는 목록에 있어야 한다. */
  function canArea(user, key) {
    if (!user || !user.active) return false;
    if (user.role === 'owner' || user.role === 'admin') return true;
    if (!key) return true;
    return (user.areas || []).indexOf(String(key)) >= 0;
  }
  /* 쓸 수 있으면 볼 수 있다 — areas 를 read_areas 에 또 적지 않아도 되게. */
  function canReadArea(user, key) {
    if (!user || !user.active) return false;
    if (user.role === 'owner' || user.role === 'admin') return true;
    if (!key) return true;
    return (user.areas || []).indexOf(String(key)) >= 0
        || (user.read_areas || []).indexOf(String(key)) >= 0;
  }
  /* 화면에서 쓰는 3단계 값 — 없음 / 읽기 / 읽기+쓰기 */
  function areaLevel(user, key) {
    if (canArea(user, key)) return 'write';
    if (canReadArea(user, key)) return 'read';
    return 'none';
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
      // 섹션 권한. 역할을 통과해도 이 화면이 안 열릴 수 있다 — 그때는 무엇이
      // 막혔는지 이름으로 말해 준다. 「권한이 없습니다」만 뜨면 누구에게
      // 무엇을 요청해야 하는지 알 수 없다.
      if (opts.area && !canReadArea(u, opts.area)) {
        return deny('no-area', '「' + labelOf(opts.area) + '」 화면을 볼 권한이 없습니다. '
                             + 'owner 에게 요청해 주세요.', u);
      }
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

  function labelOf(key) {
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].key === key) return SECTIONS[i].label;
    return String(key || '');
  }

  return {
    uid: uid,
    ROLES: ROLES,
    SECTIONS: SECTIONS,
    SECTION_KEYS: SECTION_KEYS,
    DEFAULT_AREAS: DEFAULT_AREAS,
    defaultsFor: defaultsFor,
    cleanAreas: cleanAreas,
    labelOf: labelOf,
    canArea: canArea,
    canReadArea: canReadArea,
    areaLevel: areaLevel,
    configured: cfgReady,
    login: login,
    logout: logout,
    session: session,
    token: token,
    me: me,
    can: can,
    rank: rank,
    listUsers: listUsers,
    updateUser: updateUser,
    requestAccess: requestAccess,
    listRequests: listRequests,
    resolveRequest: resolveRequest,
    guardChange: guardChange,
    require: require_,
    adoptHash: adoptHash,
    verifyTokenHash: verifyTokenHash,
    linkError: linkError,
    setPassword: setPassword,
    _dep: dep,                 // 테스트에서 fetch/storage/now 를 갈아 끼운다
    _expired: expired,
    _friendly: friendly
  };
});
