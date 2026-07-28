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

  /* ── 호텔 블록 · 기간별 보유 예외 ────────────────────────── */

  // 예외 1건 유효성: 룸타입·시작·종료가 있고 종료 >= 시작, 수량은 0 이상 정수
  MT.roomExcValid = e => {
    if (!e || !e.room || !e.from || !e.to) return false;
    if (String(e.to) < String(e.from)) return false;
    // qty 미입력(null/undefined/'')은 무효. Number(null)===0 이라 명시적으로 걸러야 한다.
    if (e.qty === null || e.qty === undefined || String(e.qty).trim() === '') return false;
    return Number.isFinite(Number(e.qty)) && Number(e.qty) >= 0;
  };

  // 기간 길이(일). from~to 포함. 잘못된 예외는 Infinity(= 절대 이기지 못함)
  MT.roomExcSpan = e => {
    if (!MT.roomExcValid(e)) return Infinity;
    const a = Date.parse(e.from + 'T00:00:00Z'), b = Date.parse(e.to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.round((b - a) / 86400000) + 1;
  };

  // ymd(YYYY-MM-DD)에 적용될 예외 1건을 고른다.
  // 우선순위: 기간이 짧은 쪽이 이김. 길이가 같으면 나중에 등록한 쪽(배열 뒤)이 이김.
  // 적용 대상 없으면 null.
  MT.pickRoomException = (exceptions, room, ymd) => {
    if (!Array.isArray(exceptions) || !room || !ymd) return null;
    let best = null, bestSpan = Infinity;
    exceptions.forEach(e => {
      if (!MT.roomExcValid(e)) return;
      if (e.room !== room) return;
      if (ymd < String(e.from) || ymd > String(e.to)) return;
      const span = MT.roomExcSpan(e);
      if (span <= bestSpan) { best = e; bestSpan = span; }   // 같은 길이면 뒤엣것이 이김
    });
    return best;
  };

  // 그날의 마스터 보유 = 기간 예외가 걸리면 그 수량, 아니면 기본 보유.
  // 기본 보유가 없으면(룸타입 미등록) null — 예외만 있는 룸타입도 유효하게 취급한다.
  // 반환: {qty, exc} — exc가 있으면 예외에서 나온 값. 조회 불가면 null.
  MT.roomCapOn = (baseRooms, exceptions, room, ymd) => {
    const exc = MT.pickRoomException(exceptions, room, ymd);
    if (exc) return { qty: Number(exc.qty), exc };
    const base = baseRooms && baseRooms[room];
    return (base != null) ? { qty: Number(base), exc: null } : null;
  };

  // 같은 룸타입에서 길이가 같은 채로 겹치는 예외 쌍이 있으면 그 id 목록을 돌려준다(경고용).
  MT.roomExcConflicts = exceptions => {
    if (!Array.isArray(exceptions)) return [];
    const bad = new Set();
    const v = exceptions.filter(MT.roomExcValid);
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const a = v[i], b = v[j];
      if (a.room !== b.room) continue;
      if (String(a.to) < String(b.from) || String(b.to) < String(a.from)) continue;  // 안 겹침
      if (MT.roomExcSpan(a) !== MT.roomExcSpan(b)) continue;                          // 길이 다르면 승부남
      bad.add(a.id); bad.add(b.id);
    }
    return [...bad];
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

})(typeof window !== 'undefined' ? window
   : typeof globalThis !== 'undefined' ? globalThis : this);

/* Node(단위 테스트)에서 require 가능하도록 — 브라우저 동작에는 영향 없음 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof globalThis !== 'undefined' ? globalThis : this).MT;
}

