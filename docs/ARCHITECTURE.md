# PaperLight — Architecture

> **버전**: v1.0
> **작성일**: 2026-05-20
> **목적**: 코드 구조·데이터 흐름·외부 의존성을 한눈에 보여주는 엔지니어링 문서. [PRD §7](./PRD.md)에서 기술 스택을 분리한 상세 버전.

---

## 1. 한 줄 요약

PaperLight = **Next.js 15 (Vercel/Seoul) ⇄ FastAPI (Render/Tokyo) ⇄ Supabase Postgres + Qdrant + Cloudflare R2 + Redis + LLM Providers**. 단일 사용자가 PDF를 업로드하면 Ingestion 파이프라인이 chunk·embedding·자동 사전 생성(Summary/Highlight/Figure/Paragraph)을 만들고, Reader는 Shadow DOM iframe에 pdf.js를 띄워 격리된 상태에서 호스트 페이지의 React UI(우측 AI 패널·Floating Menu)와 메시지 패싱으로 통신한다.

---

## 2. 모노레포 모듈 맵

```
PaperLight/
├── backend/                         # FastAPI + LangGraph (Python 3.12)
│   ├── paperlight/
│   │   ├── main.py                  # FastAPI app entry
│   │   ├── api/                     # 라우터: auth / tabs / papers / library / chat / explain / translate / podcast
│   │   │                            #  + 공용 헬퍼: _sse.py(format_sse), _ownership.py(소유권 검증)
│   │   ├── agents/                  # LangGraph 노드 (chat, ingest, podcast, search, summary, highlight)
│   │   ├── ingestion/               # parser → chunker → embedder → pipeline
│   │   ├── providers/               # LLMProvider 추상화 (openrouter / openai / gemini) + TTSProvider (openai / elevenlabs)
│   │   ├── storage/                 # db.py (Postgres), vector.py (Qdrant), object.py (R2)
│   │   ├── utils/                   # 공용 유틸 (time.now_ms 등)
│   │   └── models/                  # Pydantic + SQLAlchemy 엔티티
│   └── tests/                       # pytest (TestClient + Provider mocks)
│
├── frontend/                        # Next.js 15 App Router + React 19 + TypeScript
│   ├── src/
│   │   ├── app/                     # 페이지 라우팅 (Library, Reader/[paperId])
│   │   ├── components/
│   │   │   ├── shell/               # TabBar, TopToolbar(→toolbar/*), CommandPalette(→command-palette/*), SettingsMenu
│   │   │   ├── reader/              # ReaderShell, PdfViewer(+pdfTranslation/useFigureLayout/useReaderIframeSync), Sidebar, FloatingSelectionMenu, …
│   │   │   ├── library/             # 4-pane: Tree(→collection-tree/*), List, Detail, TagCloud
│   │   │   └── panels/              # ChatPanel(→chat/*), SummaryPanel, InsightsPanel, TranslationPane … (+ common/Markdown)
│   │   ├── stores/                  # Zustand: tabs, settings, library, reader
│   │   ├── lib/                     # api/, pdf/, selection/, theme/, i18n/, cycle.ts, fixtures/
│   │   ├── styles/                  # tokens.css (DESIGN §3), globals.css
│   │   └── locales/                 # next-intl: ko/en/ja/zh-CN/es .json
│   └── public/pdfjs/                # pdf.js 정적 자산 (worker + viewer)
│
├── config/                          # YAML — 모델 매핑, 프롬프트 템플릿, 분야별 용어집
├── docs/                            # PRD / DESIGN / ROADMAP / ARCHITECTURE
├── fixtures/
│   └── pilot-papers/                # Phase 0 데모 + 회귀 테스트용 파일럿 PDF 2편 + .meta.json
│       ├── 2602.09856-code2world.{pdf,meta.json}                     # Code2World (Zheng et al., 2026)
│       └── 2605.10347-mobile-world-model-gui-agents.{pdf,meta.json}  # Mobile World Model (Xu et al., 2026)
└── docker-compose.yml               # 로컬 — postgres, qdrant, redis, minio (R2 호환)
```

### 책임 분담 한 줄 요약

