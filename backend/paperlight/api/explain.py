"""Explanation SSE — F-04. Phase 0: simple prompt → OpenRouter relay."""
# ruff: noqa: N815

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from paperlight.providers.openrouter_provider import OpenRouterProvider

router = APIRouter(prefix="/api/explain", tags=["explain"])

DEFAULT_MODEL = os.environ.get("PAPERLIGHT_EXPLAIN_MODEL", "qwen/qwen3.6-35b-a3b")

SYSTEM_PROMPT = (
    "당신은 학술 논문 설명 도우미입니다. "
    "사용자가 선택한 단락을 한국어로 명확하고 간결하게 설명합니다. "
    "전문 용어는 그대로 두되 필요 시 한국어 부연 설명을 추가합니다. "
    "마크다운 형식을 사용해 핵심 아이디어 → 직관적 비유 → 관련 개념 순으로 구성하세요."
)


class ExplainRequest(BaseModel):
    text: str = Field(..., min_length=1)
    paperId: str | None = None
    page: int | None = None


def _format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _stream(text: str) -> AsyncIterator[str]:
    try:
        provider = OpenRouterProvider()
    except RuntimeError as err:
        yield _format_sse({"error": str(err)})
        yield "data: [DONE]\n\n"
        return
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"다음 단락을 설명해주세요:\n\n```\n{text}\n```"},
    ]
    try:
        async for token in provider.stream_chat(messages, DEFAULT_MODEL):
            yield _format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        yield _format_sse({"error": str(err)})
    yield "data: [DONE]\n\n"


@router.post("")
async def explain(req: ExplainRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(req.text),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )
