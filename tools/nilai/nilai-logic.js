/* ════════════════════════════════════════════════════════════════
   MERITTOUR 닐라이스프링스 견적서·확정서 — 계산 · 문서 HTML · 알림톡 문안
   (tools/nilai/nilai-logic.js)

   UMD: 브라우저 전역 MT_NILAI + Node require(tests/nilai.test.mjs).
   DOM 을 만지지 않는다 — 화면(index.html)은 이 모듈이 돌려주는 값만 그린다.

   왜 따로 두나 — 계산(박수 · 요금 · 잔금 기한)과 손님에게 나가는 문서 문안이
   화면 코드 안에 흩어지면 검사할 수 없다. 숫자가 틀리면 손님 문서가 틀린다.
   ════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MT_NILAI = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── 리조트 고정 정보 (손님 문서에 찍히는 공개 사실만) ── */
  var RESORT = {
    key: 'nilai',
    nameKo: '닐라이스프링스 리조트',
    nameEn: 'Nilai Springs Golf & Country Club',
    golf: '닐라이스프링스CC (18홀)',
    region: '말레이시아 · 쿠알라룸푸르 근교 닐라이',
    airportOut: '인천국제공항',
    airportIn: '쿠알라룸푸르 국제공항(KLIA)',
    product: '말레이시아 닐라이스프링스 골프'
  };

  var KIND_LABEL = { quote: '견적서', confirm: '확정서' };
  var KIND_TITLE = { quote: '견 적 서', confirm: '확 정 서' };
  var KIND_SUB = {
    quote: '예상 일정과 금액을 안내드립니다 · 예약금 입금 시 예약이 확정됩니다',
    confirm: '예약이 확정되었습니다 · 출발 전 아래 내용을 확인하여 주시기 바랍니다'
  };

  /* 입력 기본값 — 화면이 새 문서를 열 때 채운다. 담당자가 고칠 수 있다. */
  var DEFAULTS = {
    kind: 'confirm',
    room: '트윈 (2인 1실)',
    meals: '조식 포함 (리조트 조식)',
    transfer: '쿠알라룸푸르 국제공항(KLIA) ↔ 리조트 왕복 송영 포함',
    roundNote: '매일 18홀 · 2인 1카트',
    depositPP: 300000,
    staffTel: '02-365-9800',
    kakao: 'https://pf.kakao.com/_dxhWus/chat',
    acct: { bank: '국민은행', no: '817201-04-109230', holder: '㈜메리트투어' }
  };

  /* 유의사항 — 1인 원화 금액으로 정한 상품의 규칙(docs/confirm_2027_notice.md §1 끝줄).
     환율 산정 규칙(출발월 두 달 전 환율)은 적용하지 않는다. */
  function defaultNotes(kind) {
    var list = [
      '본 ' + KIND_LABEL[kind] + '의 요금은 원화로 안내된 확정 금액이며, 환율 변동에 따른 추가 청구나 차액 정산은 없습니다.',
      '항공 · 송영 · 숙박 · 라운딩은 하나의 일정으로 준비됩니다. 회원님 사정으로 포함 서비스를 이용하지 않으시더라도 그 부분의 요금은 제외 · 환불되지 않으며, 정해진 일정 밖의 이동은 회원님의 책임으로 진행됩니다.',
      '예약 변경 · 취소는 국외여행 표준약관을 따릅니다. 다만 항공권과 리조트는 항공사 · 리조트의 규정이 우선 적용되며, 해당하는 경우 담당자가 미리 안내드립니다.',
      '예약금 입금 후 항공권 발권이 진행됩니다. 발권 후 취소 · 변경 시 항공사 규정에 따른 수수료가 발생합니다.',
      '라운딩 시간은 일몰 · 골프장 사정에 따라 짧아질 수 있으며, 천재지변 또는 골프장 사정으로 라운딩이 불가한 경우 환불되지 않고 대체 프로그램으로 진행됩니다.',
      '객실은 예약 순서를 기준으로 배정되며, 객실 종류와 시설은 예약 상황에 따라 조정될 수 있습니다.',
      '여권 유효기간은 입국일 기준 6개월 이상 남아 있어야 합니다. 말레이시아 입국 시 전자입국신고(MDAC)를 출발 전 온라인으로 제출하여 주시기 바랍니다.',
      '잔금은 출발 30일 전까지 납부하여 주시기 바랍니다.'
    ];
    if (kind === 'quote') list.unshift('본 견적은 발행일 기준이며, 항공 좌석과 객실 상황에 따라 달라질 수 있습니다. 예약금 입금 시 예약이 확정됩니다.');
    return list;
  }

  /* ── 날짜 · 숫자 ── */
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function parseDate(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function ymd(d) { return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : ''; }
  function fmtDate(d) { return d ? d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' (' + DOW[d.getDay()] + ')' : ''; }
  function fmtMD(d) { return d ? pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' (' + DOW[d.getDay()] + ')' : ''; }
  function won(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR') + '원'; }
  function num(v, fallback) {
    if (v === '' || v == null) return fallback;
    var n = Number(String(v).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? fallback : n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lines(s) { return String(s || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean); }

  /* 문서 번호 — NS-연월일-순번 (예 NS-261001-01). 순번은 화면이 그날 저장된 수 + 1 로 정한다. */
  function docNo(date, seq) {
    var d = date instanceof Date ? date : (parseDate(date) || new Date());
    return 'NS-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(Math.max(1, Number(seq) || 1));
  }

  /* ── 계산 ──
     박수 기본값 = 일수 − 2 (야간 비행이라 3박 5일 · 5박 7일 — tools/booking 의 longHaul 규칙).
     담당자가 박수를 직접 적으면 그 값을 쓴다. */
  function calc(d) {
    d = d || {};
    var dep = parseDate(d.dep), ret = parseDate(d.ret);
    var days = (dep && ret && ret >= dep) ? Math.round((ret - dep) / 86400000) + 1 : 0;
    var nights = num(d.nights, null);
    if (nights == null) nights = days >= 3 ? days - 2 : Math.max(0, days - 1);
    var pax = Math.max(0, Math.round(num(d.pax, 0)));
    var rooms = num(d.rooms, null); if (rooms == null) rooms = Math.ceil(pax / 2);
    var rounds = num(d.rounds, null); if (rounds == null) rounds = nights;
    var pricePP = Math.max(0, num(d.pricePP, 0));
    var base = pricePP * pax;
    var extras = (d.extras || []).map(function (x) {
      return { label: String(x.label || '').trim(), amount: num(x.amount, 0), qty: Math.max(1, Math.round(num(x.qty, 1))) };
    }).filter(function (x) { return x.label || x.amount; });
    var extraSum = extras.reduce(function (s, x) { return s + x.amount * x.qty; }, 0);
    var discount = Math.max(0, num(d.discount, 0));
    var total = Math.max(0, base + extraSum - discount);
    var depositPP = num(d.depositPP, null); if (depositPP == null) depositPP = DEFAULTS.depositPP;
    var deposit = Math.min(total, Math.max(0, depositPP) * pax);
    var balance = Math.max(0, total - deposit);
    var dueDate = dep ? addDays(dep, -30) : null;
    return {
      dep: dep, ret: ret, days: days, nights: nights, pax: pax, rooms: rooms, rounds: rounds,
      pricePP: pricePP, base: base, extras: extras, extraSum: extraSum, discount: discount, total: total,
      depositPP: depositPP, deposit: deposit, balance: balance, dueDate: dueDate,
      stay: days ? nights + '박 ' + days + '일' : '',
      period: (dep && ret) ? fmtDate(dep) + ' ~ ' + fmtDate(ret) : '',
      productName: RESORT.product + (days ? ' ' + nights + '박 ' + days + '일' : '')
    };
  }

  /* ── 일정 — 담당자가 「일정 직접 입력」에 한 줄씩 적으면 그 줄을 쓰고, 비어 있으면 자동으로 짠다 ── */
  function itinerary(d, c) {
    c = c || calc(d);
    if (!c.dep || !c.days) return [];
    var custom = lines(d.itin);
    var rows = [];
    for (var i = 0; i < c.days; i++) {
      var date = addDays(c.dep, i);
      var text;
      if (custom.length) text = custom[i] || '';
      else if (i === 0) text = '인천 출발' + (d.flightOut ? ' (' + d.flightOut + ')' : '') + ' → 쿠알라룸푸르 도착 · 리조트 송영 · 체크인';
      else if (i === c.days - 1) text = '체크아웃 · 공항 송영 · 쿠알라룸푸르 출발' + (d.flightIn ? ' (' + d.flightIn + ')' : '') + ' → 인천 도착';
      else text = (i <= c.rounds ? '라운딩 · ' + RESORT.golf : '자유 일정') + (i === 1 && !custom.length ? '' : '');
      rows.push({ day: i + 1, date: fmtMD(date), text: text });
    }
    return rows;
  }

  /* ── 빠진 값 — 저장·발송 전에 화면이 보여 준다 ── */
  function validate(d) {
    var c = calc(d), miss = [];
    if (!String(d.repName || '').trim()) miss.push('대표자 성함');
    if (!String(d.phone || '').replace(/[^0-9]/g, '')) miss.push('휴대폰 번호');
    if (!c.pax) miss.push('인원');
    if (!c.dep) miss.push('출발일');
    if (!c.ret) miss.push('귀국일');
    if (c.dep && c.ret && c.ret < c.dep) miss.push('귀국일이 출발일보다 앞섭니다');
    if (!c.pricePP) miss.push('1인 요금');
    return miss;
  }

  /* ── 알림톡 문안 — Edge Function(send-alimtalk/index.ts buildMessage)과 글자 단위로 같아야 한다.
     승인된 카카오 템플릿도 이 꼴이다. 한쪽만 바꾸지 말 것. ── */
  function alimtalk(d, kind) {
    var c = calc(d);
    var label = KIND_LABEL[kind || d.kind] || '안내문';
    return [
      '[메리트투어] ' + (d.repName || '') + '님 ' + label + ' 안내',
      '',
      '· 행사번호 : ' + (d.docNo || ''),
      '· 출발일 : ' + (c.dep ? ymd(c.dep) : ''),
      '· 상품 : ' + c.productName,
      '',
      '아래 버튼에서 ' + label + '를 확인해 주세요.'
    ].join('\n');
  }
  /* 알림톡을 못 보낼 때(함수 미배포 · 템플릿 미승인) 알리고 콘솔이나 카카오톡 채팅에 붙여 넣는 글 */
  function smsText(d, link) {
    var c = calc(d), label = KIND_LABEL[d.kind] || '안내문';
    return '[메리트투어] ' + (d.repName || '') + '님 ' + label + ' 안내\n'
      + '문서번호 ' + (d.docNo || '') + ' · 출발 ' + (c.dep ? fmtDate(c.dep) : '') + '\n'
      + c.productName + '\n'
      + (link ? label + ' 확인: ' + link + '\n' : '')
      + '문의 ' + (d.staffTel || DEFAULTS.staffTel);
  }
  /* send-alimtalk 에 보낼 수신자 한 건 */
  function recipient(d, link) {
    var c = calc(d);
    return {
      phone: String(d.phone || '').replace(/[^0-9]/g, ''),
      name: String(d.repName || '').trim(),
      eventNo: String(d.docNo || ''),
      dep: c.dep ? ymd(c.dep) : '',
      prod: c.productName,
      link: link || ''
    };
  }

  /* ── 문서 HTML (760px · html2canvas 로 JPG) ── */
  var CSS = [
    '*{box-sizing:border-box}',
    'body{margin:0;background:#fff;color:#1f2430;font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased}',
    '.doc{width:760px;margin:0 auto;background:#fff;padding:40px 44px 36px;line-height:1.6;font-size:13.5px;word-break:keep-all}',
    '.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #373F4A;padding-bottom:14px}',
    '.hd img{height:26px;display:block}',
    '.hd .co{font-size:11px;color:#5A6472;margin-top:8px;letter-spacing:.02em}',
    '.hd .kind{text-align:right}',
    '.hd .kind b{display:block;font-size:26px;letter-spacing:.3em;color:#373F4A;line-height:1.2}',
    '.hd .kind span{display:block;font-size:11.5px;color:#5A6472;font-family:"JetBrains Mono",monospace;margin-top:4px}',
    '.sub{margin:12px 0 0;color:#5A6472;font-size:12.5px}',
    '.hero{margin:16px 0 0;background:#F4F5F7;border-left:5px solid #B8935A;border-radius:0 10px 10px 0;padding:14px 18px}',
    '.hero .t{font-size:17px;font-weight:700;color:#373F4A}',
    '.hero .p{margin-top:4px;font-size:13.5px;color:#2A2F39}',
    '.hero .p b{color:#373F4A}',
    'h2{font-size:13px;margin:22px 0 8px;color:#373F4A;letter-spacing:.06em;display:flex;align-items:center;gap:8px}',
    'h2::before{content:"";width:4px;height:13px;background:#B8935A;border-radius:2px}',
    'table{width:100%;border-collapse:collapse;font-size:13px}',
    '.kv th{width:124px;text-align:left;background:#F4F5F7;color:#5A6472;font-weight:600;padding:8px 10px;border:1px solid #E3E5EA;vertical-align:top}',
    '.kv td{padding:8px 10px;border:1px solid #E3E5EA;vertical-align:top}',
    '.it th{background:#373F4A;color:#fff;font-weight:600;padding:7px 10px;text-align:left;font-size:12.5px}',
    '.it td{padding:7px 10px;border-bottom:1px solid #E3E5EA;vertical-align:top}',
    '.it td.d{width:52px;color:#373F4A;font-weight:700;white-space:nowrap}',
    '.it td.dt{width:86px;color:#5A6472;white-space:nowrap;font-family:"JetBrains Mono",monospace;font-size:12px}',
    '.pr td{padding:7px 10px;border-bottom:1px solid #E3E5EA}',
    '.pr td.n{text-align:right;white-space:nowrap;font-family:"JetBrains Mono",monospace}',
    '.pr tr.tot td{border-top:2px solid #373F4A;border-bottom:none;font-weight:700;font-size:15px;color:#373F4A;padding-top:10px}',
    '.pr tr.sub td{color:#5A6472;font-size:12.5px}',
    '.pay{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}',
    '.pay .b{border:1px solid #E3E5EA;border-radius:10px;padding:10px 14px}',
    '.pay .b .l{font-size:11.5px;color:#5A6472}',
    '.pay .b .v{font-size:16px;font-weight:700;color:#373F4A;margin-top:2px;font-family:"JetBrains Mono",monospace}',
    '.pay .b .s{font-size:11.5px;color:#5A6472;margin-top:2px}',
    '.acct{margin-top:10px;background:#FBF7EE;border:1px solid #E6D9B8;border-radius:10px;padding:10px 14px;font-size:13px}',
    '.acct b{color:#7F6019}',
    '.memo{white-space:pre-wrap;background:#F4F5F7;border-radius:10px;padding:10px 14px;font-size:13px}',
    'ol.notes{margin:0;padding-left:20px;font-size:12.5px;color:#2A2F39}',
    'ol.notes li{margin:4px 0}',
    '.ft{margin-top:26px;border-top:1px solid #E3E5EA;padding-top:12px;display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#5A6472}',
    '.ft b{color:#373F4A}',
    '.badge{display:inline-block;font-size:11px;padding:1px 8px;border-radius:999px;background:#EEF1F5;color:#373F4A;margin-left:6px;vertical-align:middle}'
  ].join('\n');

  function buildHtml(d, opts) {
    d = d || {}; opts = opts || {};
    var kind = KIND_LABEL[d.kind] ? d.kind : 'confirm';
    var c = calc(d);
    var it = itinerary(d, c);
    var issue = parseDate(d.issueDate) || new Date();
    var acct = d.acct || DEFAULTS.acct;
    var notes = lines(d.notes);
    if (!notes.length) notes = defaultNotes(kind);
    var staffTel = d.staffTel || DEFAULTS.staffTel;
    var h = [];
    h.push('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(KIND_LABEL[kind]) + ' ' + esc(d.docNo || '') + '</title>');
    h.push('<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">');
    h.push('<style>' + CSS + '</style></head><body><div class="doc">');
    h.push('<div class="hd"><div>' + (opts.logoSrc ? '<img src="' + esc(opts.logoSrc) + '" alt="MERITTOUR">' : '<div style="font-weight:800;font-size:20px;color:#373F4A;letter-spacing:.08em">MERITTOUR</div>')
      + '<div class="co">㈜메리트투어 · 회원제 골프 전문 여행 브랜드</div></div>'
      + '<div class="kind"><b>' + KIND_TITLE[kind] + '</b><span>No. ' + esc(d.docNo || '—') + ' · 발행 ' + esc(fmtDate(issue)) + '</span></div></div>');
    h.push('<p class="sub">' + esc(KIND_SUB[kind]) + '</p>');
    h.push('<div class="hero"><div class="t">' + esc(RESORT.product) + (c.stay ? ' ' + esc(c.stay) : '') + '</div>'
      + '<div class="p">' + esc(d.repName || '') + ' 님 외 ' + (c.pax ? Math.max(0, c.pax - 1) + '명' : '—') + ' · 총 <b>' + c.pax + '명</b>'
      + (c.period ? ' · ' + esc(c.period) : '') + '</div></div>');

    h.push('<h2>예약 정보</h2><table class="kv">');
    h.push('<tr><th>대표자</th><td>' + esc(d.repName || '') + '</td><th>연락처</th><td>' + esc(d.phone || '') + '</td></tr>');
    h.push('<tr><th>인원</th><td>' + c.pax + '명' + (c.rooms ? ' · ' + c.rooms + '실' : '') + '</td><th>문서번호</th><td>' + esc(d.docNo || '—') + '</td></tr>');
    if (lines(d.companions).length) h.push('<tr><th>동행</th><td colspan="3">' + esc(lines(d.companions).join(' · ')) + '</td></tr>');
    h.push('</table>');

    h.push('<h2>여행 개요</h2><table class="kv">');
    h.push('<tr><th>여행지</th><td colspan="3">' + esc(RESORT.nameKo) + ' <span class="badge">' + esc(RESORT.nameEn) + '</span><br>' + esc(RESORT.region) + '</td></tr>');
    h.push('<tr><th>기간</th><td colspan="3">' + esc(c.period) + (c.stay ? ' · <b>' + esc(c.stay) + '</b>' : '') + '</td></tr>');
    h.push('<tr><th>출국 항공편</th><td>' + esc(d.flightOut || '—') + (d.flightOutTime ? '<br><span style="color:#5A6472">' + esc(d.flightOutTime) + '</span>' : '') + '</td>'
      + '<th>귀국 항공편</th><td>' + esc(d.flightIn || '—') + (d.flightInTime ? '<br><span style="color:#5A6472">' + esc(d.flightInTime) + '</span>' : '') + '</td></tr>');
    h.push('<tr><th>숙소</th><td colspan="3">' + esc(RESORT.nameKo) + ' · ' + esc(d.room || DEFAULTS.room) + (c.rooms ? ' · ' + c.rooms + '실' : '') + '</td></tr>');
    h.push('<tr><th>라운딩</th><td colspan="3">' + esc(RESORT.golf) + ' · ' + c.rounds + '회' + (d.roundNote ? ' · ' + esc(d.roundNote) : '') + '</td></tr>');
    h.push('<tr><th>식사</th><td>' + esc(d.meals || DEFAULTS.meals) + '</td><th>송영</th><td>' + esc(d.transfer || DEFAULTS.transfer) + '</td></tr>');
    h.push('</table>');

    if (it.length) {
      h.push('<h2>일정</h2><table class="it"><tr><th>일차</th><th>날짜</th><th>일정</th></tr>');
      it.forEach(function (r) { h.push('<tr><td class="d">' + r.day + '일차</td><td class="dt">' + esc(r.date) + '</td><td>' + esc(r.text) + '</td></tr>'); });
      h.push('</table>');
    }

    h.push('<h2>요금</h2><table class="pr">');
    h.push('<tr><td>투어 요금 (항공 · 송영 · 숙박 · 라운딩 · ' + esc((d.meals || DEFAULTS.meals).replace(/\s*\(.*\)$/, '')) + ')</td><td class="n">' + esc(won(c.pricePP)) + ' × ' + c.pax + '명</td><td class="n">' + esc(won(c.base)) + '</td></tr>');
    c.extras.forEach(function (x) {
      h.push('<tr><td>' + esc(x.label || '추가 항목') + '</td><td class="n">' + esc(won(x.amount)) + (x.qty > 1 ? ' × ' + x.qty : '') + '</td><td class="n">' + esc(won(x.amount * x.qty)) + '</td></tr>');
    });
    if (c.discount) h.push('<tr><td>할인</td><td></td><td class="n">-' + esc(won(c.discount)) + '</td></tr>');
    h.push('<tr class="tot"><td colspan="2">총 요금</td><td class="n">' + esc(won(c.total)) + '</td></tr>');
    h.push('</table>');
    h.push('<div class="pay"><div class="b"><div class="l">예약금' + (kind === 'confirm' && d.depositPaid ? ' · 입금 확인 ' + esc(fmtDate(parseDate(d.depositPaid))) : '') + '</div><div class="v">' + esc(won(c.deposit)) + '</div><div class="s">1인 ' + esc(won(c.depositPP)) + ' × ' + c.pax + '명' + (kind === 'quote' ? ' · 입금 시 예약 확정' : '') + '</div></div>'
      + '<div class="b"><div class="l">잔금</div><div class="v">' + esc(won(c.balance)) + '</div><div class="s">' + (c.dueDate ? '납부 기한 ' + esc(fmtDate(c.dueDate)) + ' (출발 30일 전)' : '출발 30일 전까지') + '</div></div></div>');
    h.push('<div class="acct">입금 계좌 <b>' + esc(acct.bank || '') + ' ' + esc(acct.no || '') + '</b>' + (acct.holder ? ' · 예금주 ' + esc(acct.holder) : '') + ' · 입금자명은 대표자 성함으로 부탁드립니다.</div>');

    if (String(d.memo || '').trim()) h.push('<h2>안내 사항</h2><div class="memo">' + esc(d.memo) + '</div>');

    h.push('<h2>유의사항</h2><ol class="notes">');
    notes.forEach(function (n) { h.push('<li>' + esc(n) + '</li>'); });
    h.push('</ol>');

    h.push('<div class="ft"><div><b>㈜메리트투어</b>' + (d.staffName ? ' · 담당 ' + esc(d.staffName) : '') + ' · ' + esc(staffTel) + ' (평일 09:00~18:00)</div><div>카카오톡 채널 「메리트투어」</div></div>');
    h.push('</div></body></html>');
    return h.join('\n');
  }

  /* 새 문서의 입력값 */
  function blank(kind, today) {
    var t = today instanceof Date ? today : new Date();
    return {
      kind: KIND_LABEL[kind] ? kind : DEFAULTS.kind,
      docNo: '', issueDate: ymd(t),
      repName: '', phone: '', pax: '', companions: '',
      dep: '', ret: '', nights: '',
      flightOut: '', flightOutTime: '', flightIn: '', flightInTime: '',
      room: DEFAULTS.room, rooms: '', rounds: '', roundNote: DEFAULTS.roundNote,
      meals: DEFAULTS.meals, transfer: DEFAULTS.transfer,
      pricePP: '', extras: [], discount: '', depositPP: '', depositPaid: '',
      itin: '', memo: '', notes: '',
      staffName: '', staffTel: DEFAULTS.staffTel,
      acct: { bank: DEFAULTS.acct.bank, no: DEFAULTS.acct.no, holder: DEFAULTS.acct.holder }
    };
  }

  return {
    RESORT: RESORT, DEFAULTS: DEFAULTS, KIND_LABEL: KIND_LABEL,
    defaultNotes: defaultNotes, blank: blank, docNo: docNo,
    calc: calc, itinerary: itinerary, validate: validate,
    buildHtml: buildHtml, alimtalk: alimtalk, smsText: smsText, recipient: recipient,
    fmtDate: fmtDate, won: won, ymd: ymd, parseDate: parseDate, esc: esc
  };
}));
