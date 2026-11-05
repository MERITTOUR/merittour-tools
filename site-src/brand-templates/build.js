// 메리트투어 홍보 템플릿 7개를 만든다. 실행: npm install && node build.js && python3 theme.py out/*.pptx (theme.py 가 색·글꼴을 써 넣는다)
const pptxgen = require('pptxgenjs');
const A = __dirname + '/assets/', OUT = __dirname + '/out/';
const THEME = { name: 'MERITTOUR', headFontFace: 'Noto Serif KR', bodyFontFace: 'Noto Sans KR',
  colors: { dk1: '1E2618', lt1: 'FFFFFF', dk2: '373F4A', lt2: 'F6F2E8', accent1: '7F6019', accent2: 'C9A876', accent3: '4C573F', accent4: '5F6B47', accent5: 'EDE7D6', accent6: 'D7263D', hlink: '7F6019', folHlink: '4C573F' } };
const HX = THEME.colors;
const CONTACT = '㈜메리트투어 02-365-9800 · 평일 09:00~18:00 · 카카오톡 채널 「메리트투어」';
const IMG = { markNavy: A + 'mark-navy.png', markWhite: A + 'mark-white.png', logoNavy: A + 'logo-navy.png', logoWhite: A + 'logo-white.png', sq: A + 'ph-square.png', wide: A + 'ph-wide.png', tall: A + 'ph-tall.png', banner: A + 'ph-banner.png', map: A + 'ph-map.png', qr: A + 'ph-qr.png' };
const LOGO_R = 2400 / 299.5;
const P = (name, type, o, text) => ({ placeholder: { options: Object.assign({ name, type, margin: 0 }, type === 'title' ? { align: 'left' } : {}, o), text } });
const logo = (x, y, w, white) => ({ image: { x, y, w, h: w / LOGO_R, path: white ? IMG.logoWhite : IMG.logoNavy } });
const mark = (x, y, s, white) => ({ image: { x, y, w: s, h: s, path: white ? IMG.markWhite : IMG.markNavy } });
const line = (x, y, w, h) => ({ line: { x, y, w, h, line: { color: 'BBBBBB', width: 0.75, dashType: 'dash' } } });
function newPres(title, w, h) {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'L', width: w, height: h }); pres.layout = 'L';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.author = '메리트투어'; pres.title = title; pres.subject = '메리트투어 홍보 템플릿';
  return pres;
}
async function save(pres, file) { await pres.writeFile({ fileName: OUT + file }); console.log('wrote', file); }
const photo = (s, path, x, y, w, h, alt) => s.addImage({ path, x, y, w, h, sizing: { type: 'cover', w, h }, altText: alt || '사진 자리' });
const CONTACT_LINES = (C, size) => [
  { text: '전화 02-365-9800', options: { breakLine: true } },
  { text: '카카오톡 채널 「메리트투어」', options: { breakLine: true } },
  { text: '2027 시즌 예약 안내 merittour.github.io/2027', options: { breakLine: true } },
  { text: '예약 홈페이지 www.merittour.co.kr' },
];

