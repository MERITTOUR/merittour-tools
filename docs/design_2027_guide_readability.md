# 2027 예약 안내문 — 읽기 편하게 · 사진 넣기

대상: **`merittour.github.io/2027/`** (손님 공개 안내문, **다른 저장소**).
이 저장소에는 그 주소로 보내는 리다이렉트 두 장(`tools/booking/2027guide/`,
`tools/booking/asoyamanami2027reservation.html`)만 남아 있다.

여기 적힌 코드는 **그대로 붙여넣어 쓰라고** 만든 것이다. 실제로 렌더해서
데스크톱·모바일(390px) 양쪽을 확인했다.

---

## 1. 색 — 베이지 라이트로 고정 (2026-08 갱신)

> **먼저 읽을 것 — 이 절의 세이지 제안은 폐기되었다.**
> 실제로 세이지(`#E7EDE0`)를 적용해 보니 **바탕과 글자가 같은 색 계열**이었다.
> 글자가 올리브·골드인데 바탕까지 초록이면 밝기 차이만으로 버티게 되어
> 「글씨가 잘 안 보인다」는 말이 나왔다. 그래서 **바탕만 베이지로 옮기고
> 글자색은 그대로 두어 색상 대비를 만들었다.** 현재 값:
>
> ```css
> :root{
>   --paper:#F6F2E8; --surface:#FFFFFF; --surface-warm:#FCFAF4; --band:#EDE7D6;
>   --ink:#1E2618; --ink-soft:#4C573F; --muted:#5F6B47;
>   --line:#DFD8C5; --line-soft:#E9E3D2;
>   --olive:#5A6C3E; --olive-deep:#47562F;
>   --gold:#7F6019; --gold-soft:#9E7C33; --member-bg:#FFFFFF; --member-line:#D3BA85;
> }
> ```
>
> 대비비 본문 **13.96** · 보조문 **6.85** · 라벨 **5.10** · 골드 **5.23** — 전부 AA 통과,
> 페이지 전체 최저 4.62. 아래 본문의 「베이지·골드 계열 비선호」 원칙보다
> **이 결정이 우선한다.** 세이지로 되돌리지 말 것.
>
> 함께 배운 것 두 가지 —
> ① `--muted`(라벨 50곳 `.facts dt`)가 대비 미달의 **유일한 원인**이었다. 색을 만질 때는
>    변수별로 짐작하지 말고 **실제 렌더에서 글자마다 대비비를 재면** 범인이 한 번에 나온다.
> ② 바탕 계열을 바꾸면 그 위에 얹힌 면(회원 패널·콜아웃 카드)이 같이 묻힌다.
>    배경만 바꾸고 끝내지 말 것.

### (아래는 폐기된 세이지 제안 — 경위 보존용)

### 무엇이 문제였나
`@media (prefers-color-scheme:dark)` 가 있어서 **같은 안내문이 기기 설정에 따라**
짙은 올리브(다크)와 밝은 오프화이트(라이트)로 갈려 보였다. 「어디서는 초록,
어디서는 베이지」의 정체가 이것이다. 직원이 스크린샷을 떠서 카톡으로 보낼 때도
보낸 사람 기기 설정에 따라 다른 그림이 나간다.

### 왜 라이트로 고정하나
대비비는 라이트·다크 셋 다 WCAG AA 를 통과한다 — 접근성은 갈림길이 아니다.
갈리는 건 **이 문서가 쓰이는 자리**다.

| | 이유 |
|---|---|
| **인쇄·PDF** | 브라우저는 기본적으로 배경색을 인쇄하지 않는다. 다크로 두면 흰 종이에 **연한 올리브 글자만** 남아 요금표가 흐려진다 |
| **밝은 데서 본다** | 골프장·차 안·창가. 다크 배경은 반사가 심해 화면이 거울이 된다 |
| **손님 연령대** | 노안·난시가 있으면 어두운 바탕 위 밝은 글자에 halation(글자 번짐)이 생긴다 |
| **긴 숫자 표** | 숙소·체재비·환율을 훑어 읽기는 라이트가 유리하다 |

### 왜 예전 라이트(`#F5F6F0`)로 안 두나
초록기가 거의 없어 **베이지로 읽힌다.** 작업 규칙이 「베이지·골드 계열 비선호」다.
배경 자체에 초록을 넣으면 브랜드 색으로 보이면서 라이트의 이점은 그대로다.

```css
:root{
  --paper:#E7EDE0; --surface:#FFFFFF; --ink:#1E2618; --ink-soft:#4C573F;
  --muted:#7C8A6B; --line:#D3DDC8; --olive:#5A6C3E; --olive-deep:#47562F;
  --olive-dim:#EDF2E6;
}
/* @media (prefers-color-scheme:dark) 블록은 넣지 않는다 */
```

대비비(WCAG AA 기준 본문 4.5): 본문/카드 **15.61** · 보조문/카드 **7.66** ·
버튼 글자/올리브 **5.75**. 모두 통과.

---