| 모듈 | 책임 | 변경 빈도 |
|------|------|-----------|
| `backend/api/` | HTTP 어댑터 — 입력 검증, SSE 스트리밍 | 중 |
| `backend/agents/` | LangGraph 워크플로 (Chat·Ingest·Podcast 등) | 높음 |
| `backend/ingestion/` | PDF → chunk → embedding 파이프라인 | 중 |
| `backend/providers/` | LLM/TTS 외부 API 어댑터 | 낮음 (인터페이스 안정) |
| `backend/storage/` | Postgres·Qdrant·R2 클라이언트 | 낮음 |
| `frontend/components/` | UI 컴포넌트 (셸 + Reader + Library + Panels) | 매우 높음 |
| `frontend/stores/` | Zustand 상태 (Tab·Settings·Reader) | 중 |
| `frontend/lib/` | 도메인 로직 (selection 파싱, PDF iframe 통신, theme) | 중 |
| `config/` | 모델·프롬프트·용어 사전 (코드 변경 없이 튜닝) | 자주 |

---

## 3. 데이터 흐름

### 3.1 PDF 업로드 → Ingestion

```
[User Browser]
      │ 1. POST /api/papers (file or arxiv URL)
      ▼
[FastAPI api/papers.py]
      │ 2. R2 업로드 → pdf_r2_key 발급
      ▼
[Postgres: papers row insert (status=queued)]
      │ 3. enqueue Redis job
      ▼
[Ingestion worker]
      │ 4. PDF 파싱 (pymupdf 기본 / config=marker면 figure·table bbox 추출)
      │ 5. chunker (≈512 tokens)
      │ 6. bge-m3 임베딩 (Qwen, 동일 클러스터)
      ▼
[Qdrant: chunks 컬렉션]
      │ 7. LangGraph "summary-pipeline" 노드 트리거
      ▼
[OpenRouter / Qwen3.6-35B]
      │ 8. Summary (다층) + F-10 Auto-Highlight + F-14 Figure + F-15 Paragraph + F-05 References 생성
      ▼
[Postgres: cache 영구 저장] ◄── 9. status=ready
      │
      ▼
[SSE: /api/papers/{id}/status]
      │
      ▼
[Reader UI 활성화]
```

### 3.2 Reader: 텍스트 선택 → Explanation (인라인 팝오버)

```
[Shadow DOM iframe (pdf.js viewer)]
      │ 1. selectionchange 이벤트 → postMessage 호스트로 전달
      ▼
[Host React (Reader page)]
      │ 2. FloatingSelectionMenu 표시 (선택 위 8px, 200ms hover)
      │ 3. 사용자 "💡 Explain" 클릭 → triggerExplain({text, hostRect})
      ▼
[POST /api/explain (SSE)]
      │ 4. 본문 chunk lookup (Qdrant nearest + paper_id 필터)
      │ 5. LangGraph "explain" agent — LLM 호출, 변수표·LaTeX 인용 생성
      ▼
[SelectionExplainPopover — 선택 문장 바로 옆 인라인 스트리밍(markdown)]
```

> **레이아웃**: ReaderShell은 `Sidebar | Center(PDF) | RightPanel(AI 탭)` flex 행. 해석(번역)은 **별도 사이드 패널이 아니라 PDF 연속 스크롤 안에서 각 페이지 오른쪽에 나란히 붙는 컬럼**(viewer.js `.page-row = [.page-wrapper | .page-translation]`)이며, 상단 툴바 [T] 토글로 컬럼을 켜고/끈다. 좌측 사이드바·AI 패널은 각각 토글이며, 경계 모서리 드래그(`ResizeHandle`)로 폭 조절 가능(사이드바 160~480px·패널 280~600px, `reader` 스토어 보관·비영속). 좌측 사이드바는 TOC↔페이지(썸네일) 전환 + 클릭 이동.

### 3.2b Reader: 페이지별 번역 컬럼 + 원문↔해석 교차 하이라이트 (F-02)

