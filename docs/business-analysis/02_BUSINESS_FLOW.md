# 02 · 업무 흐름 (Business Flow)

> 기준 파일: `tools/dashboard/index.html`. ✅ 코드 확정 / 🔎 추정 / ⚠ 확인 필요.

## 전체 동선 (영업 담당 기준, 🔎 코드+안내문구 기반)
```
엠클릭 ERP에서 엑셀 2종 다운로드
  → 대시보드에 업로드 → [통합 분석 실행]
    → ③ 데이터 검수(오류 사전 검출)
    → ⑤ 예약 관리 / ⑥ 항공 정보(PNR·여정 점검, 알리고 양식)
    → ④ 요금 관리(예상판매·환율·항공요금 검증)
    → (준비중) 확정서 생성 · 정산 · 보험 · 송영/숙소/골프/식사 점검
```
- 마스터(단가·환율·항공요금)는 관리자가 입력 후 **JSON 내보내기 → 직원 불러오기**로 배포(localStorage). ✅

## 대시보드 섹션 구조 ✅
네비게이션은 활성 탭과 준비중 탭을 구분선(`nav-sep`)으로 나눔.

**활성 6개(원형 번호):**
| 배지 | id | 역할 |
|---|---|---|
| — | `sec-upload` | 파일 업로드(엑셀 2종) |
| ① | `sec-resort` | 리조트 마스터(숙소별 단가·식사·정원·출발패턴·환율·항공요금) |
| ② | `sec-block` | 호텔 블록(서브탭 6: 현황·출발일정·대기전환·판매시뮬·전기카트·설정) |
| ③ | `sec-audit` | 데이터 검수(수기 입력 오류 사전 검출) |
| ④ | `sec-verify` | 요금 관리(예상판매·요금 검증) |
| ⑤ | `sec-booking` | 예약 관리(팀 단위 조회·수기수정·팀배정) |
| ⑥ | `sec-air` | 항공 정보(PNR·여정·사전좌석, 알리고 양식) |

**준비중 7개(「준비중」 배지):** 확정서 생성(`sec-doc`) · 정산(`sec-settle`) · 보험(`sec-insurance`) · 송영(`sec-transfer`) · 숙소(`sec-accom`) · 골프(`sec-golf`) · 식사(`sec-dinner`).
- ✅ `analyze()` 종료 시 `nav-*`의 `locked` 클래스를 일괄 제거 → **분석 후에는 준비중 7개도 클릭·동작**(확정서·정산은 완성도 높음).
- 🔎 HTML 주석에 옛 번호(⑥보험/⑦항공/⑧~⑪) 잔존 — 낡은 주석. 실제 배지·nav는 현행 6개 체계가 정답.

## 업로드 → 분석 파이프라인 ✅
1. `loadFile`/`onDrop` → `startLoad(type, files)` → 파일별 `processFile`.
2. `processFile`: `FileReader.readAsArrayBuffer` → `XLSX.read(...,{cellDates:true})` → **첫 시트만**(`SheetNames[0]`) `sheet_to_json({defval:''})` → `resMerged`/`ilhaengMerged`에 `concat`(다중 파일 자동 병합).
3. 두 종류 모두 로드되면 `[통합 분석 실행]` 활성(`checkReady`).
4. `analyze()`:
   - `buildArrivalMap()` (항공시각 4종, eventSeq당 대표) → `buildApisMap()` (PNR·항공사·편명·사전좌석·여권, 개인별)
   - `loadPersist()` (수기 오버레이 로드)
   - `resData`에서 유효상태(`견적/대기/확정/정산`, `cancCd` 없음) 필터 → `teams[]` 구성
   - 일행별예약을 eventSeq로 그룹핑해 `pax_list` 결합 → `applyEditOverrides()`
   - 취소건은 `cancelledTeams[]`로 분리(조회 전용)
   - 전 탭 unlock → 각 `render*()` → `③ 데이터 검수`로 이동
   - ⚠ 연동설정이 있으면(`docCfgReady()`) 조용히 `docSyncSupabase(true)` 자동 실행.

## 데이터 수명 ✅
- **원본(resData/ilhaengData)은 메모리 전용.** 새로고침 → 소멸 → 재업로드·재분석 필요.
- localStorage 저장분(마스터·오버레이·설정·필터)은 유지 → 재분석 시 자동 재적용.
- ⚠ 전제: 엠클릭 엑셀이 항상 **대상 탭을 첫 시트로** 내보낸다는 가정(코드는 `SheetNames[0]` 고정). 확인 필요.

## 결합 키 ✅
- **`eventSeq`** = 두 파일 결합 마스터 키(silent join, 화면 미표시). **행사번호(`eventNo`)** = 사람이 보는 표시키(검색·파일명·발송). 상세는 03 문서.