## 2. 식사 같은 빽빽한 칸 — 표로 되돌린다

### 무엇이 문제인가
**표로 된 정보를 문장으로 써 놨다.** 숙소 3곳 × 조·중·석식 × 조건(출발지·요일)은
2차원 표인데, 들여쓰기 문단으로 눕혀 놓으니 읽는 사람이 「지금 어느 숙소
얘기지」를 계속 머릿속에 붙들어야 한다. 굵은 글씨가 줄마다 흩어져 있어
어디가 중요한지도 안 잡힌다.

### 어떻게 바꾸나
1. **본 규칙은 표로.** 숙소 × 끼니.
2. **예외는 표 밖으로.** 「도착일 출발지별」은 규칙이 아니라 예외다 —
   표 안에 넣으면 표가 다시 문장이 된다.
3. **단서는 맨 아래 작게.** 「메뉴 변경 가능」류는 읽는 흐름을 끊지 않게.
4. **좁은 화면에서는 표를 접는다.** 4열 표를 390px 에 밀어 넣으면
   「조식」이 세로로 쪼개진다(실제로 그랬다).

```html
<table class="mt">
  <thead><tr><th></th><th>조식</th><th>중식</th><th>석식</th></tr></thead>
  <tbody>
    <tr><th>아소<br>야마나미</th>
      <td data-k="조식">숙소 · <b>뷔페</b></td>
      <td data-k="중식">숙소 · <b>뷔페</b> <span style="white-space:nowrap">(한식 위주)</span></td>
      <td data-k="석식">숙소 · <b>요일별 메뉴</b></td></tr>
    <tr><th>간지호텔</th>
      <td data-k="조식">숙소</td>
      <td data-k="중식"><b>그날 라운딩한 골프장</b></td>
      <td data-k="석식">숙소</td></tr>
    <tr><th>시즈노야도<br>료칸</th>
      <td data-k="조식">숙소</td>
      <td data-k="중식"><b>그날 라운딩한 골프장</b></td>
      <td data-k="석식">숙소</td></tr>
  </tbody>
</table>

<div class="note">
  <div><span class="k">도착일</span> 인천 출발 — 점심 <b>카츠카레</b> 후 바로 라운딩</div>
  <div><span class="k" style="visibility:hidden">도착일</span> 김해 출발 — <b>저녁 식사부터</b> 시작</div>
</div>

<div class="cav">
  · 간지호텔·시즈노야도 료칸 메뉴는 아소 야마나미와 같습니다(료칸은 일부 다를 수 있음).<br>
  · 당일·주간 메뉴는 현지 사정에 따라 변경될 수 있습니다.
</div>
```

```css
.mt{width:100%;border-collapse:collapse;font-size:13.5px}
.mt th,.mt td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.mt thead th{font-size:11.5px;font-weight:800;color:var(--muted);letter-spacing:.04em;
  border-bottom:1.5px solid var(--line);padding-bottom:7px;background:var(--olive-dim)}
.mt tbody th{font-weight:800;color:var(--ink);white-space:nowrap;width:1%;padding-right:14px}
.mt td{color:var(--ink-soft)}
.mt td b{color:var(--ink);font-weight:700}
.mt tbody tr:last-child th,.mt tbody tr:last-child td{border-bottom:none}

/* 좁은 화면에서는 표를 접어 숙소별 카드로 바꾼다.
   width:1% 이 데스크톱 규칙에 있어 !important 없이는 안 눌린다(실제로 안 눌렸다). */
@media (max-width:560px){
  .mt,.mt tbody,.mt tr,.mt td,.mt th{display:block;width:auto}
  .mt thead{display:none}
  .mt tbody tr{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:10px}
  .mt tbody tr:last-child{margin-bottom:0}
  .mt tbody th{width:auto!important;padding:0 0 8px;border-bottom:1px solid var(--line);
    margin-bottom:8px;white-space:normal;font-size:14px}
  .mt tbody th br{display:none}
  .mt tbody td{padding:4px 0;border:none;display:flex;gap:10px}
  .mt tbody td::before{content:attr(data-k);flex:none;width:38px;font-weight:800;
    color:var(--muted);font-size:12px;padding-top:1px}
  .note .k{display:block;min-width:0;margin-bottom:2px}
  .note .k[style*="hidden"]{display:none}
}

.note{margin-top:12px;padding:11px 13px;border-radius:9px;background:var(--olive-dim);
  border:1px solid var(--line);font-size:12.5px;line-height:1.7;color:var(--ink-soft)}
.note b{color:var(--ink)}
.note .k{display:inline-block;min-width:62px;font-weight:800;color:var(--olive)}
.cav{margin-top:9px;font-size:11.5px;color:var(--muted);line-height:1.6}
```

**같은 방법을 쓸 다른 칸**: 라운딩(숙소 × 주중/주말), 전기카트(숙소 × 요금),
체재비용(숙소 × 항목), 벳푸·간사이 등 다른 권역의 식사·라운딩.
공통 신호는 「굵은 글씨가 한 문단에 세 개 넘게 흩어져 있다」 — 표로 갈 자리다.

