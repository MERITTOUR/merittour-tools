"""회원용 '홈페이지 예약 방법 안내' 웹 페이지 조립 — 화면 캡처를 잘라 넣고(WebP, 파일 내장) 누를 곳을 표시한다.
한 페이지 안에 「휴대폰 화면」과 「PC 화면」 두 가지 안내가 들어가고, 보는 기기에 맞는 쪽이 자동으로 열린다."""
import base64, io, html, sys
from pathlib import Path
from PIL import Image

# 이 스크립트가 있는 폴더 기준으로 동작한다: guide.template.html · logo.svg · shots/ 가 같은 폴더에 있어야 한다.
# 사용: python3 build_guide.py <출력 index.html 경로>
#   예: python3 build_guide.py ../../../merittour.github.io/2027/booking/index.html   (손님 사이트 저장소의 /2027/booking/)
BASE = Path(__file__).resolve().parent
SHOTS = BASE / 'shots'
LOGO = (BASE / 'logo.svg').read_text(encoding='utf-8').strip()
if len(sys.argv) < 2:
    sys.exit('사용: python3 build_guide.py <출력 index.html 경로>   예) ../../../merittour.github.io/2027/booking/index.html')
OUT = Path(sys.argv[1]).resolve()

# ── 휴대폰·PC 양쪽에 똑같이 들어가는 안내 상자 ──
# CRED 의 「초기 비밀번호 · 변경하신 비밀번호」 줄 = 2026-10-08 Min 「비밀번호는 본인이 한번 수정했으면 수정한 그대로 입력하면 된다고 추가 안내 · 비밀번호 휴대폰 번호는 초기설정 비밀번호」(/2027/ 02 로그인 방법에도 같은 줄).
CRED = '''<div class="callout">
        <span class="co-tag">아이디 · 비밀번호 입력 방법</span>
        <dl class="cred">
          <dt>아이디</dt><dd>대문자 영문 성 + 휴대폰번호<br><code>HONG01012345678</code></dd>
          <dt>비밀번호</dt><dd>휴대폰번호<br><code>01012345678</code></dd>
        </dl>
        <p class="fine">위 예시는 성함이 홍길동, 휴대폰번호가 010-1234-5678인 경우입니다.<br>휴대폰번호는 처음 설정된 <b>초기 비밀번호</b>입니다. 이전에 비밀번호를 변경하신 적이 있으면 <b>변경하신 비밀번호</b>로 로그인하시면 됩니다.<br>로그인이 되지 않을 경우 메리트투어로 문의 부탁드립니다.</p>
      </div>'''
SINGLE = '''<div class="callout warn">
        <span class="co-tag">1인실 추가요금</span>
        <b>아소 야마나미 호텔의 1인실(싱글)</b>은 <b>1박당 2,200엔</b>의 추가요금이 발생합니다.
        <p class="fine">다른 호텔은 추가요금이 다를 수 있습니다.</p>
      </div>'''
AFTER = '''<div class="callout">
        <span class="co-tag">예약 이후</span>
        예약금은 <b>1인당 30만 원</b>이며, 예약금 입금으로 예약이 확정됩니다. 입금 방법은 메리트투어에서 따로 안내드립니다.
      </div>'''
ROOMS = ('<b>쓰실 객실에 맞게</b> 인원을 나누어 넣어 주십시오. '
         '<b>2인실(트윈) 인원은 반드시 짝수</b>(2명 · 4명)로 넣어 주십시오. ')   # 예시는 2명 · 4명만(2026-10-08 Min 「6명 이런 거는 지워 · 6명 이상되는 사람은 잘 없으니까」)
HOME_TITLE = '홈 화면으로 돌아가려면 왼쪽 위 ‘MERITTOUR’ 로고를 누릅니다'
HOME_DESC = ('예약을 마치신 뒤나 다른 화면을 보시다가 <b>홈 화면(첫 화면)</b>으로 돌아가실 때는, '
             '화면 <b>왼쪽 위의 MERITTOUR 로고</b>를 누르시면 됩니다.')