```
[iframe] (1회) computeDocFilters: 전 페이지 텍스트를 순서대로 훑어 문서 수준 비본문 산출
      │ scanReferenceActivation: References 헤딩 이후 '서지 시그니처 과반' 연속 페이지 + 말미
      │   Checklist를 비본문으로(헤딩 직후 첫 페이지는 강제, Appendix 재개 시 해제). 양식 무관:
      │   서지 시그니처가 [N]·"Luo, D."·"Z. Du"·"74. Yang"·arXiv·"et al"을 모두 커버.
      │ scanRunningFurniture: 상하단 밴드에 3페이지+ 반복되는 러닝 헤더/푸터(길이 무관 제거)
      ▼
[host] PAGE_VISIBLE(page) → 미요청이면 REQUEST_PAGE_TEXT(page) (스크롤 따라 lazy)
      ▼
[iframe] extractBodyText: Figure/Table 캡션(멀티라인·한국어·Supplementary/Extended Data 접두)·
      │ Figure/Table 영역 내부 텍스트(figure bbox region 중심 판정, 백엔드 bbox 우선·휴리스틱 폴백)·
      │ 표 수치·display 수식(수식번호 종결)·의사코드(Algorithm/Listing 블록)·저자 소속·Preprint 스탬프·
      │ 페이지번호·이메일·arXiv·러닝 헤더(furniture)·1페이지 front-matter·References/Checklist 보수적 제거.
      │ groupLines가 hasEOL 누락 join(헤더·캡션이 본문과 한 줄)을 줄높이(normTop) 점프로 분리.
      │ 전량 drop 시 빈 본문(splitSentences=0 no-op); fullText 폴백은 추출 실패(mismatch)만.
      │ + cross-page: 페이지 끝에서 끊긴 문장은 다음 페이지 본문 앞에 붙여 완성 문장으로(carryAcrossPages)
      │ + body↔원문 offset 매핑(segments, pageSegments에 저장) → PAGE_TEXT(page, bodyText)
      ▼
[host] splitSentences(bodyText) → POST /api/translate(aligned)
      │ {pair:{i,tgt}} SSE 증분 → RENDER_TRANSLATION(page, [{i,tgt,bodyStart,bodyEnd}], replace)
      │ 페이지별 캐시(재방문/토글 즉시), 논문 전환 시 reset+CLEAR_TRANSLATION
      ▼
[iframe] 해당 페이지 .page-translation 컬럼에 문장 span 증분 렌더
      │ bodyStart/bodyEnd → mapBodyRange(segments) → 원문 전역 offset
      │ 번역 span hover → 원문 연회색 오버레이 / 원문 hover → 번역 span 강조 + 원문도 연회색 오버레이 (대칭 양방향, iframe 내부)
```

