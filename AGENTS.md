# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PaperLight — [themoonlight.io](https://www.themoonlight.io) 스타일의 **단일 사용자 로컬 AI 논문
리더 웹앱**. Next.js 15 (FE) + FastAPI (BE) 모노레포. PDF를 올리면 본문만 추출해(저자/캡션/참고문헌
제외) 번역·요약·챗·설명·하이라이트·노트를 제공한다.

핵심 문서:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 모듈맵·데이터 흐름·pdf.js Shadow DOM·본문 추출(먼저 읽을 것)
- [docs/DESIGN.md](docs/DESIGN.md) — 디자인 토큰·와이어프레임
- [.claude/research/](.claude/research/) — themoonlight 기능·Zotero 파싱 조사

> 인증·팟캐스트·풀 라이브러리·클라우드 인프라(Postgres·Qdrant·Redis·R2·관측도구)는 제거됨.

## 패키지 매니저

- **Backend**: `uv` (Python 3.12+)
- **Frontend**: `pnpm` (`pnpm@11.1.3`) — npm/yarn 금지

## 자주 쓰는 명령

별도 로컬 인프라(docker) 불필요 — SQLite + 로컬 파일시스템.

### Backend (`backend/`)
```bash
cd backend
uv sync                                                      # 의존성 설치
uv run uvicorn paperlight.main:app --reload --port 8000      # 개발 서버 (SQLite 자동 생성)
uv run pytest                                                # 전체 테스트
uv run ruff check paperlight                                 # 린트 (line 100, E,F,I,B,UP,N,SIM)
```
- pytest `asyncio_mode=auto`, 테스트는 `.venv/bin/python -m pytest`도 가능

### Frontend (`frontend/`)
```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest (bodyFilter 합성 + 실제 PDF 픽스처 회귀 포함)
```

## 아키텍처 빅 픽처

자세한 내용은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). 코드 수정 전 한 번 읽을 것.

### 책임 분담
- `backend/paperlight/api/` — HTTP 어댑터(SSE 다수). 비즈니스 로직 금지.
- `backend/paperlight/agents/` — chat(retrieve+RAG)·context·pregen(자동 사전생성)·references.
- `backend/paperlight/ingestion/` — PDF → chunk → embedding 파이프라인(parser/chunker/embedder/pipeline/seed).
- `backend/paperlight/providers/` — LLM 외부 API **추상화**(openrouter/openai/gemini/stub) + router + cache.
- `backend/paperlight/storage/` — `db.py`(SQLite), `object_store.py`(로컬 FS). 라우터·에이전트는 이 계층으로만 저장소 접근.
- `backend/paperlight/local_user.py` — `LOCAL_USER_ID` + `get_user_id`(인증 없음, 단일 사용자).
- `frontend/src/components/{landing,shell,reader,panels}/` — 랜딩/셸/Reader/AI 패널.
- `frontend/src/stores/` — Zustand. Tab 상태는 FE Zustand ↔ BE Tab API ↔ SQLite로 동기(last-write-wins).
- `config/agents.yaml` — agent 라우팅 + 생성 하이퍼파라미터(model·reasoning_effort·temperature·top_p·max_tokens). **코드 변경 없이 핫리로드**.

### 비자명한 핵심 패턴

**pdf.js Shadow DOM iframe 격리** ([ARCHITECTURE §5](docs/ARCHITECTURE.md))
- pdf.js viewer는 ShadowRoot 안 iframe으로 격리(호스트 CSS·키 충돌 방지)
- postMessage 채널: `LOAD_PDF`/`JUMP_TO`/`RENDER_TRANSLATION`/`RENDER_HIGHLIGHTS` (host→iframe), `SELECTION_CHANGE`/`PAGE_VISIBLE`/`HIGHLIGHT_CLICK`/`READY` (iframe→host)
- 호스트는 `event.source === iframe.contentWindow` 검증 후 수용

**본문 추출** ([ARCHITECTURE §6](docs/ARCHITECTURE.md)) — `frontend/public/pdfjs/bodyFilter.js`
- 런타임(viewer.js)·테스트(vitest) **단일 소스**. 저자/캡션/참고문헌/헤더푸터/도표 텍스트를 제거.
- 불변식: `bodyText.slice(seg.bodyStart,seg.bodyEnd) === fullText.slice(seg.globalStart,seg.globalEnd)`. 수정 시 반드시 유지.

**Auto pre-gen** (Ingestion 시점)
- Summary·Auto-Highlight·Figure/Table·Paragraph는 자동 생성 → `cache` 테이블 영구 저장. LLM 키 부재 시 suppress(ingestion은 ready).

**Chat 검색** — Qdrant 없이 SQLite `Chunk.embedding`(packed float32) + numpy 코사인. `agents/chat.py::retrieve` 시그니처 보존.

## 파일럿 데이터

[fixtures/pilot-papers/](fixtures/pilot-papers/) — 시드·파싱 회귀의 고정 입력 PDF(+`.meta.json`).
테스트는 절대 경로 가정 금지 — `Path(__file__).resolve().parents[N] / "fixtures" / "pilot-papers"` 패턴.

## 데이터 흐름 주의

- 원본 PDF는 로컬 FS(`PAPERLIGHT_DATA_DIR`)에 저장, `/api/papers/{id}/pdf`로 직접 서빙(단일 사용자, 서명 없음).
- LLM 응답 캐시 키: `sha256(task + paper_id + chunk_id + model + prompt_version)` — 프롬프트 버전 누락 시 캐시 폭주.
- 모든 행은 `user_id = LOCAL_USER_ID`로 귀속.

## 응답 언어

작업 응답은 **한국어 기본**(코드 식별자·기술 용어는 영문 그대로).
