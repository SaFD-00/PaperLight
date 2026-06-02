"""arXiv metadata + PDF resolver — S8.

fixture-first: `fixtures/pilot-papers/{id}-*.{meta.json,pdf}` 우선(오프라인·결정적),
없으면 실 arXiv Atom API + PDF 다운로드(httpx) fallback.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from xml.etree import ElementTree as ET

import httpx
from pydantic import BaseModel

_ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")
_VENUE_CAT_RE = re.compile(r"\(([^)]+)\)")
_ATOM = "{http://www.w3.org/2005/Atom}"
_ARXIV_NS = "{http://arxiv.org/schemas/atom}"


class ArxivMeta(BaseModel):
    arxiv_id: str
    title: str
    authors: list[str]
    year: int | None = None
    abstract: str = ""
    doi: str | None = None
    categories: list[str] = []
    pdf_url: str


def normalize_arxiv_id(value: str) -> str:
    match = _ARXIV_ID_RE.search(value.strip())
    if match is None:
        raise ValueError(f"invalid arXiv id or URL: {value!r}")
    return match.group(1)


def fixtures_dir() -> Path:
    override = os.environ.get("PAPERLIGHT_FIXTURES_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[3] / "fixtures" / "pilot-papers"


def _find_fixture(arxiv_id: str, suffix: str) -> Path | None:
    base = fixtures_dir()
    if not base.is_dir():
        return None
    matches = sorted(base.glob(f"{arxiv_id}-*{suffix}"))
    return matches[0] if matches else None


def _meta_from_fixture(path: Path) -> ArxivMeta:
    data = json.loads(path.read_text(encoding="utf-8"))
    categories: list[str] = []
    venue = data.get("venue") or ""
    cat_match = _VENUE_CAT_RE.search(venue)
    if cat_match:
        categories = [c.strip() for c in cat_match.group(1).split(",") if c.strip()]
    return ArxivMeta(
        arxiv_id=data["arxiv_id"],
        title=data["title"],
        authors=data.get("authors", []),
        year=data.get("year"),
        abstract=data.get("abstract") or data.get("notes") or "",
        doi=data.get("doi"),
        categories=categories,
        pdf_url=data.get("pdf_url") or f"https://arxiv.org/pdf/{data['arxiv_id']}.pdf",
    )


def _meta_from_atom(arxiv_id: str, xml_text: str) -> ArxivMeta:
    root = ET.fromstring(xml_text)
    entry = root.find(f"{_ATOM}entry")
    if entry is None:
        raise ValueError(f"arXiv returned no entry for {arxiv_id}")
    title = (entry.findtext(f"{_ATOM}title") or "").strip()
    abstract = (entry.findtext(f"{_ATOM}summary") or "").strip()
    authors = [(a.findtext(f"{_ATOM}name") or "").strip() for a in entry.findall(f"{_ATOM}author")]
    published = entry.findtext(f"{_ATOM}published") or ""
    year = int(published[:4]) if published[:4].isdigit() else None
    doi = entry.findtext(f"{_ARXIV_NS}doi")
    categories = [c.attrib["term"] for c in entry.findall(f"{_ATOM}category") if "term" in c.attrib]
    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    for link in entry.findall(f"{_ATOM}link"):
        if link.attrib.get("title") == "pdf":
            pdf_url = link.attrib.get("href", pdf_url)
    return ArxivMeta(
        arxiv_id=arxiv_id,
        title=title,
        authors=[a for a in authors if a],
        year=year,
        abstract=abstract,
        doi=doi,
        categories=categories,
        pdf_url=pdf_url,
    )


async def resolve_meta(value: str) -> ArxivMeta:
    arxiv_id = normalize_arxiv_id(value)
    fixture = _find_fixture(arxiv_id, ".meta.json")
    if fixture is not None:
        return _meta_from_fixture(fixture)
    url = "http://export.arxiv.org/api/query"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, params={"id_list": arxiv_id})
        resp.raise_for_status()
        return _meta_from_atom(arxiv_id, resp.text)


async def fetch_pdf_bytes(meta: ArxivMeta) -> bytes:
    fixture = _find_fixture(meta.arxiv_id, ".pdf")
    if fixture is not None:
        return fixture.read_bytes()
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        resp = await client.get(meta.pdf_url)
        resp.raise_for_status()
        return resp.content
