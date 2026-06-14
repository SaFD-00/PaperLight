"""AI Chat — S12 (F-03). RAG 질의응답 SSE + 대화 영속화 + 멀티턴 히스토리.

`POST /api/chat` 는 질문을 임베딩→SQLite 코사인 검색→grounded 프롬프트로 스트리밍하고,
인용(citations)·후속 질문(followups)을 흘린 뒤 `ChatSession`/`ChatMessage`에 영구 저장한다. 스트리밍
generator 는 요청 스코프 세션이 닫힌 뒤에도 동작하므로 DB 쓰기는 `session_scope()`로 격리한다.
`GET /api/chat/{paper_id}` 는 저장된 히스토리를 돌려준다.
"""
# ruff: noqa: N815

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.agents.chat import (
    CHAT_PROMPT_VERSION,
    build_messages,
    context_signature,
    generate_followups,
    retrieve,
)
from paperlight.agents.context import SUMMARY_PROMPT_VERSION
from paperlight.api._ownership import get_owned_paper
from paperlight.api._sse import format_sse
from paperlight.local_user import get_user_id
from paperlight.models.chat import ChatMessage, ChatSession
from paperlight.providers.base import reasoning_sink
from paperlight.providers.cache import read_cached, stream_with_cache
from paperlight.storage.db import get_session, session_scope
from paperlight.utils.time import now_ms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]


class ChatRequest(BaseModel):
    paperId: str
    question: str = Field(..., min_length=1)


async def _get_or_create_session(session: AsyncSession, paper_id: str, user_id: str) -> ChatSession:
    existing = (
        (
            await session.execute(
                select(ChatSession)
                .where(ChatSession.paper_id == paper_id, ChatSession.user_id == user_id)
                .order_by(ChatSession.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if existing is not None:
        return existing
    cs = ChatSession(id=str(uuid4()), paper_id=paper_id, user_id=user_id)
    session.add(cs)
    await session.flush()
    return cs


async def _stream(paper_id: str, user_id: str, question: str) -> AsyncIterator[str]:
    # Phase 1 — load prior history (before adding the current turn), persist user message.
    async with session_scope() as session:
        cs = await _get_or_create_session(session, paper_id, user_id)
        session_id = cs.id
        prior = (
            (
                await session.execute(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == session_id)
                    .order_by(ChatMessage.created_at)
                )
            )
            .scalars()
            .all()
        )
        history = [{"role": m.role, "content": m.content} for m in prior]
        session.add(
            ChatMessage(id=str(uuid4()), session_id=session_id, role="user", content=question)
        )

    # Phase 2 — retrieve + stream the grounded answer. Reasoning ("thinking") deltas
    # arrive on a side channel (reasoning_sink) while content tokens come through the
    # generator; a queue merges both so reasoning streams live instead of going silent.
    chunks = await retrieve(paper_id, question)
    summary = await read_cached(
        "summary",
        paper_id=paper_id,
        chunk_id=f"summary:{paper_id}",
        prompt_version=SUMMARY_PROMPT_VERSION,
    )
    messages = build_messages(question, chunks, history, paper_summary=summary or "")
    sig = context_signature(question, chunks, history)
    parts: list[str] = []

    queue: asyncio.Queue[tuple[str, str] | None] = asyncio.Queue()
    reasoning_sink.set(lambda r: queue.put_nowait(("reasoning", r)))

    async def _produce() -> None:
        try:
            async for token in stream_with_cache(
                "chat",
                messages,
                text=sig,
                paper_id=paper_id,
                prompt_version=CHAT_PROMPT_VERSION,
            ):
                await queue.put(("token", token))
        except Exception as err:  # noqa: BLE001 — relay upstream failure to UI
            logger.exception("chat stream failed")
            await queue.put(("error", str(err)))
        finally:
            await queue.put(None)

    producer = asyncio.create_task(_produce())
    errored = False
    try:
        while True:
            item = await queue.get()
            if item is None:
                break
            kind, value = item
            if kind == "token":
                parts.append(value)
                yield format_sse({"token": value})
            elif kind == "reasoning":
                yield format_sse({"reasoning": value})
            else:  # error
                errored = True
                yield format_sse({"error": value})
    finally:
        producer.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await producer

    if errored:
        yield "data: [DONE]\n\n"
        return

    full = "".join(parts)
    citations = [{"chunkId": c.chunk_id, "page": c.page} for c in chunks]

    # Phase 3 — persist assistant message + emit citations/followups.
    async with session_scope() as session:
        session.add(
            ChatMessage(
                id=str(uuid4()),
                session_id=session_id,
                role="assistant",
                content=full,
                citations=citations,
            )
        )
        cs_row = await session.get(ChatSession, session_id)
        if cs_row is not None:
            cs_row.updated_at = now_ms()

    yield format_sse({"citations": citations})
    followups = await generate_followups(question, full)
    yield format_sse({"followups": followups})
    yield "data: [DONE]\n\n"


@router.post("")
async def chat(req: ChatRequest, session: SessionDep, user_id: UserDep) -> StreamingResponse:
    await get_owned_paper(session, req.paperId, user_id)
    return StreamingResponse(
        _stream(req.paperId, user_id, req.question),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )


@router.get("/{paper_id}")
async def chat_history(paper_id: str, session: SessionDep, user_id: UserDep) -> dict[str, Any]:
    await get_owned_paper(session, paper_id, user_id)
    cs = (
        (
            await session.execute(
                select(ChatSession)
                .where(ChatSession.paper_id == paper_id, ChatSession.user_id == user_id)
                .order_by(ChatSession.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if cs is None:
        return {"sessionId": None, "messages": []}
    msgs = (
        (
            await session.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == cs.id)
                .order_by(ChatMessage.created_at)
            )
        )
        .scalars()
        .all()
    )
    return {
        "sessionId": cs.id,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "citations": m.citations,
                "createdAt": m.created_at,
            }
            for m in msgs
        ],
    }
