# PaperLight

> "PDF 뷰어 안에서 모든 AI 기능이 끝나는" 논문 읽기 도구. 보고, 듣고, 정리하고, 발견한다.

PaperLight is an AI-powered paper reader that combines a PDF viewer with translation, explanation, multi-layer summaries, AI chat, **2-host AI podcasts (à la NotebookLM)**, figure/table descriptions, and paragraph-level insight — all in one place.

See [docs/PRD.md](docs/PRD.md) for the full Product Requirements (v2.3).

## Status

**Scaffolding only.** No features are implemented yet. This repo currently contains the directory skeleton, package manifests, and configuration shells described in PRD §7.4 / §7.5. Implementation follows the milestones in PRD §10.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript |
| Backend | FastAPI + LangGraph (Python 3.12) |
| Vector store | Qdrant |
| Database | PostgreSQL 16 |
| Cache / queue | Redis |
| Object storage | S3-compatible (MinIO for dev) |
| LLM providers | OpenAI / Gemini / OpenRouter (via `config/models.yaml`) |
| TTS | OpenAI / ElevenLabs |

## Repository layout

```
PaperLight/
├── frontend/         # Next.js app
├── backend/          # FastAPI + LangGraph
├── config/           # Hot-reloadable YAML (models, prompts, glossary)
├── docs/             # PRD and design docs
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Quick start (after cloning)

```bash
# 1. Spin up infra
docker compose up -d postgres qdrant redis minio

# 2. Backend
cd backend
uv sync --extra dev
uv run uvicorn paperlight.main:app --reload --port 8000

# 3. Frontend (separate terminal)
cd frontend
pnpm install
pnpm dev
```

- Backend: <http://localhost:8000/health>
- Frontend: <http://localhost:3000>

## Roadmap (PRD §10)

| Phase | Duration | Scope |
| --- | --- | --- |
| **Phase 0 — Prototype** | 4w | F-01 PDF viewer + F-02 Translation + F-04 Explanation (single LLM) |
| **Phase 1 — MVP** | 8w | Auth + Library + Chat + Summary + Provider abstraction + arXiv import |
| **Phase 2 — GA** | 12w | F-13 Podcast + F-14 Figure/Table + F-15 Paragraph + Auto Highlight + Deep Search + Billing |
| **Phase 3 — Expansion** | 12w+ | Team / Mind Map / Compare / Browser extension / Mobile |

## License

[MIT](LICENSE)
