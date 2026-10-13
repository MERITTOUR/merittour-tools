"""「선택 N / 16명」 → 「N / 4명」 보정(2026-10-13 · Min 「요금 구분을 보통은 4명까지 예약 가능하거든 · 16을 4명으로 바꿔줘」).
글꼴을 새로 그리지 않고, 같은 크기로 찍힌 「4」(12_fare_real.png 의 「선택 4 / 16명」)와 각 캡처 자신의 「명」을 떼어 붙인다.
대상: 17_fare_dates.png(휴대폰) · p11_fare_dates.png(PC) · 12_fare_real.png(인원 단계 · 「4 / 16명」 → 「4 / 4명」).
한 번만 돌린다 — 「16」 자리가 이미 비어 있으면 멈춘다(두 번 돌리면 글자가 어긋난다). 실행: python3 patch/patch_pax4.py (shots/ 안에서 제자리 수정)."""
from pathlib import Path
from PIL import Image
import numpy as np

S = Path(__file__).resolve().parent.parent / 'shots'
WHITE = (255, 255, 255)

def dark(im, box, thr=100):
    a = np.asarray(im.crop(box)).astype(int); return (255 - a).max(axis=2).max()

def fix(path, src4, four_box, six_end, myung_box, erase_box, row):
    """path 의 「16명」을 「4명」으로. four_box = 원본 12 의 「4」 영역(여백 1px 포함) · six_end = 「6」 마지막 열 ·
    myung_box = 이 캡처의 「명」 영역(왼쪽 AA 열부터 · 여백 1px 포함) · erase_box = 「16명」을 지울 영역 · row = 「4」를 붙일 (x, y)"""
    im = Image.open(S / path).convert('RGB')
    assert dark(im, (six_end - 3, erase_box[1], six_end + 1, erase_box[3])) > 150, (path, '「16」이 이미 없다 — 두 번 돌린 것')
    four = Image.open(S / src4).convert('RGB').crop(four_box)
    myung = im.crop(myung_box)
    im.paste(Image.new('RGB', (erase_box[2] - erase_box[0], erase_box[3] - erase_box[1]), WHITE), erase_box[:2])
    im.paste(four, row)
    gap = myung_box[0] - six_end - 1                     # 원본에서 「6」과 「명」 사이(AA 열 포함 0)
    mx = row[0] + four.width - 1 + gap                   # 「4」 영역 끝(여백 열) 바로 뒤
    im.paste(myung, (mx, myung_box[1]))
    im.save(S / path)
    print(f'{path}: 4 at x{row[0]}..{row[0]+four.width-1} · 명 at x{mx}..{mx+myung.width-1}')

# 휴대폰 두 장 — 같은 자리(선택 x89 · 숫자 x115 · 16 x134..148 · 명 x149..159). 12 의 「4」 = x114..123(여백 포함) y419..430
fix('17_fare_dates.png', '12_fare_real.png', (114, 419, 124, 431), 148, (149, 292, 161, 309), (133, 292, 162, 309), (133, 294))
fix('12_fare_real.png', '12_fare_real.png', (114, 419, 124, 431), 148, (149, 417, 161, 434), (133, 417, 162, 434), (133, 419))
# PC — 숫자 높이가 휴대폰과 같다(「0」 w7 h10). 16 x222..235 · 명 x236..246(236 = 왼쪽 AA 열)
fix('p11_fare_dates.png', '12_fare_real.png', (114, 419, 124, 431), 235, (236, 563, 248, 578), (221, 563, 249, 578), (221, 564))
