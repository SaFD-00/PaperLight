"""FastAPI application entry point. See PRD §7.1 / §7.7."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from paperlight.api import (
    annotations,
    auth,
    chat,
    explain,
    library,
    papers,
    podcast,
    tabs,
    translate,
)
from paperlight.observability.langfuse_client import shutdown_langfuse
from paperlight.observability.middleware import RequestContextMiddleware
from paperlight.observability.sentry import init_sentry
from paperlight.storage.db import init_db

# uvicorn/uv 는 .env 를 자동 로드하지 않으므로 서버 기동 시 직접 로드한다. lifespan 안에서
# 호출해 실서버(uvicorn)에서만 동작하게 하고, lifespan 을 띄우지 않는 ASGI 테스트는 .env 의
# 인프라 설정(S3/Qdrant/DB)에 오염되지 않게 한다. override=False 라 호스트(Render/CI)가 주입한
# 실제 env 가 항상 우선하고, .env 가 없으면 no-op 이다.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def _seed_samples_enabled() -> bool:
    # Demo pilot papers (sample-1/sample-2) are seeded only in dev or when opted
    # in, so a production DB is never polluted by the bundled fixtures.
    if os.environ.get("APP_ENV", "development") == "development":
        return True
    return os.environ.get("PAPERLIGHT_SEED_SAMPLES") == "1"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    load_dotenv(_ENV_FILE)
    init_sentry()
    await init_db()
    if _seed_samples_enabled():
        # Background so the heavy first-time ingest/pre-gen never blocks startup.
        from paperlight.ingestion.seed import seed_samples

        asyncio.create_task(seed_samples())
    yield
    shutdown_langfuse()


def _cors_origins() -> list[str]:
    # 로컬 dev 는 localhost·127.0.0.1 둘 다 흔하다(Next.js dev 가 양쪽 주소를 띄움).
    # 둘 중 하나만 허용하면 다른 쪽 origin 의 preflight 가 400 으로 막혀 POST 가 차단된다.
    raw = os.environ.get(
        "PAPERLIGHT_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="PaperLight API", version="0.0.1", lifespan=lifespan)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers.router)
app.include_router(annotations.router)
app.include_router(chat.router)
app.include_router(podcast.router)
app.include_router(library.router)
app.include_router(auth.router)
app.include_router(tabs.router)
app.include_router(explain.router)
app.include_router(translate.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
