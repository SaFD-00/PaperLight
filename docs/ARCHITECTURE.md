# PaperLight — Architecture

> **버전**: v2.0 (themoonlight.io 스타일 리팩토링 반영)
> **목적**: 코드 구조·데이터 흐름·외부 의존성을 한눈에 보여주는 엔지니어링 문서.

---

## 1. 한 줄 요약

PaperLight = **Next.js 15 ⇄ FastAPI ⇄ SQLite + 로컬 파일시스템 + LLM Provider**.
**단일 사용자 로컬 웹앱**(인증 없음). 사용자가 PDF를 업로드하면 Ingestion 파이프라인이
chunk·embedding·자동 사전 생성(Summary/Highlight/Figure/Paragraph)을 만들고, Reader는
Shadow DOM iframe에 pdf.js를 띄워 격리된 상태에서 호스트 React UI(우측 AI 패널·Floating
Menu)와 메시지 패싱으로 통신한다. 무거운 클라우드 인프라(Postgres·Qdrant·Redis·R2·관측도구)
와 팟캐스트·로그인은 제거됨.

---

## 2. 모노레포 모듈 맵

```
PaperLight/
├── backend/                         # FastAPI (Python 3.12)
│   ├── paperlight/
│   │   ├── main.py                  # FastAPI app entry (lifespan: init_db + 샘플 시드)
│   │   ├── local_user.py            # LOCAL_USER_ID 상수 + get_user_id 의존성(인증 대체)
│   │   ├── api/                     # 라우터: papers / tabs / chat / explain / translate / annotations
│   │   │                            #  + 공용 헬퍼: _sse.py(format_sse), _ownership.py(소유권 검증)
│   │   ├── agents/                  # chat(retrieve+RAG), context, pregen(자동 사전생성), references
│   │   ├── ingestion/               # parser(PyMuPDF) → chunker → embedder → pipeline → seed
│   │   ├── providers/               # LLMProvider 추상화 (openrouter / openai / gemini / stub) + router + cache
│   │   ├── storage/                 # db.py (SQLite/aiosqlite), object_store.py (로컬 FS)
│   │   ├── services/                # notion_export(노트 내보내기)
│   │   ├── utils/                   # time.now_ms 등
│   │   └── models/                  # SQLAlchemy 엔티티 (User/Paper/Chunk/Chat*/Highlight/Note/Tab/Cache)
│   └── tests/                       # pytest (ASGITransport + Provider stub)
│
├── frontend/                        # Next.js 15 App Router + React 19 + TypeScript
│   ├── src/
│   │   ├── app/                     # 라우트: / (랜딩) · /import (업로드) · /library (내 논문) · /r/[paperId] (리더)
│   │   ├── components/
│   │   │   ├── landing/             # ShaderBackground (WebGL 애니메이션 히어로)
│   │   │   ├── shell/               # AppShell, TabBar, TopToolbar(→toolbar/*), CommandPalette, SettingsMenu
│   │   │   ├── reader/              # ReaderShell, PdfViewer, RightPanel(5탭), Sidebar, FloatingSelectionMenu, …
│   │   │   └── panels/              # SummaryPanel, InsightsPanel, ChatPanel(→chat/*), ReferencesPanel, NotesPanel
│   │   ├── stores/                  # Zustand: tabs, reader, settings, papers, markup, figures, command
│   │   ├── lib/                     # api(fetch wrapper), pdf/(shadow-iframe·messages), text/(citation·markdown)
│   │   ├── styles/                  # tokens.css(디자인 토큰) + globals.css(@theme)
│   │   └── locales/                 # next-intl 메시지(ko/en/ja/zh-CN/es)
│   └── public/pdfjs/                # pdf.js 뷰어 + bodyFilter.js(본문 추출, 런타임/테스트 단일 소스)
│
├── config/
│   ├── agents.yaml                  # agent → (provider, model, reasoning_effort, …) 라우팅(핫리로드)
│   ├── prompts/                     # summary/chat/explanation/translation/figure/table/paragraph 프롬프트
│   └── glossary/                    # 도메인 용어집
├── fixtures/pilot-papers/           # 샘플 논문 PDF + .meta.json (시드 + 파싱 회귀 테스트)
└── docs/                            # ARCHITECTURE.md (본 문서), DESIGN.md
```

---