async function buildCard() {
  const W = 11.25, H = 11.25, pres = newPres('메리트투어 카드뉴스 템플릿 1080×1080', W, H), C = pres.SchemeColor;
  const label = (y) => P('label', 'body', { x: 1.6, y: y, w: 9.05, h: 0.55, fontSize: 18, bold: true, color: C.accent1, valign: 'middle' }, '지역 · 숙소 이름');
  pres.defineSlideMaster({ title: '표지', background: { color: HX.dk2 }, objects: [
    logo(0.6, 0.6, 3.0, true),
    P('title', 'title', { x: 0.6, y: 7.35, w: 10.05, h: 2.2, fontSize: 54, bold: true, color: C.background1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리 · 두 줄까지'),
    P('sub', 'body', { x: 0.6, y: 9.7, w: 10.05, h: 0.9, fontSize: 24, color: C.accent2, valign: 'top' }, '부제 한 줄'),
  ] });
  pres.defineSlideMaster({ title: '밝은 바탕', background: { color: HX.lt2 }, objects: [
    mark(0.6, 0.55, 0.8), label(0.68),
    P('title', 'title', { x: 0.6, y: 1.85, w: 10.05, h: 1.9, fontSize: 42, bold: true, color: C.text1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('body', 'body', { x: 0.6, y: 3.95, w: 10.05, h: 2.0, fontSize: 22, color: C.accent3, valign: 'top', lineSpacingMultiple: 1.3 }, '본문 두 줄 자리'),
  ] });
  pres.defineSlideMaster({ title: '사진+글', background: { color: HX.lt2 }, objects: [
    mark(0.6, 0.55, 0.8), label(0.68),
    P('title', 'title', { x: 0.6, y: 1.85, w: 10.05, h: 1.9, fontSize: 42, bold: true, color: C.text1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('body', 'body', { x: 5.9, y: 4.0, w: 4.75, h: 6.6, fontSize: 20, color: C.accent3, valign: 'top', lineSpacingMultiple: 1.35 }, '본문 자리 · 사진 옆'),
  ] });
  pres.defineSlideMaster({ title: '숫자 강조', background: { color: HX.lt1 }, objects: [
    mark(0.6, 0.55, 0.8), label(0.68),
    P('number', 'title', { x: 0.6, y: 3.2, w: 10.05, h: 2.8, fontSize: 120, bold: true, color: C.text2, align: 'center', valign: 'middle' }, '15,000엔'),
    P('unit', 'body', { x: 0.6, y: 6.2, w: 10.05, h: 1.2, fontSize: 28, color: C.text1, align: 'center', valign: 'top' }, '기준 한 줄'),
    P('note', 'body', { x: 0.6, y: 9.5, w: 10.05, h: 1.1, fontSize: 16, color: C.accent4, align: 'center', valign: 'top', lineSpacingMultiple: 1.3 }, '조건 · 환율 한 줄'),
  ] });
  pres.defineSlideMaster({ title: '목록', background: { color: HX.lt2 }, objects: [
    mark(0.6, 0.55, 0.8), label(0.68),
    P('title', 'title', { x: 0.6, y: 1.85, w: 10.05, h: 1.4, fontSize: 40, bold: true, color: C.text1, valign: 'top' }, '제목 자리'),
  ] });
  pres.defineSlideMaster({ title: '사진 전면', background: { color: HX.lt1 }, objects: [
    mark(9.85, 9.75, 0.8),
    P('caption', 'title', { x: 0.6, y: 9.05, w: 8.9, h: 0.95, fontSize: 30, bold: true, color: C.text2, valign: 'top' }, '사진 설명 한 줄'),
    P('sub', 'body', { x: 0.6, y: 10.05, w: 8.9, h: 0.6, fontSize: 18, color: C.accent4, valign: 'top' }, '보조 설명'),
  ] });
  pres.defineSlideMaster({ title: '문의처', background: { color: HX.dk2 }, objects: [
    logo(0.6, 0.6, 3.0, true),
    P('title', 'title', { x: 0.6, y: 2.7, w: 10.05, h: 1.3, fontSize: 42, bold: true, color: C.background1, valign: 'top' }, '예약 · 문의'),
    P('body', 'body', { x: 0.6, y: 4.3, w: 10.05, h: 4.8, fontSize: 24, color: C.background1, valign: 'top', lineSpacingMultiple: 1.55 }, '문의처'),
    P('note', 'body', { x: 0.6, y: 9.6, w: 10.05, h: 1.0, fontSize: 18, color: C.accent2, valign: 'top' }, '마감 · 조건 한 줄'),
  ] });

  let s = pres.addSlide({ masterName: '표지' });
  photo(s, IMG.wide, 0.6, 1.6, 10.05, 5.45);
  s.addText('2027 시즌 골프 패키지\n예약 안내', { placeholder: 'title' });
  s.addText('회원님을 위한 아소 야마나미 리조트 · 7박 8일', { placeholder: 'sub' });
  s.addNotes('표지. 제목은 두 줄까지, 부제는 한 줄. 사진은 「이미지 바꾸기」로 교체(Drive 리조트_사진).');

  s = pres.addSlide({ masterName: '밝은 바탕' });
  s.addText('구마모토 · 아소 야마나미 리조트', { placeholder: 'label' });
  s.addText('골프장과 호텔이 한 곳에 있는\n일체형 리조트', { placeholder: 'title' });
  s.addText('창밖으로 펼쳐지는 아소산 전경 · 2인 1실 트윈 · 대욕장 · 노래방 · 당구장 · 빨래방 · 골프숍', { placeholder: 'body' });
  photo(s, IMG.wide, 0.6, 6.3, 10.05, 4.35);
  s.addNotes('본문 장(사진 아래). 라벨 = 지역 · 숙소, 제목 두 줄, 본문 두 줄. 숫자는 2027 안내문에서.');

  s = pres.addSlide({ masterName: '목록' });
  s.addText('나고야 · 포틴힐즈CC', { placeholder: 'label' });
  s.addText('기본 포함 사항', { placeholder: 'title' });
  const items = [['왕복 항공권 · 송영', '공항과 숙소 사이 이동까지 하나의 요금에'], ['숙박 · 식사', '조식 · 중식 · 석식 포함 · 리조트별 포함 내역은 안내문 기준'], ['라운딩', '주중 18홀 + 9홀 서비스 · 주말 · 일본 공휴일 18홀']];
  items.forEach(([h, d], i) => {
    const y = 3.75 + i * 2.35;
    s.addShape(pres.ShapeType.ellipse, { x: 0.6, y, w: 0.95, h: 0.95, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
    s.addText(String(i + 1), { x: 0.6, y, w: 0.95, h: 0.95, fontSize: 26, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(h, { x: 1.85, y: y + 0.02, w: 8.8, h: 0.6, fontSize: 24, bold: true, color: C.text1, valign: 'top', margin: 0, isTextBox: true });
    s.addText(d, { x: 1.85, y: y + 0.7, w: 8.8, h: 1.3, fontSize: 18, color: C.accent3, valign: 'top', margin: 0, lineSpacingMultiple: 1.3, isTextBox: true });
  });
  s.addNotes('목록 장. 항목은 셋이 기본, 넷이면 간격을 줄인다. 원 안 번호는 글자다.');

  s = pres.addSlide({ masterName: '숫자 강조' });
  s.addText('야마나미 호텔 체재비', { placeholder: 'label' });
  s.addText('15,000엔', { placeholder: 'number' });
  s.addText('1박 · 1인 · 2인 1실 기준', { placeholder: 'unit' });
  s.addText('출발월 두 달 전 1일 환율 기준 · 이후 변동에 추가 청구도 차액 정산도 없음\n자세한 조건은 2027 시즌 예약 안내', { placeholder: 'note' });
  s.addNotes('숫자 강조 장. 금액에는 반드시 기준(1인 · 1박 · 2인 1실)과 환율 조건을 함께 적는다.');

  s = pres.addSlide({ masterName: '사진 전면' });
  photo(s, IMG.sq, 0, 0, 11.25, 8.6);
  s.addText('아소 야마나미CC · 27홀', { placeholder: 'caption' });
  s.addText('사진 · 아소 야마나미 리조트', { placeholder: 'sub' });
  s.addNotes('사진 전면 장. 사진은 위 영역에 꽉 차게, 설명은 아래 흰 칸에.');

  s = pres.addSlide({ masterName: '사진+글' });
  s.addText('구마모토 · 시즈노야도 료칸', { placeholder: 'label' });
  s.addText('700년 넘게 이어온\n만간지 온천의 전통 료칸', { placeholder: 'title' });
  photo(s, IMG.tall, 0.6, 4.0, 4.8, 6.6);
  s.addText([{ text: '다다미 객실 · 2인 1실', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } }, { text: '본관과 개인온천이 있는 별채', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } }, { text: '아소 야마나미 리조트에서 차로 30분', options: { bullet: true } }], { placeholder: 'body' });
  s.addNotes('사진 왼쪽 · 글 오른쪽 장. 글은 세 항목 안으로.');

  s = pres.addSlide({ masterName: '문의처' });
  s.addText('예약 · 문의', { placeholder: 'title' });
  s.addText(CONTACT_LINES(C), { placeholder: 'body' });
  s.addText('평일 09:00~18:00 · 회원님 대상 상품입니다', { placeholder: 'note' });
  s.addNotes('마지막 장. 문의처는 바꾸지 않는다. 마감일이 있으면 아래 줄에.');
  await save(pres, '01_카드뉴스_1080x1080.pptx');
}

async function buildInsta() {
  const W = 11.25, H = 14.0625, pres = newPres('메리트투어 인스타그램 템플릿 1080×1350', W, H), C = pres.SchemeColor;
  pres.defineSlideMaster({ title: '표지', background: { color: HX.lt2 }, objects: [
    P('title', 'title', { x: 0.6, y: 8.95, w: 10.05, h: 2.5, fontSize: 48, bold: true, color: C.text2, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리 · 두 줄까지'),
    P('sub', 'body', { x: 0.6, y: 11.6, w: 10.05, h: 1.0, fontSize: 24, color: C.accent3, valign: 'top' }, '부제 한 줄'),
    logo(0.6, 13.0, 3.0),
  ] });
  pres.defineSlideMaster({ title: '본문', background: { color: HX.lt2 }, objects: [
    mark(0.6, 0.55, 0.8),
    P('label', 'body', { x: 1.6, y: 0.68, w: 9.05, h: 0.55, fontSize: 18, bold: true, color: C.accent1, valign: 'middle' }, '지역 · 숙소 이름'),
    P('title', 'title', { x: 0.6, y: 1.85, w: 10.05, h: 1.9, fontSize: 40, bold: true, color: C.text1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('body', 'body', { x: 0.6, y: 3.95, w: 10.05, h: 3.7, fontSize: 22, color: C.accent3, valign: 'top', lineSpacingMultiple: 1.35 }, '본문 세 항목'),
  ] });
  pres.defineSlideMaster({ title: '문의처', background: { color: HX.dk2 }, objects: [
    logo(0.6, 0.6, 3.0, true),
    P('title', 'title', { x: 0.6, y: 3.3, w: 10.05, h: 1.3, fontSize: 42, bold: true, color: C.background1, valign: 'top' }, '예약 · 문의'),
    P('body', 'body', { x: 0.6, y: 4.9, w: 10.05, h: 5.4, fontSize: 24, color: C.background1, valign: 'top', lineSpacingMultiple: 1.55 }, '문의처'),
    P('note', 'body', { x: 0.6, y: 12.2, w: 10.05, h: 1.0, fontSize: 18, color: C.accent2, valign: 'top' }, '마감 · 조건 한 줄'),
  ] });
  let s = pres.addSlide({ masterName: '표지' });
  photo(s, IMG.tall, 0, 0, 11.25, 8.4);
  s.addText('2027 시즌,\n아소 야마나미에서', { placeholder: 'title' });
  s.addText('회원님을 위한 골프 패키지 예약 안내', { placeholder: 'sub' });
  s.addNotes('표지. 사진은 위 영역(세로형이 보기 좋다) · 제목 두 줄 · 부제 한 줄.');
  s = pres.addSlide({ masterName: '본문' });
  s.addText('나가노 · 스가다이라 그린CC', { placeholder: 'label' });
  s.addText('해발 약 1,600m\n고원 라운딩', { placeholder: 'title' });
  s.addText([{ text: '스가다이라 고원 온천호텔 · 스가다이라 맨션', options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } }, { text: '화 → 화 · 목 → 목 7박 · 14박', options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } }, { text: '7박 8일 1,900,000원부터 · 항공 · 송영 · 숙박 · 골프 · 식사 포함', options: { bullet: true } }], { placeholder: 'body' });
  photo(s, IMG.wide, 0.6, 8.0, 10.05, 5.45);
  s.addNotes('본문 장. 항목 세 개 안, 금액은 「부터」와 포함 사항을 같이.');
  s = pres.addSlide({ masterName: '문의처' });
  s.addText('예약 · 문의', { placeholder: 'title' });
  s.addText(CONTACT_LINES(C), { placeholder: 'body' });
  s.addText('평일 09:00~18:00 · 회원님 대상 상품입니다', { placeholder: 'note' });
  s.addNotes('마지막 장. 캡션의 문의처와 같은 내용.');
  await save(pres, '02_인스타그램_1080x1350.pptx');
}

async function buildKakao() {
  const W = 8.3333, pres = newPres('메리트투어 카카오톡 채널 이미지 800×800', W, W), C = pres.SchemeColor;
  pres.defineSlideMaster({ title: '밝은 바탕', background: { color: HX.lt2 }, objects: [
    mark(0.45, 0.42, 0.62),
    P('label', 'body', { x: 1.25, y: 0.5, w: 6.6, h: 0.45, fontSize: 15, bold: true, color: C.accent1, valign: 'middle' }, '지역 · 숙소 이름'),
    P('title', 'title', { x: 0.45, y: 1.35, w: 7.43, h: 1.95, fontSize: 36, bold: true, color: C.text1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('line', 'body', { x: 0.45, y: 3.4, w: 7.43, h: 0.95, fontSize: 18, color: C.accent3, valign: 'top', lineSpacingMultiple: 1.3 }, '한 줄 설명'),
  ] });
  pres.defineSlideMaster({ title: '어두운 바탕', background: { color: HX.dk2 }, objects: [
    logo(0.45, 0.45, 2.6, true),
    P('title', 'title', { x: 0.45, y: 2.3, w: 7.43, h: 2.6, fontSize: 40, bold: true, color: C.background1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('line', 'body', { x: 0.45, y: 5.1, w: 7.43, h: 1.4, fontSize: 20, color: C.accent2, valign: 'top', lineSpacingMultiple: 1.3 }, '한 줄 설명'),
    P('note', 'body', { x: 0.45, y: 7.25, w: 7.43, h: 0.6, fontSize: 14, color: C.accent2, valign: 'top' }, '조건 한 줄'),
  ] });
  let s = pres.addSlide({ masterName: '밝은 바탕' });
  s.addText('2027 시즌 예약 안내', { placeholder: 'label' });
  s.addText('상시예약 기간\n11월 30일(월) 오전 10시', { placeholder: 'title' });
  s.addText('잔여 일정을 횟수 제한 없이 · 회원님 성함으로', { placeholder: 'line' });
  photo(s, IMG.wide, 0.45, 4.55, 7.43, 3.35);
  s.addNotes('채널 메시지 이미지(사진형). 글자는 이미지 안에 적고, 메시지 본문에 같은 내용을 글로도 적는다.');
  s = pres.addSlide({ masterName: '어두운 바탕' });
  s.addText('2027 시즌 골프 패키지\n예약 안내문 공개', { placeholder: 'title' });
  s.addText('전 지역 상품 · 요금 · 환율 · 예약 절차', { placeholder: 'line' });
  s.addText('회원님 대상 · merittour.github.io/2027', { placeholder: 'note' });
  s.addNotes('채널 메시지 이미지(글자형). 사진이 없을 때.');
  await save(pres, '03_카카오톡_800x800.pptx');

  const W2 = 8.3333, H2 = 4.1667, p2 = newPres('메리트투어 카카오톡 채널 이미지 800×400', W2, H2), C2 = p2.SchemeColor;
  p2.defineSlideMaster({ title: '밝은 바탕', background: { color: HX.lt2 }, objects: [
    mark(0.4, 0.35, 0.5),
    P('title', 'title', { x: 0.4, y: 1.0, w: 4.35, h: 1.65, fontSize: 26, bold: true, color: C2.text1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('line', 'body', { x: 0.4, y: 2.75, w: 4.35, h: 0.95, fontSize: 14, color: C2.accent3, valign: 'top', lineSpacingMultiple: 1.3 }, '한 줄 설명'),
  ] });
  p2.defineSlideMaster({ title: '어두운 바탕', background: { color: HX.dk2 }, objects: [
    logo(0.4, 0.4, 2.2, true),
    P('title', 'title', { x: 0.4, y: 1.25, w: 7.5, h: 1.6, fontSize: 30, bold: true, color: C2.background1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('line', 'body', { x: 0.4, y: 2.95, w: 7.5, h: 0.8, fontSize: 15, color: C2.accent2, valign: 'top' }, '한 줄 설명'),
  ] });
  s = p2.addSlide({ masterName: '밝은 바탕' });
  s.addText('홈페이지 예약 방법\n안내 페이지', { placeholder: 'title' });
  s.addText('로그인부터 예약 완료까지 · 휴대폰 · PC', { placeholder: 'line' });
  photo(s, IMG.sq, 4.95, 0.35, 3.0, 3.47);
  s.addNotes('가로형 메시지 이미지. 왼쪽 글 · 오른쪽 사진.');
  s = p2.addSlide({ masterName: '어두운 바탕' });
  s.addText('1차 우선예약 접수가 마감되었습니다', { placeholder: 'title' });
  s.addText('2차 10월 14일(수) 오전 10시 · 2회 예약 가능', { placeholder: 'line' });
  s.addNotes('가로형 글자 이미지. 날짜는 요일을 괄호에.');
  await save(p2, '04_카카오톡_800x400.pptx');
}

async function buildYoutube() {
  const W = 13.3333, H = 7.5, pres = newPres('메리트투어 유튜브 썸네일 템플릿 1280×720', W, H), C = pres.SchemeColor;
  pres.defineSlideMaster({ title: '사진 옆 제목', background: { color: HX.dk2 }, objects: [
    logo(0.7, 0.7, 3.2, true),
    P('title', 'title', { x: 0.7, y: 2.2, w: 5.2, h: 3.2, fontSize: 50, bold: true, color: C.background1, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리 · 세 줄까지'),
    P('tag', 'body', { x: 0.7, y: 5.9, w: 5.2, h: 0.7, fontSize: 20, color: C.accent2, valign: 'top' }, '한 줄 태그'),
  ] });
  pres.defineSlideMaster({ title: '밝은 바탕', background: { color: HX.lt2 }, objects: [
    logo(0.7, 0.65, 3.2),
    P('title', 'title', { x: 0.7, y: 2.3, w: 7.7, h: 3.0, fontSize: 56, bold: true, color: C.text2, valign: 'top', lineSpacingMultiple: 1.1 }, '제목 자리'),
    P('sub', 'body', { x: 0.7, y: 5.6, w: 7.7, h: 0.9, fontSize: 22, color: C.accent3, valign: 'top' }, '부제 한 줄'),
  ] });
  let s = pres.addSlide({ masterName: '사진 옆 제목' });
  photo(s, IMG.wide, 6.3, 0, 7.0333, 7.5);
  s.addText('아소 야마나미\n리조트 4K', { placeholder: 'title' });
  s.addText('구마모토 · 아소 야마나미CC 27홀', { placeholder: 'tag' });
  s.addNotes('썸네일(사진형). 오른쪽 사진 · 왼쪽 제목. 글자 크기는 휴대폰에서 읽히게 크게.');
  s = pres.addSlide({ masterName: '밝은 바탕' });
  s.addText('리조트 안 독채 숙소\n시즈노야도 료칸', { placeholder: 'title' });
  s.addText('아소 프레스티지 · 히노키 스테이 · 소보 테라스 · 돔스테이 · 쿠쥬 프라이빗 타운', { placeholder: 'sub' });
  photo(s, IMG.sq, 8.95, 1.35, 3.75, 4.8);
  s.addNotes('썸네일(글자형). 오른쪽 작은 사진은 빼도 된다.');
  await save(pres, '05_유튜브_썸네일_1280x720.pptx');
}

async function buildLeaflet() {
  const W = 11.69, H = 8.27, PW = W / 3, pres = newPres('메리트투어 리플릿 템플릿 A4 3단', W, H), C = pres.SchemeColor;
  const m = 0.35, cw = PW - 2 * m;
  pres.defineSlideMaster({ title: '바깥면', background: { color: HX.lt1 }, objects: [
    { rect: { x: 0, y: 0, w: PW, h: H, fill: { color: HX.lt2 }, line: { color: HX.lt2, width: 0 } } },
    line(PW, 0, 0, H), line(2 * PW, 0, 0, H),
    P('lhead', 'title', { x: m, y: 0.75, w: cw, h: 0.7, fontSize: 18, bold: true, color: C.text2, valign: 'top' }, '메리트투어의 약속'),
    P('lbody', 'body', { x: m, y: 1.6, w: cw, h: 5.6, fontSize: 10.5, color: C.text1, valign: 'top', lineSpacingMultiple: 1.4 }, '약속 세 가지'),
    P('mhead', 'title', { x: PW + m, y: 0.75, w: cw, h: 0.7, fontSize: 18, bold: true, color: C.text2, valign: 'top' }, '예약 · 문의'),
    P('mbody', 'body', { x: PW + m, y: 1.6, w: cw, h: 2.1, fontSize: 10.5, color: C.text1, valign: 'top', lineSpacingMultiple: 1.45 }, '문의처'),
    P('qrtext', 'body', { x: PW + m + 1.4, y: 6.35, w: cw - 1.4, h: 1.1, fontSize: 9, color: C.accent4, valign: 'middle', lineSpacingMultiple: 1.3 }, 'QR 설명'),
    P('address', 'body', { x: PW + m, y: 7.6, w: cw, h: 0.45, fontSize: 8.5, color: C.accent4, valign: 'top' }, '주소'),
    P('ftitle', 'title', { x: 2 * PW + m, y: 5.0, w: cw, h: 1.55, fontSize: 24, bold: true, color: C.text2, valign: 'top', lineSpacingMultiple: 1.1 }, '앞면 제목'),
    P('fsub', 'body', { x: 2 * PW + m, y: 6.6, w: cw, h: 0.6, fontSize: 11, color: C.accent3, valign: 'top' }, '앞면 부제'),
    logo(2 * PW + m, 7.45, 2.4),
  ] });
  const inside = [];
  for (let i = 0; i < 3; i++) {
    const x = i * PW + m;
    inside.push(P('c' + i + 'label', 'body', { x, y: 0.6, w: cw, h: 0.35, fontSize: 10, bold: true, color: C.accent1, valign: 'top' }, '0' + (i + 1) + ' 소제목'));
    inside.push(P('c' + i + 'title', 'title', { x, y: 1.0, w: cw, h: 0.85, fontSize: 18, bold: true, color: C.text2, valign: 'top', lineSpacingMultiple: 1.1 }, '단 제목'));
    inside.push(P('c' + i + 'body', 'body', { x, y: 1.95, w: cw, h: 3.85, fontSize: 10.5, color: C.text1, valign: 'top', lineSpacingMultiple: 1.4 }, '단 본문'));
  }
  pres.defineSlideMaster({ title: '안쪽면', background: { color: HX.lt1 }, objects: [line(PW, 0, 0, H), line(2 * PW, 0, 0, H), ...inside] });

  let s = pres.addSlide({ masterName: '바깥면' });
  s.addText('메리트투어의 약속', { placeholder: 'lhead' });
  s.addText([
    { text: '회원 예약 관리', options: { bold: true, breakLine: true } }, { text: '회원 예약, 연부킹, 일정별 가능 여부 확인을 체계적으로 관리합니다.', options: { breakLine: true, paraSpaceAfter: 10 } },
    { text: '원스톱 골프여행', options: { bold: true, breakLine: true } }, { text: '항공, 숙박, 라운딩, 송영을 한 번에 연결해 복잡한 해외 골프 일정을 간편하게 준비하실 수 있습니다.', options: { breakLine: true, paraSpaceAfter: 10 } },
    { text: '상담 중심 운영', options: { bold: true, breakLine: true } }, { text: '전화, 카카오톡, 문자 안내를 통해 출발 전부터 귀국까지 필요한 정보를 단계별로 안내드립니다.' },
  ], { placeholder: 'lbody' });
  s.addText('예약 · 문의', { placeholder: 'mhead' });
  s.addText([{ text: '전화 02-365-9800 · 평일 09:00~18:00', options: { breakLine: true } }, { text: '카카오톡 채널 「메리트투어」', options: { breakLine: true } }, { text: '예약 홈페이지 www.merittour.co.kr', options: { breakLine: true } }, { text: '2027 시즌 예약 안내 merittour.github.io/2027' }], { placeholder: 'mbody' });
  photo(s, IMG.map, PW + m, 3.9, cw, 2.2, '지도 자리');
  s.addImage({ path: IMG.qr, x: PW + m, y: 6.3, w: 1.2, h: 1.2, altText: 'QR 자리' });
  s.addText('QR 을 찍으면 카카오톡 채널 또는 예약 홈페이지로 바로 이동합니다.', { placeholder: 'qrtext' });
  s.addText('서울특별시 마포구 월드컵북로 15 엠지엘빌딩 6층 601호', { placeholder: 'address' });
  photo(s, IMG.tall, 2 * PW, 0, PW, 4.7);
  s.addText('2027 시즌\n골프 패키지', { placeholder: 'ftitle' });
  s.addText('회원님을 위한 일본 골프 리조트 안내', { placeholder: 'fsub' });
  s.addNotes('바깥면. 왼쪽 = 안쪽으로 접히는 면(약속) · 가운데 = 뒷면(문의처 · 지도 · QR) · 오른쪽 = 앞면(표지). 점선은 접는 선이며 인쇄에는 안 나오게 지우거나 그대로 두어도 연하다.');

  s = pres.addSlide({ masterName: '안쪽면' });
  const cols = [['01 지역', '구마모토\n아소 야마나미 리조트', '구마모토 공항에서 약 1시간. 골프장과 호텔이 한 곳에 있는 일체형 리조트로, 아소 야마나미CC 27홀을 주중 18홀 + 9홀 서비스로 라운딩합니다. 리조트 안 독채 숙소 5곳, 간지호텔, 시즈노야도 료칸까지 숙소를 고르실 수 있습니다.'],
    ['02 상품 · 포함 사항', '항공 · 숙박 · 라운딩 · 송영\n하나의 요금에', '왕복 항공권, 공항–숙소 송영, 여행자보험, 숙박, 식사, 라운딩이 포함됩니다. 체재비는 1인 · 1박 기준, 송영비는 1인 · 왕복 기준이며 출발월 두 달 전 1일 환율로 원화 금액을 정해 이후 변동에 추가 청구도 차액 정산도 없습니다.'],
    ['03 예약 방법 · 회원권', '회원님 성함으로\n예약 홈페이지에서', '아이디는 대문자 영문 성 + 휴대폰번호, 비밀번호는 휴대폰번호입니다. 예약금 1인당 30만 원을 예약일 기준 7일 이내 입금하시면 예약이 확정되고, 확정서는 출발 2개월 전부터 카카오톡 채널로 안내드립니다.']];
  cols.forEach(([l, t, b], i) => { s.addText(l, { placeholder: 'c' + i + 'label' }); s.addText(t, { placeholder: 'c' + i + 'title' }); s.addText(b, { placeholder: 'c' + i + 'body' }); photo(s, IMG.wide, i * PW + m, 5.95, cw, 1.9); });
  s.addNotes('안쪽면 세 단. 단마다 소제목 · 제목 · 본문 · 사진. 본문은 10.5pt · 7줄 안.');
  await save(pres, '06_리플릿_A4_3단.pptx');
}

async function buildHandout() {
  const W = 8.27, H = 11.69, pres = newPres('메리트투어 유인물 템플릿 A4 세로', W, H), C = pres.SchemeColor;
  const head = [logo(0.6, 0.55, 2.4),
    P('kind', 'body', { x: 4.6, y: 0.58, w: 3.07, h: 0.32, fontSize: 9, color: C.accent4, align: 'right', valign: 'middle' }, '문서 종류 · 날짜'),
    P('title', 'title', { x: 0.6, y: 1.15, w: 7.07, h: 0.9, fontSize: 24, bold: true, color: C.text2, valign: 'top' }, '문서 제목'),
    P('intro', 'body', { x: 0.6, y: 2.1, w: 7.07, h: 0.8, fontSize: 11, color: C.accent3, valign: 'top', lineSpacingMultiple: 1.4 }, '머리글 두 줄'),
    P('footer', 'body', { x: 0.6, y: 10.95, w: 7.07, h: 0.35, fontSize: 8.5, color: C.accent4, valign: 'middle' }, CONTACT)];
  const secs = [];
  [3.1, 5.45, 7.8].forEach((y, i) => { secs.push(P('s' + i + 't', 'body', { x: 0.6, y, w: 7.07, h: 0.4, fontSize: 12.5, bold: true, color: C.text2, valign: 'top' }, '절 제목')); secs.push(P('s' + i + 'b', 'body', { x: 0.6, y: y + 0.42, w: 7.07, h: 1.75, fontSize: 10.5, color: C.text1, valign: 'top', lineSpacingMultiple: 1.4 }, '절 본문')); });
  pres.defineSlideMaster({ title: '안내문', background: { color: HX.lt1 }, objects: [...head, ...secs] });
  pres.defineSlideMaster({ title: '표', background: { color: HX.lt1 }, objects: head });

  let s = pres.addSlide({ masterName: '안내문' });
  s.addText('출발 안내 · 2027년 5월', { placeholder: 'kind' });
  s.addText('출발 전 확인하실 사항', { placeholder: 'title' });
  s.addText('출발일이 가까워지면 아래 내용을 한 번 더 확인해 주시기 바랍니다. 궁금하신 점은 카카오톡 채널로 문의해 주세요.', { placeholder: 'intro' });
  const body = [['공항 · 집합', '인천공항 출발 2시간 30분 전 지정 카운터 앞에서 담당자를 만나시면 됩니다. 여권 유효기간(6개월 이상)과 골프백 무게를 미리 확인해 주세요.'],
    ['현지 일정', '리조트 도착 후 점심 식사와 오후 라운딩으로 일정이 시작됩니다. 주간 저녁 메뉴와 라운딩 코스는 현지 사정에 따라 바뀔 수 있습니다.'],
    ['연락처', '여행 중 긴급 연락은 담당자 휴대전화 또는 메리트투어 카카오톡 채널로 주시면 됩니다. 현지 리조트 프런트에서도 한국어 안내를 받으실 수 있습니다.']];
  body.forEach(([t, b], i) => { s.addText(t, { placeholder: 's' + i + 't' }); s.addText(b, { placeholder: 's' + i + 'b' }); });
  s.addText(CONTACT, { placeholder: 'footer' });
  s.addNotes('A4 세로 안내문. 절 세 개가 기본 · 더 길면 2쪽으로. 본문 10.5pt.');

  s = pres.addSlide({ masterName: '표' });
  s.addText('일본 입국 안내 · 2027년', { placeholder: 'kind' });
  s.addText('Visit Japan Web 에 적으실 숙소 정보', { placeholder: 'title' });
  s.addText('아래 항목을 그대로 옮겨 적으시면 됩니다. 영문 표기는 리조트의 공식 표기입니다.', { placeholder: 'intro' });
  const hdr = { bold: true, fill: { color: 'EDE7D6' }, color: '1E2618' };
  s.addTable([
    [{ text: '항목', options: hdr }, { text: '내용', options: hdr }],
    ['숙소 이름', 'ASO YAMANAMI RESORT HOTEL & GOLF CLUB'],
    ['우편번호', '869-2702'],
    ['주소', '630 Ori, Ubuyama, Aso District, Kumamoto'],
    ['전화', '+81-967-25-2331'],
    ['체류 기간', '2027년 5월 11일(화) ~ 5월 18일(화) · 7박'],
  ], { x: 0.6, y: 3.2, w: 7.07, colW: [1.9, 5.17], fontSize: 10.5, fontFace: '+mn-lt', color: '1E2618', border: { type: 'solid', pt: 0.5, color: 'D9D2C0' }, margin: 0.08, valign: 'middle', rowH: 0.42, autoPage: false });
  s.addText(CONTACT, { placeholder: 'footer' });
  s.addNotes('표 양식. 머리 행은 띠색(EDE7D6). 행을 더하려면 표를 선택해 아래에 행 삽입.');
  await save(pres, '07_유인물_A4_세로.pptx');
}

(async () => { await buildCard(); await buildInsta(); await buildKakao(); await buildYoutube(); await buildLeaflet(); await buildHandout(); })().catch(e => { console.error(e); process.exit(1); });
