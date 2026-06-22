# PaperLight design-sync — repo notes

PaperLight `frontend/` 는 DS 패키지가 아니라 **Next.js 15 앱**이다. design-sync는 앱 컴포넌트를 synth-entry로 번들하는 비표준 경로로 동작한다. 아래는 그 경로에서 배운 gotcha.

## 빌드 메커니즘 (재현에 필수)
- **shape=package, synth-entry 모드**: dist가 없으므로 컨버터가 `src/components` 에서 entry를 합성한다.
- `--entry ./frontend/dist/index.js` 는 **일부러 존재하지 않는 경로**를 준다. 목적: `PKG_DIR` 를 `frontend/` 로 walk-up 시키면서(package.json name 보유) 동시에 `resolveDistEntry(soft)` 가 null→synth-entry를 트리거하게 하기 위함. 빌드 로그의 `[NO_DIST]` 2줄은 정상(에러 아님).
- `--node-modules ./frontend/node_modules`, srcDir=`src/components` (앱 페이지/스토어가 컴포넌트로 오탐되지 않게 스코프).
- `tsconfig: tsconfig.json` 로 esbuild가 `@/*` alias 를 해석.

## CSS — Tailwind v4 정적 컴파일 필수
- 컴포넌트는 Tailwind v4 유틸리티(`bg-bg-muted`, `text-text-secondary` 등)를 쓴다. 이건 빌드 타임 생성물이라 정적 스타일시트가 없으면 프리뷰가 unstyled.
- `frontend/.ds-css/compile.mjs` 가 `@tailwindcss/postcss` 로 `input.css`(globals.css 미러 + `@source ../src/components`)를 `ds-compiled.css`(~47KB)로 컴파일. `cfg.cssEntry = .ds-css/ds-compiled.css`.
- **재동기화 시 컴포넌트 클래스가 바뀌면 `cd frontend && node .ds-css/compile.mjs` 를 먼저 다시 실행**해야 새 유틸리티가 CSS에 포함된다. (ds-compiled.css 는 gitignore.)

## process shim (bundle.mjs fork)
- 앱 코드(`lib/api.ts` 의 `process.env.NEXT_PUBLIC_API_URL`)와 번들된 remark/vfile 폴리필이 bare `process` 를 참조 → 브라우저에서 `ReferenceError: process is not defined` 로 전 컴포넌트가 throw 했었다.
- `.design-sync/overrides/bundle.mjs` 에서 esbuild `banner` 로 `globalThis.process` shim 주입(헤더 line1 아래, window 할당 위 — 출력 contract 불변). `cfg.libOverrides["bundle.mjs"]` 에 선언.
- fork가 bare `esbuild` 를 import하므로 `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` 심링크 필요(clone마다 재생성, gitignore).

## 컴포넌트 스코프
- `ShaderBackground` 제외(`componentSrcMap` null): 랜딩 전용 WebGL 배경, 재사용 DS 컴포넌트 아님 + headless에서 canvas 빈 렌더로 BUNDLE_EXPORT 실패.
- 35개 컴포넌트 동기화 대상.

## 폰트
- `--font-sans` 는 `var(--font-pretendard), var(--font-inter), -apple-system, …` — Pretendard/Inter는 next/font 런타임 변수라 정적 빌드엔 없고 **시스템 sans로 폴백**한다. ship할 woff2 없음 → `[FONT_MISSING]` 미발생, 시스템 폰트 렌더가 의도된 동작.

## 우측 패널 — 런타임 백엔드 fetch (프리뷰 fetch-stub)
- `SummaryPanel`/`InsightsPanel`/`ReferencesPanel`(그리고 ChatPanel/NotesPanel 일부)은 mount 시 `apiFetch(http://localhost:8000/api/papers/:id/...)` 로 데이터를 가져온다. headless 캡처엔 백엔드가 없어 기본적으로 error 콜아웃("…불러오지 못했습니다") 상태로 떨어진다.
- 해결: 각 패널 프리뷰(`.design-sync/previews/<Panel>.tsx`)가 모듈 로드 시 `window.fetch` 를 스텁해 실제 API 응답 형태의 mock을 주입한다. `paperId="demo"` → ready(실콘텐츠), `paperId="empty"` → empty 상태. API 형태: summary `{text}`, insights `{paragraphs,figures,highlights}`, references `ReferenceCard[]`.
- **Re-sync 위험**: mock은 프리뷰에 인라인돼 있고 백엔드 API 형태에 묶여 있다. 백엔드 응답 스키마가 바뀌면 mock도 갱신해야 함(안 하면 ready 셀이 다시 error/빈 상태로 렌더). 백엔드를 띄워 실데이터로 캡처하는 대안도 가능.

