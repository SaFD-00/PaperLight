"""Podcast API — F-13 (PRD §7.7). 논문 → 2인 대담 한국어 팟캐스트.

수동 생성(비용 컨트롤): POST로 생성 잡을 큐잉하고 status를 SSE로 폴링, 완료 시 오디오를
HMAC 가드 라우트로 스트림. TTS는 stub-first(키 없으면 placeholder mp3). 생성 generator/
백그라운드 잡은 요청 스코프 밖에서 동작하므로 DB 쓰기는 session_scope()로 격리(chat.py 패턴).
"""
# ruff: noqa: N815

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.agents.context import SUMMARY_PROMPT_VERSION
from paperlight.agents.podcast_graph import HOST, build_script, parse_script
from paperlight.api._ownership import get_owned_paper
from paperlight.api._sse import format_sse
from paperlight.audio.stitcher import estimate_duration_sec, stitch
from paperlight.auth.dependencies import get_user_id
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.models.podcast import Podcast
from paperlight.observability.sentry import capture_exception
from paperlight.providers.cache import read_cached
from paperlight.providers.router import load_agents_config
from paperlight.providers.tts_openai import synthesize
from paperlight.storage.db import get_session, get_session_factory, session_scope
from paperlight.storage.object_store import (
    audio_key,
    audio_url,
    get_object_store,
    verify_audio_token,
)
from paperlight.utils.time import now_ms

router = APIRouter(prefix="/api/podcast", tags=["podcast"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]

_MAX_CHUNKS = 6


class CreateBody(BaseModel):
    paperId: str
    options: dict[str, Any] | None = None


def _voices() -> tuple[str, str]:
    tts = load_agents_config().get("tts") or {}
    providers = tts.get("providers") or {}
    prov = providers.get(tts.get("default_provider", "openai")) or {}
    return str(prov.get("voice_a", "alloy")), str(prov.get("voice_b", "echo"))


def _podcast_dict(p: Podcast) -> dict[str, Any]:
    return {
        "id": p.id,
        "paperId": p.paper_id,
        "status": p.status,
        "durationSec": p.duration_sec,
        "scriptMd": p.script_md,
        "audioUrl": audio_url(p.id) if p.status == "ready" else None,
        "createdAt": p.created_at,
    }


async def _generate(podcast_id: str) -> None:
    """백그라운드 생성: script → TTS(세그먼트별) → stitch → 오디오 저장 → ready."""
    try:
        async with session_scope() as s:
            pod = await s.get(Podcast, podcast_id)
            if pod is None:
                return
            pod.status = "processing"
            pod.updated_at = now_ms()
            paper_id = pod.paper_id

        async with session_scope() as s:
            paper = await s.get(Paper, paper_id)
            title = paper.title if paper else ""
            rows = (
                (
                    await s.execute(
                        select(Chunk)
                        .where(Chunk.paper_id == paper_id)
                        .order_by(Chunk.idx)
                        .limit(_MAX_CHUNKS)
                    )
                )
                .scalars()
                .all()
            )
            chunk_texts = [c.text for c in rows]

        summary = (
            await read_cached(
                "summary",
                paper_id=paper_id,
                chunk_id=f"summary:{paper_id}",
                prompt_version=SUMMARY_PROMPT_VERSION,
            )
            or ""
        )
        script = await build_script(title, summary, chunk_texts)
        segments = parse_script(script)
        voice_a, voice_b = _voices()
        parts = [
            await synthesize(seg.text, voice_a if seg.speaker == HOST else voice_b)
            for seg in segments
        ]
        audio = stitch(parts)
        await asyncio.to_thread(get_object_store().put_audio, audio_key(podcast_id), audio)

        async with session_scope() as s:
            pod = await s.get(Podcast, podcast_id)
            if pod is None:
                return
            pod.script_md = script
            pod.audio_r2_key = audio_key(podcast_id)
            pod.duration_sec = estimate_duration_sec(script)
            pod.status = "ready"
            pod.updated_at = now_ms()
    except Exception as err:  # noqa: BLE001 — 잡 실패는 status=failed로 표면화
        capture_exception(err)
        async with session_scope() as s:
            pod = await s.get(Podcast, podcast_id)
            if pod is not None:
                pod.status = "failed"
                pod.updated_at = now_ms()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_podcast(
    body: CreateBody, session: SessionDep, user_id: UserDep, background: BackgroundTasks
) -> dict[str, Any]:
    await get_owned_paper(session, body.paperId, user_id)
    pod = Podcast(
        id=str(uuid4()),
        paper_id=body.paperId,
        user_id=user_id,
        options=body.options or {},
        status="pending",
    )
    session.add(pod)
    await session.commit()
    background.add_task(_generate, pod.id)
    return {"id": pod.id, "status": pod.status}


async def _get_owned_podcast(session: AsyncSession, podcast_id: str, user_id: str) -> Podcast:
    pod = await session.get(Podcast, podcast_id)
    if pod is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "podcast not found")
    if pod.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "podcast belongs to another user")
    return pod


@router.get("/paper/{paper_id}")
async def latest_for_paper(
    paper_id: str, session: SessionDep, user_id: UserDep
) -> dict[str, Any] | None:
    await get_owned_paper(session, paper_id, user_id)
    pod = (
        (
            await session.execute(
                select(Podcast)
                .where(Podcast.paper_id == paper_id, Podcast.user_id == user_id)
                .order_by(Podcast.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    return _podcast_dict(pod) if pod is not None else None


@router.get("/{podcast_id}")
async def get_podcast(podcast_id: str, session: SessionDep, user_id: UserDep) -> dict[str, Any]:
    return _podcast_dict(await _get_owned_podcast(session, podcast_id, user_id))


@router.get("/{podcast_id}/status")
async def podcast_status(
    podcast_id: str, session: SessionDep, user_id: UserDep
) -> StreamingResponse:
    await _get_owned_podcast(session, podcast_id, user_id)

    async def _gen() -> AsyncIterator[str]:
        factory = get_session_factory()
        for _ in range(600):  # ~max 5min @ 0.5s
            async with factory() as poll:
                pod = await poll.get(Podcast, podcast_id)
                if pod is None:
                    yield format_sse({"error": "podcast not found"})
                    yield "data: [DONE]\n\n"
                    return
                yield format_sse({"status": pod.status})
                if pod.status in ("ready", "failed"):
                    yield "data: [DONE]\n\n"
                    return
            await asyncio.sleep(0.5)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )


@router.get("/{podcast_id}/audio")
async def podcast_audio(
    podcast_id: str,
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query()],
) -> Response:
    if not verify_audio_token(podcast_id, exp, sig):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "invalid or expired token")
    try:
        data = await asyncio.to_thread(get_object_store().get_audio, audio_key(podcast_id))
    except FileNotFoundError as err:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "audio not found") from err
    return Response(content=data, media_type="audio/mpeg")
