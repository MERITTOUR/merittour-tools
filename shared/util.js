/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 공통 유틸 엔진  (shared/util.js)
   notify · inquiry · saizen 에 중복돼 있던 함수를 한 곳으로 모았습니다.
   사용법: 각 도구 HTML 에
     <script src="../../shared/util.js"></script>
   를 넣고, 함수는 MT.pad2(...) 처럼 MT 네임스페이스로 호출합니다.
   (전역 오염을 막기 위해 window.MT 하나에만 붙습니다.)
   ════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const MT = global.MT || (global.MT = {});

  /* ── 숫자 / 문자 ─────────────────────────────────────────── */

  // 두 자리 0 채움: 5 → "05"
  MT.pad2 = n => String(n).padStart(2, '0');

  // HTML 본문 이스케이프
  MT.escHtml = s => String(s == null ? '' : s)
    .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // 속성값 이스케이프 (따옴표 포함)
  MT.escAttr = s => String(s == null ? '' : s)
    .replace(/["&<>]/g, c => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // 숫자 파싱: 콤마·공백·기호 제거 후 Number. 실패 시 0.
  MT.num = v => {
    if (v == null || v === '') return 0;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  /* ── 날짜 ────────────────────────────────────────────────────
     UTC 오프셋 버그를 피하려고 항상 로컬 기준(getFullYear/Month/Date)을
     씁니다. toISOString() 은 쓰지 않습니다. (SaiZen 개발 교훈)         */

  // 다양한 입력(Date · "2026-05-01" · "2026.5.1" · 엑셀시리얼)을 Date 로.
  MT.parseLocalDate = v => {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    // 엑셀 시리얼 숫자 (1900 기준)
    if (typeof v === 'number' || /^\d{4,6}$/.test(String(v).trim())) {
      const serial = Number(v);
      if (serial > 59 && serial < 200000) {
        const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
    }
    const s = String(v).trim().replace(/[.\/]/g, '-').replace(/-+/g, '-').replace(/-$/, '');
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };

  // → "YYYY-MM-DD" (정렬·키 용)
  MT.normalizeDate = v => {
    const d = MT.parseLocalDate(v);
    if (!d) return '';
    return `${d.getFullYear()}-${MT.pad2(d.getMonth() + 1)}-${MT.pad2(d.getDate())}`;
  };

  // → "YYYY.MM.DD" (표시용)
  MT.fmtDate = v => {
    const d = MT.parseLocalDate(v);
    if (!d) return '';
    return `${d.getFullYear()}.${MT.pad2(d.getMonth() + 1)}.${MT.pad2(d.getDate())}`;
  };

  // → "M/D" (짧은 표시)
  MT.fmtDateShort = v => {
    const d = MT.parseLocalDate(v);
    if (!d) return '';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 요일: 0=일 … 6=토 → "일".."토"
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  MT.getWD = v => {
    const d = MT.parseLocalDate(v);
    return d ? WD[d.getDay()] : '';
  };
  MT.isWeekend = v => {
    const d = MT.parseLocalDate(v);
    if (!d) return false;
    const w = d.getDay();
    return w === 0 || w === 6;
  };

  // 두 날짜 사이 개월 수 (여권 만료 점검 등). d2 - d1, 음수 가능.
  MT.monthsBetween = (d1, d2) => {
    const a = MT.parseLocalDate(d1), b = MT.parseLocalDate(d2);
    if (!a || !b) return null;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
      + (b.getDate() >= a.getDate() ? 0 : -1);
  };

  MT.today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

  /* ── 전화번호 ────────────────────────────────────────────── */

  // 숫자만 남김: "010-1234-5678" → "01012345678"
  MT.cleanPhone = p => String(p == null ? '' : p).replace(/[^0-9]/g, '');

  // 보기 좋게: "01012345678" → "010-1234-5678"
  MT.fmtPhone = p => {
    const n = MT.cleanPhone(p);
    if (n.length === 11) return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
    return n;
  };

  /* ── 토스트 (core.css .mt-toast 와 연동) ─────────────────── */
  MT.showToast = (msg, ms) => {
    let host = document.querySelector('.mt-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'mt-toast-host';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'mt-toast';
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 250);
    }, ms || 2200);
  };

})(window);
