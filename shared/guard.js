/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 로그인 문지기  (shared/guard.js)

   예전 `shared/gate.js`(공용 비밀번호 9800 + 자유 입력 이름)를 대신한다.

   왜 바꿨나
     비밀번호 하나를 전 직원이 나눠 쓰면 ① 누가 들어왔는지 알 수 없고,
     ② 퇴사자를 막을 방법이 없고, ③ 한 번 새면 되돌릴 방법이 비번 교체뿐이다.
     이름도 자유 입력이라 gate.js 스스로 「진위 보장 X」라고 적어 두었다.
     계정을 다 나눠 준 뒤에는 게이트가 지키는 것이 없고, 오히려
     **계정이 있는 사람도 9800 을 따로 알아야** 들어오는 걸림돌만 남았다.

   무엇을 하나
     - 로그인 세션이 없으면 로그인 화면으로 보낸다(`?next=` 로 돌아올 곳을 남긴다).
     - 승인 전(`active=false`)이면 들여보내지 않고 이유를 적는다.
     - 확인이 끝날 때까지 **본문을 그리지 않는다.** 잠깐이라도 보이면
       권한 없는 사람이 화면을 읽을 수 있고, 로그인 화면으로 튕기는 깜빡임도 생긴다.
     - 확인에 실패하면 **빈 화면으로 두지 않는다.** 이유와 [다시 시도]를 보여 준다.
       조용히 하얀 화면이면 사람은 「고장」이라고만 알고 손쓸 데가 없다.

   역할(sales/air/…)로는 문 앞에서 막지 않는다. 초대 기본 역할이 `air` 이고
   루트가 모두를 `/sales/` 로 보내므로, 허브마다 역할을 걸면 신규 직원이
   전부 문 앞에서 막힌다. 역할 차이는 서버 RLS 와 `admin/users/` 가 본다.

   사용법: <head> 안에서 본문보다 먼저 한 줄. 깊이는 상관없다.
     <script src="../shared/guard.js"></script>
     <script src="../../shared/guard.js"></script>

   의존 스크립트(supabase-config.js·access.js)는 이 파일이 알아서 부른다.
   페이지마다 세 줄을 맞춰 넣게 하면 어느 한 장에서 순서가 틀어져도
   조용히 안 막힌다 — 한 줄로 끝나야 빠뜨릴 자리가 없다.

   다른 스크립트에서:
     window.MT_USER.get()   → 로그인한 사람의 표시명(없으면 이메일 아이디)
     window.MT_USER.user()  → app_users 행 전체(id·email·name·role·active)
     window.MT_USER.logout()
     window.addEventListener('mt-user-change', e => e.detail.name)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 이 파일이 있는 shared/ 경로에서 나머지 주소를 만든다 ──
     페이지 깊이(1·2·3단계)마다 상대경로가 달라지는데, 그걸 페이지가
     계산하게 하면 새 도구를 넣을 때 틀린다. */
  var self = document.currentScript;
  var SHARED = (self && self.src ? self.src : '').replace(/[^/]*$/, '');   // .../shared/
  var BASE = SHARED.replace(/[^/]*\/$/, '');                                // .../ (저장소 루트)
  var LOGIN = BASE + 'login/';

  var LOGO_SVG = '<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 539.49 67.31"><g><g><polygon points="146.69 51.4 146.54 51.4 134.83 9.89 118.23 9.89 118.23 58.23 127.38 58.23 127.07 13.73 127.22 13.73 140.89 58.23 151.87 58.23 165.61 13.45 165.77 13.45 165.46 58.23 174.92 58.23 174.92 9.89 158.63 9.89 146.69 51.4" fill="#373f4a"/><polygon points="196.74 35.48 214.89 35.48 214.89 31.07 196.74 31.07 196.74 14.38 217.38 14.38 217.38 9.89 187.05 9.89 187.05 58.23 218.94 58.23 218.94 53.74 196.74 53.74 196.74 35.48" fill="#373f4a"/><rect x="277.51" y="9.89" width="9.7" height="48.33" fill="#373f4a"/><polygon points="296.11 14.47 311.12 14.47 311.12 58.23 320.81 58.23 320.81 14.47 335.9 14.47 335.9 9.89 296.11 9.89 296.11 14.47" fill="#373f4a"/><polygon points="343.94 14.5 358.95 14.5 358.95 58.23 368.65 58.23 368.65 14.5 383.74 14.5 383.74 9.89 343.94 9.89 343.94 14.5" fill="#373f4a"/><path d="M434.24,15.86a26.37,26.37,0,0,0-8.84-5.25,28.41,28.41,0,0,0-10.48-1.85,27.81,27.81,0,0,0-10.4,1.88A26.51,26.51,0,0,0,395.69,16a24.24,24.24,0,0,0-5.83,8.1,24.86,24.86,0,0,0-2.07,10.2,23.92,23.92,0,0,0,3.56,13,24.44,24.44,0,0,0,9.89,8.85,28.57,28.57,0,0,0,13.68,3.19,28,28,0,0,0,10.48-1.88,27.07,27.07,0,0,0,8.84-5.26,23.57,23.57,0,0,0,5.82-8,24.55,24.55,0,0,0,2.08-10.16,24.55,24.55,0,0,0-2.08-10.16A24.12,24.12,0,0,0,434.24,15.86ZM429.67,44.7a16.86,16.86,0,0,1-6.22,6.9,14.88,14.88,0,0,1-8.53,2.47,14.54,14.54,0,0,1-8.45-2.51,17,17,0,0,1-6.21-7.06A23.36,23.36,0,0,1,398,34.06a23.27,23.27,0,0,1,2.23-10.48,17,17,0,0,1,6.21-7A14.68,14.68,0,0,1,415,14.05a14.17,14.17,0,0,1,8.41,2.55,17.59,17.59,0,0,1,6.22,7.14,23.51,23.51,0,0,1,2.26,10.56A22.93,22.93,0,0,1,429.67,44.7Z" fill="#373f4a"/><path d="M481.23,43.93a10.81,10.81,0,0,1-2.51,7.36c-1.66,1.92-4.4,2.88-8.2,2.88s-6.48-1-8.18-3a11.12,11.12,0,0,1-2.54-7.46V9.89h-9.69V41.67A18.24,18.24,0,0,0,452.42,51a15.4,15.4,0,0,0,6.84,6.18,25.62,25.62,0,0,0,11.26,2.2,24.89,24.89,0,0,0,11.25-2.27,15.82,15.82,0,0,0,6.85-6.29,18.52,18.52,0,0,0,2.3-9.35V9.89h-9.69Z" fill="#373f4a"/><path d="M257.1,37.12a15.52,15.52,0,0,0,6.84-4.94,12.39,12.39,0,0,0,2.46-7.72,12.78,12.78,0,0,0-2.35-7.67,15.12,15.12,0,0,0-6.6-5.08,25.07,25.07,0,0,0-9.89-1.82h-18V58.23h9.7v-44H247c2.76,0,5,.23,6.78,1.6s3.85,3.35,3.32,8.93a8.25,8.25,0,0,1-2.32,5A10.28,10.28,0,0,1,250,32.32a25.34,25.34,0,0,1-6.29.74h-3.6L253.91,53h0l.44.62a12,12,0,0,0,3.14,3,13.5,13.5,0,0,0,2.6,1,41.48,41.48,0,0,0,8.05.67h.68L253.88,38.06A22.35,22.35,0,0,0,257.1,37.12Z" fill="#373f4a"/><path d="M84.43,0s-25-.23-42.24,18.8a17.14,17.14,0,0,0-1.73,2.37v-.06c-7,9.81-8,18.06-8,21.41,0,8.74,2.3,12.21,2.3,12.21,0-1.56.08-3.06.15-4.44a40.71,40.71,0,0,1,3.77-14.21q1.11-2,2.26-3.8c.22-.33.45-.66.62-.94,14.07-21,32.4-19.09,32.4-19.09s3,19-4.06,32.94S45.54,67.31,45.54,67.31H47C63.37,66,72.61,54,73.37,52.91,89.74,30,84.43,0,84.43,0Z" fill="#373f4a"/><path d="M15.38,45.19c-7-14-4.06-32.94-4.06-32.94S23.5,11,35.62,21.89a29.79,29.79,0,0,1,4.51-6.06C23.15-.19.82,0,.82,0S-4.49,30,11.88,52.91c.76,1,10,13.13,26.43,14.4h1.41S22.44,59.16,15.38,45.19Z" fill="#373f4a"/><path d="M527.76,37.12a15.4,15.4,0,0,0,6.84-4.94,12.34,12.34,0,0,0,2.47-7.72,12.85,12.85,0,0,0-2.35-7.67,15.15,15.15,0,0,0-6.61-5.08,25,25,0,0,0-9.89-1.82h-18V58.23h9.7v-44h7.74c2.76,0,5,.23,6.78,1.6s3.85,3.35,3.31,8.93a8.24,8.24,0,0,1-2.31,5,10.28,10.28,0,0,1-4.77,2.56,25.42,25.42,0,0,1-6.3.74H510.8L524.58,53h0l.43.62a12.05,12.05,0,0,0,3.15,3,13.5,13.5,0,0,0,2.6,1,41.42,41.42,0,0,0,8,.67h.68L524.55,38.06A22.21,22.21,0,0,0,527.76,37.12Z" fill="#373f4a"/></g></g></svg>';

  /* ── 확인이 끝날 때까지 본문을 감춘다 ──
     display:none 이 아니라 visibility 로 감춘다. display 를 끄면 레이아웃이
     0 이 되어, 폭·높이를 재서 그리는 표들이 확인 직후 잘못된 크기로 뜬다. */
  var hide = document.createElement('style');
  hide.id = 'mt-guard-hide';
  hide.textContent = 'body{visibility:hidden!important}#mt-guard{visibility:visible!important}';
  (document.head || document.documentElement).appendChild(hide);

  function reveal() {
    var s = document.getElementById('mt-guard-hide');
    if (s) s.remove();
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function whenBody(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ── 안내 카드 (게이트와 같은 모양을 유지한다) ────────────────── */
  function card(title, bodyHtml, buttons) {
    whenBody(function () {
      var old = document.getElementById('mt-guard');
      if (old) old.remove();
      var wrap = document.createElement('div');
      wrap.id = 'mt-guard';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.innerHTML = [
        '<style>',
        '#mt-guard{position:fixed;inset:0;z-index:2147483647;display:flex;',
        'align-items:center;justify-content:center;padding:24px;background:#F7F8FA;',
        "font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif;}",
        '#mt-guard *{box-sizing:border-box;}',
        '#mt-guard .g-card{width:100%;max-width:380px;background:#fff;border:1px solid #E3E5EA;',
        'border-radius:12px;box-shadow:0 8px 28px rgba(26,35,50,.12);padding:36px 32px 30px;text-align:center;}',
        '#mt-guard .logo{height:24px;width:auto;display:block;margin:0 auto 8px;}',
        '#mt-guard .g-sub{font-size:11px;color:#97A0AE;letter-spacing:.08em;',
        "font-family:'JetBrains Mono',monospace;margin-bottom:24px;}",
        '#mt-guard h2{margin:0 0 10px;font-size:16px;font-weight:700;color:#353C48;}',
        '#mt-guard p{margin:0;font-size:13px;color:#5A6472;line-height:1.7;}',
        '#mt-guard p b{color:#353C48;}',
        '#mt-guard .g-btns{margin-top:20px;display:flex;flex-direction:column;gap:8px;}',
        '#mt-guard button{width:100%;font-size:15px;font-weight:700;font-family:inherit;',
        'padding:13px;border:1px solid #E3E5EA;border-radius:8px;cursor:pointer;',
        'background:#fff;color:#5A6472;transition:background-color .15s;}',
        '#mt-guard button.pri{background:#353C48;color:#fff;border-color:#353C48;}',
        '#mt-guard button.pri:hover{background:#2A2F39;}',
        '#mt-guard button:not(.pri):hover{background:#F2F5F9;}',
        '#mt-guard .foot{margin-top:22px;font-size:11px;color:#97A0AE;line-height:1.6;}',
        '</style>',
        '<div class="g-card">',
        '  ' + LOGO_SVG,
        '  <div class="g-sub">INTERNAL TOOLS</div>',
        '  <h2>' + escHtml(title) + '</h2>',
        '  <p>' + bodyHtml + '</p>',
        '  <div class="g-btns"></div>',
        '  <div class="foot">사내 직원 전용 도구함입니다.</div>',
        '</div>'
      ].join('');
      document.body.appendChild(wrap);
      var box = wrap.querySelector('.g-btns');
      (buttons || []).forEach(function (b) {
        var el = document.createElement('button');
        el.type = 'button';
        el.textContent = b.label;
        if (b.primary) el.className = 'pri';
        el.addEventListener('click', b.fn);
        box.appendChild(el);
      });
    });
  }

  /* ── 로그인 화면으로 ──
     돌아올 곳은 로그인 페이지 기준 **상대경로**로 넘긴다. 절대주소를 넘기면
     로그인 화면이 열린 리다이렉트 방지 규칙에 걸려 기본값(/sales/)으로 가버린다. */
  function toLogin() {
    var here = location.pathname + location.search + location.hash;
    /* 오리진을 문자열로 떼어내지 말 것 — file:// 로 열어 보는 경우가 있고,
       그때 정규식이 안 맞아 next 가 조용히 빠진다(로그인 뒤 늘 /sales/ 로 간다). */
    var root = '/';
    try { root = new URL(BASE).pathname; } catch (e) {}      // /merittour-tools/
    var rel = here.indexOf(root) === 0 ? here.slice(root.length) : '';
    var next = rel ? '../' + rel : '';
    location.replace(LOGIN + (next ? '?next=' + encodeURIComponent(next) : ''));
  }

  /* ── 헤더의 사용자 배지 ────────────────────────────────────── */
  var CURRENT = null;

  function displayName(u) {
    if (!u) return '';
    if (u.name && String(u.name).trim()) return String(u.name).trim();
    return String(u.email || '').split('@')[0];
  }

  var ROLE_KO = { owner: '대표', admin: '관리자', manage: '관리', sales: '영업', air: '항공(읽기)' };

  function refreshHeader() {
    var name = displayName(CURRENT);
    var badge = document.getElementById('mtUserBadge');
    if (!badge) {
      var actions = document.querySelector('.header-actions') || document.querySelector('.header-right');
      if (!actions) return;
      badge = document.createElement('button');
      badge.id = 'mtUserBadge';
      badge.type = 'button';
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
    badge.title = CURRENT ? (CURRENT.email || '') : '';
    badge.innerHTML = '<span style="font-weight:700;color:#353C48">' + escHtml(name) + '</span> 님'
      + ' <span style="opacity:.5;font-size:10px">▾</span>';
  }

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
    m.style.cssText =
      'position:fixed;z-index:2147483645;min-width:200px;background:#fff;' +
      'border:1px solid #E3E5EA;border-radius:10px;padding:5px;' +
      'box-shadow:0 8px 24px rgba(26,35,50,.16);' +
      "font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif;" +
      'top:' + Math.round(r.bottom + 6) + 'px;' +
      'left:' + Math.round(Math.max(8, Math.min(r.right - 200, window.innerWidth - 208))) + 'px;';

    /* 누구로 로그인했는지 먼저 적는다. 공용 PC 에서 앞사람 계정으로
       남아 있는 것을 알아채는 자리가 여기밖에 없다. */
    var who = document.createElement('div');
    who.style.cssText = 'padding:9px 12px 10px;border-bottom:1px solid #EEF0F3;margin-bottom:4px;';
    who.innerHTML =
      '<div style="font-size:12.5px;font-weight:700;color:#353C48">' + escHtml(displayName(CURRENT)) + '</div>'
      + '<div style="font-size:11px;color:#97A0AE;margin-top:2px;word-break:break-all">'
      + escHtml((CURRENT && CURRENT.email) || '') + '</div>'
      + '<div style="font-size:11px;color:#5A6472;margin-top:4px">권한 · '
      + escHtml(ROLE_KO[CURRENT && CURRENT.role] || (CURRENT && CURRENT.role) || '') + '</div>';
    m.appendChild(who);

    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = '로그아웃';
    b.style.cssText =
      'display:block;width:100%;text-align:left;padding:9px 12px;border:none;' +
      'background:none;border-radius:7px;font-size:13.5px;font-weight:600;' +
      'font-family:inherit;cursor:pointer;color:#C0392B;';
    b.onmouseenter = function () { b.style.background = '#F2F5F9'; };
    b.onmouseleave = function () { b.style.background = 'none'; };
    b.addEventListener('click', function (e) { e.stopPropagation(); closeMenu(); doLogout(); });
    m.appendChild(b);

    document.body.appendChild(m);
    badge.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', closeMenu);
      document.addEventListener('keydown', onMenuKey);
      window.addEventListener('resize', closeMenu);
      window.addEventListener('scroll', closeMenu, true);
    }, 0);
  }

  function doLogout() {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    var done = function () { location.replace(LOGIN); };
    if (window.MT_AUTH && typeof window.MT_AUTH.logout === 'function') {
      window.MT_AUTH.logout().catch(function () {}).then(done);
    } else done();
  }

  /* ── 전역 노출 ──
     이름은 이제 계정에서 온다. 예전 gate.js 의 set()/prompt()(자유 입력 이름
     바꾸기)는 두지 않는다 — 표시명을 각자 PC 에서 고치면 「누가 올렸는지」가
     사람마다 달라진다. 바꿀 곳은 admin/users/ 한 곳이다. */
  window.MT_USER = {
    get: function () { return displayName(CURRENT); },
    user: function () { return CURRENT; },
    role: function () { return CURRENT ? CURRENT.role : ''; },
    logout: doLogout
  };

  /* ── 의존 스크립트 로드 ─────────────────────────────────────── */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error(src + ' 를 불러오지 못했습니다.')); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  function need(globalName, file) {
    if (window[globalName]) return Promise.resolve();
    return loadScript(SHARED + file);
  }

  /* ── 본 흐름 ─────────────────────────────────────────────────── */
  function fail(msg) {
    card('들어갈 수 없습니다', escHtml(msg), [
      { label: '다시 시도', primary: true, fn: function () { location.reload(); } },
      { label: '로그인 화면으로', fn: function () { location.replace(LOGIN); } }
    ]);
  }

  /* 확인이 오래 걸려도 하얀 화면으로 두지 않는다. */
  var settled = false;
  var slow = setTimeout(function () {
    if (!settled) {
      card('확인하는 중입니다', '로그인 상태를 확인하고 있습니다.<br>네트워크가 느리면 시간이 걸릴 수 있습니다.', [
        { label: '로그인 화면으로', fn: function () { location.replace(LOGIN); } }
      ]);
    }
  }, 4000);

  need('MT_SB', 'supabase-config.js')
    .then(function () { return need('MT_AUTH', 'access.js'); })
    .then(function () {
      if (!window.MT_AUTH || !window.MT_AUTH.configured || !window.MT_AUTH.configured()) {
        /* 설정이 없으면 확인할 방법이 없다. 열어 주는 쪽으로 기울지 않는다. */
        throw new Error('접속 설정이 비어 있어 로그인을 확인할 수 없습니다. 관리자에게 알려 주세요.');
      }
      return window.MT_AUTH.me();
    })
    .then(function (u) {
      settled = true; clearTimeout(slow);
      if (!u) {
        /* 세션이 없거나, 로그인은 됐는데 app_users 에 행이 아직 없다.
           둘 다 로그인 화면이 알맞다 — 그쪽이 초대·승인 흐름을 안내한다. */
        toLogin();
        return;
      }
      if (!u.active) {
        CURRENT = u;
        card('승인 대기 중입니다',
          '<b>' + escHtml(displayName(u)) + '</b> 님의 계정은 만들어졌지만<br>'
          + '아직 <b>사용 승인이 나지 않았습니다.</b><br>관리자에게 승인을 요청해 주세요.',
          [{ label: '다른 계정으로 로그인', primary: true, fn: doLogout }]);
        return;
      }
      CURRENT = u;
      reveal();
      whenBody(function () {
        refreshHeader();
        try {
          window.dispatchEvent(new CustomEvent('mt-user-change', { detail: { name: displayName(u), user: u } }));
        } catch (e) {}
      });
    })
    .catch(function (e) {
      settled = true; clearTimeout(slow);
      fail((e && e.message) || '로그인을 확인하지 못했습니다.');
    });
})();
