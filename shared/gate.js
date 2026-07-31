/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 접근 게이트 + 사용자 이름  (shared/gate.js)

   - 페이지 진입 시 비밀번호 + 이름을 받는 가벼운 가림막.
   - 비밀번호 통과 기록은 localStorage + 30일 슬라이딩 만료.
     (탭/창을 닫거나 새 탭을 열어도 유지. 접속 시마다 만료 30일 자동 연장.
      30일간 완전 미접속 시에만 재입력.)
   - 이름은 localStorage(계속 유지). 헤더에서 언제든 변경 가능.
   - 비밀번호 원문은 코드에 두지 않고 SHA-256 해시만 보관.

   ※ 정적 GitHub Pages 환경이라 소스가 노출됩니다.
     "외부 침입 차단"이 아니라 "URL 우연 노출 가림막 + 협업용 서명" 용도.
     이름은 인증이 아니라 자유 입력 라벨(진위 보장 X).

   사용법: <head> 안에서 본문보다 먼저 한 줄.
     <script src="../shared/gate.js"></script>

   다른 스크립트에서 이름 사용:
     window.MT_USER.get()           → 현재 이름(문자열, 없으면 '')
     window.MT_USER.set('홍길동')    → 이름 저장(+헤더 갱신)
     window.MT_USER.prompt()        → 이름 변경 모달 열기
     window.MT_USER.logout()        → 로그아웃(게이트 기록·이름 삭제, 새로고침)
     window.addEventListener('mt-user-change', e => e.detail.name)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // 로고: 인라인 SVG (외부 파일 의존 없이 어디서든 렌더)
  var LOGO_SVG = '<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 539.49 67.31"><g id="레이어_2" data-name="레이어 2"><g id="레이어_1-2" data-name="레이어 1"><polygon points="146.69 51.4 146.54 51.4 134.83 9.89 118.23 9.89 118.23 58.23 127.38 58.23 127.07 13.73 127.22 13.73 140.89 58.23 151.87 58.23 165.61 13.45 165.77 13.45 165.46 58.23 174.92 58.23 174.92 9.89 158.63 9.89 146.69 51.4" fill="#373f4a"/><polygon points="196.74 35.48 214.89 35.48 214.89 31.07 196.74 31.07 196.74 14.38 217.38 14.38 217.38 9.89 187.05 9.89 187.05 58.23 218.94 58.23 218.94 53.74 196.74 53.74 196.74 35.48" fill="#373f4a"/><rect x="277.51" y="9.89" width="9.7" height="48.33" fill="#373f4a"/><polygon points="296.11 14.47 311.12 14.47 311.12 58.23 320.81 58.23 320.81 14.47 335.9 14.47 335.9 9.89 296.11 9.89 296.11 14.47" fill="#373f4a"/><polygon points="343.94 14.5 358.95 14.5 358.95 58.23 368.65 58.23 368.65 14.5 383.74 14.5 383.74 9.89 343.94 9.89 343.94 14.5" fill="#373f4a"/><path d="M434.24,15.86a26.37,26.37,0,0,0-8.84-5.25,28.41,28.41,0,0,0-10.48-1.85,27.81,27.81,0,0,0-10.4,1.88A26.51,26.51,0,0,0,395.69,16a24.24,24.24,0,0,0-5.83,8.1,24.86,24.86,0,0,0-2.07,10.2,23.92,23.92,0,0,0,3.56,13,24.44,24.44,0,0,0,9.89,8.85,28.57,28.57,0,0,0,13.68,3.19,28,28,0,0,0,10.48-1.88,27.07,27.07,0,0,0,8.84-5.26,23.57,23.57,0,0,0,5.82-8,24.55,24.55,0,0,0,2.08-10.16,24.55,24.55,0,0,0-2.08-10.16A24.12,24.12,0,0,0,434.24,15.86ZM429.67,44.7a16.86,16.86,0,0,1-6.22,6.9,14.88,14.88,0,0,1-8.53,2.47,14.54,14.54,0,0,1-8.45-2.51,17,17,0,0,1-6.21-7.06A23.36,23.36,0,0,1,398,34.06a23.27,23.27,0,0,1,2.23-10.48,17,17,0,0,1,6.21-7A14.68,14.68,0,0,1,415,14.05a14.17,14.17,0,0,1,8.41,2.55,17.59,17.59,0,0,1,6.22,7.14,23.51,23.51,0,0,1,2.26,10.56A22.93,22.93,0,0,1,429.67,44.7Z" fill="#373f4a"/><path d="M481.23,43.93a10.81,10.81,0,0,1-2.51,7.36c-1.66,1.92-4.4,2.88-8.2,2.88s-6.48-1-8.18-3a11.12,11.12,0,0,1-2.54-7.46V9.89h-9.69V41.67A18.24,18.24,0,0,0,452.42,51a15.4,15.4,0,0,0,6.84,6.18,25.62,25.62,0,0,0,11.26,2.2,24.89,24.89,0,0,0,11.25-2.27,15.82,15.82,0,0,0,6.85-6.29,18.52,18.52,0,0,0,2.3-9.35V9.89h-9.69Z" fill="#373f4a"/><path d="M257.1,37.12a15.52,15.52,0,0,0,6.84-4.94,12.39,12.39,0,0,0,2.46-7.72,12.78,12.78,0,0,0-2.35-7.67,15.12,15.12,0,0,0-6.6-5.08,25.07,25.07,0,0,0-9.89-1.82h-18V58.23h9.7v-44H247c2.76,0,5,.23,6.78,1.6s3.85,3.35,3.32,8.93a8.25,8.25,0,0,1-2.32,5A10.28,10.28,0,0,1,250,32.32a25.34,25.34,0,0,1-6.29.74h-3.6L253.91,53h0l.44.62a12,12,0,0,0,3.14,3,13.5,13.5,0,0,0,2.6,1,41.48,41.48,0,0,0,8.05.67h.68L253.88,38.06A22.35,22.35,0,0,0,257.1,37.12Z" fill="#373f4a"/><path d="M84.43,0s-25-.23-42.24,18.8a17.14,17.14,0,0,0-1.73,2.37v-.06c-7,9.81-8,18.06-8,21.41,0,8.74,2.3,12.21,2.3,12.21,0-1.56.08-3.06.15-4.44a40.71,40.71,0,0,1,3.77-14.21q1.11-2,2.26-3.8c.22-.33.45-.66.62-.94,14.07-21,32.4-19.09,32.4-19.09s3,19-4.06,32.94S45.54,67.31,45.54,67.31H47C63.37,66,72.61,54,73.37,52.91,89.74,30,84.43,0,84.43,0Z" fill="#373f4a"/><path d="M15.38,45.19c-7-14-4.06-32.94-4.06-32.94S23.5,11,35.62,21.89a29.79,29.79,0,0,1,4.51-6.06C23.15-.19.82,0,.82,0S-4.49,30,11.88,52.91c.76,1,10,13.13,26.43,14.4h1.41S22.44,59.16,15.38,45.19Z" fill="#373f4a"/><path d="M527.76,37.12a15.4,15.4,0,0,0,6.84-4.94,12.34,12.34,0,0,0,2.47-7.72,12.85,12.85,0,0,0-2.35-7.67,15.15,15.15,0,0,0-6.61-5.08,25,25,0,0,0-9.89-1.82h-18V58.23h9.7v-44h7.74c2.76,0,5,.23,6.78,1.6s3.85,3.35,3.31,8.93a8.24,8.24,0,0,1-2.31,5,10.28,10.28,0,0,1-4.77,2.56,25.42,25.42,0,0,1-6.3.74H510.8L524.58,53h0l.43.62a12.05,12.05,0,0,0,3.15,3,13.5,13.5,0,0,0,2.6,1,41.42,41.42,0,0,0,8,.67h.68L524.55,38.06A22.21,22.21,0,0,0,527.76,37.12Z" fill="#373f4a"/></g></g></svg>';

  // 접근 비밀번호의 SHA-256 해시 (원문 비노출)
  var PASS_HASH = '5d1b67c4f5ebfbc63dd15285fa79e490cbc37c4c479a44f8e6646e0f7d65b5da';

  var GATE_KEY = 'mt-gate-ok';
  var NAME_KEY = 'mt-user-name';
  var GATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30일

  /* ── 게이트 통과 기록 (localStorage + 슬라이딩 만료) ── */
  function gatePassed() {
    try {
      var raw = localStorage.getItem(GATE_KEY);
      if (!raw) return false;
      var rec = JSON.parse(raw);
      // 해시 일치 + 미만료면 통과. 접속 시마다 만료를 30일 뒤로 연장(슬라이딩).
      if (rec && rec.h === PASS_HASH && rec.exp && Date.now() < rec.exp) {
        markGatePassed();
        return true;
      }
      localStorage.removeItem(GATE_KEY);   // 만료·해시 불일치면 정리
    } catch (e) { /* 차단 환경이면 매번 묻습니다 */ }
    return false;
  }
  function markGatePassed() {
    try {
      localStorage.setItem(GATE_KEY, JSON.stringify({ h: PASS_HASH, exp: Date.now() + GATE_TTL_MS }));
    } catch (e) {}
  }

  /* ── 이름 저장소 (localStorage, 계속 유지) ── */
  function getName() {
    try { return (localStorage.getItem(NAME_KEY) || '').trim(); } catch (e) { return ''; }
  }
  function setName(name) {
    var v = (name || '').trim();
    try { localStorage.setItem(NAME_KEY, v); } catch (e) {}
    refreshHeader();
    try {
      window.dispatchEvent(new CustomEvent('mt-user-change', { detail: { name: v } }));
    } catch (e) {}
    return v;
  }
  function validName(name) {
    var v = (name || '').trim();
    return v.length >= 2;   // 빈칸·1글자 차단
  }

  /* ── 헤더의 사용자 표시 갱신 (있을 때만) ── */
  function refreshHeader() {
    var name = getName();
    // 1순위: 전용 컨테이너 #mtUserBadge (없으면 생성 시도)
    var badge = document.getElementById('mtUserBadge');
    if (!badge) {
      var actions = document.querySelector('.header-actions') || document.querySelector('.header-right');
      if (actions) {
        badge = document.createElement('button');
        badge.id = 'mtUserBadge';
        badge.type = 'button';
        badge.title = '이름 변경';
        badge.style.cssText =
          'display:inline-flex;align-items:center;gap:6px;padding:6px 13px;' +
          'background:#fff;border:1px solid #E3E5EA;border-radius:24px;' +
          'font-size:12.5px;color:#5A6472;cursor:pointer;font-family:inherit;' +
          'transition:border-color .15s,color .15s;';
        badge.setAttribute('aria-haspopup', 'menu');
        badge.setAttribute('aria-expanded', 'false');
        badge.onmouseenter = function () { badge.style.borderColor = '#353C48'; badge.style.color = '#353C48'; };
        badge.onmouseleave = function () { badge.style.borderColor = '#E3E5EA'; badge.style.color = '#5A6472'; };
        badge.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(badge); });
        actions.insertBefore(badge, actions.firstChild);
      }
    }
    if (badge) {
      badge.innerHTML = name
        ? '<span style="font-weight:700;color:#353C48">' + escHtml(name) + '</span> 님 <span style="opacity:.5;font-size:10px">▾</span>'
        : '<span style="color:#DC2626;font-weight:700">이름 미설정</span> <span style="opacity:.5;font-size:10px">▾</span>';
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /* ── 헤더 배지 메뉴 (이름 변경 · 로그아웃) ──
     종전에는 배지에 ▾ 만 있고 눌러도 이름 모달만 떴다. 로그아웃 수단이
     아예 없어서, 공용 PC 에서 앞사람 이름으로 남는 것을 끊을 방법이 없었다. */
  var MENU_ID = 'mt-user-menu';
  function closeMenu() {
    var m = document.getElementById(MENU_ID);
    if (m) m.remove();
    var b = document.getElementById('mtUserBadge');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', closeMenu);
    document.removeEventListener('keydown', onMenuKey);
    window.removeEventListener('resize', closeMenu);
    window.removeEventListener('scroll', closeMenu, true);
  }
  function onMenuKey(e) { if (e.key === 'Escape') closeMenu(); }

  function toggleMenu(badge) {
    if (document.getElementById(MENU_ID)) { closeMenu(); return; }
    var r = badge.getBoundingClientRect();
    var m = document.createElement('div');
    m.id = MENU_ID;
    m.setAttribute('role', 'menu');
    // position:fixed — 헤더에 overflow 가 걸려 있어도 잘리지 않는다
    m.style.cssText =
      'position:fixed;z-index:2147483645;min-width:172px;background:#fff;' +
      'border:1px solid #E3E5EA;border-radius:10px;padding:5px;' +
      'box-shadow:0 8px 24px rgba(26,35,50,.16);' +
      "font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif;" +
      'top:' + Math.round(r.bottom + 6) + 'px;' +
      'left:' + Math.round(Math.max(8, Math.min(r.right - 172, window.innerWidth - 180))) + 'px;';

    [
      { label: '이름 변경', color: '#353C48', fn: openNameModal },
      { label: '로그아웃',  color: '#C0392B', fn: doLogout }
    ].forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.textContent = it.label;
      b.style.cssText =
        'display:block;width:100%;text-align:left;padding:9px 12px;border:none;' +
        'background:none;border-radius:7px;font-size:13.5px;font-weight:600;' +
        'font-family:inherit;cursor:pointer;color:' + it.color + ';';
      b.onmouseenter = function () { b.style.background = '#F2F5F9'; };
      b.onmouseleave = function () { b.style.background = 'none'; };
      b.addEventListener('click', function (e) { e.stopPropagation(); closeMenu(); it.fn(); });
      m.appendChild(b);
    });

    document.body.appendChild(m);
    badge.setAttribute('aria-expanded', 'true');
    // 지금 이 클릭이 그대로 닫기로 이어지지 않게 다음 틱에 건다
    setTimeout(function () {
      document.addEventListener('click', closeMenu);
      document.addEventListener('keydown', onMenuKey);
      window.addEventListener('resize', closeMenu);
      window.addEventListener('scroll', closeMenu, true);
    }, 0);
  }

  /* 로그아웃 — 게이트 기록과 이름을 지운다.
     이름을 남기면 공용 PC 에서 다음 사람이 앞사람 이름 그대로 통과한다.
     로그인(Supabase)이 붙어 있는 페이지면 그 세션도 같이 끊는다. */
  function doLogout() {
    if (!window.confirm('로그아웃하시겠습니까?\n다음 접속 때 이름과 접근 비밀번호를 다시 입력해야 합니다.')) return;
    try { localStorage.removeItem(GATE_KEY); } catch (e) {}
    try { localStorage.removeItem(NAME_KEY); } catch (e) {}
    if (window.MT_AUTH && typeof window.MT_AUTH.logout === 'function') {
      window.MT_AUTH.logout()
        .catch(function () {})
        .then(function () { location.reload(); });
      return;
    }
    location.reload();
  }

  /* ── 이름만 변경하는 모달 (헤더 클릭 시) ── */
  function openNameModal() {
    if (document.getElementById('mt-name-modal')) return;
    var cur = getName();
    var wrap = document.createElement('div');
    wrap.id = 'mt-name-modal';
    wrap.innerHTML = [
      '<style>',
      '#mt-name-modal{position:fixed;inset:0;z-index:2147483646;display:flex;',
      'align-items:center;justify-content:center;padding:24px;background:rgba(26,35,50,.45);',
      "font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif;}",
      '#mt-name-modal *{box-sizing:border-box;}',
      '#mt-name-modal .nm-card{width:100%;max-width:340px;background:#fff;border-radius:12px;',
      'box-shadow:0 8px 28px rgba(26,35,50,.2);padding:26px 24px 22px;}',
      '#mt-name-modal h3{margin:0 0 16px;font-size:15px;color:#353C48;font-weight:700;}',
      '#mt-name-modal input{width:100%;font-size:16px;padding:11px 13px;border:1px solid #CDD1D8;',
      'border-radius:8px;color:#2A2F39;}',
      '#mt-name-modal input:focus{outline:none;border-color:#353C48;}',
      '#mt-name-modal input.err{border-color:#DC2626;background:#FEE2E2;}',
      '#mt-name-modal .nm-msg{min-height:16px;font-size:12px;color:#DC2626;margin-top:8px;}',
      '#mt-name-modal .nm-row{display:flex;gap:8px;margin-top:14px;}',
      '#mt-name-modal button{flex:1;font-size:14px;font-weight:700;font-family:inherit;',
      'padding:11px;border-radius:8px;cursor:pointer;border:1px solid #E3E5EA;}',
      '#mt-name-modal .nm-ok{background:#353C48;color:#fff;border-color:#353C48;}',
      '#mt-name-modal .nm-cancel{background:#fff;color:#5A6472;}',
      '</style>',
      '<div class="nm-card">',
      '  <h3>이름 설정</h3>',
      '  <input id="mt-name-input" type="text" maxlength="20" placeholder="이름 (2글자 이상)" value="' + escHtml(cur) + '">',
      '  <div class="nm-msg" id="mt-name-msg"></div>',
      '  <div class="nm-row">',
      '    <button class="nm-cancel" id="mt-name-cancel" type="button">취소</button>',
      '    <button class="nm-ok" id="mt-name-ok" type="button">저장</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    var inp = document.getElementById('mt-name-input');
    var msg = document.getElementById('mt-name-msg');
    inp.focus(); inp.select();
    function close() { wrap.remove(); }
    function save() {
      if (!validName(inp.value)) {
        msg.textContent = '이름을 2글자 이상 입력해 주세요.';
        inp.classList.add('err'); inp.focus(); return;
      }
      setName(inp.value);
      close();
    }
    document.getElementById('mt-name-ok').addEventListener('click', save);
    document.getElementById('mt-name-cancel').addEventListener('click', close);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); if (e.key === 'Escape') close(); });
    inp.addEventListener('input', function () { inp.classList.remove('err'); msg.textContent = ''; });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  }

  /* ── 전역 노출 (다른 스크립트가 이름 사용) ── */
  window.MT_USER = { get: getName, set: setName, prompt: openNameModal, logout: doLogout };

  // 게이트를 안 거치는 페이지(이미 세션 통과)에서도 헤더 이름은 표시
  function whenReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // 이미 통과한 기기(미만료)면 게이트는 건너뛰되 헤더만 갱신
  if (gatePassed()) {
    whenReady(refreshHeader);
    return;
  }

  // ── SHA-256 (SubtleCrypto, https/localhost 에서 동작) ──
  async function sha256(text) {
    var buf = new TextEncoder().encode(text);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.prototype.map
      .call(new Uint8Array(hash), function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  // ── 게이트 오버레이 DOM ──
  function buildOverlay() {
    var savedName = getName();

    var wrap = document.createElement('div');
    wrap.id = 'mt-gate';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = [
      '<style>',
      '#mt-gate{position:fixed;inset:0;z-index:2147483647;',
      'display:flex;align-items:center;justify-content:center;padding:24px;',
      'background:#F7F8FA;',
      "font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif;}",
      '#mt-gate *{box-sizing:border-box;}',
      '#mt-gate .card{width:100%;max-width:380px;background:#fff;border:1px solid #E3E5EA;',
      'border-radius:12px;box-shadow:0 8px 28px rgba(26,35,50,.12);padding:36px 32px 30px;text-align:center;}',
      '#mt-gate .logo{height:24px;width:auto;display:block;margin:0 auto 8px;}',
      '#mt-gate .sub{font-size:11px;color:#97A0AE;letter-spacing:.08em;',
      "font-family:'JetBrains Mono',monospace;margin-bottom:24px;}",
      '#mt-gate label{display:block;text-align:left;font-size:13px;font-weight:700;',
      'color:#5A6472;margin:14px 0 7px;}',
      '#mt-gate label:first-of-type{margin-top:0;}',
      '#mt-gate input{width:100%;font-size:17px;padding:12px 14px;border:1px solid #CDD1D8;',
      'border-radius:8px;background:#fff;color:#2A2F39;transition:border-color .15s;}',
      '#mt-gate input#mt-gate-pw{text-align:left;letter-spacing:.3em;}',
      '#mt-gate input#mt-gate-name{text-align:left;}',
      '#mt-gate input:focus{outline:none;border-color:#353C48;}',
      '#mt-gate input.err{border-color:#DC2626;background:#FEE2E2;}',
      '#mt-gate .msg{min-height:18px;font-size:12.5px;color:#DC2626;margin-top:10px;text-align:left;}',
      '#mt-gate button{width:100%;margin-top:18px;font-size:15px;font-weight:700;',
      "font-family:inherit;padding:13px;border:none;border-radius:8px;cursor:pointer;",
      'background:#353C48;color:#fff;transition:background-color .15s;}',
      '#mt-gate button:hover{background:#2A2F39;}',
      '#mt-gate button:disabled{opacity:.5;cursor:default;}',
      '#mt-gate .foot{margin-top:22px;font-size:11px;color:#97A0AE;line-height:1.6;}',
      '</style>',
      '<div class="card">',
      '  ' + LOGO_SVG,
      '  <div class="sub">INTERNAL TOOLS</div>',
      '  <label for="mt-gate-name">이름</label>',
      '  <input id="mt-gate-name" type="text" maxlength="20" autocomplete="off"',
      '         placeholder="이름 (2글자 이상)" value="' + escHtml(savedName) + '">',
      '  <label for="mt-gate-pw">접근 비밀번호</label>',
      '  <input id="mt-gate-pw" type="password" inputmode="numeric" autocomplete="off"',
      '         autocapitalize="off" spellcheck="false" aria-label="접근 비밀번호">',
      '  <div class="msg" id="mt-gate-msg"></div>',
      '  <button id="mt-gate-btn" type="button">입력</button>',
      '  <div class="foot">사내 직원 전용 도구함입니다.</div>',
      '</div>'
    ].join('');
    return wrap;
  }

  function lockScroll(on) {
    document.documentElement.style.overflow = on ? 'hidden' : '';
    if (document.body) document.body.style.overflow = on ? 'hidden' : '';
  }

  function mount() {
    var overlay = buildOverlay();
    document.body.appendChild(overlay);
    lockScroll(true);

    var nameInput = document.getElementById('mt-gate-name');
    var pwInput = document.getElementById('mt-gate-pw');
    var btn = document.getElementById('mt-gate-btn');
    var msg = document.getElementById('mt-gate-msg');

    // 이름이 이미 있으면 비밀번호로, 없으면 이름으로 포커스
    if (getName()) pwInput.focus(); else nameInput.focus();

    async function submit() {
      var nameVal = nameInput.value.trim();
      var pwVal = pwInput.value.trim();
      if (!validName(nameVal)) {
        msg.textContent = '이름을 2글자 이상 입력해 주세요.';
        nameInput.classList.add('err'); nameInput.focus(); return;
      }
      if (!pwVal) { pwInput.focus(); return; }
      btn.disabled = true;
      var ok = false;
      try {
        ok = (await sha256(pwVal)) === PASS_HASH;
      } catch (e) {
        msg.textContent = '이 환경에서는 보안 검증을 사용할 수 없습니다. https 주소로 접속해 주세요.';
        btn.disabled = false; return;
      }
      if (ok) {
        setName(nameVal);
        markGatePassed();
        overlay.remove();
        lockScroll(false);
        refreshHeader();
      } else {
        msg.textContent = '비밀번호가 올바르지 않습니다.';
        pwInput.classList.add('err'); pwInput.value = ''; pwInput.focus();
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', submit);
    function onEnter(e) { if (e.key === 'Enter') submit(); }
    nameInput.addEventListener('keydown', onEnter);
    pwInput.addEventListener('keydown', onEnter);
    nameInput.addEventListener('input', function () { nameInput.classList.remove('err'); msg.textContent = ''; });
    pwInput.addEventListener('input', function () { pwInput.classList.remove('err'); msg.textContent = ''; });
  }

  whenReady(mount);
})();
