"""Whole-paper context injection (F-03/F-04/F-14/F-15).

per-element 태스크(설명·도표·단락·챗·번역)가 "이 부분이 논문 전체에서 어떤 의미인지"
알도록, (a) pregen `summary` 캐시 + (c) RAG 관련 청크를 하나의 "논문 맥락" 블록으로
조립한다. 모두 best-effort — 캐시 미스/검색 실패 시 빈 문자열을 돌려 호출부는 기존대로
동작한다. 맥락은 `(paper_id, query_text)`의 결정적 함수라 캐시 키 정합성을 깨지 않으며,
프롬프트 변경은 각 호출부의 prompt_version bump 로 무효화한다.
"""

from __future__ import annotations

import logging

from paperlight.agents.chat import retrieve
from paperlight.providers.cache import read_cached

logger = logging.getLogger(__name__)

SUMMARY_PROMPT_VERSION = "summary-v1"  # pregen.SUMMARY_PROMPT_VERSION 과 동기화

_SUMMARY_CAP = 1200
_RELATED_CHARS = 600
_RELATED_TOP_K = 3

GROUND_GUARD = (
    "아래 [논문 맥락]을 활용해 대상이 논문 전체에서 갖는 의미를 함께 설명하되, "
    "근거는 반드시 대상 본문에서 찾고 맥락에만 있는 내용을 단정하거나 지어내지 마세요."
)


async def _read_summary(paper_id: str) -> str | None:
    try:
        return await read_cached(
            "summary",
            paper_id=paper_id,
            chunk_id=f"summary:{paper_id}",
            prompt_version=SUMMARY_PROMPT_VERSION,
        )
    except Exception:
        logger.exception("context summary read failed for %s", paper_id)
        return None


async def build_paper_context(
    paper_id: str | None,
    query_text: str,
    *,
    summary: bool = True,
    related: bool = True,
    top_k: int = _RELATED_TOP_K,
    exclude_chunk_id: str | None = None,
    precomputed_summary: str | None = None,
) -> str:
    """Assemble a paper-level context block: (a) summary + (c) related chunks.

    Returns "" when paper_id is missing or nothing is available, so callers can
    fall back to their original prompt unchanged.
    """
    if not paper_id:
        return ""

    blocks: list[str] = []

    if summary:
        text = precomputed_summary
        if text is None:
            text = await _read_summary(paper_id)
        if text:
            blocks.append(f"[논문 요약]\n{text[:_SUMMARY_CAP]}")

    if related and query_text.strip():
        try:
            chunks = await retrieve(paper_id, query_text, top_k=top_k + 1)
        except Exception:
            logger.exception("context retrieve failed for %s", paper_id)
            chunks = []
        picked = [c for c in chunks if c.chunk_id != exclude_chunk_id][:top_k]
        if picked:
            joined = "\n\n".join(
                f"[페이지 {c.page}] {c.text[:_RELATED_CHARS]}" for c in picked
            )
            blocks.append(f"[관련 본문 발췌]\n{joined}")

    return "\n\n".join(blocks)


def apply_context(system: str, user_content: str, ctx: str) -> list[dict[str, str]]:
    """Text-only task helper: fold a context block into system+user messages.

    멀티모달(parts 배열) 태스크는 호출부에서 text part 에 직접 주입한다.
    """
    if not ctx:
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]
    return [
        {"role": "system", "content": f"{system}\n\n{GROUND_GUARD}"},
        {"role": "user", "content": f"[논문 맥락]\n{ctx}\n\n{user_content}"},
    ]
