# PaperLight Backend

FastAPI 백엔드(단일 사용자 로컬). 상세는 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Setup

```bash
uv sync
uv run uvicorn paperlight.main:app --reload --port 8000
```

Health check: <http://localhost:8000/health>

별도 인프라(docker) 불필요 — SQLite + 로컬 파일시스템(`PAPERLIGHT_DATA_DIR`)을 쓴다.
로컬(`APP_ENV=development`) 실행 시 파일럿 샘플 논문(`sample-1`/`sample-2`)이 startup 백그라운드로
자동 시드되어 Reader AI 패널(Summary/Insights/Chat)이 바로 동작한다(게이팅: `PAPERLIGHT_SEED_SAMPLES`).
더 좋은 임베딩이 필요하면 `uv sync --extra ingest` 후 `INGEST_EMBEDDER=fastembed`.
요약/챗/번역/설명 같은 생성 기능은 LLM 키(`OPENROUTER_API_KEY` 등)가 있어야 한다(없으면 stub).

## Layout

- `paperlight/api/` — FastAPI 라우터 (papers / tabs / chat / explain / translate / annotations)
- `paperlight/agents/` — chat(retrieve+RAG) · context · pregen · references
- `paperlight/ingestion/` — PDF 파싱 + 청킹 + 임베딩 파이프라인
- `paperlight/providers/` — LLM 추상화(openrouter/openai/gemini/stub) + router + cache
- `paperlight/storage/` — `db.py`(SQLite), `object_store.py`(로컬 FS)
- `paperlight/models/` — SQLAlchemy 엔티티 (User/Paper/Chunk/Chat*/Highlight/Note/Tab/Cache)

## 테스트

```bash
uv run pytest
uv run ruff check paperlight
```
