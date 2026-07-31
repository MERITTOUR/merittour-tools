/* ════════════════════════════════════════════════════════════════
   MERITTOUR — 오른쪽 섹션 표시줄 (shared/section-rail.js)

   긴 한 장짜리 페이지에서 「지금 어디를 보고 있는지」를 오른쪽에 표시하고,
   눌러서 그 자리로 이동한다. 페이지를 고치지 않아도 되게, 제목을 스스로
   찾아 id 를 붙인다.

   쓰는 법 — </body> 앞에 한 줄:
     <script src="/merittour-tools/shared/section-rail.js" defer></script>

   같은 도메인(merittour.github.io)이면 다른 사이트에서 불러도 된다.

   조정이 필요하면 script 태그에 붙인다:
     data-headings="h2"          제목 선택자 (기본 "h2")
     data-scope="main"           찾을 범위 (기본 main → article → body 순)
     data-min="1100"             이 폭 이상이면 글자까지 보이는 넓은 줄 (기본 1100)
     data-max-label="18"         글자 수 제한 (기본 18)
     data-skip=".no-rail"        건너뛸 제목
     data-offset="0"             고정 헤더 높이(px). 이동 위치가 가려지면 넣는다

   좁은 화면에서도 표시줄은 남는다 — 점만 있는 줄로 바뀌고, 지금 보는
   칸에만 이름표가 뜬다. 본문을 덮지 않도록 오른쪽 끝에 붙는다.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  var D = (S && S.dataset) || {};

  var HEADINGS = D.headings || 'h2';
  var SCOPE    = D.scope || '';
  var MINW     = Number(D.min || 1100);
  var MAXLABEL = Number(D.maxLabel || 18);
  var SKIP     = D.skip || '';
  var OFFSET   = Number(D.offset || 0);
  var MIN_ITEMS = 3;              // 두어 개짜리 페이지에 줄을 세우면 거추장스럽다

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var scope = SCOPE ? document.querySelector(SCOPE)
              : (document.querySelector('main') || document.querySelector('article') || document.body);
    if (!scope) return;

    var heads = [].slice.call(scope.querySelectorAll(HEADINGS)).filter(function (h) {
      if (SKIP && h.matches && h.matches(SKIP)) return false;
      if (h.closest && h.closest('[data-no-rail]')) return false;
      return (h.textContent || '').trim().length > 0;
    });
    if (heads.length < MIN_ITEMS) return;

    /* id 가 없으면 붙인다 — 원래 있던 id 는 건드리지 않는다(기존 링크가 깨진다) */
    var used = {};
    var items = heads.map(function (h, i) {
      if (!h.id) {
        var slug = (h.textContent || '').trim().toLowerCase()
          .replace(/[^가-힣a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
        var base = 'sec-' + (slug || (i + 1));
        var id = base, n = 2;
        while (document.getElementById(id) || used[id]) id = base + '-' + (n++);
        h.id = id;
      }
      used[h.id] = true;
      var full = (h.textContent || '').trim().replace(/\s+/g, ' ');
      return { el: h, id: h.id, full: full,
               label: full.length > MAXLABEL ? full.slice(0, MAXLABEL - 1) + '…' : full };
    });

    inject();
    var nav = build(items);
    document.body.appendChild(nav);

    var links = [].slice.call(nav.querySelectorAll('a'));
    var cur = -1;

    /* 화면 위쪽 38% 선을 지난 마지막 제목이 「지금 보는 곳」이다.
       문서 끝에서는 마지막 항목으로 — 짧은 마지막 절이 기준선에 영영
       안 닿아 한 번도 안 짚이는 것을 막는다. */
    function current() {
      var line = window.innerHeight * 0.38 + OFFSET, best = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i].el.getBoundingClientRect().top - line <= 0) best = i;
      }
      var doc = document.documentElement;
      if (window.innerHeight + (window.pageYOffset || doc.scrollTop) >= doc.scrollHeight - 4) best = items.length - 1;
      return best;
    }
    /* 좁은 화면에서는 이름표를 잠깐만 보여 주고 접는다.
       계속 펼쳐 두면 오른쪽 본문 글자를 덮는다(실제로 덮었다). */
    var narrow = window.matchMedia ? window.matchMedia('(max-width:' + (MINW - 1) + 'px)') : null;
    var peekTimer = null;
    function peek() {
      if (!narrow || !narrow.matches) return;
      nav.classList.add('peek');
      clearTimeout(peekTimer);
      peekTimer = setTimeout(function () { nav.classList.remove('peek'); }, 1400);
    }

    function apply() {
      var i = current();
      if (i === cur) return;
      cur = i;
      for (var k = 0; k < links.length; k++) {
        var on = k === i;
        links[k].classList.toggle('on', on);
        if (on) links[k].setAttribute('aria-current', 'true');
        else links[k].removeAttribute('aria-current');
      }
      peek();
    }
    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; apply(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    apply();

    /* 고정 헤더가 있는 페이지에서 이동 지점이 가려지지 않게 */
    if (OFFSET > 0) items.forEach(function (it) { it.el.style.scrollMarginTop = (OFFSET + 12) + 'px'; });

    function build(list) {
      var n = document.createElement('nav');
      n.className = 'mt-rail';
      n.setAttribute('aria-label', '섹션 바로가기');
      n.innerHTML = list.map(function (it, i) {
        return '<a href="#' + it.id + '" title="' + esc(it.full) + '">'
             + '<i aria-hidden="true"></i>'
             + '<span class="mt-rail-n">' + pad(i + 1) + '</span>'
             + '<span class="mt-rail-t">' + esc(it.label) + '</span></a>';
      }).join('');
      return n;
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function inject() {
      if (document.getElementById('mt-rail-css')) return;
      var css = document.createElement('style');
      css.id = 'mt-rail-css';
      css.textContent = [
        /* 이동은 기본 앵커 + smooth 에 맡긴다. 스크립트로 가로채면 뒤로가기와
           「애니메이션 줄이기」 설정이 같이 깨진다. */
        '@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}',
        '.mt-rail{position:fixed;top:50%;transform:translateY(-50%);z-index:900;',
        '  font:600 12.5px/1.35 "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;',
        '  -webkit-font-smoothing:antialiased}',
        '.mt-rail a{display:flex;align-items:center;gap:7px;text-decoration:none;',
        '  color:rgba(120,128,138,.85);padding:5px 0;transition:color .15s}',
        '.mt-rail a i{width:2px;height:15px;border-radius:2px;flex:none;',
        '  background:currentColor;opacity:.32;transition:opacity .15s,height .15s}',
        '.mt-rail a.on{color:#2E5A88}',
        '.mt-rail a.on i{opacity:1;height:19px}',
        '.mt-rail a:hover{color:#2E5A88}',
        '.mt-rail-n{font-size:10.5px;letter-spacing:.06em;opacity:.7;font-variant-numeric:tabular-nums}',
        /* 넓은 화면 — 글자까지 */
        '@media (min-width:' + MINW + 'px){',
        '  .mt-rail{right:max(18px,calc((100vw - 1100px) / 2 - 40px));max-width:190px}',
        '  .mt-rail-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '}',
        /* 좁은 화면 — 표시줄은 남기되 점만. 오른쪽 끝에 붙는다.
           이름표는 절이 바뀔 때 잠깐 떴다가 접힌다. 계속 펼쳐 두면
           오른쪽 본문 글자를 덮는다. 손대면(hover·focus) 다시 펼친다. */
        '@media (max-width:' + (MINW - 1) + 'px){',
        /* 화면 오른쪽 여백 안에 들어가게 바싹 붙인다 — 좁은 화면에서는
           본문 칸이 넓어 조금만 나와도 글자 위에 얹힌다 */
        '  .mt-rail{right:2px}',
        '  .mt-rail a{gap:0;padding:6px 1px;justify-content:flex-end}',
        '  .mt-rail a i{width:11px;height:2px}',
        '  .mt-rail a.on i{width:16px;height:2px}',
        '  .mt-rail-n{display:none}',
        '  .mt-rail-t{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
        '    opacity:0;margin:0;order:-1;border-radius:6px;padding:0;',
        '    transition:max-width .22s,opacity .22s,margin .22s,padding .22s}',
        '  .mt-rail.peek a.on .mt-rail-t,',
        '  .mt-rail:hover a.on .mt-rail-t,',
        '  .mt-rail:focus-within a.on .mt-rail-t{max-width:42vw;opacity:1;margin-right:7px;padding:2px 7px;',
        '    background:rgba(255,255,255,.94);color:#2E5A88;',
        '    box-shadow:0 1px 6px rgba(20,30,45,.14)}',
        '}',
        /* 아주 낮은 화면(가로로 눕힌 휴대폰)에서는 자리가 안 나온다 */
        '@media (max-height:420px){.mt-rail{display:none}}',
        '@media (prefers-color-scheme:dark){',
        '  .mt-rail a{color:rgba(170,180,192,.8)}',
        '  .mt-rail a.on,.mt-rail a:hover{color:#8FB4DC}',
        '  .mt-rail.peek a.on .mt-rail-t,',
        '  .mt-rail:hover a.on .mt-rail-t,',
        '  .mt-rail:focus-within a.on .mt-rail-t{background:rgba(24,30,40,.94);color:#8FB4DC}',
        '}',
        '@media print{.mt-rail{display:none}}'
      ].join('\n');
      document.head.appendChild(css);
    }
  });
})();
