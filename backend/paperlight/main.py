"""FastAPI application entry point. See PRD §7.1 / §7.7."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from paperlight.api import auth, chat, explain, library, papers, podcast, tabs, translate
from paperlight.storage.db import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await init_db()
    yield


def _cors_origins() -> list[str]:
    raw = os.environ.get("PAPERLIGHT_CORS_ORIGINS", "http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="PaperLight API", version="0.0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers.router)
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