> 번역 원문은 백엔드 `parser.py`(ingestion)가 아니라 **iframe text-layer**에서 추출한다. 본문 필터는 렌더되는 text-layer를 바꾸지 않고 `bodyText`+`segments`만 별도 생성한다(가정 `items[].str 연결 == text-layer.textContent`, 어긋나면 필터 없이 전체 텍스트 폴백). 글꼴(세리프/산세리프)·크기는 host가 `SET_TRANSLATION_FONT`로 iframe에 전달(iframe은 next/font 변수를 못 봄 → viewer.css `@font-face` 자체 호스팅).
>
> **비본문 제거 원칙(`bodyFilter.js`)**: 본문 오삭제 > 비본문 통과(보수적). 단일 페이지로 못 거르는 비본문(연속 References, 반복 러닝 헤더)은 **문서 수준**(전 페이지 1회 스캔, lazy·임의 순서 요청과 무관하게 결정적·memoize)에서, 위치·폰트·패턴·반복성 중 **2개 이상 신호의 AND**로만 제거한다. 양식 다양성은 `fixtures/pilot-papers`의 회귀 논문(#1 성-이니셜·#2 대괄호·#3 이니셜-성·#4 점번호 References)으로 검증한다. `frontend/src/lib/text/bodyFilter.test.ts`가 `bodyFilter.js`(viewer.js와 단일 소스)를 그대로 import해 순수 함수로 보장한다.

### 3.2c Reader: Figure/Table 인라인 비전 설명 + 후속 채팅 (F-04/F-14)

본문 번역에서 제외된 Figure/Table은 각각 **개별적으로** 비전 분석해 인라인 팝오버로 보고, 후속 질문으로 이어서 대화한다.

```
[iframe] 페이지 paint 시 REQUEST_FIGURES(page) → [host] marker bbox를 RENDER_FIGURES(page,figures)로
      │ 응답. figures 있으면 정밀 bbox 버튼, 없으면 detectFigureAnchors 휴리스틱 폴백
      │ (캡션 앵커: Figure=캡션 위, Table=캡션 아래, ±42% 밴드 — 과잉 crop 허용)
      ▼ (버튼 클릭)
[iframe] cropRegion: page-canvas에서 region을 잘라 PNG dataURL → FIGURE_EXPLAIN(page, kind,
      │ label, captionText, imageDataUrl, rect) 전송
      ▼
[host] iframe rect 보정 → FigureExplainPopover: POST /api/explain/figure
      │ {kind, image(dataURL), label, captionText, question, history, paperId, page}
      │ 첫 설명 자동 스트림 → 후속 질문 칩 + 미니 채팅(매 턴 이미지 재첨부, history 누적)
      ▼
[backend] figure_description(gpt-5 vision) / table_description(gemini-2.5-pro) task로
      │ [text + image] 멀티모달 스트리밍 → 종료 후 generate_followups로 후속 질문 3개(SSE meta)
      │ 이미지·질문·히스토리 해시 캐시 키(on-demand+캐시)
```

> 영역 bbox 소스 2가지: `config/ingestion.yaml`의 `parser: marker`면 marker-pdf 정밀 bbox(`GET /api/papers/{id}/figures`, Cache `figure_layout`에 저장), 기본 `pymupdf`면 프론트 캡션 앵커 휴리스틱(과잉 crop). pregen의 figure/table 사전생성도 marker bbox가 있으면 해당 영역을 `get_pixmap(clip)`으로 렌더해 **비전**으로 생성(없으면 텍스트 폴백). 인라인 팝오버는 별도 on-demand 멀티턴 경로.

### 3.3 Tab 상태 동기화

```
[Frontend Zustand: tabsStore]
      │ openTab / closeTab / reorderTab / pinTab
      ▼ (debounced 500ms)
[POST /api/tabs/reorder, POST /api/tabs, DELETE /api/tabs/{id}]
      ▼
[Postgres: tabs 테이블]
      ▲
      │ 페이지 진입 시 GET /api/tabs → hydrate Zustand
[Frontend Reader/Library shell]
```

**충돌 정책 (v1)**: last-write-wins. 동일 사용자 멀티 디바이스는 v2에서 결정 (CRDT 검토). 자세한 결정은 [ROADMAP §6](./ROADMAP.md) 참고.

---

## 4. pdf.js Shadow DOM 격리 패턴 (F-01, Moonlight 차용)

### 4.1 왜 격리하는가
- pdf.js viewer는 자체 CSS·키 이벤트 핸들러를 갖는다. 호스트 페이지의 Tailwind·next-intl·Zustand와 직접 충돌하면 (a) 키 단축키 가로채기, (b) 색상 토큰 누수, (c) iframe 스크롤 동기화 깨짐 등이 발생.
- Moonlight의 Shadow DOM iframe 패턴은 viewer를 자기 자신의 ShadowRoot 안에 호스팅해 CSS·이벤트를 호스트와 단방향 격리.

### 4.2 통신 채널

```
Host React  ───► iframe.contentWindow.postMessage({ type, payload })
            ◄─── window.parent.postMessage(...)
```

**Host → iframe 메시지 타입**:
- `LOAD_PDF` (signed URL) · `JUMP_TO` (page) · `SET_ZOOM` (scale)
- `RENDER_HIGHLIGHTS` / `REMOVE_HIGHLIGHT` (저장 하이라이트 오버레이)
- `TOGGLE_TRANSLATION` (enabled — 번역 컬럼 표시/숨김 + 본문 hover on/off) · `REQUEST_PAGE_TEXT` (page — 본문만 반환)
- `REQUEST_OUTLINE` · `REQUEST_THUMBNAILS` (좌측 사이드바)
- `RENDER_TRANSLATION` (page, pairs[{i,tgt,bodyStart,bodyEnd}], replace) / `CLEAR_TRANSLATION` (page?) — 페이지별 번역 컬럼
- `SET_TRANSLATION_FONT` (family sans|serif, scale) — 번역 컬럼 글꼴·크기
- `RENDER_FIGURES` (page, figures[{kind,label,bbox,captionText}]) — 백엔드 marker bbox 주입(빈 배열이면 휴리스틱 폴백)

**iframe → Host 메시지 타입**:
- `SELECTION_CHANGE` (text, rect, rects, page) · `PAGE_VISIBLE` (page) · `PAGE_TEXT` (page, text=본문)
- `HIGHLIGHT_CLICK` (id) · `OUTLINE` (items) · `THUMBNAIL` (page, dataUrl) — TOC는 내장 outline 우선·휴리스틱 폴백이며, 내장 outline 제목엔 빠진 섹션 번호를 본문 text-layer **span 단위**로 헤딩을 찾아 복원(숫자형 `1`/`2.1` + 부록형 `A`/`E.1`)해 앞에 붙임. 평탄 `textContent`가 아닌 span을 순회하므로 앞 span(그림 숫자 등)이 번호에 혼입되지 않음
- `REQUEST_FIGURES` (page) — 페이지 paint 시 백엔드 figure bbox 요청(번역 lazy 패턴 미러)
- `FIGURE_EXPLAIN` (page, kind, label, captionText, imageDataUrl, rect) — Figure/Table 설명 버튼 클릭(crop 이미지)
- `READY` / `ERROR`

> 교차 하이라이트는 원문·번역이 모두 iframe 안에 있으므로 iframe 내부에서 처리한다(이전 `HIGHLIGHT_SENTENCE`/`SENTENCE_HOVER` host 왕복 제거).

### 4.3 보안
- 호스트는 `event.source === iframeRef.current?.contentWindow` 검증 후에만 메시지 수용.
- pdf.js viewer는 `sandbox="allow-scripts allow-same-origin"` (same-origin 필요 — KaTeX 폰트 로드)로 실행.
- R2 PDF는 presigned URL (TTL 10분)만 iframe에 전달.

---

## 5. Provider 추상화

### 5.1 LLMProvider

```python
class LLMProvider(Protocol):
    name: Literal["openrouter", "openai", "gemini"]

    async def chat(
        self,
        messages: list[Message],
        model: str,
        stream: bool = True,
        max_tokens: int | None = None,
        temperature: float = 0.3,
    ) -> AsyncIterator[StreamChunk]: ...

    async def embed(self, texts: list[str], model: str) -> list[list[float]]: ...
```

**기본 라우팅** (Phase 0~1) — 라우팅 설정은 레포 루트 `config/agents.yaml`(router가 로드 시 구조 검증: `default`·각 agent·각 `fallback`이 `provider`+`model`을 갖는지 fail-fast), 전 agent OpenRouter Qwen3.6 + agent별 `reasoning_effort`:
- 일반 텍스트 추론 → `openrouter/qwen/qwen3.6-35b-a3b` (경량 task는 `qwen3.6-flash`)
- Figure/Table description (Vision) → `openrouter/qwen/qwen3.6-plus` (F-14)
- 팟캐스트 창작 → `openrouter/qwen/qwen3.6-plus`(`reasoning_effort: high`)
- 임베딩 → `bge-m3` (self-host) or `openai/text-embedding-3-large` (initial, 라우터 미사용)

생성 하이퍼파라미터(`temperature`·`top_p`·`max_tokens`)도 같은 `config/agents.yaml`에서 agent별로 정의돼 `router.hyperparameters()`가 읽어 전달한다. 단 **`reasoning_effort != none`인 agent는 temperature/top_p를 보내지 않는다**(thinking 모델은 sampling을 무시/거부하고 greedy 디코딩은 추론 품질을 떨어뜨림) — `max_tokens`만 전달. provider base_url/timeout은 코드 하드코딩(별도 `providers.yaml` 없음).

**멀티모달 content**: 메시지 `content`는 `str`(텍스트, 기존 그대로) 또는 parts 배열 `[{type:text}, {type:image, mime, data}]`(`providers/content.py`)을 받는다. gemini는 `inline_data`, openai/openrouter는 `image_url`(data URL)로 변환, stub은 이미지 무시. 두 비전 경로가 이를 쓴다: ① Figure/Table 인라인 설명(`/api/explain/figure`, §3.2c) — 프론트 crop 이미지 + 캡션·본문 + 멀티턴 history. ② pregen 사전생성(`agents/pregen.py`) — marker bbox가 있으면 `ingestion/render.py`의 `get_pixmap(clip)`로 영역을 렌더해 비전으로 figure/table을 미리 설명(없으면 텍스트 폴백, prompt_version v2).

**Fallback 정책**: provider 5xx → 다음 provider 동일 모델군 → 최종 실패 시 사용자 알림 (PRD §7.5).

**Reasoning 스트리밍**: OpenRouter `qwen` 계열은 추론(reasoning) 모델이라 사고 과정이 OpenRouter SSE의 `delta.reasoning`으로 먼저 흐르고 `delta.content`(최종 답변)는 그 뒤에 온다. 그대로 두면 추론 동안 사용자에게 빈 스트림만 보인다. Chat 경로는 요청 스코프 `reasoning_sink` contextvar(`providers/base.py`)로 reasoning 델타를 받아 `{"reasoning": ...}` SSE 이벤트로 라이브 전송한다(`api/chat.py`가 큐로 content·reasoning 머지). reasoning 은 캐시·영속화·Langfuse output 에 포함하지 않는다. **전 agent가 Qwen3.6(OpenRouter reasoning 모델)이고 `config/agents.yaml`의 agent별 `reasoning_effort`가 OpenRouter 요청의 `reasoning.effort`로 전달되므로, chat primary에 reasoning 델타가 흐른다(effort `none`이면 사실상 일반 content 스트림).** Explain/Translate(단발 task)는 reasoning_sink 미적용.

### 5.2 TTSProvider

```python
class TTSProvider(Protocol):
    name: Literal["openai", "elevenlabs"]
    async def synthesize(
        self,
        script: PodcastScript,
        voice_a: str,
        voice_b: str,
    ) -> AudioStream: ...
```

**기본**: `openai/tts-1-hd`. **Fallback**: `elevenlabs/eleven_turbo_v2`. Phase 2 F-13에서 활성.

---

## 6. 데이터 저장소

### 6.1 Postgres (Supabase, Seoul)
- 10개 핵심 엔티티 ([PRD §8.4](./PRD.md)): User, Paper, Collection, LibraryItem, Tag, Tab, Note, Highlight, Podcast, Cache.
- Soft delete: `soft_deleted_at TIMESTAMPTZ NULL` — 30일 후 hard delete (GDPR §8.2).
- 마이그레이션 도구: **Alembic** (Phase 1 도입). Phase 0은 로컬 SQLite 단일 파일.
- **SQLite 동시성**: 로컬 sqlite는 단일 writer라 동시 캐시 write(translate/explain SSE + pregen)가 `database is locked`로 즉시 실패한다. `storage/db.py`가 sqlite 연결마다 `PRAGMA journal_mode=WAL`(reader 비차단) + `PRAGMA busy_timeout=5000`(writer 대기·재시도)을 건다. Postgres·`:memory:`는 무영향.
- **드라이버 정규화**: Supabase/Render/.env 가 주는 `postgresql://`(또는 `postgres://`)는 SQLAlchemy 기본이 동기 psycopg2(미설치)다. `storage/db.py`가 async 엔진 빌드 시 `postgresql+asyncpg://`로 정규화한다(`_normalize_async_url`). sqlite URL 은 무변경.

### 6.2 Qdrant (Cloud, ap-northeast-1)
- 컬렉션: `paper_chunks` (vector dim = 1024 for bge-m3, payload = paper_id, page, bbox, text).
- 검색 필터: `paper_id` (Chat·Explain 컨텍스트), 또는 전역 (F-09 Deep Search).

### 6.3 Cloudflare R2
- 버킷: `paperlight-pdf` (원본 PDF, AES-256), `paperlight-audio` (Podcast mp3), `paperlight-notes` (Markdown 백업).
- 접근: presigned URL only — 직접 노출 금지.

### 6.4 Redis (Redis Cloud)
- Job queue (Ingestion 워커), SSE 세션 토큰, 단기 캐시 (Translation 페이지 단위 5분 TTL).

### 6.5 Cache 정책
- LLM 응답 캐시 (Cache 테이블, `key = sha256(task + paper_id + chunk_id + model + prompt_v)`):
  - Summary / F-14 / F-15 → **영구 (TTL ∞)** — ingestion pregen
  - References → **30일** — ingestion pregen(`get_references`), 만료 후 lazy 재생성
  - Explanation / Translation → 24시간 — on-demand(pregen 제외, 임의 선택/페이지 의존)
  - Chat → 캐시 안 함 (대화 컨텍스트 의존)
- **전체 논문 맥락 주입**(`agents/context.py`): per-element 태스크 프롬프트에 (a) `summary` 캐시 + (c) RAG 관련 청크를 "[논문 맥락]" 블록으로 주입한다. 맥락은 `(paper_id, query_text)`의 **결정적 함수**(요약=paper_id 종속, RAG=둘 다 종속, 모두 캐시 키에 이미 포함)라 캐시 키 정합성을 깨지 않으며, 프롬프트 포맷 변경은 **prompt_version bump**(explain v2 / figure·table v3 / paragraph v2 / chat v2 / translate v2)로만 무효화한다. 번역은 충실성 위해 요약만(용어 참고)·system-only 주입으로 정렬 1:1을 보존.

---

## 7. 외부 의존성·환경

### 7.1 외부 API
| 서비스 | 용도 | 키 환경변수 |
|--------|------|------------|
| OpenRouter | LLM 메인 (Qwen3.6-35B) | `OPENROUTER_API_KEY` |
| OpenAI | Vision (GPT-5), TTS | `OPENAI_API_KEY` |
| Google Gemini | Table description fallback | `GEMINI_API_KEY` |
| ElevenLabs | TTS fallback | `ELEVENLABS_API_KEY` |
| Semantic Scholar | F-05 Citation, F-09 Deep Search | `S2_API_KEY` (optional) |
| arXiv | 메타데이터 + PDF | (no key) |
| Crossref | DOI 메타데이터 | (mailto 헤더만) |
| Google OAuth | 인증 (Phase 1+) | `GOOGLE_OAUTH_CLIENT_ID/SECRET` |
| Supabase | Postgres + Storage 부가 | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

### 7.2 환경별 구성
| 환경 | Frontend | Backend | DB | Vector | Object | LLM |
|------|----------|---------|----|--------|--------|-----|
| **local** | `next dev` :3000 | `uvicorn` :8000 | docker-compose Postgres | docker-compose Qdrant | docker-compose MinIO | OpenRouter |
| **preview** | Vercel preview | Render preview | Supabase staging | Qdrant Cloud staging | R2 staging | OpenRouter |
| **prod** | Vercel (Seoul edge) | Render (Tokyo) | Supabase (Seoul) | Qdrant Cloud (ap-northeast-1) | R2 (auto) | OpenRouter |

**`.env` 로딩**: `uvicorn`/`uv run`은 `.env`를 자동 로드하지 않는다. 백엔드는 FastAPI `lifespan` startup에서 `load_dotenv(<repo>/.env, override=False)`로 로드 → 로컬 실행 시 API 키·DB·인프라 URL이 `os.environ`에 들어온다. `override=False`라 Render/CI가 주입한 실제 env가 우선하고, `.env` 부재 시 no-op. **import가 아닌 lifespan에 두는 이유**: ASGI 테스트(`ASGITransport`, lifespan 미실행)에 `.env`의 인프라 설정(S3/Qdrant/DB)이 새지 않게 하여 오프라인 테스트를 보존한다.

**로컬 빠른 실행 모드(Docker 불필요)**: `.env`에서 `DATABASE_URL`·`QDRANT_URL`·`S3_ENDPOINT` 3개만 주석 처리하면 sqlite(`db.py` 기본) + LocalObjectStore(`object_store.py:get_object_store`) + 인메모리 Qdrant(`vector.py`)로 폴백한다. API 키는 그대로 로드돼 AI는 동작. 풀 인프라는 3줄 주석 해제 후 `docker-compose up -d`.

**파일럿 샘플 논문 시드(데모)**: FE 라이브러리는 `sample-1`/`sample-2`(`fixtures/pilot-papers`)를 데모 카드로 노출하지만, 백엔드 `papers`에 행이 없으면 우측 AI 패널이 `/api/papers/sample-1/...`을 호출해 **404 → 빨간 에러**가 난다. 백엔드는 `lifespan` startup에서 `ingestion/seed.py:seed_samples`를 백그라운드(`asyncio.create_task`)로 돌려 두 파일럿을 `anonymous` 소유로 ingest + pregen해 둔다 → Summary/Insights/Chat이 import 없이 동작. **env 게이팅**: `APP_ENV=development` 또는 `PAPERLIGHT_SEED_SAMPLES=1`일 때만(프로덕션 DB 미오염). **idempotent**: chunks가 있으면 full ingest를 건너뛰되, 인메모리 Qdrant는 재시작 시 비므로 벡터만 재-upsert해 Chat retrieval을 복구한다(pregen 산출물은 `caches` TTL ∞로 영속 → 두 번째 startup부터 LLM 재호출 없이 캐시 히트). **Chat 검색 품질**: 기본 `INGEST_EMBEDDER=stub`은 결정적 랜덤 벡터라 의미 검색이 안 돼 Chat이 "근거 없음"으로 답할 수 있다. 의미 기반 RAG가 필요하면 `uv sync --extra ingest` 후 `INGEST_EMBEDDER=fastembed`(bge-m3)로 전환하고 재시드한다.

### 7.3 Observability
- **Sentry** — 에러 (FE + BE)
- **PostHog** — 제품 이벤트, KPI ([PRD §3](./PRD.md))
- **Langfuse** — LLM trace (prompt·response·cost·latency)
- **Prometheus + Grafana** — 인프라 메트릭 (Phase 2+)
- **OpenTelemetry** — distributed trace across FE → BE → Provider

**S15 구현(Phase 1 — 트레이스 가시화)**: 전부 **env 게이팅**(키 부재 시 완전 no-op → 로컬/CI/테스트 무영향). BE `paperlight/observability/`(settings·trace contextvars·`init_sentry`·순수 ASGI `RequestContextMiddleware`로 `X-Request-Id`·`get_langfuse` + `stream_task` generation 래핑). FE `@sentry/nextjs`(withSentryConfig + instrumentation + error boundary) + `posthog-js`(`lib/analytics` + `AnalyticsProvider`). Prometheus/Grafana/OpenTelemetry는 Phase 2.

**환경 변수** (미설정 시 해당 통합 비활성):

| 대상 | Backend | Frontend |
|------|---------|----------|
| Sentry | `SENTRY_DSN` · `SENTRY_ENVIRONMENT` · `SENTRY_TRACES_SAMPLE_RATE` | `NEXT_PUBLIC_SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_ENVIRONMENT` · (빌드 소스맵) `SENTRY_AUTH_TOKEN`·`SENTRY_ORG`·`SENTRY_PROJECT` |
| Langfuse | `LANGFUSE_PUBLIC_KEY` · `LANGFUSE_SECRET_KEY` · `LANGFUSE_HOST` | — |
| PostHog | — | `NEXT_PUBLIC_POSTHOG_KEY` · `NEXT_PUBLIC_POSTHOG_HOST` |

**Trace 키**(PRD §7.9): `request_id`(미들웨어) · `user_id`(`get_user_id`) · `paper_id`(chat/explain/translate, best-effort) · `task`/`model`(Langfuse generation). `tab_id`는 BE LLM 경로 미가용 → 후속.

---

## 8. 빌드·배포

| 단계 | 도구 | 위치 |
|------|------|------|
| **Frontend lint+typecheck+test** | ESLint + tsc + Vitest + Playwright | GitHub Actions |
| **Backend lint+test** | ruff + pyright + pytest | GitHub Actions |
| **Docker smoke** | docker-compose up + health check | GitHub Actions |
| **Frontend deploy** | Vercel (auto on `main`) | — |
| **Backend deploy** | Render (auto on `main`) | — |
| **DB migration** | Alembic (Phase 1+) — Render pre-deploy hook | — |

CI 파일: [.github/workflows/ci.yml](.github/workflows/ci.yml) — Phase 0~1 동안 채워질 예정.

---

## 9. 보안·프라이버시 요약

- 모든 시크릿: Vercel/Render 환경변수 (코드에 하드코딩 금지)
- PDF: R2에 AES-256 암호화, presigned URL TTL 10분
- 인증: Google OAuth + httpOnly Cookie + Refresh Token rotation (Phase 1)
- CSP: pdf.js iframe은 `sandbox` + `allow-same-origin`만 허용
- GDPR: `GET /api/export/gdpr-zip` (Phase 2) + soft delete 30일 정책

자세한 항목은 [PRD §8.2](./PRD.md) 참조.

---

## 10. 관련 문서

- [PRD.md](./PRD.md) — 무엇을 만드는가
- [DESIGN.md](./DESIGN.md) — 어떻게 보이는가
- [ROADMAP.md](./ROADMAP.md) — 언제·어떤 순서로
