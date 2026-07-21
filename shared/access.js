/* ════════════════════════════════════════════════════════════════
   MERITTOUR — Supabase Auth + 역할 접근제어 공통 모듈 (shared/access.js)

   목적: DB/Storage 의 실제 보안은 Supabase Auth + RLS 로 하고, 이 파일은
         "로그인 여부·역할·active" 를 클라이언트에서 확인해 UI 를 가드한다.
         (게이트 shared/gate.js 는 UX 용도로만 유지 — 실제 보안 경계 아님)

   ★ 기본 비활성(ENABLED=false): 켜기 전에는 아무 동작도 하지 않는다(no-op).
     → 마이그레이션(01~04) 적용 + 초대 계정 준비가 끝난 뒤 ENABLED=true 로 전환.
     → 단계적 전환: 켜기 전까지 기존 대시보드 기능은 그대로 동작.

   사용법(<head>, gate.js 뒤):
     <script src="../../shared/access.js"></script>
   페이지 영역 가드:
     <body data-area="dashboard">  (또는 admin/air/manage/sales)
   API:
     window.MT_ACCESS.ready         → Promise<{user, role, active}|null>
     window.MT_ACCESS.hasRole(['admin','sales'])
     window.MT_ACCESS.client        → supabase-js 클라이언트(활성 시)
     window.MT_ACCESS.signOut()

   ※ 여기에는 publishable(anon) 키만 사용 가능. service_role/secret 키 금지.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CONFIG = {
    // ── 운영자가 설정(마이그레이션·초대 준비 후 true 로) ──
    ENABLED: false,
    SUPABASE_URL: '',          // 예: https://xxxx.supabase.co  (확인 필요)
    SUPABASE_ANON_KEY: '',     // publishable/anon 키만 (service_role 금지)
    LOGIN_URL: '../login/',    // 로그인 페이지 경로(도구 깊이에 맞게) — 확인 필요
    // data-area 별 허용 역할. area 미지정 페이지는 로그인만 요구.
    AREA_ROLES: {
      dashboard: ['admin', 'sales', 'air', 'manage'],
      sales:     ['admin', 'sales'],
      air:       ['admin', 'air'],
      manage:    ['admin', 'manage'],
      admin:     ['admin']
    },
    SDK: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
  };

  // 비활성이면 즉시 종료(no-op) — 기존 페이지에 영향 없음.
  if (!CONFIG.ENABLED) {
    window.MT_ACCESS = {
      enabled: false,
      ready: Promise.resolve(null),
      hasRole: function () { return true; },      // 비활성 시 가드 통과(기존 동작 유지)
      signOut: function () {},
      client: null
    };
    return;
  }

  function loadSDK() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script');
      s.src = CONFIG.SDK; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('supabase-js 로드 실패')); };
      document.head.appendChild(s);
    });
  }

  function overlay(msg, showLogin) {
    var d = document.createElement('div');
    d.id = 'mt-access-block';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;'
      + 'justify-content:center;background:rgba(26,35,50,.55);font-family:sans-serif;padding:24px';
    d.innerHTML = '<div style="background:#fff;border-radius:12px;padding:28px 26px;max-width:340px;'
      + 'text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.25)">'
      + '<div style="font-size:15px;font-weight:700;color:#353C48;margin-bottom:10px">접근 제한</div>'
      + '<div style="font-size:13.5px;color:#5A6472;line-height:1.6">' + msg + '</div>'
      + (showLogin ? '<button id="mt-access-login" style="margin-top:16px;background:#353C48;color:#fff;'
        + 'border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer">로그인</button>' : '')
      + '</div>';
    document.body.appendChild(d);
    var b = document.getElementById('mt-access-login');
    if (b) b.onclick = function () { location.href = CONFIG.LOGIN_URL; };
  }

  var resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });
  var api = {
    enabled: true, ready: ready, client: null, ctx: null,
    hasRole: function (roles) { return !!(api.ctx && roles.indexOf(api.ctx.role) >= 0); },
    signOut: function () { if (api.client) api.client.auth.signOut().then(function () { location.href = CONFIG.LOGIN_URL; }); }
  };
  window.MT_ACCESS = api;

  (async function () {
    try {
      if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
        overlay('인증 설정이 필요합니다. (SUPABASE_URL/ANON_KEY 미설정 — 확인 필요)', false);
        resolveReady(null); return;
      }
      await loadSDK();
      var client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      api.client = client;

      var sess = (await client.auth.getSession()).data.session;
      if (!sess) { overlay('로그인이 필요한 페이지입니다.', true); resolveReady(null); return; }

      // user_access: 본인 행(RLS 로 본인만 조회 가능)
      var uid = sess.user.id;
      var q = await client.from('user_access').select('role,active,name').eq('user_id', uid).limit(1).maybeSingle();
      var acc = q.data;
      if (!acc || acc.active !== true) { overlay('비활성 계정이거나 접근 권한이 없습니다. 관리자에게 문의하세요.', false); resolveReady(null); return; }

      // 영역(area) 가드
      var area = (document.body && document.body.getAttribute('data-area')) || '';
      if (area && CONFIG.AREA_ROLES[area] && CONFIG.AREA_ROLES[area].indexOf(acc.role) < 0) {
        overlay('이 부서/기능에 대한 접근 권한이 없습니다. (역할: ' + acc.role + ')', false);
        resolveReady(null); return;
      }

      api.ctx = { user: sess.user, role: acc.role, active: acc.active, name: acc.name || '' };
      // 세션 만료/변경 감지
      client.auth.onAuthStateChange(function (_e, s) { if (!s) location.reload(); });
      resolveReady(api.ctx);
    } catch (e) {
      overlay('인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', true);
      resolveReady(null);
    }
  })();
})();
