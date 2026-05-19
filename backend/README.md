# PaperLight Backend

FastAPI + LangGraph backend. See [docs/PRD.md](../docs/PRD.md) §7 for the full architecture.

## Setup

```bash
uv sync --extra dev
uv run uvicorn paperlight.main:app --reload --port 8000
```

Health check: <http://localhost:8000/health>

## Layout (PRD §7.4)

- `paperlight/api/` — FastAPI routers
- `paperlight/agents/` — LangGraph graphs (one per feature)
- `paperlight/providers/` — Multi-LLM / TTS abstraction (PRD §7.5)
- `paperlight/ingestion/` — PDF parsing + chunking + embedding pipeline
- `paperlight/audio/` — Podcast TTS + stitching
- `paperlight/services/` — Business services (library, citation, recommendation)
- `paperlight/storage/` — DB / vector / object store adapters

All modules are currently stubs. Implementation is tracked in PRD §10 milestones.
