/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 접근 게이트 + 사용자 이름  (shared/gate.js)

   - 페이지 진입 시 비밀번호 + 이름을 받는 가벼운 가림막.
   - 비밀번호 통과 기록은 sessionStorage(탭 닫으면 재입력).
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
     window.addEventListener('mt-user-change', e => e.detail.name)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // 접근 비밀번호의 SHA-256 해시 (원문 비노출)
  var PASS_HASH = '5d1b67c4f5ebfbc63dd15285fa79e490cbc37c4c479a44f8e6646e0f7d65b5da';

  var SESSION_KEY = 'mt-gate-ok';
  var NAME_KEY = 'mt-user-name';

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
        badge.onmouseenter = function () { badge.style.borderColor = '#353C48'; badge.style.color = '#353C48'; };
        badge.onmouseleave = function () { badge.style.borderColor = '#E3E5EA'; badge.style.color = '#5A6472'; };
        badge.addEventListener('click', openNameModal);
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
  window.MT_USER = { get: getName, set: setName, prompt: openNameModal };

  // 게이트를 안 거치는 페이지(이미 세션 통과)에서도 헤더 이름은 표시
  function whenReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // 이번 세션에서 이미 통과했으면 게이트는 건너뛰되 헤더만 갱신
  try {
    if (sessionStorage.getItem(SESSION_KEY) === PASS_HASH) {
      whenReady(refreshHeader);
      return;
    }
  } catch (e) { /* sessionStorage 차단 환경이면 매번 묻습니다 */ }

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
    var logoBase = document.currentScript
      ? document.currentScript.src.replace(/shared\/gate\.js.*$/, '')
      : '';
    var logoUrl = logoBase + 'assets/logo-merittour-horizontal.svg';
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
      '#mt-gate input#mt-gate-pw{text-align:center;letter-spacing:.3em;}',
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
      '  <img class="logo" src="' + logoUrl + '" alt="MERITTOUR">',
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
        try { sessionStorage.setItem(SESSION_KEY, PASS_HASH); } catch (e) {}
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
