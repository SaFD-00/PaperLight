# PaperLight Backend

FastAPI + LangGraph backend. See [docs/PRD.md](../docs/PRD.md) §7 for the full architecture.

## Setup

```bash
uv sync --extra dev
uv run uvicorn paperlight.main:app --reload --port 8000
```

Health check: <http://localhost:8000/health>

로컬(`APP_ENV=development`) 실행 시 파일럿 샘플 논문(`sample-1`/`sample-2`)이 startup 백그라운드로 자동 시드되어 라이브러리·Reader AI 패널(Summary/Insights/Chat)이 바로 동작한다(게이팅: `PAPERLIGHT_SEED_SAMPLES`). Chat 의미 검색이 필요하면 `uv sync --extra ingest` 후 `INGEST_EMBEDDER=fastembed`, 인메모리 Qdrant 대신 영속이 필요하면 `QDRANT_URL`(docker)을 설정한다.

## Layout (PRD §7.4)

- `paperlight/api/` — FastAPI routers
- `paperlight/agents/` — LangGraph graphs (one per feature)
- `paperlight/providers/` — Multi-LLM / TTS abstraction (PRD §7.5)
- `paperlight/ingestion/` — PDF parsing + chunking + embedding pipeline
- `paperlight/audio/` — Podcast TTS + stitching
- `paperlight/services/` — Business services (library, citation, recommendation)
- `paperlight/storage/` — DB / vector / object store adapters

All modules are currently stubs. Implementation is tracked in PRD §10 milestones.
