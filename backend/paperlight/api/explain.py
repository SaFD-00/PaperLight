"""Explanation SSE — F-04. Phase 0: simple prompt → OpenRouter relay."""
# ruff: noqa: N815

from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator
from typing import Any, Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from paperlight.observability.context import paper_id_var
from paperlight.observability.sentry import capture_exception
from paperlight.providers.cache import stream_with_cache

router = APIRouter(prefix="/api/explain", tags=["explain"])

EXPLAIN_PROMPT_VERSION = "explain-v1"
FIGURE_PROMPT_VERSION = "figure-v2"
TABLE_PROMPT_VERSION = "table-v2"

SYSTEM_PROMPT = (
    "당신은 학술 논문 설명 도우미입니다. "
    "사용자가 선택한 단락을 한국어로 명확하고 간결하게 설명합니다. "
    "전문 용어는 그대로 두되 필요 시 한국어 부연 설명을 추가합니다. "
    "마크다운 형식을 사용해 핵심 아이디어 → 직관적 비유 → 관련 개념 순으로 구성하세요."
)

FIGURE_SYSTEM_PROMPT = (
    "당신은 학술 논문의 그림(Figure)을 설명하는 도우미입니다. "
    "제공된 그림 이미지와 캡션·주변 본문을 함께 활용해 한국어 마크다운으로 설명하세요: "
    "무엇을 보여주는지 → 핵심 관찰/결과 → 본문에서의 의미. "
    "이미지에서 확인되지 않는 내용은 단정하지 마세요."
)
TABLE_SYSTEM_PROMPT = (
    "당신은 학술 논문의 표(Table)를 설명하는 도우미입니다. "
    "제공된 표 이미지와 캡션·주변 본문을 함께 활용해 한국어 마크다운으로 설명하세요: "
    "표가 비교하는 항목 → 핵심 수치/경향 → 본문에서의 의미. "
    "이미지에서 확인되지 않는 내용은 단정하지 마세요."
)


class ExplainRequest(BaseModel):
    text: str = Field(..., min_length=1)
    paperId: str | None = None
    page: int | None = None


class FigureExplainRequest(BaseModel):
    kind: Literal["figure", "table"]
    image: str = Field(..., min_length=1, description="data URL 또는 base64 PNG")
    label: str = ""
    captionText: str = ""
    context: str = ""
    paperId: str | None = None
    page: int | None = None


def _format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _stream(text: str, paper_id: str | None) -> AsyncIterator[str]:
    if paper_id:
        paper_id_var.set(paper_id)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"다음 단락을 설명해주세요:\n\n```\n{text}\n```"},
    ]
    try:
        async for token in stream_with_cache(
            "explanation",
            messages,
            text=text,
            paper_id=paper_id,
            prompt_version=EXPLAIN_PROMPT_VERSION,
        ):
            yield _format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        capture_exception(err)
        yield _format_sse({"error": str(err)})
    yield "data: [DONE]\n\n"


@router.post("")
async def explain(req: ExplainRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(req.text, req.paperId),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )


def _parse_data_url(value: str) -> tuple[str, str]:
    """('data:image/png;base64,XXXX' | 'XXXX') → (mime, base64)."""
    if value.startswith("data:") and ";base64," in value:
        head, b64 = value.split(";base64,", 1)
        mime = head[len("data:") :] or "image/png"
        return mime, b64
    return "image/png", value


async def _stream_figure(req: FigureExplainRequest) -> AsyncIterator[str]:
    if req.paperId:
        paper_id_var.set(req.paperId)
    mime, b64 = _parse_data_url(req.image)
    is_table = req.kind == "table"
    system = TABLE_SYSTEM_PROMPT if is_table else FIGURE_SYSTEM_PROMPT
    task = "table_description" if is_table else "figure_description"
    version = TABLE_PROMPT_VERSION if is_table else FIGURE_PROMPT_VERSION

    prompt = f"{req.label or req.kind} 캡션:\n{req.captionText or '(없음)'}"
    if req.context:
        prompt += f"\n\n주변 본문:\n{req.context}"
    prompt += f"\n\n위 {('표' if is_table else '그림')}를 설명해주세요."

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image", "mime": mime, "data": b64},
            ],
        },
    ]
    # 이미지 해시를 캐시 키에 포함해 같은 figure 재요청을 재사용한다.
    image_hash = hashlib.sha256(b64.encode("utf-8")).hexdigest()[:16]
    cache_text = f"{req.kind}|{req.label}|{image_hash}"
    try:
        async for token in stream_with_cache(
            task,
            messages,
            text=cache_text,
            paper_id=req.paperId,
            prompt_version=version,
        ):
            yield _format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        capture_exception(err)
        yield _format_sse({"error": str(err)})
    yield "data: [DONE]\n\n"


@router.post("/figure")
async def explain_figure(req: FigureExplainRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_figure(req),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )
