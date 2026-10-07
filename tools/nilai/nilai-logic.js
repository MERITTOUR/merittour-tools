/* ════════════════════════════════════════════════════════════════
   MERITTOUR 닐라이스프링스 견적서·확정서 — 계산 · 문서 HTML · 알림톡 문안
   (tools/nilai/nilai-logic.js)

   UMD: 브라우저 전역 MT_NILAI + Node require(tests/nilai.test.mjs).
   DOM 을 만지지 않는다 — 화면(index.html)은 이 모듈이 돌려주는 값만 그린다.

   문서 구성은 엠클릭 확정서(2026-10-01 · Min 「이것도 참고해봐」 · 예약 30003171 MS워드 저장본)를 따른다:
   머리(회사 정보 · 발신) → 여행정보 → 요금안내(판매항목 표) → 상품정보(포함 · 불포함 · 참고 사항)
   → 항공정보 → 숙박정보 → 상세일정 → 미팅장소및시간 → 취소및환불정보 → 유의사항.
   ════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MT_NILAI = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── 회사 · 리조트 고정 정보 (손님 문서에 찍히는 공개 사실만) ── */
  var COMPANY = {
    name: '(주)메리트투어', tel: '02-365-9800', fax: '02-365-9801',
    addr: '서울특별시 마포구 월드컵북로 15, 6층 601호(서교동, 엠지엘빌딩)', site: 'https://www.merittour.co.kr'
  };
  var RESORT = {
    key: 'nilai',
    hotel: '닐라이스프링스 리조트 호텔',
    golf: '닐라이스프링스CC',
    nameEn: 'Nilai Springs Golf & Country Club',
    region: '말레이시아 · 쿠알라룸푸르',
    airportOut: '인천국제공항', airportIn: '쿠알라룸푸르 국제공항(KLIA)',
    iataOut: 'ICN', iataIn: 'KUL',
    transfer: '닐라이스프링스 골프&리조트 이동 (약 25분 소요)',
    addrEn: 'PT4770, NILAI SPRINGS PUTRA NILAI, NEGERI SEMBILAN, MALAYSIA', zip: '71800'
  };
  /* 항공사별 기본 편 — 항공사를 고르면 채워 주고 담당자가 고친다(엠클릭 예약 30003171 · 30003435 의 편). */
  var AIRLINES = {
    '대한항공': { out: 'KE427', outDep: '16:40', outArr: '22:25', inn: 'KE428', inDep: '23:55', inArr: '07:15', bag: '위탁수화물 23KG (골프백 포함) · 기내수화물 10KG' },
    '바틱항공': { out: 'OD821', outDep: '06:50', outArr: '12:30', inn: 'OD820', inDep: '22:00', inArr: '05:50', bag: '위탁수화물 20KG 기준 (골프백 포함) · 기내수화물 7KG' },
    /* 말레이시아항공(2026-10-02 · Min 「말레이시아 추가」 · 엠클릭 예약 화면의 교통편 — MH067 ICN 11:05 → KUL 16:45 당일 · MH066 KUL 23:15 → ICN 06:30 다음 날). 수하물 기준은 확인 전이라 비워 둔다. */
    '말레이시아항공': { out: 'MH067', outDep: '11:05', outArr: '16:45', inn: 'MH066', inDep: '23:15', inArr: '06:30', bag: '' }
  };

  var KIND_LABEL = { quote: '견적서', confirm: '확정서' };
  var KIND_TITLE = { quote: '견 적 서', confirm: '확 정 서' };
  var PAGE_LABEL = { core: '핵심본', notes: '안내본' };   // 이미지 두 장 — ① 핵심본 · ② 안내본(2026-10-07 · Min)
  var KIND_SUB = {
    quote: '예상 일정과 금액을 안내드립니다 · 예약금 입금 시 예약이 확정됩니다',
    confirm: '예약이 확정되었습니다 · 출발 전 아래 내용을 확인하여 주시기 바랍니다'
  };

  /* 입력 기본값 — 엠클릭 확정서의 문안을 그대로 가져왔다. 시즌마다 바뀌는 숫자(동계 조인 기간 · GP 모터쇼 · 특식 · MDAC 개별 작성일)는 담당자가 고친다. */
  var DEFAULTS = {
    kind: 'quote',
    airline: '대한항공',
    room: '트윈 (TWN)',
    incl: '숙박비, 라운딩비(1일 18홀), 식비(조, 중, 석식), 왕복송영비, 회원관리비[여행자보험가입 포함]',
    excl: '캐디피+캐디팁, 개인비용',
    depositPP: 300000,
    staffTel: COMPANY.tel,
    kakao: 'https://pf.kakao.com/_dxhWus/chat',
    acct: { bank: '하나은행', no: '109-890042-62004', holder: '(주)메리트투어' },
    meeting: '쿠알라룸푸르 공항 도착 후 입국심사와 세관 절차를 마치고 수하물을 찾으신 뒤, 도착 출구는 한 곳이므로 출구로 나오시면 “닐라이스프링스CC” 피켓을 든 현지(말레이시아) 직원이 대기하고 있습니다.',
    ref: [
      '■ 항공 수하물 안내',
      '바틱항공 · 위탁수화물 20KG 기준 (골프백 포함) · 기내수화물 7KG',
      '대한항공 · 위탁수화물 23KG (골프백 포함) · 기내수화물 10KG',
      '※ 원활한 수속을 위해 출발 3시간 전까지 공항 도착을 권장드립니다. (성수기, 단체 출발 및 골프백 위탁 시 수속 시간이 더 소요될 수 있습니다.)',
      '※ 개별 발권 진행하신 분들은 개별적으로 위탁수화물 및 기내수화물 참고',
      '',
      '1. 캐디피+캐디팁 비용',
      '2인 1캐디 (18홀 기준) → RM 150 (현지 지불, 카드결제 가능)',
      '2. 골프 운영',
      '주말/공휴일 오전 플레이: 2인 1캐디 필수 (현지에 의해 주중 캐디 필수 사용 가능성 있음)',
      '주말·공휴일 2인 플레이: 오후 티업만 가능',
      '조인 플레이: 2인 투어 리조트 사정에 따라 발생 가능 (동계 기간 26.12.01~27.2.28 2인 조인 플레이)',
      '3. 홀수 인원 투어',
      '홀수 인원: 싱글룸 + 싱글카트 필수',
      '싱글룸 추가: 비수기 ₩50,000 / 성수기 ₩65,000 · 싱글카트: ₩18,000 (18홀)',
      '4. 객실 옵션',
      '발코니 디럭스룸: ₩13,000 / 1인 1박 (현지에서 일반 트윈 → 디럭스룸 변경 시 현지 닐라이스프링스 직원에게 직접 요청)',
      '5. 추가 라운드 (9홀 기준)',
      '9홀 RM28.00 / 1인 · 18홀 RM49.00 / 1인 · 캐디 선택사항 (18홀 캐디피+캐디팁 RM150 현지 지불) · 현지 카드결제 가능',
      '6. 말레이시아 공휴일 안내',
      '주말 및 공휴일 오전 티업 배정 시 캐디 필수 · 티업 시간(AM/PM): 랜덤 배정',
      '7. 시즌 & 특별 요금',
      '12/24, 12/31 특식 추가요금: RM 20 / 1인 (현지 지불)',
      'GP 모터쇼 기간 요금 인상 → 2026.10.28~11.02: ₩20,000 / 1인 1박 추가',
      '8. 레이트 체크아웃',
      '18시 이전: ₩65,000 / 룸 · 18시 이후: ₩110,000 / 룸 (객실 상황에 따라 불가할 수 있음)',
      '',
      '■ 복장 규정',
      '남성: 카라가 있는 상의 / 반바지 or 긴바지 (벨트 착용)',
      '여성: 카라가 있는 상의 / 반바지 or 긴바지 or 치마바지 (치마바지 제외한 복장은 벨트 필수)',
      '■ 캐리어는 일반 벨트, 골프백은 A벨트에서 수령 후 출구로 이동 바랍니다',
      '■ MDAC(말레이시아 자동 입국신고서)는 출발 최대 하루 전날 작성 후 대표자님께 발송해 드립니다 (작성 시 E-Mail 필수)',
      '■ 자동 입국 신고서 숙소 정보 — 공식사이트 https://imigresen-online.imi.gov.my/mdac/main?registerMain · 주소 ' + RESORT.addrEn + ' · 우편번호 ' + RESORT.zip,
      '■ 주요 공항 안내 — 인천국제공항 https://www.airport.kr/ · 쿠알라룸푸르공항 https://airports.malaysiaairports.com.my/en/klia1 (링크는 예고 없이 바뀔 수 있습니다)'
    ].join('\n'),
    cancel: [
      '※ 천재지변(우천, 폭설 등) 또는 골프장 사정으로 인해 라운드 진행이 불가한 경우 환불되지 않습니다.',
      '· 표준약관 이전에 취소하시는 경우라도, 항공권 발권 이후 취소 시에는 항공사 규정에 따른 취소 수수료(페널티)가 별도로 부과될 수 있습니다.',
      '· 본 상품의 예약 및 취소는 「국외여행 표준약관」 외 추가 특별 약관이 적용됩니다. (특별 약관은 바틱항공 계약 좌석에 한함)',
      '· 국외여행 표준약관 [취소 수수료 안내] — 출발 30일 전까지: 계약금 전액 환급 / 29~20일: 여행요금의 10% / 19~10일: 15% / 9~8일: 20% / 7~1일: 30% / 출발 당일: 50% 배상 (No-show 의 경우 왕복 항공권은 전액 환불 불가)',
      '· 추가 특별약관(바틱항공 계약 좌석) — 출발 50일 전 ~ 26일 전: 1인당 60,000원 / 25일 전 ~ 17일 전: 1인당 250,000원 / 16일 전 ~ 출발 1일 전: 항공료 전액 환불 불가 (평일 오전 9시 ~ 오후 5시 내 통보 기준 · 주말, 공휴일 제외)',
      '· 상기 일정은 여행 표준약관 제8조, 제12조의 규정에 따라 여행자의 안전과 보호를 위하여 여행자의 요청 또는 현지 사정에 의하여 부득이하다고 쌍방이 합의한 경우, 천재지변 · 전란 · 정부의 명령 · 운송 · 숙박기관의 파업 · 휴업 등으로 여행의 목적을 달성할 수 없는 경우에 변경될 수 있습니다.'
    ].join('\n')
  };

  /* 유의사항 — 1인 원화 금액으로 정한 상품의 규칙(docs/confirm_2027_notice.md §1 끝줄 · 환율 산정 규칙 미적용). 취소 · 라운딩 불가 · MDAC 는 위 절에 있어 겹치지 않게 뺐다. */
  function defaultNotes(kind) {
    var list = [
      '본 ' + KIND_LABEL[kind] + '의 요금은 원화로 안내된 확정 금액이며, 환율 변동에 따른 추가 청구나 차액 정산은 없습니다.',
      '항공 · 송영 · 숙박 · 식사 · 라운딩은 하나의 일정으로 준비됩니다. 회원님 사정으로 포함 서비스를 이용하지 않으시더라도 그 부분의 요금은 제외 · 환불되지 않으며, 정해진 일정 밖의 이동은 회원님의 책임으로 진행됩니다.',
      '객실은 예약 순서를 기준으로 배정되며, 객실 종류와 시설은 예약 상황에 따라 조정될 수 있습니다.',
      '여권 유효기간은 입국일 기준 6개월 이상 남아 있어야 합니다.'
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
  /* ── 날짜 느슨하게 읽기(2026-10-01 · Min 「여기 입력이 이상함」 — 브라우저 date 칸은 연도 칸이 6자리까지 받아 엠클릭처럼 「20270105」를 치면 「202701-05-일」이 됐다) ──
     받는 꼴: 20270105 · 2027-01-05 · 2027.1.5 · 2027/1/5 · 27.1.5 · 270105 · 0105 · 1/5(월·일만 — 해는 base 기준 · dir 'next'(기본)면 base 보다 앞설 때 다음 해, 'prev' 면 base 보다 뒤일 때 지난 해).
     틀린 날짜(2월 30일 · 자릿수가 안 맞는 숫자)는 '' — 화면은 「날짜를 확인해 주세요」. */
  function parseLoose(s, base, dir) {
    var t = String(s || '').replace(/\s+/g, '');
    if (!t) return '';
    var m, y, mo, d, b = parseDate(base) || new Date();
    if ((m = t.match(/^(\d{4})(\d{2})(\d{2})$/)) || (m = t.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = t.match(/^(\d{2})(\d{2})(\d{2})$/)) || (m = t.match(/^(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?$/))) { y = 2000 + +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = t.match(/^(\d{2})(\d{2})$/)) || (m = t.match(/^(\d{1,2})[.\-\/](\d{1,2})\.?$/))) {
      y = b.getFullYear(); mo = +m[1]; d = +m[2];
      var b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()), guess = new Date(y, mo - 1, d);
      if (dir === 'prev' ? guess > b0 : guess < b0) y += (dir === 'prev' ? -1 : 1);
    }
    else return '';
    var dt = new Date(y, mo - 1, d);
    if (y < 2000 || y > 2100 || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return ymd(dt);
  }
  function dowOf(s) { var d = parseDate(s); return d ? DOW[d.getDay()] : ''; }
  function fmtDate(d) { return d ? d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' (' + DOW[d.getDay()] + ')' : ''; }
  function fmtYmdDot(d) { return d ? d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) : ''; }
  function fmtMD(d) { return d ? pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' (' + DOW[d.getDay()] + ')' : ''; }
  function won(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR') + '원'; }
  function comma(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR'); }
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
  function lines(s) { return String(s || '').split(/\r?\n/).map(function (l) { return l.trim(); }); }
  function nonEmpty(s) { return lines(s).filter(Boolean); }

  /* 행사번호 — 담당자가 적는 선택 항목이다. 비우면 문서·알림톡에 공란으로 나간다
     (2026-10-01 · Min 「문서번호 → 행사번호로 수정 · 입력 안 하면 공란으로 나올 거니까 · 입력 항목은 있어야」).
     자동 번호는 쓰지 않는다 — 보관함의 열쇠는 행 id 다. */

  /* ── 항공 날짜 보정(엠클릭 교통편의 표현 · 2026-10-01 · Min 「이 표현이 좀 헷갈려 기존 사용 표현을 보내줄게」) ──
     출발편 도착: outArrOffset 0 = 「당일 도착」 · 1 = 「1일후도착」(출발일 다음 날 도착)
     도착편 출발: inDepOffset −1 = 「1일전출발」(귀국일 전날 밤 쿠알라룸푸르 출발 · 기본) · 0 = 「당일 출발」
     옛 저장분의 체크박스 값(outNextDay · inNextDay)도 읽는다. */
  var OUT_ARR_LABEL = { 0: '당일 도착', 1: '1일후도착' };
  var IN_DEP_LABEL = { '-1': '1일전출발', 0: '당일 출발' };
  function offsets(d) {
    var outArr = d.outArrOffset != null && d.outArrOffset !== '' ? Number(d.outArrOffset) : (d.outNextDay ? 1 : 0);
    var inDep = d.inDepOffset != null && d.inDepOffset !== '' ? Number(d.inDepOffset) : (d.inNextDay === false ? 0 : -1);
    return { outArr: outArr === 1 ? 1 : 0, inDep: inDep === 0 ? 0 : -1 };
  }

  /* ── 계산 ──
     여행기간(일수) = 귀국일 − 출발일 + 1 · 체크인 = 출발일 + 출발편 도착 보정 · 체크아웃 = 귀국일 + 도착편 출발 보정(1일전출발이면 귀국일 전날)
     박수 기본값 = 체크아웃 − 체크인 = 일수 − 2 (밤 비행 귀국 · 6박 8일 · 7박 9일 — 엠클릭 예약과 같다) · 당일 출발이면 일수 − 1. 담당자가 박수를 직접 적으면 그 값. */
  function calc(d) {
    d = d || {};
    var dep = parseDate(d.dep), ret = parseDate(d.ret);
    var days = (dep && ret && ret >= dep) ? Math.round((ret - dep) / 86400000) + 1 : 0;
    var off = offsets(d), inNext = off.inDep === -1;
    var nights = num(d.nights, null);
    if (nights == null) nights = Math.max(0, days ? days - 1 + off.inDep - off.outArr : 0);
    var pax = Math.max(0, Math.round(num(d.pax, 0)));
    var rooms = num(d.rooms, null); if (rooms == null) rooms = Math.ceil(pax / 2);
    var rounds = num(d.rounds, null); if (rounds == null) rounds = nights;
    var fares = (d.fares || []).map(function (f, i) {
      var qty = num(f.qty, null); if (qty == null) qty = (i === 0 ? pax : 1);
      return { label: String(f.label || '').trim() || (i === 0 ? '투어비(항공료 포함)' : ''), amount: Math.max(0, num(f.amount, 0)), qty: Math.max(0, Math.round(qty)) };
    }).filter(function (f) { return f.label || f.amount; });
    var sum = fares.reduce(function (s, f) { return s + f.amount * f.qty; }, 0);
    var discount = Math.max(0, num(d.discount, 0));
    var total = Math.max(0, sum - discount);
    var depositPP = num(d.depositPP, null); if (depositPP == null) depositPP = DEFAULTS.depositPP;
    var deposit = Math.min(total, Math.max(0, depositPP) * pax);
    var balance = Math.max(0, total - deposit);
    var dueDate = dep ? addDays(dep, -30) : null;
    var checkIn = dep ? addDays(dep, off.outArr) : null;
    var checkOut = checkIn ? addDays(checkIn, nights) : null;
    var inDepDate = ret ? addDays(ret, off.inDep) : null;
    var airline = String(d.airline || '').trim();
    var stay = days ? nights + '박 ' + days + '일' : '';
    return {
      dep: dep, ret: ret, days: days, nights: nights, pax: pax, rooms: rooms, rounds: rounds,
      fares: fares, sum: sum, discount: discount, total: total,
      depositPP: depositPP, deposit: deposit, balance: balance, dueDate: dueDate,
      checkIn: checkIn, checkOut: checkOut, inDepDate: inDepDate, inNextDay: inNext, outArrOffset: off.outArr, inDepOffset: off.inDep,
      stay: stay,
      period: (dep && ret) ? fmtYmdDot(dep) + ' ~ ' + fmtYmdDot(ret) + (stay ? ' (' + stay + ')' : '') : '',
      productName: (stay ? '[' + stay + '] ' : '') + RESORT.golf + ' 골프 투어' + (airline ? ' - ' + airline : '')
    };
  }

  /* ── 항공정보 두 줄 ── */
  function flights(d, c) {
    c = c || calc(d);
    var al = String(d.airline || '').trim();
    return [
      { leg: '출발편', airline: al, no: d.flightOut || '', depDate: c.dep ? ymd(c.dep) : '', depTime: d.flightOutDep || '', from: RESORT.iataOut, to: RESORT.iataIn, arrDate: c.dep ? ymd(addDays(c.dep, c.outArrOffset)) : '', arrTime: d.flightOutArr || '', arrNote: c.outArrOffset ? OUT_ARR_LABEL[1] : '' },
      { leg: '도착편', airline: al, no: d.flightIn || '', depDate: c.inDepDate ? ymd(c.inDepDate) : '', depTime: d.flightInDep || '', from: RESORT.iataIn, to: RESORT.iataOut, arrDate: c.ret ? ymd(c.ret) : '', arrTime: d.flightInArr || '', depNote: c.inDepOffset ? IN_DEP_LABEL['-1'] : '' }
    ];
  }

  /* ── 상세일정 — 엠클릭 확정서의 하루 구성(지역 · 내용 줄 · 호텔 · 식사). 「일정 직접 입력」에 한 줄씩 적으면 그 줄이 내용이 된다. ── */
  function itinerary(d, c) {
    c = c || calc(d);
    if (!c.dep || !c.days) return [];
    var custom = nonEmpty(d.itin);
    var al = String(d.airline || '').trim();
    var rows = [];
    var arrLine = '쿠알라룸푸르공항 도착' + (d.flightOutArr ? ' (' + d.flightOutArr + ')' : '');
    var icnLine = '인천국제공항 도착' + (d.flightInArr ? ' (' + d.flightInArr + ')' : '');
    for (var i = 0; i < c.days; i++) {
      var date = addDays(c.dep, i), last = (i === c.days - 1), first = (i === 0);
      var arrDay = (i === c.outArrOffset);                       // 쿠알라룸푸르에 도착하는 날(당일 도착이면 1일차)
      var depDay = (i === c.days - 1 + c.inDepOffset);           // 쿠알라룸푸르에서 출발하는 날(1일전출발이면 귀국일 전날)
      var r = { day: i + 1, date: fmtDate(date), lines: [], hotel: '', meals: '' };
      if (custom.length) { r.lines = [custom[i] || '']; }
      else if (first) {
        r.lines = [RESORT.airportOut + (al === '대한항공' ? ' 2터미널' : '') + ' 출국장' + (al ? ', ' + al + ' 카운터' : '') + ' 개별수속', '출국 수속 완료 후 출발' + (d.flightOut ? ' (' + d.flightOut + (d.flightOutDep ? ' ' + d.flightOutDep : '') + ')' : '')];
        if (arrDay) r.lines = r.lines.concat([arrLine, RESORT.transfer, '숙소에 도착 후 휴식']);
      } else if (arrDay) {
        r.lines = [arrLine, RESORT.transfer, '숙소에 도착 후 휴식'];
      } else if (depDay) {
        r.lines = ['호텔 조식 후 라운딩', '❑ ' + RESORT.golf + ' (주중 18홀 / 주말&휴일 오후 18홀)', '라운딩 후 숙소 이동', '※ 귀국일 Late Check-out 희망 시 추가요금 발생 (현지에서 확인 가능)',
                   '석식 후 공항으로 이동', '쿠알라룸푸르 국제공항에서 인천국제공항으로 출발' + (d.flightIn ? ' (' + d.flightIn + (d.flightInDep ? ' ' + d.flightInDep : '') + ')' : '')];
        if (last) r.lines.push(icnLine);
      } else if (last) {
        r.lines = [icnLine];
      } else if (i <= c.rounds) {
        r.lines = ['호텔 조식 후 라운딩', '❑ ' + RESORT.golf + ' (주중 18홀 / 주말&휴일 오후 18홀)', '라운딩 후 숙소 이동', '석식 및 휴식'];
      } else {
        r.lines = ['자유 일정', '석식 및 휴식'];
      }
      var sleeps = c.checkIn && c.checkOut && date >= c.checkIn && date < c.checkOut;
      r.hotel = sleeps ? (d.hotel || RESORT.hotel) : '';
      if (first && !arrDay) r.meals = '불포함';
      else if (arrDay) r.meals = '석식 : 불포함';
      else if (last && !depDay) r.meals = '';
      else r.meals = '조식 : 호텔식 · 중식 : 호텔식 · 석식 : 호텔식';
      rows.push(r);
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
    if (!c.fares.some(function (f) { return f.amount > 0; })) miss.push('요금');
    return miss;
  }

  /* ── 알림톡 문안 — Edge Function(send-alimtalk/index.ts buildMessage)과 글자 단위로 같아야 한다.
     승인된 카카오 템플릿도 이 꼴이다. 한쪽만 바꾸지 말 것. 행사번호를 비우면 공란으로 나간다. ── */
  /* ── 받는 분 — 대표자 + 동행 (2026-10-02 · Min 「동행 적는 것도 맞는데 동행자 1인한테만 보낼 때는 어떻게 함?」) ──
     동행 칸은 「김영희 010-2222-3333 · 이수진」처럼 적는다(· , ; 줄바꿈으로 나눔). 번호를 적은 동행에게는 따로(또는 함께) 보낼 수 있고,
     알림톡·문자 문안은 받는 분 성함으로 나가며 내역도 받는 분마다 한 건씩 남는다. 문서(고객명/인원)에는 이름만 찍히고 번호는 찍지 않는다. */
  function companionsOf(d) {
    return String((d && d.companions) || '').split(/[·,;\n]/).map(function (t) {
      t = t.trim(); if (!t) return null;
      var m = t.match(/(0\d{1,2}[\s-]?\d{3,4}[\s-]?\d{4})/);
      var phone = m ? m[1].replace(/[^0-9]/g, '') : '';
      var name = (m ? t.replace(m[0], '') : t).replace(/[()\s]+/g, ' ').trim();
      return { name: name, phone: phone };
    }).filter(function (x) { return x && (x.name || x.phone); });
  }
  function recipientsOf(d) {
    d = d || {};
    var list = [{ key: 'rep', role: '대표자', name: String(d.repName || '').trim(), phone: String(d.phone || '').replace(/[^0-9]/g, '') }];
    companionsOf(d).forEach(function (x, i) { list.push({ key: 'c' + i, role: '동행', name: x.name, phone: x.phone }); });
    return list;
  }
  function companionNames(d) { return companionsOf(d).map(function (x) { return x.name; }).filter(Boolean); }
  function nameOf(d, to) { return String((to && to.name) || (d && d.repName) || '').trim(); }

  function alimtalk(d, kind, to) {
    var c = calc(d);
    var label = KIND_LABEL[kind || d.kind] || '안내문';
    return [
      '[메리트투어] ' + nameOf(d, to) + '님 ' + label + ' 안내',
      '',
      '· 행사번호 : ' + (d.eventNo || ''),
      '· 출발일 : ' + (c.dep ? ymd(c.dep) : ''),
      '· 상품 : ' + c.productName,
      '',
      '아래 버튼에서 ' + label + '를 확인해 주세요.'
    ].join('\n');
  }
  /* 알림톡을 못 보낼 때(함수 미설정 · 템플릿 미승인) 알리고 콘솔이나 카카오톡 채팅에 붙여 넣는 글 */
  function smsText(d, link, to) {
    var c = calc(d), label = KIND_LABEL[d.kind] || '안내문';
    return '[메리트투어] ' + nameOf(d, to) + '님 ' + label + ' 안내\n'
      + (d.eventNo ? '행사번호 ' + d.eventNo + ' · ' : '') + '출발 ' + (c.dep ? fmtDate(c.dep) : '') + '\n'
      + c.productName + '\n'
      + (link ? label + ' 확인: ' + link + '\n' : '')
      + '문의 ' + (d.staffTel || DEFAULTS.staffTel);
  }
  /* 발송 기록 한 건 — 누구에게(to) · 어떤 내용(message · data 스냅샷 · link) · 어떻게(via) · 누가·언제.
     보낸 뒤 문서를 고쳐도 그때 보낸 내용이 남는다(Min 「어떤 사람한테 어떤 내용으로 보냈는지 내역만 남고 내역은 확인할 수 있어야」). */
  var VIA_LABEL = { alimtalk: '알림톡', kakao: '카카오톡 이미지', sms: '문자·알리고 콘솔', other: '기타' };
  function sendEntry(d, via, opts) {
    opts = opts || {};
    var kind = KIND_LABEL[d.kind] ? d.kind : 'quote';
    var to = opts.to || recipientsOf(d)[0];   // 받는 분(대표자 또는 동행) — 비우면 대표자
    return {
      at: opts.at || new Date().toISOString(),
      by: opts.by || '',
      via: VIA_LABEL[via] ? via : 'other',
      to: String(to.phone || '').replace(/[^0-9]/g, ''),
      name: String(to.name || '').trim(),
      role: to.role || '대표자',
      kind: kind,
      memo: String(opts.memo || '').trim(),
      link: opts.link || '',
      message: via === 'alimtalk' ? alimtalk(d, kind, to) : smsText(d, opts.link || '', to),
      data: JSON.parse(JSON.stringify(d))
    };
  }
  /* send-alimtalk 에 보낼 수신자 한 건 */
  function recipient(d, link, to) {
    var c = calc(d);
    to = to || recipientsOf(d)[0];
    return {
      phone: String(to.phone || '').replace(/[^0-9]/g, ''),
      name: String(to.name || '').trim(),
      eventNo: String(d.eventNo || '').trim(),
      dep: c.dep ? ymd(c.dep) : '',
      prod: c.productName,
      link: link || ''
    };
  }

  /* ── 문서 HTML (760px · html2canvas 로 JPG) ── */
  var CSS = [
    '*{box-sizing:border-box}',
    'body{margin:0;background:#fff;color:#1f2430;font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased}',
    '.doc{width:760px;margin:0 auto;background:#fff;padding:36px 40px 32px;line-height:1.6;font-size:13px;word-break:keep-all}',
    '.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}',
    '.hd img{height:26px;display:block}',
    '.hd .co{font-size:11px;color:#5A6472;line-height:1.55;text-align:right}',
    '.ttl{text-align:center;margin:16px 0 14px}',
    '.ttl b{font-size:24px;letter-spacing:.35em;color:#373F4A;border-bottom:2px solid #373F4A;padding:0 6px 2px}',
    '.ttl span{display:block;font-size:12px;color:#5A6472;margin-top:8px}',
    'table{width:100%;border-collapse:collapse;font-size:12.5px}',
    '.kv th{width:112px;text-align:center;background:#F4F5F7;color:#2A2F39;font-weight:600;padding:7px 8px;border:1px solid #CDD1D8;vertical-align:top}',
    '.kv td{padding:7px 10px;border:1px solid #CDD1D8;vertical-align:top}',
    'h2{font-size:13.5px;margin:18px 0 6px;color:#1f2430;display:flex;align-items:center;gap:6px}',
    'h2::before{content:"▶";font-size:11px;color:#373F4A}',
    '.gd th{background:#F4F5F7;color:#2A2F39;font-weight:600;padding:6px 8px;border:1px solid #CDD1D8;text-align:center;font-size:12px}',
    '.gd td{padding:6px 8px;border:1px solid #CDD1D8;text-align:center;vertical-align:top}',
    '.gd td.l{text-align:left}',
    '.gd td.n{text-align:right;font-family:"JetBrains Mono",monospace;white-space:nowrap}',
    '.gd tr.tot td{font-weight:700;background:#FBF7EE}',
    '.pay{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}',
    '.pay .b{border:1px solid #CDD1D8;border-radius:8px;padding:8px 12px}',
    '.pay .b .l{font-size:11.5px;color:#5A6472}',
    '.pay .b .v{font-size:15px;font-weight:700;color:#373F4A;font-family:"JetBrains Mono",monospace}',
    '.pay .b .s{font-size:11.5px;color:#5A6472}',
    '.acct{margin-top:8px;background:#FBF7EE;border:1px solid #E6D9B8;border-radius:8px;padding:8px 12px;font-size:12.5px;line-height:1.7}',
    '.acct b{color:#7F6019}',
    '.pre{white-space:pre-wrap;font-size:12px;line-height:1.65}',
    '.more{margin-top:18px;background:#F4F5F7;border:1px solid #CDD1D8;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#373F4A}',
    '.it td.d{width:92px;font-weight:700;color:#373F4A;background:#F4F5F7;border:1px solid #CDD1D8;padding:6px 8px;vertical-align:top;white-space:nowrap}',
    '.it td.c{border:1px solid #CDD1D8;padding:6px 10px;vertical-align:top}',
    '.it .ln{margin:0;padding:0;list-style:none}',
    '.it .ln li{margin:1px 0}',
    '.it .ht{margin-top:4px;font-size:11.5px;color:#5A6472}',
    '.it .ht b{color:#373F4A;font-weight:600}',
    'ol.notes{margin:0;padding-left:20px;font-size:12px;color:#2A2F39}',
    'ol.notes li{margin:3px 0}',
    '.ft{margin-top:22px;border-top:1px solid #CDD1D8;padding-top:10px;display:flex;justify-content:space-between;gap:12px;font-size:11.5px;color:#5A6472}',
    '.ft b{color:#373F4A}'
  ].join('\n');

  /* ── 손님 열람 조각(view) — 2026-10-02 · Min 「손님께 링크를 보내면 너무 긴 내용들은 접고 펴고 할 수 있고 인쇄도」 ──
     merittour.github.io /doc/ 페이지 안에 끼워 넣으므로 body·* 규칙은 빼고 모든 규칙을 .doc 아래로 묶는다. 절마다 <details>(접기·펼치기),
     참고 사항·취소 규정은 접힌 채 시작, 폰에서는 폭을 화면에 맞추고 넓은 표는 가로로 민다. 스크립트는 넣지 않는다(뷰어가 인쇄·펼치기를 맡는다). */
  var VIEW_CSS = [
    '.doc{width:auto;max-width:760px;padding:20px 16px 28px;font-size:14px}',
    '.doc table{font-size:13px}',
    '.doc .gd td.n,.doc .pay .b .v{font-family:inherit;font-variant-numeric:tabular-nums}',
    '.doc .tw{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.doc .tw table{min-width:560px}',
    '.doc .tw.wide table{min-width:680px}',
    '.doc details.sec{border-top:1px solid #E3E6EB;margin-top:10px;padding-top:4px}',
    '.doc details.sec>summary{list-style:none;cursor:pointer;padding:8px 0;-webkit-tap-highlight-color:transparent}',
    '.doc details.sec>summary::-webkit-details-marker{display:none}',
    '.doc details.sec>summary h2{margin:0;font-size:16px}',
    '.doc details.sec[open]>summary h2::before{content:"▼"}',
    '.doc .tg{margin-left:auto;font-size:12px;font-weight:400;color:#5A6472;border:1px solid #CDD1D8;border-radius:999px;padding:2px 10px;white-space:nowrap}',
    '.doc .tg::after{content:"펼치기"}',
    '.doc details[open]>summary .tg::after{content:"접기"}',
    '.doc details.sec>.sb{padding-bottom:6px}',
    '.doc details.sub{margin-top:8px;border:1px solid #CDD1D8;border-radius:8px;padding:0 12px}',
    '.doc details.sub>summary{list-style:none;cursor:pointer;padding:9px 0;font-weight:600;color:#373F4A;display:flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent}',
    '.doc details.sub>summary::-webkit-details-marker{display:none}',
    '.doc details.sub>summary::before{content:"▶";font-size:11px}',
    '.doc details.sub[open]>summary::before{content:"▼"}',
    '.doc details.sub>.pre{padding:2px 0 12px}',
    /* 폰에서는 요금 표의 늘 같은 두 열(판매항목 「판매요금」 · 구분 「성인」)을 숨겨 총합계까지 한 화면에 보이게 한다 — 가로로 밀어야 보이면 견적의 핵심인 총합계를 놓친다 */
    '@media (max-width:600px){.doc .hd{flex-wrap:wrap}.doc .hd .co{text-align:left}.doc .ttl b{font-size:20px;letter-spacing:.25em}.doc .pay{grid-template-columns:1fr}.doc .ft{flex-direction:column;gap:4px}.doc .tw table.fee{min-width:0}.doc table.fee th:nth-child(1),.doc table.fee tr:not(.tot)>td:nth-child(1),.doc table.fee th:nth-child(3),.doc table.fee tr:not(.tot)>td:nth-child(3){display:none}.doc table.fee th,.doc table.fee td{padding:6px 5px}}',
    '@media print{.doc .tg{display:none}.doc details.sec{border-top:none}.doc tr,.doc details.sub,.doc .pay .b,.doc .acct{break-inside:avoid}.doc h2{break-after:avoid}}'
  ].join('\n');
  function scopedCss() {
    return CSS.split('\n').map(function (rule) {
      var sel = rule.slice(0, rule.indexOf('{')).trim();
      if (sel === '*' || sel === 'body') return '';
      return sel.indexOf('.doc') === 0 ? rule : '.doc ' + rule;
    }).filter(Boolean).join('\n') + '\n' + VIEW_CSS;
  }

  /* page — '' 전체(미리보기 · 링크 · 인쇄) · 'core' ① 핵심본(여행정보 · 요금 · 포함/불포함 · 항공 · 숙박 · 일정 · 미팅 · 안내 사항) · 'notes' ② 안내본(참고 사항 · 취소및환불정보 · 유의사항).
     이미지로 보낼 때만 나눈다(2026-10-07 · Min 「응 한번 해보자」) — 한 장에 다 넣으면 카카오톡이 긴 그림을 줄여 글자가 안 읽힌다. 링크(열람 조각)·인쇄는 그대로 전체. page 가 있으면 view 는 무시한다(이미지는 접지 않는다). */
  function buildHtml(d, opts) {
    d = d || {}; opts = opts || {};
    var kind = KIND_LABEL[d.kind] ? d.kind : 'quote';
    var page = PAGE_LABEL[opts.page] ? opts.page : '';
    var c = calc(d), fl = flights(d, c), it = itinerary(d, c);
    var issue = parseDate(d.issueDate) || new Date();
    var acct = d.acct || DEFAULTS.acct;
    var notes = nonEmpty(d.notes); if (!notes.length) notes = defaultNotes(kind);
    var ref = String(d.ref == null ? DEFAULTS.ref : d.ref).trim();
    var cancel = String(d.cancel == null ? DEFAULTS.cancel : d.cancel).trim();
    var meeting = String(d.meeting == null ? DEFAULTS.meeting : d.meeting).trim();
    var staffTel = d.staffTel || DEFAULTS.staffTel;
    var view = !!opts.view && !page;
    var h = [];
    /* 절 하나 — 손님 열람 조각에서는 접고 펼 수 있는 <details>(open === false 면 접힌 채 시작), 미리보기·JPG·인쇄용 문서에서는 h2 + 본문 */
    function sec(title, body, open) {
      if (view) h.push('<details class="sec"' + (open === false ? '' : ' open') + '><summary><h2>' + esc(title) + '<span class="tg"></span></h2></summary><div class="sb">' + body + '</div></details>');
      else h.push('<h2>' + esc(title) + '</h2>' + body);
    }
    if (view) h.push('<style>' + scopedCss() + '</style>');
    else {
      h.push('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(KIND_LABEL[kind]) + (page ? ' ' + PAGE_LABEL[page] : '') + (d.eventNo ? ' ' + esc(d.eventNo) : '') + '</title>');
      h.push('<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">');
      h.push('<style>' + CSS + '</style></head><body>');
    }
    h.push('<div class="doc"' + (view ? ' data-kind="' + esc(KIND_LABEL[kind]) + '"' + (opts.until ? ' data-until="' + esc(String(opts.until).slice(0, 10)) + '"' : '') : '') + '>');
    // 머리 — 회사 정보(엠클릭 확정서와 같은 자리)
    h.push('<div class="hd"><div>' + (opts.logoSrc ? '<img src="' + esc(opts.logoSrc) + '" alt="MERITTOUR">' : '<div style="font-weight:800;font-size:20px;color:#373F4A;letter-spacing:.08em">MERITTOUR</div>') + '</div>'
      + '<div class="co">' + esc(COMPANY.site) + '<br>TEL : ' + esc(COMPANY.tel) + '   FAX : ' + esc(COMPANY.fax) + '<br>' + esc(COMPANY.addr) + '</div></div>');
    if (page === 'notes') h.push('<div class="ttl"><b>안 내 사 항</b><span>' + esc(KIND_LABEL[kind]) + ' 안내 · 발행 ' + esc(fmtDate(issue)) + '</span></div>');
    else h.push('<div class="ttl"><b>' + KIND_TITLE[kind] + '</b><span>' + esc(KIND_SUB[kind]) + ' · 발행 ' + esc(fmtDate(issue)) + '</span></div>');
    h.push('<table class="kv"><tr><th>발신</th><td>' + esc((d.staffName ? d.staffName + ' / ' : '') + COMPANY.name) + '</td></tr></table>');

    if (page === 'notes') {
      // ② 안내본 — 어느 문서의 안내인지(문서 · 행사번호 · 고객명 · 여행기간)만 짧게
      h.push('<table class="kv"><tr><th>문서</th><td>' + esc(KIND_LABEL[kind]) + (d.eventNo ? ' · 행사번호 ' + esc(d.eventNo) : '') + '</td></tr>'
        + '<tr><th>고객명/인원</th><td>' + esc(d.repName || '') + ' 님 / ' + c.pax + '명</td></tr>'
        + '<tr><th>여행기간</th><td>' + esc(c.period) + '</td></tr></table>');
    } else {
      sec('여행정보', '<table class="kv">'
        + '<tr><th>상품명</th><td>' + esc(c.productName) + '</td></tr>'
        + '<tr><th>여행기간</th><td>' + esc(c.period) + '</td></tr>'
        + '<tr><th>고객명/인원</th><td>' + esc(d.repName || '') + ' 님 / ' + c.pax + '명 (성인 ' + c.pax + ')' + (companionNames(d).length ? ' · ' + esc(companionNames(d).join(' · ')) : '') + '</td></tr>'
        + '<tr><th>행사번호</th><td>' + esc(d.eventNo || '') + '</td></tr>'
        + '<tr><th>연락처</th><td>' + esc(d.phone || '') + '</td></tr>'
        + '</table>');

      var fee = ['<div class="tw"><table class="gd fee"><tr><th>판매항목</th><th>요금구분</th><th>구분</th><th>금액</th><th>인원</th><th>합계</th></tr>'];
      c.fares.forEach(function (f) {
        fee.push('<tr><td>판매요금</td><td class="l">' + esc(f.label) + '</td><td>성인</td><td class="n">' + esc(comma(f.amount)) + '</td><td>' + f.qty + '</td><td class="n">' + esc(comma(f.amount * f.qty)) + '</td></tr>');
      });
      if (c.discount) fee.push('<tr><td>할인</td><td class="l">할인</td><td></td><td></td><td></td><td class="n">-' + esc(comma(c.discount)) + '</td></tr>');
      fee.push('<tr class="tot"><td colspan="5">총합계</td><td class="n">' + esc(comma(c.total)) + '</td></tr></table></div>');
      fee.push('<div class="pay"><div class="b"><div class="l">예약금' + (kind === 'confirm' && d.depositPaid ? ' · 입금 확인 ' + esc(fmtDate(parseDate(d.depositPaid))) : '') + '</div><div class="v">' + esc(won(c.deposit)) + '</div><div class="s">1인 ' + esc(won(c.depositPP)) + ' × ' + c.pax + '명' + (kind === 'quote' ? ' · 입금 시 예약 확정' : '') + '</div></div>'
        + '<div class="b"><div class="l">잔금</div><div class="v">' + esc(won(c.balance)) + '</div><div class="s">' + (c.dueDate ? '납부 기한 ' + esc(fmtDate(c.dueDate)) + ' (출발 30일 전)' : '출발 30일 전까지') + '</div></div></div>');
      fee.push('<div class="acct">■ 입금 계좌 안내 <b>' + esc(acct.bank || '') + ' ' + esc(acct.no || '') + ' ' + esc(acct.holder || '') + '</b><br>※ 본 금액에는 선납하신 예약금이 포함되어 있습니다.<br>※ 투어피는 출국 30일 전까지 완납해 주시기 바랍니다.</div>');
      sec('요금안내', fee.join('\n'));

      var prod = ['<table class="kv">'
        + '<tr><th>포함 사항</th><td>' + esc(d.incl == null ? DEFAULTS.incl : d.incl) + '</td></tr>'
        + '<tr><th>불포함 사항</th><td>' + esc(d.excl == null ? DEFAULTS.excl : d.excl) + '</td></tr>'];
      if (ref && !view && !page) prod.push('<tr><th>참고 사항</th><td><div class="pre">' + esc(ref) + '</div></td></tr>');
      prod.push('</table>');
      if (ref && view) prod.push('<details class="sub"><summary>참고 사항<span class="tg"></span></summary><div class="pre">' + esc(ref) + '</div></details>');
      sec('상품정보', prod.join('\n'));

      var air = ['<div class="tw wide"><table class="gd"><tr><th>구분</th><th>항공사</th><th>항공편</th><th>출발일자</th><th>출발시간</th><th>출발지</th><th>도착지</th><th>도착일자</th><th>도착시간</th></tr>'];
      fl.forEach(function (f) {
        air.push('<tr><td>' + esc(f.leg) + '</td><td>' + esc(f.airline) + '</td><td>' + esc(f.no) + '</td><td>' + esc(f.depDate) + (f.depNote ? '<br><span style="font-size:11px;color:#5A6472">' + esc(f.depNote) + '</span>' : '') + '</td><td>' + esc(f.depTime) + '</td><td>' + esc(f.from) + '</td><td>' + esc(f.to) + '</td><td>' + esc(f.arrDate) + (f.arrNote ? '<br><span style="font-size:11px;color:#5A6472">' + esc(f.arrNote) + '</span>' : '') + '</td><td>' + esc(f.arrTime) + '</td></tr>');
      });
      air.push('</table></div>');
      sec('항공정보', air.join('\n'));

      sec('숙박정보', '<div class="tw"><table class="gd"><tr><th>호텔명</th><th>룸타입</th><th>체크인</th><th>체크아웃</th><th>박수</th><th>방수</th><th>식사</th></tr>'
        + '<tr><td class="l">' + esc(d.hotel || RESORT.hotel) + '</td><td>' + esc(d.room || DEFAULTS.room) + '</td><td>' + esc(c.checkIn ? fmtDate(c.checkIn) : '') + '</td><td>' + esc(c.checkOut ? fmtDate(c.checkOut) : '') + '</td><td>' + c.nights + '</td><td>' + c.rooms + '</td><td>조 · 중 · 석식</td></tr></table></div>');

      if (it.length) {
        var itn = ['<table class="it">'];
        it.forEach(function (r) {
          itn.push('<tr><td class="d">' + r.day + '일차<br><span style="font-weight:400;color:#5A6472;font-size:11.5px">' + esc(r.date) + '</span></td><td class="c"><ul class="ln">' + r.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>'
            + ((r.hotel || r.meals) ? '<div class="ht">' + (r.hotel ? '<b>호텔</b> ' + esc(r.hotel) : '') + (r.hotel && r.meals ? ' · ' : '') + (r.meals ? '<b>식사</b> ' + esc(r.meals) : '') + '</div>' : '') + '</td></tr>');
        });
        itn.push('</table>');
        sec('상세일정', itn.join('\n'));
      }

      if (meeting) sec('미팅장소및시간', '<div class="pre">' + esc(meeting) + '</div>');
      if (String(d.memo || '').trim()) sec('안내 사항', '<div class="pre">' + esc(d.memo) + '</div>');
    }

    if (page === 'core') h.push('<div class="more">※ 참고 사항 · 취소 및 환불 규정 · 유의사항은 별도 안내문에서 확인해 주세요.</div>');
    else {
      if (page === 'notes' && ref) sec('참고 사항', '<div class="pre">' + esc(ref) + '</div>');
      if (cancel) sec('취소및환불정보', '<div class="pre">' + esc(cancel) + '</div>', false);
      sec('유의사항', '<ol class="notes">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ol>');
    }

    h.push('<div class="ft"><div><b>' + esc(COMPANY.name) + '</b>' + (d.staffName ? ' · 담당 ' + esc(d.staffName) : '') + ' · ' + esc(staffTel) + ' (평일 09:00~18:00)</div><div>카카오톡 채널 「메리트투어」</div></div>');
    h.push('</div>' + (view ? '' : '</body></html>'));
    return h.join('\n');
  }

  /* 새 문서의 입력값 */
  function blank(kind, today) {
    var t = today instanceof Date ? today : new Date();
    var al = AIRLINES[DEFAULTS.airline];
    return {
      kind: KIND_LABEL[kind] ? kind : DEFAULTS.kind,
      eventNo: '', issueDate: ymd(t),
      repName: '', phone: '', pax: '', companions: '',
      dep: '', ret: '', nights: '', rounds: '',
      airline: DEFAULTS.airline, flightOut: al.out, flightOutDep: al.outDep, flightOutArr: al.outArr, flightIn: al.inn, flightInDep: al.inDep, flightInArr: al.inArr,
      outArrOffset: '0', inDepOffset: '-1',
      hotel: RESORT.hotel, room: DEFAULTS.room, rooms: '',
      fares: [{ label: '투어비(항공료 포함)', amount: '', qty: '' }], discount: '', depositPP: '', depositPaid: '',
      incl: DEFAULTS.incl, excl: DEFAULTS.excl, ref: DEFAULTS.ref, meeting: DEFAULTS.meeting, cancel: DEFAULTS.cancel,
      itin: '', memo: '', notes: '',
      staffName: '', staffTel: DEFAULTS.staffTel,
      acct: { bank: DEFAULTS.acct.bank, no: DEFAULTS.acct.no, holder: DEFAULTS.acct.holder }
    };
  }

  return {
    COMPANY: COMPANY, RESORT: RESORT, AIRLINES: AIRLINES, DEFAULTS: DEFAULTS, KIND_LABEL: KIND_LABEL, OUT_ARR_LABEL: OUT_ARR_LABEL, IN_DEP_LABEL: IN_DEP_LABEL, PAGE_LABEL: PAGE_LABEL,
    defaultNotes: defaultNotes, blank: blank,
    calc: calc, flights: flights, itinerary: itinerary, validate: validate,
    buildHtml: buildHtml, alimtalk: alimtalk, smsText: smsText, recipient: recipient, companionsOf: companionsOf, recipientsOf: recipientsOf,
    VIA_LABEL: VIA_LABEL, sendEntry: sendEntry,
    fmtDate: fmtDate, won: won, ymd: ymd, parseDate: parseDate, parseLoose: parseLoose, dowOf: dowOf, esc: esc
  };
}));
