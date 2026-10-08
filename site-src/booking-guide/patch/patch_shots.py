# ※ 인수인계용 사본: 바꾸기 전의 실제 개인정보 문자열은 자리표시(<실제 …>)로 지웠다. 원본 캡처도 묶음에 없으므로 참고용이다.
"""예약 화면 캡처 보정: 골프텔→호텔, 기간 '8일' 추가, 출발월 2027년 3~12월, 제목 '언제 출발하시나요?'
원본 픽셀은 최대한 그대로 두고, 바뀌는 글자만 같은 글꼴(Noto Sans KR)로 다시 그린다."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

D = Path('/home/claude/guide/shots')
FONTS = {w: f'/usr/share/fonts/opentype/noto/NotoSansCJK-{w}.ttc' for w in ('Regular', 'Medium', 'Bold')}
SS = 4  # 글자 렌더링 슈퍼샘플 배율


def render(text, weight, size):
    """글자 알파 마스크(1배)와 잉크 bbox 반환"""
    f = ImageFont.truetype(FONTS[weight], size * SS, index=1)
    w = int(f.getlength(text)) + 40 * SS
    w += (-w) % SS
    big = Image.new('L', (w, 48 * SS), 0)
    ImageDraw.Draw(big).text((10 * SS, 8 * SS), text, font=f, fill=255)
    m = np.asarray(big.resize((w // SS, 48), Image.LANCZOS)).astype(float)
    ys, xs = np.where(m > 127)
    return m, (xs.min(), ys.min(), xs.max(), ys.max())


def ink_bbox(img, box, thr=128):
    a = np.asarray(img.convert('L').crop(box)).astype(int)
    ys, xs = np.where(a < thr)
    assert len(xs), ('no ink', box)
    return box[0] + xs.min(), box[1] + ys.min(), box[0] + xs.max(), box[1] + ys.max()


def calibrate(img, box, old):
    """원본 글자와 폭·높이·농도가 가장 가까운 (굵기, 크기) 찾기"""
    x0, y0, x1, y1 = ink_bbox(img, box)
    w0, h0 = x1 - x0 + 1, y1 - y0 + 1
    lum = np.asarray(img.convert('L').crop((x0, y0, x1 + 1, y1 + 1))).astype(float)
    bg = float(np.percentile(lum, 98)); fg = float(lum.min())
    mass0 = ((bg - lum).clip(0) / max(bg - fg, 1)).sum()
    best = None
    for weight in FONTS:
        for size in np.arange(12.5, 18.01, 0.5):
            m, (a, b, c, d) = render(old, weight, float(size))
            w, h = c - a + 1, d - b + 1
            mass = (m[b:d + 1, a:c + 1] / 255).sum()
            score = abs(w - w0) * 3 + abs(h - h0) * 2 + abs(mass - mass0) / max(mass0, 1) * 40
            if best is None or score < best[0]:
                best = (score, weight, float(size), w, h, round(mass))
    return best[1], best[2], dict(orig=(w0, h0, round(mass0)), got=best[3:], score=round(best[0], 1))


def replace_text(img, box, old, new, align='left', pad=3, font=None):
    """box 안의 old 글자를 지우고 같은 자리에 new를 그린다. align='center'면 원래 글자의 가운데에 맞춘다."""
    x0, y0, x1, y1 = ink_bbox(img, box)
    weight, size, info = font or calibrate(img, box, old)
    px = np.asarray(img.convert('RGB')).astype(int)
    region = px[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3)
    color = tuple(int(v) for v in region[region.sum(axis=1).argmin()])
    bgc = tuple(int(v) for v in np.median(px[y0 - pad:y0 - 1, x0:x1 + 1].reshape(-1, 3), axis=0))
    m_old, (a, b, c, d) = render(old, weight, size)
    assert abs((c - a) - (x1 - x0)) <= 2, ('width mismatch', old, c - a, x1 - x0, weight, size)
    dx, dy = x0 - a, y0 - b
    ImageDraw.Draw(img).rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), fill=bgc)
    m_new, (na, nb, nc, nd) = render(new, weight, size)
    if align == 'center':
        dx += round(((a + c) - (na + nc)) / 2)
    layer = Image.new('RGB', (m_new.shape[1], m_new.shape[0]), color)
    img.paste(layer, (int(dx), int(dy)), Image.fromarray(m_new.astype('uint8')))
    print(f'  "{old}" → "{new}" | {weight} {size}px | color {color} | {info}')
    return weight, size, info


def extend_modal(img, x0, y0, x1, y1, extra, radius=8):
    """흰 팝업 창을 아래로 extra px 늘린다(위쪽 모서리는 원본 유지)."""
    W, H = img.size
    big = Image.new('L', (W * SS, H * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle((x0 * SS, y0 * SS, (x1 + 1) * SS - 1, (y1 + 1 + extra) * SS - 1), radius=radius * SS, fill=255)
    mask = np.asarray(big.resize((W, H), Image.LANCZOS)).copy()
    mask[:y1 - 14, :] = 0                      # 아래쪽만 새로 칠함
    img.paste(Image.new('RGB', (W, H), (255, 255, 255)), (0, 0), Image.fromarray(mask))


# ── 05 호텔 선택: 골프텔 → 호텔 ──
print('05 hotel')
im = Image.open(D / '05_hotel_orig.png').convert('RGB')
replace_text(im, (50, 400, 440, 423), '일본·구마모토·아소 야마나미 골프텔', '일본·구마모토·아소 야마나미 호텔')
replace_text(im, (50, 475, 440, 498), '일본·나고야·포틴힐즈CC골프텔', '일본·나고야·포틴힐즈CC호텔')
im.save(D / '05_hotel.png')

# ── 06 여행기간: '8일' 추가 ──
print('06 duration')
im = Image.open(D / '06_duration_orig.png').convert('RGB')
btn = im.crop((61, 400, 240, 440))            # '4일' 버튼(테두리 포함)
extend_modal(im, 18, 316, 471, 509, 50)
im.paste(btn, (61, 450))
replace_text(im, (70, 455, 230, 485), '4일', '8일', align='center')
im.save(D / '06_duration.png')

# ── 07 출발월: 제목 교체 + 2027년 3~12월 ──
print('07 month')
im = Image.open(D / '07_month_orig.png').convert('RGB')
btn = im.crop((61, 373, 240, 413))            # '2029년 1월' 버튼
extend_modal(im, 18, 289, 471, 532, 150)
replace_text(im, (60, 300, 430, 330), '어디서 출발하시나요?', '언제 출발하시나요?', align='center')
months = [f'2027년 {m}월' for m in range(3, 13)]
font = None
for i, label in enumerate(months):
    x = (61, 250)[i % 2]; y = 373 + 50 * (i // 2)
    im.paste(btn, (x, y))
    font = replace_text(im, (x + 10, y + 5, x + 170, y + 35), '2029년 1월', label, align='center', font=font)
im.save(D / '07_month.png')

# ── 08 선택 확인: 골프텔 → 호텔, 출발월 2027년 4월 ──
print('08 confirm')
im = Image.open(D / '08_confirm_orig.png').convert('RGB')
CF = ('Bold', 14.0, 'fixed')                # 값 열은 Bold 14px (두 줄 폭 모두 일치)
replace_text(im, (115, 430, 440, 455), '일본·구마모토·아소 야마나미 골프텔', '일본·구마모토·아소 야마나미 호텔', font=CF)
replace_text(im, (115, 490, 440, 514), '2029년 4월', '2027년 4월', font=CF)
im.save(D / '08_confirm.png')
print('done')
