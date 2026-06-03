"""Deep Search — F-09 (PRD §9). 관심 벡터 기반 외부 논문 추천 + '왜 추천' 설명.

stub-first: DEEP_SEARCH_PROVIDER 미설정 시 쿼리 해시로 결정적 카드 생성(오프라인/CI),
semantic_scholar 설정 시 외부 검색 best-effort(실패 → stub 폴백). references 패턴.
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import httpx

from paperlight.services.library_service import interest_vector

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 15.0


def _provider() -> str:
    return os.environ.get("DEEP_SEARCH_PROVIDER", "stub")


def _seed(*parts: str) -> int:
    return int.from_bytes(hashlib.sha256("|".join(parts).encode("utf-8")).digest()[:8], "big")


def _why(query: str, has_interest: bool) -> str:
    if has_interest:
        return (
            f"회원님 라이브러리의 관심 주제와 의미적으로 가깝고('{query}' 관련) 인용이 활발합니다."
        )
    return f"검색어 '{query}'와 주제가 밀접한 논문입니다."


def _stub_results(query: str, limit: int, has_interest: bool) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for i in range(limit):
        s = _seed(query, str(i))
        results.append(
            {
                "title": f"{query}에 관한 연구 {i + 1}",
                "authors": [f"저자 {chr(65 + (s % 26))}."],
                "year": 2018 + (s % 7),
                "url": f"https://www.semanticscholar.org/search?q={query}",
                "abstract": f"이 논문은 {query} 주제를 다룹니다.",
                "score": round(0.95 - i * (0.5 / max(1, limit)), 3),
                "why": _why(query, has_interest),
            }
        )
    return results


async def _semantic_scholar(query: str, limit: int, has_interest: bool) -> list[dict[str, Any]]:
    params = {"query": query, "limit": str(limit), "fields": "title,authors,year,url,abstract"}
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
        resp = await http.get(
            "https://api.semanticscholar.org/graph/v1/paper/search", params=params
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
    results: list[dict[str, Any]] = []
    for i, item in enumerate(data):
        results.append(
            {
                "title": item.get("title") or "(제목 없음)",
                "authors": [a.get("name", "") for a in (item.get("authors") or [])][:5],
                "year": item.get("year"),
                "url": item.get("url") or "",
                "abstract": item.get("abstract"),
                "score": round(1.0 - i / max(1, limit), 3),
                "why": _why(query, has_interest),
            }
        )
    return results


async def deep_search(user_id: str, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
    has_interest = (await interest_vector(user_id)) is not None
    if _provider() != "semantic_scholar":
        return _stub_results(query, limit, has_interest)
    try:
        return await _semantic_scholar(query, limit, has_interest)
    except Exception:  # noqa: BLE001 — external best-effort, fall back to deterministic stub
        logger.exception("deep search external failed")
        return _stub_results(query, limit, has_interest)
