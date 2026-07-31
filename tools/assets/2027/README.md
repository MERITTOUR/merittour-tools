# tools/assets/2027/ — 2027 안내문 지역 사진

`tools/booking/asoyamanami2027reservation.html` 의 지역별 사진 스트립에 쓰입니다.

## 올리는 법

지역 폴더를 만들고 **`01.webp` ~ `04.webp`** 이름으로 올리면 코드 수정 없이 바로 붙습니다.
GitHub 웹에서 **Add file → Upload files** 로 드래그하면 됩니다.

```
tools/assets/2027/kumamoto/01.webp
tools/assets/2027/kumamoto/02.webp
tools/assets/2027/nagoya/01.webp
...
```

| 폴더명 | 지역 |
|---|---|
| `kumamoto` | 구마모토 · 아소 야마나미 |
| `nagoya` | 나고야 · 포틴힐즈 |
| `akiba` | 벳푸 · 아키바 리조트 |
| `mutsuki` | 벳푸 · 무츠키 료칸 |
| `ibaraki` | 이바라키 · 시로사토 |
| `nagano` | 나가노 · 스가다이라 |
| `miyazaki` | 미야자키 · 국제공항CC |
| `kl` | 쿠알라룸푸르 · 닐라이스프링스 |

## 권장 규격

- **가로형 16:9**. 화면에는 폭 268px로 나오지만 고해상도 화면을 위해 **가로 1200px 내외** 권장.
- 장당 **80KB 이하**(webp). 8개 지역 × 4장을 다 채워도 2MB 안쪽이라 모바일에서도 무리 없습니다.
- 한 지역에 **최대 4장**까지 표시됩니다(`01`~`04`). 1~3장만 올려도 됩니다.

## 사진이 없을 때

파일이 없으면 **스트립 자체가 사라져** 지금의 문서 모양 그대로입니다. 빈 칸이나 깨진 이미지는 보이지 않습니다.

## 영상

안내문 스크립트 하단 `VIDEO` 에 지역별 주소를 넣으면 그 지역에만 「▶ 영상 보기」 링크가 생깁니다.

```js
var VIDEO = { kumamoto: 'https://youtu.be/xxxxxxxx' };
```

유튜브를 문서에 직접 임베드하지 않는 이유 — 지역마다 넣으면 로딩이 무거워지고,
이 안내문의 조용한 톤과도 맞지 않습니다. 필요해지면 썸네일을 누를 때만 플레이어를 띄우는 방식으로 바꿀 수 있습니다.

## 변환 예시

```python
from PIL import Image
im = Image.open('원본.jpg').convert('RGB')
w = 1200
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save('01.webp', 'WEBP', quality=80, method=6)
```
