"""로고 마크(흰색판)와 「사진 자리」 그림을 만든다. 로고 가로형 PNG 는 svg2png.mjs(Playwright). 사용: python3 prep.py"""
from PIL import Image, ImageDraw, ImageFont
import os
HERE = os.path.dirname(os.path.abspath(__file__)); A = HERE + '/assets/'; TOOLS = os.path.dirname(os.path.dirname(HERE))
src = Image.open(TOOLS + '/assets/logo-merittour-mark-800-alpha.png').convert('RGBA'); src.save(A + 'mark-navy.png')
r, g, b, a = src.split(); L = Image.new('L', src.size, 255); Image.merge('RGBA', (L, L, L, a)).save(A + 'mark-white.png')
FONT = os.environ.get('NOTO_SANS_KR', os.path.expanduser('~/.local/share/fonts/noto-kr/NotoSansKR.ttf'))
def ph(name, w, h, main='사진 자리', sub='Drive 리조트_사진에서 「이미지 바꾸기」'):
    im = Image.new('RGB', (w, h), (0xED, 0xE7, 0xD6)); d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(FONT, max(36, int(min(w, h) * 0.085))); f2 = ImageFont.truetype(FONT, max(22, int(min(w, h) * 0.04)))
    for f, wt in ((f1, 600), (f2, 400)):
        try: f.set_variation_by_axes([wt])
        except Exception: pass
    col = (0x5F, 0x6B, 0x47)
    bb = d.textbbox((0, 0), main, font=f1); d.text(((w - bb[2]) / 2, (h / 2) - bb[3] * 0.95), main, font=f1, fill=col)
    bb2 = d.textbbox((0, 0), sub, font=f2); d.text(((w - bb2[2]) / 2, (h / 2) + bb[3] * 0.45), sub, font=f2, fill=col)
    m = int(min(w, h) * 0.04); d.rectangle([m, m, w - m, h - m], outline=(0xC9, 0xA8, 0x76), width=max(2, int(min(w, h) * 0.004)))
    im.save(A + name + '.png'); print(name, im.size)
ph('ph-square', 1200, 1200); ph('ph-wide', 1600, 900); ph('ph-tall', 1000, 1250); ph('ph-banner', 1800, 700)
ph('ph-map', 1200, 900, '지도 자리', '오시는 길 지도 그림으로 바꾸기'); ph('ph-qr', 600, 600, 'QR 자리', '채널 · 예약 홈페이지 QR')