## 3. 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트 | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand |
| PDF 뷰어 | Mozilla pdf.js (Shadow DOM 호스트 안 same-origin iframe, postMessage 격리) · KaTeX(번역 컬럼 인라인 수식, `public/pdfjs/vendor/katex`로 vendored) |
| 랜딩 | 자체 WebGL 셰이더(외부 의존성 0, `prefers-reduced-motion` 대응, 랜딩 라우트 dynamic import) |
| 백엔드 | FastAPI · Uvicorn · SQLAlchemy 2.0 async |
| DB | **SQLite** (aiosqlite, WAL) — `Base.metadata.create_all`이 스키마 소스 |
| 임베딩 검색 | 청크 임베딩을 SQLite `Chunk.embedding`(packed float32)에 저장 → numpy 코사인 top-k |
| 객체 저장 | **로컬 파일시스템** (`PAPERLIGHT_DATA_DIR`, 원본 PDF·노트 백업) |
| PDF 파싱 | PyMuPDF(기본) / marker(정밀 figure bbox, opt-in) |
| 임베딩 모델 | stub(결정적 dim=1024, 오프라인 기본) / fastembed bge-m3(opt-in) |
| LLM | OpenRouter(Qwen3.6 기본) · OpenAI · Gemini · StubProvider — `config/agents.yaml` 라우팅 |
| 테스트 | 프론트 Vitest(jsdom + node 픽스처) / 백엔드 pytest |

---

## 4. 입력 → 데이터 흐름

```
[브라우저] PDF 업로드(/import) ──multipart──▶ POST /api/papers/upload
   (arXiv 임포트는 보조: POST /api/papers/import)
        │ Paper 행 생성(pending) + 원본 PDF를 로컬 FS에 저장
        ▼
[BackgroundTask] ingest_paper(paper_id)
   parse(PyMuPDF) → chunk(≈512토큰) → embed(stub/fastembed)
   → Chunk 행(text + embedding) SQLite 저장  [status: parsing→embedding→ready]
        ▼
   pregen(paper): Summary / Auto-Highlight / Figure·Table / Paragraph 사전 생성 → Cache 저장
        ▼
[리더 /r/{id}] pdf.js iframe이 GET /api/papers/{id}/pdf 를 직접 로드(서명 없음)
   우측 AI 패널이 캐시된 Summary/Insights/References 표시, Chat/Explain/Translate는 SSE 스트리밍
```

- **상태 전이**: `pending → parsing → embedding → ready`(실패 시 `failed`). `/api/papers/{id}/ingestion` SSE가 진행률 관측.
- **사전 생성 실패**(LLM 키 부재 등)는 suppress — ingestion은 `ready`로 정상 완료. AI 생성 기능만 키 필요.

---

## 5. Reader — pdf.js Shadow DOM 격리

```
[호스트 React] ── attachShadow ──▶ ShadowRoot ──▶ <iframe src=pdfjs/viewer.html>
        ▲                                                  │ pdf.js Worker + Viewer
        │  postMessage 채널                                ▼
        ├─▶ LOAD_PDF / JUMP_TO / SET_ZOOM / RENDER_TRANSLATION / RENDER_HIGHLIGHTS / …
        └◀─ SELECTION_CHANGE / PAGE_VISIBLE / HIGHLIGHT_CLICK / READY
   호스트는 event.source === iframe.contentWindow 검증 후에만 수신.
```

pdf.js는 호스트 CSS/React와 완전히 격리(Shadow DOM)되어 충돌이 없다. 번역·하이라이트
오버레이는 text-layer offset 공간 위에 그려진다.

---

## 6. 본문 추출 — `frontend/public/pdfjs/bodyFilter.js`

런타임(viewer.js)과 테스트(Vitest)가 공유하는 순수 ESM. text item을 라인으로 묶고 비본문을
보수적으로 제거해 **본문 문자열 + 원문 offset 매핑(segments)**을 만든다.

- **제외 대상**: Figure/Table 캡션(다국어 `图/表/図` + Scheme/Chart/… 포함, 멀티라인), 저자·소속
  (1페이지 front-matter 밴드 + Zotero식 폰트 구조 폴백: 최대 폰트=제목, 직후 폰트 블록=저자;
  대학/연구소/위첨자 마커는 기능어 개수로 본문 문장과 구분), 이메일·arXiv 스탬프, 참고문헌
  (문서 수준 `scanReferenceActivation`, 서지 신호 비율 임계 0.10으로 멀티페이지 출렁임 대응),
  러닝 헤더/푸터(`scanRunningFurniture` 반복 탐지), 도표 내부 텍스트(`figureExclusionBand` 본문
  보존형 밴드), display 수식·의사코드. display 수식은 `(N)`으로 끝나는 단일 라인뿐 아니라
  `(N)`으로 안 끝나는 멀티라인 수식의 분자/분모 줄까지 `isDisplayMathLine`(산문 보호 게이트
  `funcWordCount===0` + 관계연산자 + 구조 글리프 밀도 ≥0.3)로 제거한다.
