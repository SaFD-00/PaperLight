"""AI Chat — S12 (F-03). RAG 질의응답 SSE + 대화 영속화 + 멀티턴 히스토리.

`POST /api/chat` 는 질문을 임베딩→Qdrant 검색→grounded 프롬프트로 스트리밍하고, 인용(citations)과
후속 질문(followups) 이벤트를 흘린 뒤 대화를 `ChatSession`/`ChatMessage`에 영구 저장한다. 스트리밍
generator 는 요청 스코프 세션이 닫힌 뒤에도 동작하므로 DB 쓰기는 `session_scope()`로 격리한다.
`GET /api/chat/{paper_id}` 는 저장된 히스토리를 돌려준다.
"""
# ruff: noqa: N815

from __future__ import annotations

import json
import time
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
from paperlight.api.papers import _get_owned
from paperlight.auth.dependencies import get_user_id
from paperlight.models.chat import ChatMessage, ChatSession
from paperlight.providers.cache import stream_with_cache
from paperlight.storage.db import get_session, session_scope

router = APIRouter(prefix="/api/chat", tags=["chat"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]


class ChatRequest(BaseModel):
    paperId: str
    question: str = Field(..., min_length=1)


def _format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def _now_ms() -> int:
    return int(time.time() * 1000)


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

    # Phase 2 — retrieve + stream the grounded answer.
    chunks = await retrieve(paper_id, question)
    messages = build_messages(question, chunks, history)
    sig = context_signature(question, chunks, history)
    parts: list[str] = []
    try:
        async for token in stream_with_cache(
            "chat",
            messages,
            text=sig,
            paper_id=paper_id,
            prompt_version=CHAT_PROMPT_VERSION,
        ):
            parts.append(token)
            yield _format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay upstream failure to UI
        yield _format_sse({"error": str(err)})
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
            cs_row.updated_at = _now_ms()

    yield _format_sse({"citations": citations})
    followups = await generate_followups(question, full)
    yield _format_sse({"followups": followups})
    yield "data: [DONE]\n\n"


@router.post("")
async def chat(req: ChatRequest, session: SessionDep, user_id: UserDep) -> StreamingResponse:
    await _get_owned(session, req.paperId, user_id)
    return StreamingResponse(
        _stream(req.paperId, user_id, req.question),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )


@router.get("/{paper_id}")
async def chat_history(paper_id: str, session: SessionDep, user_id: UserDep) -> dict[str, Any]:
    await _get_owned(session, paper_id, user_id)
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