LOGIN_LEAD = '예약은 <b>회원 전용</b>입니다. 먼저 로그인해 주십시오. <b>회원가입 없이</b> 아래 방법으로 바로 로그인하실 수 있습니다.'
DATE_LEAD = '검색하기를 누르면 상품 화면이 나옵니다. <b>달력</b>에서 출발일을 고르고, 그 아래 <b>요금구분</b>에서 인원 수를 정합니다.'
FINISH_LEAD = '마지막으로 예약자 정보를 확인하고 약관에 동의하시면 예약이 접수됩니다.'
# (이력) PC 안내에서 휴대폰 캡처를 쓰는 단계에 「휴대폰 화면 예시입니다. PC에서도 같은 순서로 진행됩니다.」 캡션을 달았었다 — 2026-10-08 Min 「어차피 똑같은 화면이니 지워줘」로 뺐다. 다시 달지 않는다.

# 단계 정의: img, crop(원본 좌표), hl=[(x0,y0,x1,y1,라벨[,'r'])](원본 좌표), title, desc(HTML), extra(HTML)
#   tip=True  → 번호 없는 '참고' 카드(순서에 들어가지 않는 안내)
#   cap='…'   → 화면 아래 작은 설명(지금은 쓰는 단계 없음) / phone=True → PC 안내 안에서 휴대폰 캡처를 쓰는 단계(좁게 · 설명 옆에 표시 · 캡션은 달지 않는다)

# ══ 휴대폰 화면 ══
MOBILE = [
    dict(id='s-login', flow='로그인하기', title='로그인하기', lead=LOGIN_LEAD,
         steps=[
             dict(img='01_main.png', crop=(0, 0, 491, 300), hl=[(438, 6, 482, 46, '여기', 'r')],
                  title='오른쪽 위 메뉴 버튼(줄 3개)을 누릅니다',
                  desc='메리트투어 홈페이지 <b>www.merittour.co.kr</b>에 접속한 뒤, 화면 오른쪽 위의 <b>줄 3개 버튼</b>을 누릅니다.'),
             dict(img='02_menu.png', crop=(0, 0, 490, 330), hl=[(14, 69, 477, 122, '여기')],
                  title='‘로그인을 해주세요’를 누릅니다',
                  desc='메뉴가 열리면 맨 위의 <b>로그인을 해주세요</b>를 누릅니다.'),
             dict(img='03_login.png', crop=(0, 170, 493, 450),
                  hl=[(44, 235, 448, 284, '1'), (44, 288, 448, 337, '2'), (44, 347, 448, 399, '3')],
                  title='아이디와 비밀번호를 넣고 ‘로그인’을 누릅니다',
                  desc='① 아이디 → ② 비밀번호 → ③ <b>로그인</b> 순서로 진행합니다.', extra=CRED),
         ]),
    dict(id='s-search', flow='출발지 · 호텔 · 기간 · 출발월 고르기', title='출발지 · 호텔 · 기간 · 출발월 고르기',
         lead='로그인하신 뒤 첫 화면 가운데의 검색 상자에서 <b>출발지 → 호텔 → 여행기간 → 출발월</b> 순서로 고릅니다.',
         steps=[
             dict(img='04_departure.png', crop=(0, 215, 492, 560), hl=[(41, 391, 453, 485, '여기')],
                  title='출발지를 고릅니다',
                  desc='검색 상자의 맨 위 칸 <b>출발지</b>를 누르면 선택 창이 나옵니다. <b>김해출발</b> 또는 <b>인천출발</b> 중에서 고릅니다.'),
             dict(img='05_hotel.png', crop=(0, 30, 492, 795), hl=[(39, 387, 451, 456, '여기')],
                  title='호텔을 고릅니다',
                  desc='가시려는 <b>호텔</b>을 누릅니다. 목록이 길면 아래로 내려 보실 수 있습니다.<br><span class="eg">예시 · 아소 야마나미 호텔</span>'),
             dict(img='06_duration.png', crop=(0, 290, 491, 585), hl=[(59, 448, 242, 492, '여기')],
                  title='여행기간을 고릅니다',
                  desc='머무실 <b>기간</b>을 누릅니다.<br><span class="eg">예시 · 8일(7박 8일)</span>'),
             dict(img='07_month.png', crop=(0, 265, 490, 705), hl=[(59, 371, 242, 415, '여기')],
                  title='출발월을 고릅니다',
                  desc='출발하실 <b>달</b>을 누릅니다.<br><span class="eg">예시 · 2027년 3월</span>'),
             dict(img='08_confirm.png', crop=(0, 140, 490, 690),
                  hl=[(36, 396, 454, 520, '1'), (36, 581, 456, 649, '2')],
                  title='고르신 내용을 확인하고 ‘검색하기’를 누릅니다',
                  desc='① 출발지 · 호텔 · 기간 · 출발월이 맞는지 확인하고 ② <b>검색하기</b>를 누릅니다.'),
         ]),
    dict(id='s-date', flow='출발일 · 인원 수 정하기', title='출발일 · 인원 수 정하기', lead=DATE_LEAD,
         steps=[
             dict(img='12_fare_real.png', crop=(0, 112, 393, 385), hl=[(166, 169, 229, 281, '여기')],
                  title='달력에서 출발일을 누릅니다',
                  desc='날짜 아래의 숫자(예: <b>85실</b>)는 <b>현재 남은 객실 수</b>입니다. 남은 객실 수가 표시된 날짜 중에서 출발하실 날을 누릅니다.<br><span class="eg">예시 · 3월 10일</span>'),
             dict(img='12_fare_real.png', crop=(0, 400, 393, 830),
                  hl=[(60, 514, 166, 554, '1', 'r'), (60, 636, 166, 676, '2', 'r'), (67, 762, 387, 819, '3')],
                  title='인원 수를 정하고 ‘예약하기’를 누릅니다',
                  desc='<b>요금구분</b>에서 객실 종류마다 <b>− +</b> 버튼을 눌러 <b>인원 수</b>를 정합니다(①②). ' + ROOMS +
                       '오른쪽의 숫자(예: <b>67실</b>)는 현재 남은 객실 수입니다. 인원을 정하신 뒤 맨 아래 ③ <b>예약하기</b>를 누릅니다.'
                       '<br><span class="eg">예시 · 4명 = 2인실(트윈) 2명 + 1인실(싱글) 2명</span>',
                  extra=SINGLE),
         ]),
    dict(id='s-finish', flow='약관 동의 후 예약 마치기', title='약관 동의 후 예약 마치기', lead=FINISH_LEAD,
         steps=[
             dict(img='14_form_checked.png', crop=(0, 262, 391, 730),
                  hl=[(12, 511, 130, 542, '1'), (14, 644, 382, 718, '2')],
                  title='‘전체 약관동의’를 누르고 ‘예약하기’를 누릅니다',
                  desc='예약자 정보(이름 · 이메일 · 휴대폰)를 확인합니다. ① <b>전체 약관동의</b>를 눌러 체크한 뒤 ② <b>예약하기</b>를 누릅니다.'),
             dict(img='15_done.png', crop=(0, 236, 399, 575), hl=[],
                  title='‘예약이 완료되었습니다’ 화면이 나오면 예약 완료입니다',
                  desc='이 화면이 나오면 예약이 접수된 것입니다. <b>예약번호</b>가 함께 표시됩니다.'),
             dict(img='16_detail.png', crop=(2, 105, 401, 460), hl=[],
                  title='예약 내역을 확인합니다',
                  desc='예약 내역 화면에서 예약번호와 진행 단계(<b>예약접수 → 예약대기 → 예약확정 → 여행출발</b>)를 확인하실 수 있습니다.',
                  extra=AFTER),
             dict(tip=True, img='16_detail.png', crop=(2, 0, 401, 215), hl=[(12, 9, 183, 47, '여기', 'r')],
                  title=HOME_TITLE, desc=HOME_DESC),
         ]),
]

# ══ PC 화면 ══ (호텔 선택 창 · 선택 확인 창은 PC 캡처가 없어 휴대폰 캡처를 쓴다 — phone=True · 캡션 없이)
PC = [
    dict(id='s-login', flow='로그인하기', title='로그인하기', lead=LOGIN_LEAD,
         steps=[
             dict(img='p01_main.png', crop=(330, 0, 1575, 160), hl=[(1278, 18, 1328, 84, '여기', 'r')],
                  title='오른쪽 위의 ‘로그인’을 누릅니다',
                  desc='메리트투어 홈페이지 <b>www.merittour.co.kr</b>에 접속한 뒤, 화면 오른쪽 위의 <b>로그인</b>(자물쇠 그림)을 누릅니다.'),
             dict(img='p02_login.png', crop=(560, 240, 1340, 645),
                  hl=[(750, 441, 1150, 491, '1'), (750, 499, 1150, 549, '2'), (750, 563, 1150, 620, '3')],
                  title='아이디와 비밀번호를 넣고 ‘로그인’을 누릅니다',
                  desc='① 아이디 → ② 비밀번호 → ③ <b>로그인</b> 순서로 진행합니다.', extra=CRED),
         ]),
    dict(id='s-search', flow='출발지 · 호텔 · 기간 · 출발월 고르기', title='출발지 · 호텔 · 기간 · 출발월 고르기',
         lead='로그인하신 뒤 첫 화면의 검색 상자에서 <b>출발지 → 호텔 → 여행기간 → 출발월</b> 순서로 고릅니다.',
         steps=[
             dict(img='p03_departure.png', crop=(350, 225, 1300, 780), hl=[(650, 430, 1252, 525, '여기')],
                  title='출발지를 고릅니다',
                  desc='검색 상자의 맨 위 칸 <b>출발지</b>를 누르면 선택 창이 나옵니다. <b>김해출발</b> 또는 <b>인천출발</b> 중에서 고릅니다.'),
             dict(img='05_hotel.png', crop=(0, 30, 492, 795), hl=[(39, 387, 451, 456, '여기')], phone=True,
                  title='호텔을 고릅니다',
                  desc='가시려는 <b>호텔</b>을 누릅니다. 목록이 길면 아래로 내려 보실 수 있습니다.<br><span class="eg">예시 · 아소 야마나미 호텔</span>'),
             dict(img='p05_duration.png', crop=(353, 245, 1303, 790), hl=[(958, 452, 1076, 494, '여기')],
                  title='여행기간을 고릅니다',
                  desc='머무실 <b>기간</b>을 누릅니다.<br><span class="eg">예시 · 8일(7박 8일)</span>'),
             dict(img='p06_month.png', crop=(350, 240, 1300, 780), hl=[(700, 446, 818, 488, '여기')],
                  title='출발월을 고릅니다',
                  desc='출발하실 <b>달</b>을 누릅니다.<br><span class="eg">예시 · 2027년 3월</span>'),
             dict(img='08_confirm.png', crop=(0, 140, 490, 690), phone=True,
                  hl=[(36, 396, 454, 520, '1'), (36, 581, 456, 649, '2')],
                  title='고르신 내용을 확인하고 ‘검색하기’를 누릅니다',
                  desc='① 출발지 · 호텔 · 기간 · 출발월이 맞는지 확인하고 ② <b>검색하기</b>를 누릅니다.'),
         ]),
    dict(id='s-date', flow='출발일 · 인원 수 정하기', title='출발일 · 인원 수 정하기', lead=DATE_LEAD,
         steps=[
             dict(img='p07_calendar_fare.png', crop=(340, 130, 1250, 600), hl=[(734, 341, 857, 396, '여기')],
                  title='달력에서 출발일을 누릅니다',
                  desc='날짜 아래의 숫자(예: <b>82실</b>)는 <b>현재 남은 객실 수</b>입니다. 남은 객실 수가 표시된 날짜 중에서 출발하실 날을 누릅니다.<br><span class="eg">예시 · 3월 10일</span>'),
             dict(img='p07_calendar_fare.png', crop=(340, 0, 1560, 900),
                  hl=[(1110, 736, 1230, 786, '1'), (1110, 824, 1230, 874, '2'), (1264, 8, 1550, 78, '3', 'r')],
                  title='인원 수를 정하고 ‘예약하기’를 누릅니다',
                  desc='달력 아래 <b>요금구분</b>에서 객실 종류마다 <b>− +</b> 버튼을 눌러 <b>인원 수</b>를 정합니다(①②). ' + ROOMS +
                       '‘잔여’ 칸의 숫자(예: <b>66실</b>)는 현재 남은 객실 수입니다. 인원을 정하신 뒤 화면 <b>오른쪽 위</b>의 ③ <b>예약하기</b>를 누릅니다.'
                       '<br><span class="eg">예시 · 4명 = 2인실(트윈) 4명</span>',
                  extra=SINGLE),
         ]),
    dict(id='s-finish', flow='약관 동의 후 예약 마치기', title='약관 동의 후 예약 마치기', lead=FINISH_LEAD,
         steps=[
             dict(img='p08_form.png', crop=(340, 430, 1565, 875),
                  hl=[(360, 622, 504, 655, '1'), (728, 785, 1176, 855, '2')],
                  title='‘전체 약관동의’를 누르고 ‘예약하기’를 누릅니다',
                  desc='예약자 정보(이름 · 이메일 · 휴대폰)를 확인합니다. ① <b>전체 약관동의</b>를 눌러 체크한 뒤 ② <b>예약하기</b>를 누릅니다.'),
             dict(img='p09_done.png', crop=(560, 500, 1340, 905), hl=[],
                  title='‘예약이 완료되었습니다’ 화면이 나오면 예약 완료입니다',
                  desc='이 화면이 나오면 예약이 접수된 것입니다. <b>예약번호</b>가 함께 표시됩니다.'),
             dict(img='p10_detail.png', crop=(370, 50, 1530, 470), hl=[],
                  title='예약 내역을 확인합니다',
                  desc='예약 내역 화면에서 예약번호와 진행 단계(<b>예약접수 → 예약대기 → 예약확정 → 여행출발</b>)를 확인하실 수 있습니다.',
                  extra=AFTER),
             dict(tip=True, img='p09_done.png', crop=(330, 0, 1575, 165), hl=[(342, 25, 597, 75, '여기', 'r')],
                  title=HOME_TITLE, desc=HOME_DESC),
         ]),
]

