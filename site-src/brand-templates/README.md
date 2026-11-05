# 홍보 템플릿 생성 (`site-src/brand-templates/` · 2026-11-05)

Google Slides 에서 쓰는 메리트투어 홍보 템플릿 7개(.pptx)를 만드는 스크립트입니다. 만든 pptx 는 `out/`(gitignore)에 두고, 7개와 사용법을 묶은 zip 하나만 `dist/merittour_brand_templates.zip` 에 둡니다 — Drive 「홍보 템플릿」 폴더에 넣는 길이 아래 「Drive 에 넣기」입니다(직원 사용법은 `out/README_사용법.txt` 와 같은 내용을 Drive 「00_템플릿 사용법」 Doc 에 둔다).

| 파일 | 크기 | 장 |
|---|---|---|
| `01_카드뉴스_1080x1080.pptx` | 11.25×11.25 in | 표지 · 밝은 바탕 · 목록 · 숫자 강조 · 사진 전면 · 사진+글 · 문의처 |
| `02_인스타그램_1080x1350.pptx` | 11.25×14.06 in | 표지 · 본문 · 문의처 |
| `03_카카오톡_800x800.pptx` · `04_카카오톡_800x400.pptx` | 8.33×8.33 · 8.33×4.17 in | 밝은 바탕(사진) · 어두운 바탕(글자) |
| `05_유튜브_썸네일_1280x720.pptx` | 13.33×7.5 in | 사진 옆 제목 · 밝은 바탕 |
| `06_리플릿_A4_3단.pptx` | A4 가로 | 바깥면(안쪽 덮개 · 뒷면 · 앞면) · 안쪽면 3단 · 접는 선은 레이아웃 |
| `07_유인물_A4_세로.pptx` | A4 세로 | 안내문(절 3개) · 표 |

## 만들기

```
cd site-src/brand-templates
npm install            # pptxgenjs
node build.js          # out/*.pptx
python3 theme.py out/*.pptx   # 테마에 색 12개 + Noto Serif KR / Noto Sans KR(라틴 · 동아시아) 써 넣기 — 꼭 돌린다
python3 shrink.py out/*.pptx  # 같은 그림 중복 제거 + 압축 — 7개 합쳐 300KB 안팎(Drive 커넥터로 올릴 수 있는 크기)
```

- 로고 · 「사진 자리」 그림은 `assets/` 에 들어 있다(가로 로고 1200px · 마크 320px · 사진 자리 ≤ 960px · 팔레트 PNG — 파일을 작게 두려고 줄인 것. pptxgenjs 는 그림을 쓸 때마다 media 에 또 넣고 압축도 안 해서 `shrink.py` 가 필요하다). 로고가 바뀌면 `node svg2png.mjs`(Playwright 로 `assets/logo-merittour-horizontal.svg` → 네이비 · 흰색 PNG)와 `python3 prep.py`(마크 흰색판 · 사진 자리 그림 · Noto Sans KR 글꼴 필요)로 다시 만든다.
- 색 · 글꼴 · 문의처는 `build.js` 위쪽 `THEME` · `CONTACT` 와 `theme.py` 의 `COLORS` 에 있다(두 곳 같은 값). 팔레트는 `docs/gemini/knowledge/brand_guide.md` 3절.
- 글은 레이아웃의 자리표시자(placeholder)에 들어가고 로고 · 바탕 · 접는 선 · 문의처 줄은 레이아웃에 있다 — Slides 에서는 「테마 수정」으로만 바뀐다. 사진은 슬라이드 위의 실제 그림이라 「이미지 바꾸기」로 교체한다.
- 확인: pptx 를 LibreOffice 로 PDF 로 바꿔 보면 된다(Noto KR 글꼴을 설치해야 한글이 제대로 보인다). Slides 로 올린 뒤에는 글꼴 메뉴 「글꼴 더보기」에서 Noto Serif KR · Noto Sans KR 을 추가한다. Pretendard 는 Slides 에 없다.

## Drive 에 넣기

Drive 커넥터로는 올라가지 않는다(`create_file` `base64Content` 는 파일 내용을 대화로 옮겨 적어야 해서 29KB pptx 가 두 번 깨졌다 — 다시 시도하지 말 것). 길은 셋.

1. **클라우드 세션이 컴퓨터 폴더를 쓸 수 있을 때** — Claude 데스크톱 앱 설정 → Claude Code → Remote Control 에 Google Drive 데스크톱의 「공유 드라이브」 폴더를 등록하고 「휴대폰 및 claude.ai에서 여기에 세션을 시작할 수 있도록 허용」을 켠다. 세션이 그 폴더에 붙으면 `out/*.pptx` 를 「홍보 템플릿」 안에 바로 쓴다(2026-11-05 에는 등록은 됐으나 `not_available` 로 잡혀 못 썼다).
2. **그 컴퓨터에서 도는 세션** — Claude 데스크톱 앱에서 Drive 의 「홍보 템플릿」 폴더를 작업 폴더로 열고 「이 zip 받아서 여기 풀어줘」:
   `https://github.com/MERITTOUR/merittour-tools/raw/main/site-src/brand-templates/dist/merittour_brand_templates.zip`
3. 사람이 zip 을 풀어 폴더에 끌어다 놓기.

올라간 뒤에는 Drive 에서 pptx 마다 「연결 앱 → Google Slides」로 열어 Slides 로 저장한다. 템플릿을 다시 만들면 zip 도 갈아 끼운다: `cd out && rm -f ../dist/merittour_brand_templates.zip && zip -X ../dist/merittour_brand_templates.zip *.pptx README_사용법.txt`.
