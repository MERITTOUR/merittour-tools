/* ============================================================
 * MERITTOUR Internal Tools — Common Auth Script
 * ----------------------------------------------------------
 * Google Identity Services (GSI) 기반 로그인
 * + 이메일 화이트리스트 검증
 *
 * 사용법:
 *   1) <script src="https://accounts.google.com/gsi/client" async defer></script>
 *      위 라인을 도구 HTML <head> 또는 <body> 끝에 추가
 *   2) <script src="../auth.js"></script>
 *      이 스크립트도 같이 include
 *   3) 도구 HTML에서 window.MERITTOUR_AUTH = { onSignIn, onSignOut, onError, buttonContainer }
 *      설정해두면 자동으로 로그인 흐름 시작
 *
 * 주의: 이 인증은 클라이언트 사이드 검증이므로 기술적으로 우회 가능.
 *       정직한 직원 대상이며, 영업 비밀급 강한 보안이 필요해지면
 *       Cloudflare Access 등 서버 사이드 인증으로 전환 권장.
 * ============================================================ */

(function () {
  'use strict';

  // ─── 설정 (운영자가 직접 편집) ──────────────────────────
  const CONFIG = {
    // 🔐 로그인 활성화 여부
    //   false: 로그인 없이 누구나 접근 (URL을 직원에게만 공유하는 방식)
    //   true:  Google 로그인 + 이메일 화이트리스트 강제
    ENABLED: false,

    // Google Cloud Console에서 발급받은 OAuth 2.0 Client ID
    // (발급 방법은 README 참고)
    CLIENT_ID: 'YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com',

    // 도메인 화이트리스트 (이 도메인 메일은 자동 허용)
    // Google Workspace 사용 시 매우 유용
    ALLOWED_DOMAINS: [
      // 예: 'merittour.co.kr'
    ],

    // 개별 이메일 화이트리스트 (위 도메인에 없어도 허용)
    ALLOWED_EMAILS: [
      // 예: 'manager@gmail.com',
      // 'sai@example.com',
    ],

    // 로그인 유지 기간 (밀리초). 기본 7일.
    SESSION_DURATION_MS: 7 * 24 * 60 * 60 * 1000,

    // localStorage 키
    STORAGE_KEY: 'mt_auth_session_v1'
  };

  const HOOKS = window.MERITTOUR_AUTH || {};
  const BUTTON_CONTAINER_ID = HOOKS.buttonContainer || 'gsiButtonBox';

  // ─── 세션 저장/불러오기 ──────────────────────────────────
  function saveSession(profile) {
    const session = {
      ...profile,
      expiresAt: Date.now() + CONFIG.SESSION_DURATION_MS
    };
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(session)); }
    catch (e) { console.warn('[auth] 세션 저장 실패', e); }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.expiresAt && s.expiresAt > Date.now()) return s;
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      return null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); }
    catch (e) {}
  }

  // ─── JWT 파싱 (Google ID Token) ──────────────────────────
  function parseJwt(token) {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      // UTF-8 디코딩 (한글 이름 등 처리)
      const utf8 = decodeURIComponent(
        Array.from(decoded).map(c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );
      return JSON.parse(utf8);
    } catch (e) {
      console.error('[auth] JWT 파싱 실패', e);
      return null;
    }
  }

  // ─── 이메일 화이트리스트 검증 ───────────────────────────
  function isEmailAllowed(email) {
    if (!email) return false;
    const lower = email.toLowerCase().trim();

    // 1) 개별 이메일 매칭
    if (CONFIG.ALLOWED_EMAILS.map(e => e.toLowerCase().trim()).includes(lower)) {
      return true;
    }
    // 2) 도메인 매칭
    const domain = lower.split('@')[1];
    if (domain && CONFIG.ALLOWED_DOMAINS.map(d => d.toLowerCase().trim()).includes(domain)) {
      return true;
    }
    return false;
  }

  // ─── Google ID 토큰 콜백 ────────────────────────────────
  function handleCredentialResponse(response) {
    const profile = parseJwt(response.credential);
    if (!profile || !profile.email) {
      callError('로그인 정보를 읽지 못했습니다.');
      return;
    }
    if (!profile.email_verified) {
      callError('이메일 인증이 완료되지 않은 Google 계정입니다.');
      return;
    }
    if (!isEmailAllowed(profile.email)) {
      callError(`접근 권한이 없는 계정입니다: ${profile.email}\n시스템 관리자에게 등록을 요청해 주세요.`);
      return;
    }

    const user = {
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture || '',
      sub: profile.sub
    };
    saveSession(user);
    callSignIn(user);
  }

  function callSignIn(user) {
    if (typeof HOOKS.onSignIn === 'function') HOOKS.onSignIn(user);
  }
  function callSignOut() {
    if (typeof HOOKS.onSignOut === 'function') HOOKS.onSignOut();
  }
  function callError(msg) {
    if (typeof HOOKS.onError === 'function') HOOKS.onError(msg);
    else console.warn('[auth] ' + msg);
  }

  // ─── GSI 버튼 렌더 ──────────────────────────────────────
  function renderSignInButton() {
    const container = document.getElementById(BUTTON_CONTAINER_ID);
    if (!container) {
      console.warn('[auth] 버튼 컨테이너 #' + BUTTON_CONTAINER_ID + '를 찾을 수 없습니다');
      return;
    }
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      // GSI 스크립트가 아직 로드 안 됨 → 잠시 후 재시도
      setTimeout(renderSignInButton, 200);
      return;
    }
    if (CONFIG.CLIENT_ID.indexOf('YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE') !== -1) {
      container.innerHTML =
        '<div style="font-size:12px;color:#DC2626;line-height:1.6;text-align:left;padding:10px;border:1px solid #FCA5A5;border-radius:6px;background:#FEE2E2;">' +
        '⚠️ <b>auth.js 설정 필요</b><br>' +
        'Google OAuth Client ID가 입력되지 않았습니다.<br>' +
        'auth.js의 <code>CONFIG.CLIENT_ID</code>를 발급받은 값으로 교체해 주세요.' +
        '</div>';
      return;
    }

    google.accounts.id.initialize({
      client_id: CONFIG.CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false
    });
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: 'ko_KR'
    });
  }

  // ─── 로그아웃 ───────────────────────────────────────────
  function signOut() {
    clearSession();
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    callSignOut();
    setTimeout(renderSignInButton, 50);
  }

  // ─── 초기화 ────────────────────────────────────────────
  function init() {
    // ENABLED:false면 인증 비활성화 모드 — 그냥 통과
    if (!CONFIG.ENABLED) {
      console.log('[auth] 비활성화 모드 (CONFIG.ENABLED=false). 로그인 없이 접근 허용.');
      return;
    }

    const existing = loadSession();
    if (existing && isEmailAllowed(existing.email)) {
      callSignIn(existing);
      return;
    }
    if (existing) clearSession();
    renderSignInButton();
  }

  // 외부 API 노출
  window.MerittourAuth = {
    signOut: signOut,
    getCurrentUser: loadSession,
    isAllowed: isEmailAllowed,
    reinit: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