# (모드 코드, 화면 이름, 단계 목록) — 모드 코드는 요소 id 앞머리(m-… / p-…)와 CSS 클래스(only-m / only-p)에 쓰인다
GUIDES = [('m', '휴대폰 화면', MOBILE), ('p', 'PC 화면', PC)]
assert [s['id'] for s in MOBILE] == [s['id'] for s in PC], '두 안내의 큰 순서(섹션)는 같아야 한다'

_cache = {}


def shot_html(st, label, mode):
    """캡처를 잘라 WebP로 내장하고, 누를 곳(hl)을 % 좌표로 올린다. 반환: (figure HTML, 이미지 바이트 수)"""
    key = (st['img'], st['crop'])
    if key not in _cache:
        im = Image.open(SHOTS / st['img']).convert('RGB')
        x0, y0, x1, y1 = st['crop']
        crop = im.crop((x0, y0, min(x1, im.width), min(y1, im.height)))
        buf = io.BytesIO(); crop.save(buf, 'WEBP', quality=88 if crop.width < 600 else 84, method=6)
        _cache[key] = (crop.size, buf.getvalue())
    (W, H), data = _cache[key]
    x0, y0 = st['crop'][:2]; x1, y1 = x0 + W, y0 + H
    uri = 'data:image/webp;base64,' + base64.b64encode(data).decode()
    marks = ''
    for h in st['hl']:
        hx0, hy0, hx1, hy1, lab = h[:5]
        side = ' r' if len(h) > 5 else ''
        assert x0 <= hx0 < hx1 <= x1 and y0 <= hy0 < hy1 <= y1, ('highlight outside crop', st['img'], h, st['crop'])
        style = f'left:{(hx0 - x0) / W * 100:.2f}%;top:{(hy0 - y0) / H * 100:.2f}%;width:{(hx1 - hx0) / W * 100:.2f}%;height:{(hy1 - hy0) / H * 100:.2f}%'
        marks += f'<span class="hl{side}" style="{style}"><i>{html.escape(lab)}</i></span>'
    alt = html.escape(f'{label} 화면: ' + st['title'])
    wide = mode == 'p' and not st.get('phone')          # PC 캡처: 원래 크기까지만 키우고, 크게 보기는 원본 폭으로
    fig_attr = f' class="shot wide" style="max-width:{W}px"' if wide else ' class="shot"'
    zoom = f' data-zoom="{W}"' if wide else ''
    cap = f'<figcaption>{st["cap"]}</figcaption>' if st.get('cap') else ''
    return (f'<figure{fig_attr}><button type="button" class="shot-frame"{zoom} aria-label="{alt} 크게 보기">'
            f'<img src="{uri}" width="{W}" height="{H}" alt="{alt}">{marks}</button>{cap}</figure>'), len(data)