## next/navigation no-op stub (bundle.mjs fork)
- `TabBar`/`AppShell`(및 라우터 읽는 컴포넌트)이 `useRouter()`(next/navigation) 호출 → Next 앱 밖(=모든 design·프리뷰)에선 "invariant expected app router to be mounted" throw로 빈 셀이 됐다.
- `.design-sync/overrides/bundle.mjs` 의 esbuild 플러그인이 `next/navigation` 을 no-op 라우터 stub으로 alias. claude.ai/design엔 Next 라우터가 없으니 이게 정답이고 모든 design에서 견고. `cfg.libOverrides["bundle.mjs"]` 참조.

## store-coupled 컴포넌트 (extraEntries로 store 공유)
- `SearchBar`/`FloatingSelectionMenu`/`SelectionExplainPopover`/`SelectionTranslatePopover`/`FigureExplainPopover` 는 `useReader`(일부 `useMarkup`/`useFigures`) zustand 슬라이스가 비면 `null` 반환 → 빈 셀.
- 프리뷰는 별개 esbuild 빌드라 소스 상대경로로 store를 import하면 **다른 인스턴스**가 돼 seed가 안 닿음. 해결: `cfg.extraEntries` 에 `./src/stores/{reader,markup,figures}.ts` 추가 → `.bundle-entry.mjs` 가 store+synth-entry를 한 빌드에서 묶어 **단일 인스턴스**가 `window.PaperLight.useReader` 등으로 노출됨. 프리뷰는 `import { useReader } from "paperlight-frontend"` 로 받아 `useReader.setState({...})` 로 seed.
- **Re-sync 위험**: 프리뷰 seed 값이 store state 형태(SelectionInfo/ExplainSelection/FigureExplain/searchOpen 등)에 묶여 있음. reader 스토어 인터페이스가 바뀌면 해당 프리뷰 seed도 갱신 필요.

## popover SSE 스텁 + cardMode
- 3 popover(SelectionExplain/SelectionTranslate/FigureExplain)는 mount 시 `streamSse("/api/explain"|"/api/translate"|"/api/explain/figure")` 호출. 각 프리뷰가 `window.fetch` 를 **SSE ReadableStream**(`data: {"token":...}\n\n` … `data: [DONE]`)으로 스텁해 완료 상태를 보여줌. (재동기화 위험: SSE 토큰 프로토콜이 바뀌면 스텁도 갱신.)
- popover 4종은 `position:fixed` 라 sized 컨테이너를 무시 → `cfg.overrides.<Name> = {cardMode:single, viewport:"WxH"}`. **fixed 요소의 shrink-to-fit 가용폭 = viewport폭 − left** 라, FloatingSelectionMenu는 라벨이 글자별로 줄바꿈되지 않도록 viewport 폭을 760으로 키웠다(메뉴 center left≈280 기준 가용폭 ~480 확보).
- wide 카드 19종은 `cfg.overrides.<Name> = {cardMode:column}` (그리드 셀보다 넓어 잘리던 것 → 한 줄에 한 셀).

## Known render warns
- `ToolbarNavGroup` — `[RENDER_THIN]`: 실제로 nav 아이콘 3개만 있는 짧은 컴포넌트라 thin이 정상.
- `SearchBar` — `[RENDER_THIN] variants render identically`: 오탐. 검색 박스 chrome은 동일하나 3 변형의 내용(placeholder / "결과 없음" / "3/12" 카운터)은 실제로 다름. benign.

## Re-sync risks
- **ds-compiled.css 가 gitignore** 라 fresh clone에선 `node .ds-css/compile.mjs` 를 반드시 다시 돌려야 cssEntry가 존재한다. 안 돌리면 `[CSS_IMPORT_MISSING]`.
- synth-entry는 `src/components` 의 PascalCase value export 전부를 컴포넌트로 본다. 새 헬퍼 컴포넌트 추가 시 오탐되면 `componentSrcMap: {Name: null}` 로 제외.
- bundle.mjs fork는 upstream lib/bundle.mjs 변경을 따라가지 않는다 — 재동기화 시 diff해서 머지 검토.
- pdfjs/WebGL 등 무거운 앱 결합 컴포넌트(PdfViewer 등)는 headless에서 빈/empty-state로 렌더될 수 있음(실패 아님).
