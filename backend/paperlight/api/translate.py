"""Translation SSE — F-02. Phase 0: simple prompt → OpenRouter relay."""
# ruff: noqa: N815

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, model_validator

from paperlight.agents.context import SUMMARY_PROMPT_VERSION
from paperlight.api._sse import format_sse
from paperlight.observability.context import paper_id_var
from paperlight.observability.sentry import capture_exception
from paperlight.providers.cache import read_cached, stream_with_cache

router = APIRouter(prefix="/api/translate", tags=["translate"])

TRANSLATE_PROMPT_VERSION = "translate-v2"  # v2: 논문 요약을 용어 일관성 참고로 주입
ALIGNED_PROMPT_VERSION = "translate-aligned-v2"

_TERMS_CAP = 800
_TERMS_GUARD = (
    "아래 [용어 참고]는 논문의 용어·주제 일관성 참고용입니다. "
    "번역에 새로운 내용을 추가하지 말고 원문만 충실히 옮기세요."
)

SYSTEM_PROMPT = (
    "당신은 학술 논문 번역가입니다. "
    "주어진 텍스트를 자연스러운 한국어로 번역합니다. "
    "수식·고유 명사·약어는 원문 그대로 유지하고, "
    "문장 구조는 한국어 어순에 맞게 재배열합니다. "
    "마크다운 포맷은 그대로 보존합니다."
)

ALIGNED_SYSTEM_PROMPT = (
    "당신은 학술 논문 번역가입니다. "
    "입력은 번호가 매겨진 영어 문장 목록입니다. "
    "각 문장을 자연스러운 한국어로 번역하되, 한 줄에 하나씩 "
    "`<번호>\\t<번역>` 형식으로만 출력하세요. "
    "번호와 문장 개수를 그대로 유지하고, 수식·고유 명사·약어는 원문을 보존합니다. "
    "추가 설명이나 머리말은 절대 쓰지 마세요."
)


async def _terminology(paper_id: str | None) -> str:
    """논문 요약을 용어 일관성 참고용 텍스트로 (없으면 빈 문자열)."""
    if not paper_id:
        return ""
    summary = await read_cached(
        "summary",
        paper_id=paper_id,
        chunk_id=f"summary:{paper_id}",
        prompt_version=SUMMARY_PROMPT_VERSION,
    )
    return (summary or "")[:_TERMS_CAP]


_LINE_RE = re.compile(r"^\s*(\d+)[.):\t ]+(.*)$")


class TranslateRequest(BaseModel):
    text: str | None = None
    sentences: list[str] | None = None
    aligned: bool = False
    targetLang: str = "ko"
    paperId: str | None = None
    page: int | None = None

    @model_validator(mode="after")
    def _require_content(self) -> TranslateRequest:
        if self.aligned and self.sentences:
            return self
        if self.text and self.text.strip():
            return self
        raise ValueError("text 또는 sentences가 필요합니다")


async def _stream(text: str, target_lang: str, paper_id: str | None) -> AsyncIterator[str]:
    if paper_id:
        paper_id_var.set(paper_id)
    system = SYSTEM_PROMPT
    terms = await _terminology(paper_id)
    if terms:
        system = f"{SYSTEM_PROMPT}\n\n{_TERMS_GUARD}\n[용어 참고]\n{terms}"
    messages = [
        {"role": "system", "content": system},
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
            yield format_sse({"token": token})
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        capture_exception(err)
        yield format_sse({"error": str(err)})
    yield "data: [DONE]\n\n"


def _parse_pair(line: str, count: int, emitted: set[int]) -> dict[str, Any] | None:
    m = _LINE_RE.match(line)
    if not m:
        return None
    idx = int(m.group(1)) - 1
    if idx < 0 or idx >= count or idx in emitted:
        return None
    emitted.add(idx)
    return {"pair": {"i": idx, "tgt": m.group(2).strip()}}


async def _stream_aligned(
    sentences: list[str], target_lang: str, paper_id: str | None
) -> AsyncIterator[str]:
    """문장별 번역을 `{"pair": {"i", "tgt"}}` SSE로 증분 전송(원문은 프론트가 인덱스로 보유)."""
    if paper_id:
        paper_id_var.set(paper_id)
    numbered = "\n".join(f"{i + 1}\t{s}" for i, s in enumerate(sentences))
    # 용어 참고는 system 에만 — 번호 매긴 user 입력은 손대지 않아 1:1 문장 대응이 유지된다.
    system = ALIGNED_SYSTEM_PROMPT
    terms = await _terminology(paper_id)
    if terms:
        system = (
            f"{ALIGNED_SYSTEM_PROMPT}\n\n{_TERMS_GUARD} [용어 참고]는 번역하지 마세요. "
            "출력은 입력 문장과 번호 기준 1:1 대응이며 문장 개수·번호를 그대로 유지합니다.\n"
            f"[용어 참고]\n{terms}"
        )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"다음 문장들을 {target_lang}로 번역하세요:\n\n{numbered}"},
    ]
    emitted: set[int] = set()
    buffer = ""
    try:
        async for token in stream_with_cache(
            "translation",
            messages,
            text=numbered,
            paper_id=paper_id,
            prompt_version=ALIGNED_PROMPT_VERSION,
        ):
            buffer += token
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                ev = _parse_pair(line, len(sentences), emitted)
                if ev:
                    yield format_sse(ev)
        ev = _parse_pair(buffer, len(sentences), emitted)
        if ev:
            yield format_sse(ev)
    except Exception as err:  # noqa: BLE001 — relay any upstream failure to UI
        capture_exception(err)
        yield format_sse({"error": str(err)})
    yield "data: [DONE]\n\n"


@router.post("")
async def translate(req: TranslateRequest) -> StreamingResponse:
    headers = {"cache-control": "no-cache", "x-accel-buffering": "no"}
    if req.aligned and req.sentences:
        return StreamingResponse(
            _stream_aligned(req.sentences, req.targetLang, req.paperId),
            media_type="text/event-stream",
            headers=headers,
        )
    return StreamingResponse(
        _stream(req.text or "", req.targetLang, req.paperId),
        media_type="text/event-stream",
        headers=headers,
    )
