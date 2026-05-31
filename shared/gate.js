/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 간단 접근 게이트  (shared/gate.js)

   - 페이지 진입 시 비밀번호 1개로 가벼운 가림막을 칩니다.
   - 통과 기록은 sessionStorage 에 저장 → 탭/브라우저를 닫으면 다시 입력.
   - 비밀번호 원문은 코드에 두지 않고 SHA-256 해시만 보관합니다.

   ※ 주의: 정적 GitHub Pages 환경이라 소스가 노출됩니다.
     이건 "외부 침입 차단"이 아니라 "URL 우연 노출 가림막" 용도입니다.

   사용법: <head> 안에서 본문보다 먼저 한 줄만 넣으면 됩니다.
     <script src="../shared/gate.js"></script>
   (경로는 페이지 위치에 맞게 ../ 깊이를 조정하세요.)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // 접근 비밀번호의 SHA-256 해시 (원문 비노출)
  var PASS_HASH = '5d1b67c4f5ebfbc63dd15285fa79e490cbc37c4c479a44f8e6646e0f7d65b5da';

  var SESSION_KEY = 'mt-gate-ok';

  // 이번 세션에서 이미 통과했으면 아무것도 하지 않음
  try {
    if (sessionStorage.getItem(SESSION_KEY) === PASS_HASH) return;
  } catch (e) { /* sessionStorage 차단 환경이면 매번 묻습니다 */ }

  // ── SHA-256 (SubtleCrypto, https/localhost 에서 동작) ──
  async function sha256(text) {
    var buf = new TextEncoder().encode(text);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.prototype.map
      .call(new Uint8Array(hash), function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  // ── 오버레이 DOM 구성 ──
  function buildOverlay() {
    var logoBase = document.currentScript
      ? document.currentScript.src.replace(/shared\/gate\.js.*$/, '')
      : '';
    var logoUrl = logoBase + 'assets/logo-merittour-horizontal.svg';

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
      "font-family:'JetBrains Mono',monospace;margin-bottom:26px;}",
      '#mt-gate label{display:block;text-align:left;font-size:13px;font-weight:700;',
      'color:#5A6472;margin-bottom:8px;}',
      '#mt-gate input{width:100%;font-size:18px;padding:13px 14px;border:1px solid #CDD1D8;',
      'border-radius:8px;background:#fff;color:#2A2F39;text-align:center;letter-spacing:.3em;',
      'transition:border-color .15s;}',
      '#mt-gate input:focus{outline:none;border-color:#353C48;}',
      '#mt-gate input.err{border-color:#DC2626;background:#FEE2E2;}',
      '#mt-gate .msg{min-height:18px;font-size:12.5px;color:#DC2626;margin-top:10px;text-align:left;}',
      '#mt-gate button{width:100%;margin-top:16px;font-size:15px;font-weight:700;',
      "font-family:inherit;padding:13px;border:none;border-radius:8px;cursor:pointer;",
      'background:#353C48;color:#fff;transition:background-color .15s;}',
      '#mt-gate button:hover{background:#2A2F39;}',
      '#mt-gate button:disabled{opacity:.5;cursor:default;}',
      '#mt-gate .foot{margin-top:22px;font-size:11px;color:#97A0AE;line-height:1.6;}',
      '</style>',
      '<div class="card">',
      '  <img class="logo" src="' + logoUrl + '" alt="MERITTOUR">',
      '  <div class="sub">INTERNAL TOOLS</div>',
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

    var input = document.getElementById('mt-gate-pw');
    var btn = document.getElementById('mt-gate-btn');
    var msg = document.getElementById('mt-gate-msg');
    input.focus();

    async function submit() {
      var val = input.value.trim();
      if (!val) { input.focus(); return; }
      btn.disabled = true;
      var ok = false;
      try {
        ok = (await sha256(val)) === PASS_HASH;
      } catch (e) {
        msg.textContent = '이 환경에서는 보안 검증을 사용할 수 없습니다. https 주소로 접속해 주세요.';
        btn.disabled = false;
        return;
      }
      if (ok) {
        try { sessionStorage.setItem(SESSION_KEY, PASS_HASH); } catch (e) {}
        overlay.remove();
        lockScroll(false);
      } else {
        msg.textContent = '비밀번호가 올바르지 않습니다.';
        input.classList.add('err');
        input.value = '';
        input.focus();
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    input.addEventListener('input', function () {
      input.classList.remove('err');
      msg.textContent = '';
    });
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
