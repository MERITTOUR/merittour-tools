# ※ 인수인계용 사본: 바꾸기 전의 실제 개인정보 문자열은 자리표시(<실제 …>)로 지웠다. 원본 캡처도 묶음에 없으므로 참고용이다.
"""PC 화면 캡처 보정: 출발월 창 — 제목 '언제 출발하시나요?' · 2027년 3~12월 10칸"""
from pathlib import Path
from PIL import Image
from shotlib import replace_text, replace_prefix, blue_box, extend_modal

P = Path('/home/claude/guide/shots_pc')

print('p06 month (PC)')
im = Image.open(P / 'p06_month_orig.png').convert('RGB')
blank = Image.open(P / 'p05_duration.png').convert('RGB').crop((701, 450, 821, 495))   # 선택 안 된 버튼('4일') 한 칸
extend_modal(im, 627, 343, 1274, 557, 106)
replace_text(im, (700, 362, 1200, 396), '어디서 출발하시나요?', '언제 출발하시나요?', align='center')
font = None
for i, m in enumerate(range(3, 13)):
    if m == 3:
        continue                                   # 3월은 원본(선택된 모양) 그대로 — 안내의 예시
    x = 700 + 128 * (i % 4); y = 445 + 53 * (i // 4)
    im.paste(blank, (x - 1, y - 1))
    font = replace_text(im, (x + 8, y + 6, x + 110, y + 37), '4일', f'2027년 {m}월', align='center', font=font, color=(27, 34, 51))
im.save(P / 'p06_month.png')

# ── 실제 계정 정보 → 가상 값 (공개 저장소 규칙: 홍길동 · 010-1234-5678 · 예약번호도 가상) ──
print('p08 form (PC)')
im = Image.open(P / 'p08_form_orig.png').convert('RGB')
replace_text(im, (418, 534, 718, 570), '<실제 이름>', '홍길동')
replace_text(im, (1240, 534, 1525, 570), '<실제 휴대폰>', '010-1234-5678')
im.save(P / 'p08_form.png')

print('p09 done (PC)')
im = Image.open(P / 'p09_done_orig.png').convert('RGB')
replace_prefix(im, (790, 668, 1112, 700), '<실제 이름> 님의 예약번호는 <실제 예약번호> 입니다', '<실제 이름>', '홍길동', color=(0, 0, 0))
replace_text(im, blue_box(im, (790, 668, 1112, 700)), '<실제 예약번호>', '30001234')
im.save(P / 'p09_done.png')

print('p10 detail (PC)')
im = Image.open(P / 'p10_detail_orig.png').convert('RGB')
replace_text(im, blue_box(im, (860, 80, 1040, 112)), '<실제 예약번호>', '30001234')
replace_text(im, (1340, 625, 1448, 657), '<실제 이름>', '홍길동', align='right')
im.save(P / 'p10_detail.png')
print('done')
