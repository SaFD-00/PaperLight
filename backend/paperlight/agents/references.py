"""Reference extraction + external enrichment — S12 (F-05).

논문 chunk 텍스트에서 참고문헌 섹션을 찾아 엔트리로 분할하고, 각 엔트리를 Crossref 등 외부 API로
보강한다. 외부 호출은 best-effort(`REFERENCE_PROVIDER=stub` 기본 오프라인) — 실패 시 원문/식별자만
담은 카드로 graceful 폴백한다. 결과는 `Cache` 테이블에 memo 한다(반복 외부 호출 회피).

본문 [12] 마커의 in-PDF 오버레이 호버는 bbox/marker-pdf 부재로 보류 — References 패널 리스트로 제공.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time

import httpx
from sqlalchemy import select

from paperlight.models.cache import Cache
from paperlight.models.chunk import Chunk
from paperlight.providers.cache import cache_key
from paperlight.storage.db import get_session_factory, session_scope

logger = logging.getLogger(__name__)

REF_VERSION = "ref-v1"
_MEMO_TTL_SECONDS = 30 * 24 * 3600
_MAX_REFS = 40
_MIN_ENTRY_CHARS = 12
_HTTP_TIMEOUT = 5.0
_CONCURRENCY = 5

_HEADING_RE = re.compile(
    r"^\s*(?:\d+\.?\s+)?(references|bibliography|참고문헌)\s*$",
    re.IGNORECASE | re.MULTILINE,
)
_BRACKET_RE = re.compile(r"(?=\[\d+\])")
_NUMDOT_RE = re.compile(r"(?m)(?=^\d+\.\s)")
_ARXIV_RE = re.compile(r"arxiv:\s*(\d{4}\.\d{4,5})", re.IGNORECASE)
_DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:a-z0-9]+", re.IGNORECASE)
_WS_RE = re.compile(r"\s+")


def extract_references(chunks: list[Chunk]) -> list[str]:
    """Locate the references section in concatenated chunk text and split into entries."""
    text = "\n".join(c.text for c in chunks)
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return []
    body = text[matches[-1].end() :]

    if "[" in body and re.search(r"\[\d+\]", body):
        parts = _BRACKET_RE.split(body)
    elif _NUMDOT_RE.search(body):
        parts = _NUMDOT_RE.split(body)
    else:
        parts = body.splitlines()

    entries: list[str] = []
    for part in parts:
        cleaned = _WS_RE.sub(" ", part).strip()
        if len(cleaned) >= _MIN_ENTRY_CHARS:
            entries.append(cleaned)
        if len(entries) >= _MAX_REFS:
            break
    return entries


def _identifiers(entry: str) -> tuple[str | None, str | None]:
    arxiv = _ARXIV_RE.search(entry)
    doi = _DOI_RE.search(entry)
    return (arxiv.group(1) if arxiv else None, doi.group(0) if doi else None)


def _base_card(entry: str) -> dict[str, object]:
    arxiv_id, doi = _identifiers(entry)
    url = None
    source = "raw"
    if arxiv_id:
        url = f"https://arxiv.org/abs/{arxiv_id}"
        source = "arxiv"
    elif doi:
        url = f"https://doi.org/{doi}"
        source = "doi"
    return {
        "raw": entry,
        "title": None,
        "authors": [],
        "year": None,
        "abstract": None,
        "url": url,
        "source": source,
    }


async def _crossref(entry: str, card: dict[str, object]) -> dict[str, object]:
    params = {"query.bibliographic": entry[:300], "rows": "1"}
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
        resp = await http.get(
            "https://api.crossref.org/works",
            params=params,
            headers={"User-Agent": "PaperLight/0.1 (mailto:noreply@paperlight.app)"},
        )
        resp.raise_for_status()
        items = resp.json().get("message", {}).get("items", [])
    if not items:
        return card
    item = items[0]
    title = item.get("title") or []
    authors = [
        " ".join(filter(None, [a.get("given"), a.get("family")])) for a in item.get("author", [])
    ]
    parts = (item.get("issued", {}) or {}).get("date-parts", [[None]])
    year = parts[0][0] if parts and parts[0] else None
    return {
        **card,
        "title": title[0] if title else card["title"],
        "authors": authors or card["authors"],
        "year": year,
        "url": item.get("URL") or card["url"],
        "source": "crossref",
    }


async def enrich(entry: str) -> dict[str, object]:
    """Best-effort enrichment of one reference; offline stub returns identifiers only."""
    card = _base_card(entry)
    if os.environ.get("REFERENCE_PROVIDER", "stub") != "crossref":
        return card
    try:
        return await _crossref(entry, card)
    except Exception:  # noqa: BLE001 — external API best-effort, fall back to raw card
        logger.exception("crossref enrichment failed")
        return card


def _memo_key(paper_id: str) -> str:
    return cache_key("references", paper_id, f"references:{paper_id}", "static", REF_VERSION)


async def _memo_read(key: str) -> list[dict[str, object]] | None:
    async with session_scope() as session:
        row = await session.get(Cache, key)
        if row is None:
            return None
        if row.expires_at is not None and row.expires_at < int(time.time()):
            return None
        raw = row.response.get("text")
    if not isinstance(raw, str):
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, list) else None


async def _memo_write(key: str, paper_id: str, cards: list[dict[str, object]]) -> None:
    payload = {"text": json.dumps(cards, ensure_ascii=False)}
    expires_at = int(time.time()) + _MEMO_TTL_SECONDS
    async with session_scope() as session:
        existing = await session.get(Cache, key)
        if existing is not None:
            existing.response = payload
            existing.expires_at = expires_at
        else:
            session.add(
                Cache(
                    key=key,
                    task="references",
                    paper_id=paper_id,
                    response=payload,
                    expires_at=expires_at,
                )
            )


async def get_references(paper_id: str) -> list[dict[str, object]]:
    """Extract + enrich a paper's references, memoized in the cache table."""
    key = _memo_key(paper_id)
    cached = await _memo_read(key)
    if cached is not None:
        return cached

    factory = get_session_factory()
    async with factory() as session:
        chunks = list(
            (
                await session.execute(
                    select(Chunk).where(Chunk.paper_id == paper_id).order_by(Chunk.idx)
                )
            )
            .scalars()
            .all()
        )
    entries = extract_references(chunks)

    semaphore = asyncio.Semaphore(_CONCURRENCY)

    async def _one(idx: int, entry: str) -> dict[str, object]:
        async with semaphore:
            card = await enrich(entry)
        return {"marker": idx + 1, **card}

    cards = await asyncio.gather(*(_one(i, e) for i, e in enumerate(entries)))
    result = list(cards)
    await _memo_write(key, paper_id, result)
    return result
