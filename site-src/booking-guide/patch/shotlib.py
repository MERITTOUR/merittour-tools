# ※ 인수인계용 사본: 바꾸기 전의 실제 개인정보 문자열은 자리표시(<실제 …>)로 지웠다. 원본 캡처도 묶음에 없으므로 참고용이다.
"""화면 캡처 보정 공용 함수 — 글자 다시 그리기(replace_text), 파란 글자 범위(blue_box), 팝업 창 늘리기(extend_modal)"""
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


def extend_modal(img, x0, y0, x1, y1, extra, radius=8):
    """흰 팝업 창을 아래로 extra px 늘린다(위쪽 모서리는 원본 유지)."""
    W, H = img.size
    big = Image.new('L', (W * SS, H * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle((x0 * SS, y0 * SS, (x1 + 1) * SS - 1, (y1 + 1 + extra) * SS - 1), radius=radius * SS, fill=255)
    mask = np.asarray(big.resize((W, H), Image.LANCZOS)).copy()
    mask[:y1 - 14, :] = 0                      # 아래쪽만 새로 칠함
    img.paste(Image.new('RGB', (W, H), (255, 255, 255)), (0, 0), Image.fromarray(mask))


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
