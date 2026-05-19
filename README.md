# PaperLight

> "PDF 뷰어 안에서 모든 AI 기능이 끝나는" 논문 읽기 도구. 보고, 듣고, 정리하고, 발견한다.

PaperLight is an AI-powered paper reader that combines a PDF viewer with translation, explanation, multi-layer summaries, AI chat, **2-host AI podcasts (à la NotebookLM)**, figure/table descriptions, paragraph-level insight, and a **tabbed Zotero-style library** — all in one place.

See [docs/PRD.md](docs/PRD.md) for the full Product Requirements (**v3.0**) and [docs/DESIGN.md](docs/DESIGN.md) for design tokens, wireframes, and reference index.

## Status

**Scaffolding only.** No features are implemented yet. This repo currently contains the directory skeleton, package manifests, and configuration shells described in PRD §7.4 / §7.5. Implementation follows the milestones in PRD §10.

## Inspiration

| Reference | Role |
| --- | --- |
| [Moonlight](https://www.themoonlight.io/ko) | Reader UI, Top toolbar toggles, right AI panel, Shadow DOM PDF iframe, Floating Selection Menu |
| [Zotero](https://www.zotero.org/) | Tabbed workspace (library tab + paper tabs), 4-pane library, infinite collection tree, desktop information density |
| [NotebookLM](https://notebooklm.google/) | 2-host audio overview → F-13 AI Podcast |
| [SciSpace](https://typeset.io/) | Compare mode (Phase 3) |

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + `next-intl` |
| PDF | Mozilla pdf.js + KaTeX (Shadow DOM iframe per Moonlight) |
| Backend | FastAPI + LangGraph (Python 3.12) |
| Auth | Google OAuth 2.0 via Supabase Auth |
| Database | Supabase Postgres 16 (Seoul, ap-northeast-2) |
| Vector store | Qdrant Cloud (ap-northeast-1) |
| Cache / queue | Redis Cloud |
| Object storage | Cloudflare R2 (S3-compatible) |
| **LLM (default)** | **OpenRouter — `qwen/qwen3.6-35b-a3b`** |
| LLM (fallback) | OpenAI (GPT-5) / Gemini 2.5 / Anthropic via OpenRouter |
| TTS | OpenAI tts-1-hd (default) / ElevenLabs (fallback) |
| Observability | Sentry + PostHog + Langfuse + OpenTelemetry |
| Hosting | Vercel (FE) + Render/Railway (BE, Tokyo) |

## Repository layout

```
PaperLight/
├── frontend/         # Next.js app
├── backend/          # FastAPI + LangGraph
├── config/           # Hot-reloadable YAML (models, prompts, glossary)
├── docs/             # PRD.md + DESIGN.md
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Quick start (after cloning)

```bash
# 1. Spin up local infra (dev)
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

**Production region**: Supabase = Seoul (`ap-northeast-2`); Backend / Qdrant / Redis = Tokyo (`ap-northeast-1`).

## Keyboard shortcuts (highlights)

| Key | Action |
| --- | --- |
| `[` `]` `\` | Toggle left / right panel / Focus mode |
| `⌘W` / `⌘⇧T` | Close tab / Reopen recent tab |
| `⌘⇧←` `⌘⇧→` `⌘1`~`⌘9` | Switch tabs |
| `H` `I` `K` | F-15 modes: Inline Hint / Importance Highlight / Quick Skim |
| `⌘K` | Command Palette |
| `A` `G` `P` `T` | Auto Highlight / Image Description / Paragraph Hint / Auto Translate |

Full chart in [PRD §15](docs/PRD.md#15-키보드-단축키-차트--v30-신설).

## Roadmap (PRD §10)

| Phase | Duration | Scope |
| --- | --- | --- |
| **Phase 0 — Prototype** | 4w | Tabbed workspace + pdf.js + F-04 Explanation + F-02 Translation (Qwen3.6 default) |
| **Phase 1 — MVP** | 8w | Google OAuth + Supabase + Library 4-pane (Zotero) + Ingestion auto-prefab (Summary / Auto-Highlight / F-14 / F-15) + Chat + Provider abstraction + arXiv import |
| **Phase 2 — GA** | 12w | F-13 Podcast + Scholar Deep Search + Notion/Obsidian Export + Observability stack. Billing deferred to v2. |
| **Phase 3 — Expansion** | 12w+ | Team / Mind Map / Compare / Browser extension / **PWA** (native gated by DAU 1k + PWA usage ≥ 35%) |

## Authentication

Google OAuth 2.0 / OIDC only in v1. Sessions via httpOnly cookies with 15-min access JWT + 30-day rotating refresh token.

## Data lifecycle

- Account delete request → immediate logout + 30-day soft-delete grace → hard delete (PDFs, notes, highlights, podcasts, cache).
- GDPR Article 20 export → ZIP (PDFs + `notes.md` + `library.bib` + `highlights.json`).

## License

[MIT](LICENSE)