flows, modes, total, counts = [], [], 0, {}
for mode, mode_name, sections in GUIDES:
    flow, parts, n = [], [], 0
    for si, sec in enumerate(sections, 1):
        flow.append(f'<li><a href="#{mode}-{sec["id"]}"><span class="n">{si}</span>{sec["flow"]}</a></li>')
        out = [f'  <section id="{mode}-{sec["id"]}">',
               f'    <div class="kicker"><span class="no">{si:02d}</span><h2>{sec["title"]}</h2></div>',
               f'    <p class="sec-lead">{sec["lead"]}</p>']
        for st in sec['steps']:
            tip = st.get('tip')
            if not tip: n += 1
            fig, size = shot_html(st, '참고' if tip else f'{n}단계', mode); total += size
            cls = 'step' + (' tip' if tip else '') + (' phone' if st.get('phone') else '')
            sid = f' id="{mode}-tip-home"' if tip else f' id="{mode}-step-{n}"'
            no = '<span class="step-no">참고</span>' if tip else f'<span class="step-no">{n}</span>'
            out.append(f'''    <article class="{cls}"{sid}>
      <div class="step-head">{no}<h3>{st["title"]}</h3></div>
      <p class="step-desc">{st["desc"]}</p>
      {fig}
      {st.get("extra", "")}
    </article>''')
        out.append('  </section>\n')
        parts.append('\n'.join(out))
    counts[mode] = n
    flows.append(f'<ol class="only-{mode}">\n        ' + '\n        '.join(flow) + '\n      </ol>')
    modes.append(f'<div class="mode mode-{mode} only-{mode}" data-mode="{mode}" aria-label="{mode_name} 안내">\n'
                 + '\n'.join(parts) + '</div>\n')

tpl = (BASE / 'guide.template.html').read_text(encoding='utf-8')
assert tpl.count('<!--LOGO-->') == 2 and tpl.count('<!--SECTIONS-->') == 1 and tpl.count('<!--FLOW-->') == 1
page = (tpl.replace('<!--LOGO-->', LOGO).replace('<!--FLOW-->', '\n      '.join(flows))
        .replace('<!--SECTIONS-->', '\n'.join(modes)).replace('<!--CONTACT_NO-->', f'{len(MOBILE) + 1:02d}'))
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page, encoding='utf-8')
print('steps', counts, '(+참고 1개씩) | sections', len(MOBILE), '| images', total // 1024, 'KB | html', len(page.encode()) // 1024, 'KB →', OUT)
