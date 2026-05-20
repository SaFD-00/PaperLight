"""Translation SSE — F-02. Phase 0: simple prompt → OpenRouter relay."""
# ruff: noqa: N815

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from paperlight.observability.context import paper_id_var
from paperlight.observability.sentry import capture_exception
from paperlight.providers.cache import stream_with_cache

router = APIRouter(prefix="/api/translate", tags=["translate"])

TRANSLATE_PROMPT_VERSION = "translate-v1"

SYSTEM_PROMPT = (
    "당신은 학술 논문 번역가입니다. "
    "주어진 텍스트를 자연스러운 한국어로 번역합니다. "
    "수식·고유 명사·약어는 원문 그대로 유지하고, "
    "문장 구조는 한국어 어순에 맞게 재배열합니다. "
    "마크다운 포맷은 그대로 보존합니다."
)


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1)
    targetLang: str = "ko"
    paperId: str | None = None
    page: int | None = None


def _format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _stream(text: str, target_lang: str, paper_id: str | None) -> AsyncIterator[str]:
    if paper_id:
        paper_id_var.set(paper_id)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"다음 텍스트를 {target_lang}로 번역해주세요:\n\n```\n{text}\n```",
        },
    ]
    try:
        async for token in stream_with_cache(
            "translation",
            messages,
            text=text,
            paper_id=paper_id,
            prompt_version=TRANSLATE_PROMPT_VERSION,
        ):
            yield _format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        capture_exception(err)
        yield _format_sse({"error": str(err)})
    yield "data: [DONE]\n\n"


@router.post("")
async def translate(req: TranslateRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(req.text, req.targetLang, req.paperId),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )
