# ※ 인수인계용 사본: 바꾸기 전의 실제 개인정보 문자열은 자리표시(<실제 …>)로 지웠다. 원본 캡처도 묶음에 없으므로 참고용이다.
"""달력·요금구분 화면 보정: '엠클릭테스트' 삭제, 2029.02 → 2027.04(29·30일 셀 추가), 여행기간 날짜, 골프텔 → 호텔.
배경색과의 차이로 글자를 찾으므로 흰 바탕·회색 셀·네이비 카드 위 글자를 모두 처리한다."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

D = Path('/home/claude/guide/shots')
FONTS = {w: f'/usr/share/fonts/opentype/noto/NotoSansCJK-{w}.ttc' for w in ('Regular', 'Medium', 'Bold')}
SS = 4


def render(text, weight, size):
    f = ImageFont.truetype(FONTS[weight], size * SS, index=1)
    w = int(f.getlength(text)) + 40 * SS
    w += (-w) % SS
    big = Image.new('L', (w, 48 * SS), 0)
    ImageDraw.Draw(big).text((10 * SS, 8 * SS), text, font=f, fill=255)
    m = np.asarray(big.resize((w // SS, 48), Image.LANCZOS)).astype(float)
    ys, xs = np.where(m > 127)
    return m, (xs.min(), ys.min(), xs.max(), ys.max())


def analyse(img, box):
    """box 안에서 배경색·글자 영역·글자색·농도 계산"""
    a = np.asarray(img.convert('RGB').crop(box)).astype(int)
    ring = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(ring, axis=0)
    dist = np.abs(a - bg).max(axis=2)
    mx = dist.max()
    assert mx > 40, ('no text found', box, mx)
    ys, xs = np.where(dist > mx * 0.5)
    x0, y0, x1, y1 = box[0] + xs.min(), box[1] + ys.min(), box[0] + xs.max(), box[1] + ys.max()
    strong = a[dist >= mx * 0.8]
    color = tuple(int(v) for v in np.median(strong, axis=0))
    cov = (dist / mx)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return dict(bbox=(x0, y0, x1, y1), bg=tuple(int(v) for v in bg), color=color, mass=float(cov.sum()))


def calibrate(info, old):
    x0, y0, x1, y1 = info['bbox']; w0, h0, mass0 = x1 - x0 + 1, y1 - y0 + 1, info['mass']
    best = None
    for weight in FONTS:
        for size in np.arange(11.5, 19.01, 0.5):
            m, (a, b, c, d) = render(old, weight, float(size))
            w, h = c - a + 1, d - b + 1
            mass = (m[b:d + 1, a:c + 1] / 255).sum()
            score = abs(w - w0) * 3 + abs(h - h0) * 2 + abs(mass - mass0) / max(mass0, 1) * 40
            if best is None or score < best[0]:
                best = (score, weight, float(size), w, h)
    return best[1], best[2], f'orig {w0}x{h0} got {best[3]}x{best[4]} score {best[0]:.1f}'


def replace_text(img, box, old, new, align='left', pad=2, font=None, color=None):
    info = analyse(img, box)
    if color: info['color'] = color          # 가는 획은 표본색이 옅게 잡히므로 알려진 글자색을 지정
    x0, y0, x1, y1 = info['bbox']
    weight, size, note = font or calibrate(info, old)
    m_old, (a, b, c, d) = render(old, weight, size)
    assert abs((c - a) - (x1 - x0)) <= 2, ('width mismatch', old, c - a, x1 - x0, weight, size)
    dx, dy = x0 - a, y0 - b
    ImageDraw.Draw(img).rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), fill=info['bg'])
    if new:
        m_new, (na, nb, nc, nd) = render(new, weight, size)
        if align == 'center':
            dx += round(((a + c) - (na + nc)) / 2)
        elif align == 'right':
            dx += (c - nc)
        img.paste(Image.new('RGB', (m_new.shape[1], m_new.shape[0]), info['color']), (int(dx), int(dy)), Image.fromarray(m_new.astype('uint8')))
    print(f'  "{old}" → "{new}" | {weight} {size}px | color {info["color"]} bg {info["bg"]} | {note}')
    return weight, size, note


def blue_box(img, box, gap=6):
    """box 안에서 파란 글자(날짜·예약번호)만의 범위. 검정 글자의 ClearType 색 번짐도 파랗게 잡히므로,
    파란 점이 세로로 3개 이상인 열만 모아 가장 넓은 덩어리를 고른다."""
    a = np.asarray(img.convert('RGB').crop(box)).astype(int)
    mask = (a[:, :, 2] > 195) & (a[:, :, 0] < 75) & (a[:, :, 1] > 85) & (a[:, :, 1] < 135)
    cols = np.where(mask.sum(axis=0) >= 3)[0]
    groups = []; s0 = p0 = cols[0]
    for c in cols[1:]:
        if c > p0 + gap: groups.append((s0, p0)); s0 = c
        p0 = c
    groups.append((s0, p0))
    g0, g1 = max(groups, key=lambda g: g[1] - g[0])
    ys = np.where(mask[:, g0:g1 + 1].any(axis=1))[0]
    return (box[0] + g0 - 4, box[1] + ys.min() - 4, box[0] + g1 + 5, box[1] + ys.max() + 5)


def add_days(img, row_y, col_x, src_col):
    """마지막 주에 29·30일(마감) 셀 추가: '27' 셀을 복사해 숫자만 바꾼다. col_x = 일~토 셀의 왼쪽 x"""
    y0, y1 = row_y
    sx = col_x[src_col]
    cell = img.crop((sx - 1, y0 - 1, sx + 62, y1 + 2))
    font = None
    for col, day in ((4, '29'), (5, '30')):
        x = col_x[col]
        img.paste(cell, (x - 1, y0 - 1))
        font = replace_text(img, (x + 8, y0 + 3, x + 53, y0 + 23), '27', day, align='center', font=('Bold', 14.0, 'fixed'))


COLS_A = [19, 84, 149, 214, 280, 345, 410]      # 09·10 화면의 셀 왼쪽 x
COLS_B = [20, 85, 150, 215, 281, 346, 411]      # 11 화면(1px 밀림)

# (테스트 상품 달력 캡처 09·10·11 은 실제 2027년 화면으로 대체되어 더 이상 보정하지 않는다)

# ── 08 선택 확인: 실제 2027년 화면(3월 10일 출발 7박 8일)과 맞춘 예시 값 ──
print('08 confirm')
im = Image.open(D / '08_confirm_orig.png').convert('RGB')
CF = ('Bold', 14.0, 'fixed'); INK = (27, 34, 51)
replace_text(im, (115, 430, 440, 455), '일본·구마모토·아소 야마나미 골프텔', '일본·구마모토·아소 야마나미 호텔', font=CF, color=INK)
replace_text(im, (115, 460, 200, 484), '5일', '8일', font=CF, color=INK)
replace_text(im, (115, 490, 440, 514), '2029년 4월', '2027년 3월', font=CF, color=INK)
im.save(D / '08_confirm.png')


def replace_prefix(img, box, old_full, old_prefix, new_prefix, color=None):
    """한 줄 문장의 앞부분(이름)만 바꾼다. 뒤 글자는 원본 그대로 두고, 새 이름은 원래 이름의 오른쪽 끝에 맞춘다."""
    info = analyse(img, box)
    x0, y0, x1, y1 = info['bbox']
    weight, size, note = calibrate(info, old_full)
    m_full, (a, b, c, d) = render(old_full, weight, size)
    assert abs((c - a) - (x1 - x0)) <= 3, ('width mismatch', old_full, c - a, x1 - x0, weight, size)
    dx, dy = x0 - a, y0 - b
    m_old, (pa, pb, pc, pd) = render(old_prefix, weight, size)
    ImageDraw.Draw(img).rectangle((dx + pa - 2, y0 - 2, dx + pc + 2, y1 + 2), fill=info['bg'])
    m_new, (na, nb, nc, nd) = render(new_prefix, weight, size)
    col = color or info['color']
    img.paste(Image.new('RGB', (m_new.shape[1], m_new.shape[0]), col), (int(dx + (pc - nc)), int(dy)), Image.fromarray(m_new.astype('uint8')))
    print(f'  "{old_prefix}" → "{new_prefix}" (in "{old_full}") | {weight} {size}px | {note}')


# ── 14 예약자 정보: 실제 이름·이메일·휴대폰 번호를 예시 값으로 바꿈 ──
print('14 form')
im = Image.open(D / '14_form_checked_orig.png').convert('RGB')
replace_text(im, (126, 342, 352, 372), '<실제 이름>', '홍길동')
replace_text(im, (126, 392, 352, 422), '<실제 이메일>', 'hong@example.com')
replace_text(im, (126, 442, 352, 472), '<실제 휴대폰>', '010-1234-5678')
im.save(D / '14_form_checked.png')

# ── 15 예약 완료: 이름을 예시 값으로 바꿈 ──
print('15 done')
im = Image.open(D / '15_done_orig.png').convert('RGB')
replace_prefix(im, (50, 398, 345, 422), '<실제 이름> 님의 예약번호는 <실제 예약번호> 입니다', '<실제 이름>', '홍길동', color=(0, 0, 0))
replace_text(im, blue_box(im, (50, 398, 345, 422)), '<실제 예약번호>', '30001234')          # 공개 저장소용: 예약번호도 가상 값으로
im.save(D / '15_done.png')

# ── 16 예약 내역: 예약번호·이름을 가상 값으로 ──
print('16 detail')
im = Image.open(D / '16_detail_orig.png').convert('RGB')
replace_text(im, blue_box(im, (60, 128, 340, 160)), '<실제 예약번호>', '30001234')
replace_text(im, (240, 530, 328, 558), '<실제 이름>', '홍길동', align='right')
im.save(D / '16_detail.png')
print('done')
