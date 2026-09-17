/* ── 문안 복사 상자 (shared/copybox.js) ──────────────────────────────
   고객에게 보내는 문안(카카오톡 · 메일 · 문자)을 한 자리에서 보여 주고 복사하게 한다.
   문안 자체는 부르는 쪽(가입 서류 자료실 · 영업 허브)이 들고 있고, 이 파일은 상자만 그린다 —
   그래야 같은 문안이 화면마다 다르게 적히지 않는다.

   쓰는 법
     <script src="../../shared/copybox.js"></script>
     MT_COPYBOX.open({
       title: '가입 서류 안내 문안',
       note:  '○○○ 자리는 고객 성함·담당자 이름으로 바꿔 보내세요.',
       tabs:  [{ key: 'kakao', label: '카카오톡', body: '…' },
               { key: 'mail',  label: '메일', subject: '[메리트투어] …', body: '…' }],
       active: 'mail'
     });
   - subject 가 있는 탭은 제목 칸과 [제목 복사] 가 따로 생긴다(메일은 제목을 따로 붙여 넣는다).
   - 본문 칸은 고칠 수 있다(보내기 전에 고객 이름을 채운다). 탭을 옮기면 고친 것은 남지 않는다.
   - Esc · 바깥 클릭 · × 로 닫는다. 닫으면 열 때 초점이 있던 곳으로 돌려준다.
   - 브라우저 clipboard API 가 막혀 있으면 textarea 를 선택해 execCommand 로 복사한다.
   ─────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  var CSS = [
    '.mt-copybox-back{position:fixed;inset:0;background:rgba(20,24,32,.48);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px}',
    '.mt-copybox{background:var(--mt-surface,#fff);color:var(--mt-text,#1a2740);border:1px solid var(--mt-border,#dfe3ea);border-radius:14px;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.25);width:min(760px,100%);max-height:min(92vh,900px);display:flex;flex-direction:column;overflow:hidden;font-family:var(--mt-sans,inherit)}',
    '.mt-copybox-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--mt-border,#dfe3ea)}',
    '.mt-copybox-title{font-size:15px;font-weight:800;flex:1;color:var(--mt-brand,#1a2740)}',
    '.mt-copybox-x{background:none;border:0;font-size:22px;line-height:1;cursor:pointer;color:var(--mt-text3,#8a93a3);padding:2px 6px;border-radius:6px}',
    '.mt-copybox-x:hover{color:var(--mt-text,#1a2740);background:var(--mt-surface2,#f3f5f8)}',
    '.mt-copybox-tabs{display:flex;gap:6px;padding:10px 18px 0;flex-wrap:wrap}',
    '.mt-copybox-tab{border:1px solid var(--mt-border,#dfe3ea);background:var(--mt-surface2,#f3f5f8);color:var(--mt-text2,#4a5568);padding:6px 14px;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer}',
    '.mt-copybox-tab.on{background:var(--mt-accent,#1a2740);border-color:var(--mt-accent,#1a2740);color:#fff}',
    '.mt-copybox-body{padding:12px 18px 16px;display:flex;flex-direction:column;gap:10px;overflow:auto}',
    '.mt-copybox-row{display:flex;gap:8px;align-items:center}',
    '.mt-copybox-lab{font-size:11px;font-weight:800;color:var(--mt-text2,#4a5568);letter-spacing:.04em;width:34px;flex-shrink:0}',
    '.mt-copybox-subj{flex:1;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--mt-border,#dfe3ea);border-radius:8px;background:var(--mt-surface,#fff);color:inherit;min-width:0}',
    '.mt-copybox-text{width:100%;min-height:300px;flex:1;font:inherit;font-size:13px;line-height:1.6;padding:12px 14px;border:1px solid var(--mt-border,#dfe3ea);border-radius:10px;',
    '  background:var(--mt-surface2,#f8f9fb);color:inherit;resize:vertical;white-space:pre-wrap}',
    '.mt-copybox-note{font-size:11.5px;color:var(--mt-text3,#8a93a3);line-height:1.6}',
    '.mt-copybox-foot{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:0 18px 16px;flex-wrap:wrap}',
    '.mt-copybox-meta{font-size:11px;color:var(--mt-text3,#8a93a3);font-family:var(--mt-mono,monospace);margin-right:auto}',
    '.mt-copybox-btn{border:1.5px solid var(--mt-border2,#c9d0dc);background:var(--mt-surface,#fff);color:var(--mt-text,#1a2740);padding:9px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}',
    '.mt-copybox-btn.primary{background:var(--mt-accent,#1a2740);border-color:var(--mt-accent,#1a2740);color:#fff}',
    '.mt-copybox-btn:hover{filter:brightness(1.06)}',
    '.mt-copybox-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--mt-brand2,#1a2740);color:#fff;padding:10px 18px;border-radius:22px;font-size:13px;z-index:901;opacity:0;transition:opacity .2s;pointer-events:none}',
    '.mt-copybox-toast.show{opacity:1}',
    '@media (max-width:600px){.mt-copybox-back{padding:0;align-items:stretch}.mt-copybox{width:100%;max-height:100vh;border-radius:0}.mt-copybox-text{min-height:220px}}'
  ].join('\n');

  var state = { back: null, opener: null, tabs: [], active: 0, toastTimer: null };

  function ensureCss() {
    if (document.getElementById('mt-copybox-css')) return;
    var s = document.createElement('style');
    s.id = 'mt-copybox-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function bytesEucKr(s) {                    // 문자(LMS) 길이 감각용 — 한글 2바이트 · ASCII 1바이트
    var n = 0;
    for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) <= 0x7f ? 1 : 2;
    return n;
  }

  function toast(msg) {
    var t = document.getElementById('mt-copybox-toast');
    if (!t) { t = el('div', 'mt-copybox-toast'); t.id = 'mt-copybox-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function copyText(text, from) {
    var done = function () { toast('복사했습니다'); };
    var fail = function () {
      try {
        if (from) { from.focus(); from.select(); }
        if (document.execCommand('copy')) { done(); return; }
      } catch (e) { /* 아래 안내 */ }
      toast('복사가 막혀 있습니다 — 본문을 직접 선택해 복사해 주세요');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else fail();
  }

  function render() {
    var tab = state.tabs[state.active];
    var body = state.back.querySelector('.mt-copybox-body');
    var tabs = state.back.querySelectorAll('.mt-copybox-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', i === state.active);
    body.innerHTML = '';

    var subjInput = null;
    if (tab.subject != null) {
      var row = el('div', 'mt-copybox-row');
      row.appendChild(el('span', 'mt-copybox-lab', '제목'));
      subjInput = el('input', 'mt-copybox-subj'); subjInput.value = tab.subject;
      var sb = el('button', 'mt-copybox-btn', '제목 복사'); sb.type = 'button';
      sb.addEventListener('click', function () { copyText(subjInput.value, subjInput); });
      row.appendChild(subjInput); row.appendChild(sb);
      body.appendChild(row);
    }

    var ta = el('textarea', 'mt-copybox-text'); ta.value = tab.body || '';
    ta.setAttribute('aria-label', tab.label + ' 문안');
    body.appendChild(ta);
    if (state.note) body.appendChild(el('div', 'mt-copybox-note', state.note));

    var foot = state.back.querySelector('.mt-copybox-foot');
    foot.innerHTML = '';
    var meta = el('span', 'mt-copybox-meta');
    var refresh = function () { meta.textContent = ta.value.length + '자 · ' + bytesEucKr(ta.value) + '바이트'; };
    ta.addEventListener('input', refresh); refresh();
    foot.appendChild(meta);
    var closeB = el('button', 'mt-copybox-btn', '닫기'); closeB.type = 'button';
    closeB.addEventListener('click', close);
    var copyB = el('button', 'mt-copybox-btn primary', '본문 복사'); copyB.type = 'button';
    copyB.addEventListener('click', function () { copyText(ta.value, ta); });
    foot.appendChild(closeB); foot.appendChild(copyB);
    setTimeout(function () { try { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; } catch (e) { /* 무시 */ } }, 0);
  }

  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }

  function open(opts) {
    opts = opts || {};
    ensureCss();
    close();
    state.opener = document.activeElement;
    state.tabs = (opts.tabs || []).filter(function (t) { return t && (t.body != null); });
    if (!state.tabs.length) return;
    state.note = opts.note || '';
    state.active = Math.max(0, state.tabs.map(function (t) { return t.key; }).indexOf(opts.active));

    var back = el('div', 'mt-copybox-back');
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    var box = el('div', 'mt-copybox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    var head = el('div', 'mt-copybox-head');
    head.appendChild(el('div', 'mt-copybox-title', opts.title || '문안'));
    var x = el('button', 'mt-copybox-x', '×'); x.type = 'button'; x.setAttribute('aria-label', '닫기');
    x.addEventListener('click', close);
    head.appendChild(x);
    box.appendChild(head);

    var tabs = el('div', 'mt-copybox-tabs');
    state.tabs.forEach(function (t, i) {
      var b = el('button', 'mt-copybox-tab', t.label || t.key); b.type = 'button';
      b.addEventListener('click', function () { state.active = i; render(); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    box.appendChild(el('div', 'mt-copybox-body'));
    box.appendChild(el('div', 'mt-copybox-foot'));
    back.appendChild(box);
    document.body.appendChild(back);
    state.back = back;
    document.addEventListener('keydown', onKey);
    render();
  }

  function close() {
    if (!state.back) return;
    document.removeEventListener('keydown', onKey);
    state.back.remove();
    state.back = null;
    if (state.opener && state.opener.focus) { try { state.opener.focus(); } catch (e) { /* 무시 */ } }
    state.opener = null;
  }

  root.MT_COPYBOX = { open: open, close: close, isOpen: function () { return !!state.back; }, bytesEucKr: bytesEucKr };
})(typeof window !== 'undefined' ? window : this);