---

## 3. 사진 넣기

### 마크업

```html
<div class="ph-grid">
  <div class="ph">
    <figure><img src="photos/aso-yamanami.webp" alt="아소 야마나미 리조트 외관과 잔디 코스"
      width="1200" height="900" loading="lazy" decoding="async"></figure>
    <div class="cap">
      <div class="nm">아소 야마나미</div>
      <div class="ds">코스 바로 앞 숙소. 조·중·석식 모두 리조트 안에서 해결됩니다.</div>
      <div class="kv"><span>27홀 인접</span><span>전기카트 가능</span><span>뷔페</span></div>
    </div>
  </div>

  <!-- 아직 사진이 없는 곳: figure 에 none 을 붙인다 -->
  <div class="ph">
    <figure class="none"></figure>
    <div class="cap">
      <div class="nm">시즈노야도 료칸</div>
      <div class="ds">일본 전통 료칸. 온천을 함께 이용하실 수 있습니다.</div>
      <div class="kv"><span>료칸</span><span>온천</span></div>
    </div>
  </div>
</div>
```

```css
.ph-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));margin-top:14px}
.ph{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;
  display:flex;flex-direction:column}
/* aspect-ratio 로 자리를 미리 잡는다. 안 잡으면 사진이 뜰 때마다 글이 밀려
   손님이 읽던 줄을 놓친다(레이아웃 시프트). */
.ph figure{margin:0;aspect-ratio:4/3;background:var(--olive-dim);position:relative}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.ph .cap{padding:13px 15px 15px}
.ph .nm{font-size:14.5px;font-weight:800;color:var(--ink);letter-spacing:-.01em}
.ph .ds{font-size:12.5px;color:var(--ink-soft);line-height:1.65;margin-top:5px}
.ph .kv{margin-top:9px;padding-top:9px;border-top:1px solid var(--line);
  display:flex;flex-wrap:wrap;gap:5px}
.ph .kv span{font-size:11.5px;font-weight:700;color:var(--olive);background:var(--olive-dim);
  border:1px solid var(--line);border-radius:20px;padding:3px 9px}
/* 사진이 아직 없을 때 — 빈 칸을 숨기지 말고 「준비 중」이라고 적는다.
   숨기면 어느 숙소 사진이 빠졌는지 아무도 모른다. */
.ph figure.none::after{content:'사진 준비 중';position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;font-size:12px;color:var(--muted);font-weight:700}
```

`auto-fit`+`minmax(248px,1fr)` 이라 화면 폭에 따라 3열 → 2열 → 1열로 알아서
접힌다. 390px 에서 가로 스크롤이 안 생기는 것까지 확인했다.

### 사진 준비 규격

| 항목 | 값 | 이유 |
|---|---|---|
| 형식 | **WebP** | JPG 대비 30~50% 작다. 손님이 셀룰러로 연다 |
| 가로 | **1200px** | 4:3 이면 1200×900. 2배 화면에서도 카드 크기(≈250~400px)엔 충분 |
| 용량 | **장당 200KB 이하** | 숙소·골프장 10장이면 2MB. 이보다 크면 첫 화면이 늦다 |
| 비율 | **4:3 고정** | 카드가 `object-fit:cover` 로 잘라내므로 세로 사진은 인물·건물이 잘린다 |
| 파일명 | **영문 소문자·하이픈** (`aso-yamanami.webp`) | 한글 파일명은 주소에서 깨진다 |
| 위치 | `2027/photos/` | 지금 구조 그대로 |

변환은 **사내 이미지 툴킷**(`tools/imgtoolkit/`)으로 하면 된다 —
WebP 변환·리사이즈·압축이 다 있다. 따로 프로그램 깔 필요 없다.

### `alt` 는 반드시 채운다
사진이 안 뜨거나(느린 회선) 화면 낭독기를 쓰는 손님에게는 `alt` 가 사진 자리를
대신한다. 「사진」·「이미지」 같은 말 말고 **무엇이 찍혔는지** 적을 것 —
`alt="아소 야마나미 리조트 외관과 잔디 코스"`.

### 골프장은 숙소와 같은 틀을 쓰되 팩트만 바꾼다
`.kv` 칩에 홀수·거리·특징을 넣는다 — `27홀` `파72` `숙소에서 도보`.
숙소 카드와 모양이 같아야 손님이 두 번 배우지 않는다.

---

## 4. 남은 일

- [ ] 위 색·표·사진 블록을 `merittour.github.io/2027/` 본문에 반영
      (그 저장소를 세션에 추가해 주시면 이어서 함)
- [ ] 사진 촬영본 → 이미지 툴킷으로 WebP 1200px 변환 → `2027/photos/`
- [ ] 벳푸·간사이 등 다른 권역의 식사·라운딩 칸도 같은 표로

이 저장소 쪽 리다이렉트 두 장은 **색만 먼저 맞춰 뒀다**(다크 분기 제거 + 세이지).
