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

from paperlight.agents.chat import generate_followups
from paperlight.agents.context import GROUND_GUARD, apply_context, build_paper_context
from paperlight.observability.context import paper_id_var
from paperlight.observability.sentry import capture_exception
from paperlight.providers.cache import stream_with_cache

router = APIRouter(prefix="/api/explain", tags=["explain"])

EXPLAIN_PROMPT_VERSION = "explain-v2"  # v2: 전체 논문 맥락(요약+RAG) 주입
FIGURE_PROMPT_VERSION = "figure-v3"  # v3: 전체 논문 맥락 주입
TABLE_PROMPT_VERSION = "table-v3"

_FIGURE_HISTORY_TURNS = 6

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
    question: str = ""  # 후속 질문(빈 값=첫 설명 턴)
    history: list[dict[str, str]] = Field(default_factory=list)  # 이전 텍스트 turns
    paperId: str | None = None
    page: int | None = None


def _format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _stream(text: str, paper_id: str | None) -> AsyncIterator[str]:
    if paper_id:
        paper_id_var.set(paper_id)
    context = await build_paper_context(paper_id, text)
    messages = apply_context(
        SYSTEM_PROMPT, f"다음 단락을 설명해주세요:\n\n```\n{text}\n```", context
    )
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

    if req.question.strip():
        user_text = req.question
        context = ""
    else:
        user_text = f"{req.label or req.kind} 캡션:\n{req.captionText or '(없음)'}"
        if req.context:
            user_text += f"\n\n주변 본문:\n{req.context}"
        user_text += f"\n\n위 {('표' if is_table else '그림')}를 설명해주세요."
        # 첫 설명 턴에만 전체 논문 맥락(요약+RAG) 주입 — 후속 질문은 history가 맥락을 잇는다.
        context = await build_paper_context(
            req.paperId, f"{req.captionText}\n{req.context}"
        )

    if context:
        system = f"{system}\n\n{GROUND_GUARD}"
        user_text = f"[논문 맥락]\n{context}\n\n{user_text}"

    history = req.history[-_FIGURE_HISTORY_TURNS:]
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}, *history]
    # 매 턴 이미지를 재첨부해 비전 모델이 그림 세부를 계속 참조하게 한다.
    messages.append(
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {"type": "image", "mime": mime, "data": b64},
            ],
        }
    )
    # 이미지 해시 + 질문 + 히스토리를 캐시 키에 포함(같은 figure 재요청 재사용 + 멀티턴 정확성).
    image_hash = hashlib.sha256(b64.encode("utf-8")).hexdigest()[:16]
    q_hash = hashlib.sha256(req.question.encode("utf-8")).hexdigest()[:12]
    hist_raw = "|".join(f"{m.get('role')}:{m.get('content')}" for m in history)
    hist_hash = hashlib.sha256(hist_raw.encode("utf-8")).hexdigest()[:12]
    cache_text = f"{req.kind}|{req.label}|{image_hash}|{q_hash}|{hist_hash}"

    answer: list[str] = []
    try:
        async for token in stream_with_cache(
            task,
            messages,
            text=cache_text,
            paper_id=req.paperId,
            prompt_version=version,
        ):
            answer.append(token)
            yield _format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        capture_exception(err)
        yield _format_sse({"error": str(err)})
        yield "data: [DONE]\n\n"
        return

    followups = await generate_followups(req.question or req.label or req.kind, "".join(answer))
    if followups:
        yield _format_sse({"followups": followups})
    yield "data: [DONE]\n\n"


@router.post("/figure")
async def explain_figure(req: FigureExplainRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_figure(req),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )
