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
│   │   ├── agents/                  # LangGraph 노드 (chat, ingest, podcast, search, summary, highlight)
│   │   ├── ingestion/               # parser → chunker → embedder → pipeline
│   │   ├── providers/               # LLMProvider 추상화 (openrouter / openai / gemini) + TTSProvider (openai / elevenlabs)
│   │   ├── storage/                 # db.py (Postgres), vector.py (Qdrant), object.py (R2)
│   │   └── models/                  # Pydantic + SQLAlchemy 엔티티
│   └── tests/                       # pytest (TestClient + Provider mocks)
│
├── frontend/                        # Next.js 15 App Router + React 19 + TypeScript
│   ├── src/
│   │   ├── app/                     # 페이지 라우팅 (Library, Reader/[paperId])
│   │   ├── components/
│   │   │   ├── shell/               # TabBar, TopToolbar, SettingsMenu
│   │   │   ├── reader/              # ReaderShell, PdfViewer, FloatingSelectionMenu, TranslationPane
│   │   │   ├── library/             # 4-pane: Tree, List, Detail, TagCloud
│   │   │   └── panels/              # ExplanationPanel, ChatPanel, SummaryPanel
│   │   ├── stores/                  # Zustand: tabs, settings, library, reader
│   │   ├── lib/                     # api/, pdf/, selection/, theme/, i18n/
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
      │ 4. marker-pdf 파싱 (text + bbox + figures)
      │ 5. chunker (≈512 tokens)
      │ 6. bge-m3 임베딩 (Qwen, 동일 클러스터)
      ▼
[Qdrant: chunks 컬렉션]
      │ 7. LangGraph "summary-pipeline" 노드 트리거
      ▼
[OpenRouter / Qwen3.6-35B]
      │ 8. Summary (다층) + F-10 Auto-Highlight + F-14 Figure + F-15 Paragraph 생성
      ▼
[Postgres: cache 영구 저장] ◄── 9. status=ready
      │
      ▼
[SSE: /api/papers/{id}/status]
      │
      ▼
[Reader UI 활성화]
```

### 3.2 Reader: 텍스트 선택 → Explanation

```
[Shadow DOM iframe (pdf.js viewer)]
      │ 1. selectionchange 이벤트 → postMessage 호스트로 전달
      ▼
[Host React (Reader page)]
      │ 2. FloatingSelectionMenu 표시 (선택 위 8px, 200ms hover)
      │ 3. 사용자 "💡 Explain" 클릭
      ▼
[POST /api/explain (SSE)]
      │ 4. 본문 chunk lookup (Qdrant nearest + paper_id 필터)
      │ 5. LangGraph "explain" agent — Qwen 호출, 변수표·LaTeX 인용 생성
      ▼
[ExplanationPanel — 우측 패널 스트리밍]
      │ 6. 본문 근거 클릭 → host로 jump 명령 → iframe scrollTo + 0.5초 펄스
```

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
- `LOAD_PDF` (paperId, pdf_r2_key signed URL)
- `JUMP_TO` (page, bbox)
- `SET_ZOOM` (scale)
- `HIGHLIGHT_REGION` (page, bbox, color, ttl)
- `TOGGLE_TRANSLATION` (lang)

**iframe → Host 메시지 타입**:
- `SELECTION_CHANGE` (text, bbox, page)
- `PAGE_VISIBLE` (page, progress_pct)
- `READY` / `ERROR`

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

**기본 라우팅** (Phase 0~1):
- 일반 텍스트 추론 → `openrouter/qwen/qwen3.6-35b-a3b`
- Figure description (Vision) → `openai/gpt-5` (F-14)
- Table description → `gemini/gemini-2.5-pro` (F-14 fallback)
- 임베딩 → `bge-m3` (self-host) or `openai/text-embedding-3-large` (initial)

**Fallback 정책**: provider 5xx → 다음 provider 동일 모델군 → 최종 실패 시 사용자 알림 (PRD §7.5).

**Reasoning 스트리밍**: 기본 모델 `qwen/qwen3.6-35b-a3b`는 추론(reasoning) 모델이라 사고 과정이 OpenRouter SSE의 `delta.reasoning`으로 먼저 흐르고 `delta.content`(최종 답변)는 그 뒤에 온다. 그대로 두면 추론 동안 사용자에게 빈 스트림만 보인다. Chat 경로는 요청 스코프 `reasoning_sink` contextvar(`providers/base.py`)로 reasoning 델타를 받아 `{"reasoning": ...}` SSE 이벤트로 라이브 전송한다(`api/chat.py`가 큐로 content·reasoning 머지). reasoning 은 캐시·영속화·Langfuse output 에 포함하지 않는다. Explain/Translate(단발 task)는 미적용.

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
  - Summary / F-14 / F-15 → **영구 (TTL ∞)**
  - Explanation / Translation → 24시간
  - Chat → 캐시 안 함 (대화 컨텍스트 의존)

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
