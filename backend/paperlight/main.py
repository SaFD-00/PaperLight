"""FastAPI application entry point. See PRD §7.1 / §7.7."""
from fastapi import FastAPI

from paperlight.api import auth, chat, library, papers, podcast

app = FastAPI(title="PaperLight API", version="0.0.1")

app.include_router(papers.router)
app.include_router(chat.router)
app.include_router(podcast.router)
app.include_router(library.router)
app.include_router(auth.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