- **불변식**: `bodyText.slice(seg.bodyStart, seg.bodyEnd) === fullText.slice(seg.globalStart, seg.globalEnd)`.
- **cross-page**: 페이지 끝에서 끊긴 문장을 다음 페이지 본문 앞에 이어 붙여 완성된 문장으로 해석.
- **테스트**: `bodyFilter.test.ts`(합성 케이스) + `bodyFilter.fixtures.test.ts`(실제 파일럿 PDF를
  pdfjs-dist로 로드 → 저자·이메일·참고문헌 미누출 회귀).

---

## 7. 번역 파이프라인

```
[iframe] extractBody → bodyText + segments
   ▼ [호스트] splitSentences(bodyText)
   ▼ POST /api/translate (aligned, sentences[])  (SSE)
   ▼ [백엔드] stream_task("translation") — 용어집 일관성 참고(요약 캐시)
   ▼ RENDER_TRANSLATION({i, tgt}) — 페이지 컬럼에 문장별 정렬
   ▼ 본문↔번역 교차 하이라이트(hover)
```

번역 대상은 `bodyFilter`가 골라낸 **본문만**(저자·캡션·참고문헌 제외).

- **인라인 수식 렌더**: 프롬프트가 인라인 수식을 LaTeX `$...$`로 감싸도록 지시(prompt v3 /
  aligned-v3, 캐시 키)하고, viewer.js `renderTranslatedText`가 번역 문자열을 `$...$`/`\(...\)`
  기준으로 쪼개 KaTeX로 조판한다. KaTeX 미주입·렌더 실패·통화(`$5`) 오탐 시 원문 평문 폴백.

---

## 8. Chat 검색 (RAG, Qdrant 제거 후)

`agents/chat.py::retrieve(paper_id, question, top_k)` — 질문을 임베딩하고 해당 paper의 청크를
SQLite에서 로드해 **numpy 코사인 유사도**로 top-k를 고른다(임베딩은 ingestion 때 `Chunk.embedding`에
저장됨). 시그니처는 보존되어 chat·explain·pregen이 동일 인터페이스로 사용한다.

---

## 9. LLM Provider 추상화

`config/agents.yaml`이 agent별 (provider, model, reasoning_effort, temperature, …)을 라우팅한다.
`providers/router.py::stream_task`가 후보 체인을 순서대로 시도(첫 토큰 전 실패만 폴백)하고,
`providers/cache.py`가 `sha256(task+paper_id+chunk_id+model+prompt_version)` 키로 응답을 캐시한다.
`LLM_PROVIDER=stub` 또는 키 부재 시 오프라인 StubProvider로 폴백한다.

---

## 10. 데이터 모델 (SQLite)

핵심 엔티티: **User**(단일 로컬 사용자 1행), **Paper**(메타+ingestion_status), **Chunk**(text +
embedding packed float32), **ChatSession/ChatMessage**, **Highlight**, **Note**, **Tab**(리더
워크스페이스), **Cache**(LLM 출력). 스키마는 `init_db()`의 `create_all`이 생성(마이그레이션 도구
없음). 모든 행은 `user_id = LOCAL_USER_ID`로 귀속.

---

## 11. 로컬 실행

```bash
# 백엔드
cd backend && uv sync && uv run uvicorn paperlight.main:app --reload --port 8000
# 프론트
cd frontend && pnpm install && pnpm dev   # http://localhost:3000
```

- `.env`(루트): `OPENROUTER_API_KEY` 등 LLM 키(없으면 stub), `PAPERLIGHT_DATA_DIR`, `DATABASE_URL`(기본 SQLite).
- 개발 모드에서 파일럿 샘플 논문 2편이 자동 시드됨(`PAPERLIGHT_SEED_SAMPLES`).

---

## 12. 검증

- 백엔드: `uv run pytest` · `ruff check paperlight`
- 프론트: `pnpm typecheck` · `pnpm test`(vitest, 픽스처 파싱 회귀 포함) · `pnpm build`
