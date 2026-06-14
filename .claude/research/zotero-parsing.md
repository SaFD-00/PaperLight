# Zotero PDF 파싱 기법 조사 — 본문 추출 강화 참고

> 조사일: 2026-06-14. 출처: github.com/zotero/pdf-worker, zotero.org/support/retrieve_pdf_metadata, Zotero 포럼.
> 목적: PaperLight 본문 추출(`frontend/public/pdfjs/bodyFilter.js`)에서 **저자·소속·캡션을 본문에서 제외**하는 로직을 강화하기 위한 기법 차용.

## 1. Zotero가 PDF를 다루는 구조

- **`zotero/pdf-worker`**: pdf.js 기반. PDF에서 **텍스트 + 레이아웃 구조(폰트 크기/위치 포함)**를 추출해 recognizer-server에 전달할 구조화 데이터를 만든다.
- **recognizer(메타데이터 인식)**: PDF **앞 몇 페이지의 텍스트**를 추출 알고리즘으로 분석 → 제목·저자 후보를 뽑고, Crossref/DOI/ISBN 조회와 결합해 서지(부모 아이템)를 생성.
- 핵심: **폰트 크기/스타일/위치 기반의 구조 분석**으로 "무엇이 제목/저자/본문인지"를 추정한다.

## 2. 차용할 핵심 휴리스틱

1. **제목 = 1페이지 최대 폰트 라인.** 문서 첫 페이지에서 가장 큰 폰트로 렌더된 (연속) 라인이 제목.
2. **저자/소속 = 제목 직후의 구별되는 폰트 블록.** 제목 바로 다음, 본문 modal 폰트가 시작되기 전까지의 **더 작거나 이탤릭/다른 폰트**의 연속 블록이 저자·소속·이메일·각주 마커.
3. **앞 페이지 집중 분석.** 저자/소속/제목 같은 프론트매터는 1페이지에 집중 → 1페이지에 한해 폰트 기반 밴드 제거를 적용(본문 오제거 위험 최소화).
4. **소속 신호 어휘.** University / Institute / Laboratory / Department / College / School of / Inc. / Ltd. / GmbH, 선행 위첨자 마커(`^[\d*†‡§¶]+`), 이메일, 다중 소속 콤마 리스트.
5. **캡션은 본문과 구별되는 폰트.** Figure/Table 캡션은 본문 modal과 다른(작거나 볼드) 폰트인 경우가 많음 → 폰트 연속성으로 다줄 캡션을 추적.

## 3. PaperLight `bodyFilter.js`에 적용하는 방식

현재 `extractBody`의 프론트매터 밴드는 **Abstract 헤딩이 있을 때만** 동작(저자 제거가 Abstract 없는 1페이지에서 누락). Zotero식 폰트 구조 분석을 폴백으로 추가:

- `detectFrontMatterBand(lines, modal)` 신설:
  - 1페이지 최대 폰트 라인 = 제목으로 확정(`titleHeight`).
  - 제목 직후 ~ 첫 본문 modal 문단 전까지의 라인 중, **폰트가 modal보다 작거나/이탤릭이거나 소속·이메일 신호를 가진 라인**을 저자/소속 밴드로 보고 제외.
  - Abstract가 있으면 기존 경로, 없으면 이 폴백을 사용.
- `AFFILIATION_RE` 어휘 확장(위 4번) + 프론트매터 밴드/짧은 길이로 게이팅해 본문 중 "University" 언급 오제거 방지.
- 캡션: `captionMode`를 동일 폰트 캡션에도 적용하되 `figureExclusionBand`의 `isProseLine`/`FUNC_RE` 판별자를 공유해 산문 전환 시 중단. `CAPTION_RE`에 다국어(`图|表`, `図|表`) + `Scheme|Chart|Plate|Box|Exhibit` 추가.

## 4. 차이 / 주의

- Zotero recognizer는 **메타데이터 추출**(제목/저자를 *얻기* 위함)이고, 우리는 **본문 추출**(제목/저자/캡션을 *버리기* 위함)이다. 같은 구조 신호를 반대 목적으로 사용.
- Zotero는 외부 서비스(Crossref) 의존 → 우리는 오프라인 폰트 휴리스틱만 차용(네트워크 의존 없음).
- 불변식 유지 필수: `bodyText.slice(seg.bodyStart,seg.bodyEnd) === full.slice(seg.globalStart,seg.globalEnd)`.
