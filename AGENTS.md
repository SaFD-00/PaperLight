# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PaperLight — "PDF 뷰어 안에서 모든 AI 기능이 끝나는" 논문 읽기 도구. Next.js 15 (FE) + FastAPI/LangGraph (BE) 모노레포. 영감: Moonlight(Reader UX) + Zotero(Tabbed 4-pane Library) + NotebookLM(Podcast).

**현재 상태**: 코드는 스캐폴딩만, 실제 로직 미구현. **Phase 0 진행 준비 완료** — task 분해는 [docs/ROADMAP.md](docs/ROADMAP.md) §2 참조.

핵심 문서를 먼저 읽고 작업할 것:
- [docs/PRD.md](docs/PRD.md) — 무엇을 만드는가 (F-01~F-15, §18에 진척도)
- [docs/DESIGN.md](docs/DESIGN.md) — 어떻게 보이는가 (디자인 토큰, 와이어프레임)
- [docs/ROADMAP.md](docs/ROADMAP.md) — 언제·어떤 순서로 (Phase 0 T0~T10)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 어떻게 짜여있는가 (모듈맵, 데이터 흐름, pdf.js Shadow DOM 패턴)

## 패키지 매니저

- **Backend**: `uv` (Python 3.12+)
- **Frontend**: `pnpm` (locked at `pnpm@11.1.3`) — npm/yarn 사용 금지

## 자주 쓰는 명령

### 로컬 인프라 (Postgres 16 + Qdrant + Redis 7 + MinIO)
```bash
docker compose up -d postgres qdrant redis minio
docker compose down
```

### Backend (`backend/`)
```bash
cd backend
uv sync --extra dev                                          # 의존성 설치 (+dev)
uv run uvicorn paperlight.main:app --reload --port 8000      # 개발 서버
uv run pytest                                                # 전체 테스트
uv run pytest tests/test_health.py::test_health -v           # 단일 테스트
uv run ruff check . && uv run ruff format --check .          # 린트
uv run mypy paperlight                                       # 타입 검사 (strict mode)
```
- Ruff: line-length 100, rules `E,F,I,B,UP,N,SIM`
- pytest `asyncio_mode=auto` — async 테스트에 마커 불필요
- mypy `strict=true` — 모든 함수 타입 어노테이션 필수

### Frontend (`frontend/`)
```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
pnpm lint         # next lint
pnpm typecheck    # tsc --noEmit (emit 없음, 검사만)
```

## 아키텍처 빅 픽처

자세한 다이어그램·플로우는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). 코드를 만지기 전 반드시 한 번 읽고 시작.

### 책임 분담
- `backend/paperlight/api/` — HTTP 어댑터 (SSE 스트리밍 다수). 비즈니스 로직 금지.
- `backend/paperlight/agents/` — LangGraph 워크플로 (Chat·Ingest·Podcast 등). 한 기능 = 한 그래프.
- `backend/paperlight/ingestion/` — PDF → chunk → embedding 파이프라인 (parser/chunker/embedder/pipeline).
- `backend/paperlight/providers/` — LLM/TTS 외부 API **추상화**. 전 agent OpenRouter Qwen3.6 패밀리(`plus`/`flash`/`35b-a3b`) + agent별 `reasoning_effort`. 신규 provider는 동일 Protocol 구현(`stream_chat(..., *, reasoning_effort=None)`).
- `backend/paperlight/storage/` — Postgres·Qdrant·R2 어댑터. 라우터·에이전트는 이 계층을 통해서만 저장소 접근.
- `frontend/src/components/{shell,reader,library,panels}/` — 셸/Reader/Library/AI 패널.
- `frontend/src/stores/` — Zustand. Tab 상태는 (FE Zustand ↔ BE Tab API ↔ Postgres)로 동기화 (last-write-wins).
- `config/*.yaml` — agent 라우팅(`agents.yaml`, router가 로드하는 단일 소스), 하이퍼파라미터/프로바이더/프롬프트/용어집(`hyperparameters.yaml`·`providers.yaml`·`prompts/`·`glossary/` — 현재 미배선 스펙). **코드 변경 없이 핫리로드** 가능하게 유지.

### 비자명한 핵심 패턴

**pdf.js Shadow DOM iframe 격리** ([ARCHITECTURE §4](docs/ARCHITECTURE.md)) — Moonlight 차용.
- pdf.js viewer는 ShadowRoot 안 iframe으로 격리 (호스트 CSS·키 이벤트 충돌 방지)
- 호스트 React ↔ iframe 통신은 **postMessage 채널**: `LOAD_PDF` / `JUMP_TO` / `SET_ZOOM` / `HIGHLIGHT_REGION` / `TOGGLE_TRANSLATION` (host→iframe), `SELECTION_CHANGE` / `PAGE_VISIBLE` / `READY` (iframe→host)
- 호스트는 `event.source === iframeRef.current?.contentWindow` 검증 후에만 메시지 수용

**Auto pre-gen 정책** (Ingestion 시점)
- Summary (다층) + F-10 Auto-Highlight + F-14 Figure/Table + F-15 Paragraph는 **자동 생성** — 결과는 `cache` 테이블에 영구 저장
- F-13 Podcast만 **수동 생성** (비용 통제)

**Provider 라우팅 기본값** (전 agent Qwen3.6, `config/agents.yaml`)
- 일반 텍스트 추론 → `openrouter/qwen/qwen3.6-35b-a3b` (경량 task `qwen3.6-flash`)
- Figure/Table description (Vision) → `openrouter/qwen/qwen3.6-plus`
- 팟캐스트 창작 → `openrouter/qwen/qwen3.6-plus` (`reasoning_effort: high`)
- 임베딩 → `bge-m3` (Phase 1+에 self-host, 라우터 미사용)
- 5xx → 동일 모델군의 다음 provider로 자동 fallback

## 파일럿 데이터

[fixtures/pilot-papers/](fixtures/pilot-papers/) — Phase 0 데모·E2E·ingestion 회귀의 **고정 입력** PDF 2편 (Code2World, Mobile World Model). 슬러그 명명 `<arxiv-id>-<slug>.pdf` + `.meta.json` 동반. 추가/변경 절차는 동 디렉토리 README.

테스트 작성 시 절대 경로 가정 금지 — `Path(__file__).resolve().parents[N] / "fixtures" / "pilot-papers"` 패턴으로 접근.

## 보안 / 데이터 흐름 주의

- 원본 PDF는 R2 (presigned URL, TTL 10분)로만 클라이언트에 전달. 직접 URL 노출 금지.
- LLM 응답 캐시 키: `sha256(task + paper_id + chunk_id + model + prompt_version)` — 프롬프트 버전을 누락하면 캐시 폭주.
- Soft delete 정책: `soft_deleted_at` 30일 후 hard delete (GDPR §8.2). 직접 row 삭제 금지.

## 커밋·문서 동기화 규칙

- F-넘버별 진척도는 [PRD §18.2](docs/PRD.md) 표에서 관리. 기능 PR 머지 시 ⬜→🚧→✅ 갱신.
- Phase 0 task는 [ROADMAP §2.1](docs/ROADMAP.md) 체크박스로 추적.
- 마일스톤 변경은 PRD §10 + ROADMAP §1을 동시 갱신.

## 응답 언어

이 저장소의 작업 응답은 **한국어 기본** (코드 식별자·기술 용어는 영문 그대로). PRD/ROADMAP/ARCHITECTURE는 한·영 혼용이며, 신규 문서도 동일 톤 유지.

## CI 상태

`.github/workflows/ci.yml`은 현재 빈 워크플로. FE lint/typecheck/test + BE pytest/ruff/mypy + docker-compose smoke 채우기는 Phase 1 작업 — [ROADMAP §3.1](docs/ROADMAP.md) 참조.
