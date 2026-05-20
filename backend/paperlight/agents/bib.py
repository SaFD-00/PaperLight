"""Bibliographic format parse/export — S13 (F-08 import/export).

순수 함수만(외부 deps 없음). BibTeX/RIS/EndNote ↔ `ParsedRef`. 깨진 입력은 graceful —
title 없는 엔트리는 건너뛰고, 알 수 없는 포맷은 ValueError.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

FORMATS = ("bibtex", "ris", "endnote")


@dataclass
class ParsedRef:
    title: str
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    doi: str | None = None
    arxiv_id: str | None = None


def _to_year(value: str | None) -> int | None:
    if not value:
        return None
    m = re.search(r"\d{4}", value)
    return int(m.group()) if m else None


def _cite_key(ref: ParsedRef, idx: int) -> str:
    base = ""
    if ref.authors:
        tokens = ref.authors[0].replace(",", " ").split()
        if tokens:
            base = re.sub(r"[^A-Za-z]", "", tokens[-1])
    return f"{base or 'ref'}{ref.year or idx}"


# ── parse ────────────────────────────────────────────────────────────────────


def _bibtex_entries(text: str) -> list[str]:
    entries: list[str] = []
    for chunk in text.split("@")[1:]:
        brace = chunk.find("{")
        if brace == -1:
            continue
        body = chunk[brace + 1 :]
        end = body.rfind("}")
        if end == -1:
            continue
        entries.append(body[:end])
    return entries


def parse_bibtex(text: str) -> list[ParsedRef]:
    refs: list[ParsedRef] = []
    for block in _bibtex_entries(text):
        fields: dict[str, str] = {}
        for m in re.finditer(r'(\w+)\s*=\s*(\{[^{}]*\}|"[^"]*"|[^,\n]+)', block):
            fields[m.group(1).lower()] = m.group(2).strip().strip('{}"').strip()
        title = fields.get("title")
        if not title:
            continue
        authors = [a.strip() for a in fields.get("author", "").split(" and ") if a.strip()]
        refs.append(
            ParsedRef(
                title=title,
                authors=authors,
                year=_to_year(fields.get("year")),
                venue=fields.get("journal") or fields.get("booktitle"),
                doi=fields.get("doi"),
                arxiv_id=fields.get("eprint"),
            )
        )
    return refs


def parse_ris(text: str) -> list[ParsedRef]:
    refs: list[ParsedRef] = []
    cur: dict[str, str] = {}
    authors: list[str] = []

    def flush() -> None:
        nonlocal cur, authors
        if cur.get("title"):
            refs.append(
                ParsedRef(
                    title=cur["title"],
                    authors=authors,
                    year=_to_year(cur.get("year")),
                    venue=cur.get("venue"),
                    doi=cur.get("doi"),
                )
            )
        cur, authors = {}, []

    for line in text.splitlines():
        m = re.match(r"^([A-Z][A-Z0-9])\s+-\s?(.*)$", line)
        if not m:
            continue
        tag, val = m.group(1), m.group(2).strip()
        if tag == "ER":
            flush()
        elif tag in ("TI", "T1"):
            cur["title"] = val
        elif tag in ("AU", "A1"):
            authors.append(val)
        elif tag in ("PY", "Y1"):
            cur["year"] = val
        elif tag in ("JO", "JF", "T2"):
            cur["venue"] = val
        elif tag == "DO":
            cur["doi"] = val
    flush()
    return refs


def parse_endnote(text: str) -> list[ParsedRef]:
    refs: list[ParsedRef] = []
    for block in re.split(r"\n\s*\n", text.strip()):
        cur: dict[str, str] = {}
        authors: list[str] = []
        for line in block.splitlines():
            m = re.match(r"^%(.) (.*)$", line)
            if not m:
                continue
            code, val = m.group(1), m.group(2).strip()
            if code == "T":
                cur["title"] = val
            elif code == "A":
                authors.append(val)
            elif code == "D":
                cur["year"] = val
            elif code == "J":
                cur["venue"] = val
            elif code == "R":
                cur["doi"] = val
        if cur.get("title"):
            refs.append(
                ParsedRef(
                    title=cur["title"],
                    authors=authors,
                    year=_to_year(cur.get("year")),
                    venue=cur.get("venue"),
                    doi=cur.get("doi"),
                )
            )
    return refs


def parse(fmt: str, text: str) -> list[ParsedRef]:
    if fmt == "bibtex":
        return parse_bibtex(text)
    if fmt == "ris":
        return parse_ris(text)
    if fmt == "endnote":
        return parse_endnote(text)
    raise ValueError(f"unknown format: {fmt}")


# ── export ───────────────────────────────────────────────────────────────────


def export_bibtex(refs: list[ParsedRef]) -> str:
    blocks: list[str] = []
    for i, r in enumerate(refs):
        lines = [f"@article{{{_cite_key(r, i)},", f"  title = {{{r.title}}},"]
        if r.authors:
            lines.append(f"  author = {{{' and '.join(r.authors)}}},")
        if r.year:
            lines.append(f"  year = {{{r.year}}},")
        if r.venue:
            lines.append(f"  journal = {{{r.venue}}},")
        if r.doi:
            lines.append(f"  doi = {{{r.doi}}},")
        if r.arxiv_id:
            lines.append(f"  eprint = {{{r.arxiv_id}}},")
        lines.append("}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def export_ris(refs: list[ParsedRef]) -> str:
    blocks: list[str] = []
    for r in refs:
        lines = ["TY  - JOUR", f"TI  - {r.title}"]
        lines += [f"AU  - {a}" for a in r.authors]
        if r.year:
            lines.append(f"PY  - {r.year}")
        if r.venue:
            lines.append(f"JO  - {r.venue}")
        if r.doi:
            lines.append(f"DO  - {r.doi}")
        lines.append("ER  - ")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def export_endnote(refs: list[ParsedRef]) -> str:
    blocks: list[str] = []
    for r in refs:
        lines = ["%0 Journal Article", f"%T {r.title}"]
        lines += [f"%A {a}" for a in r.authors]
        if r.year:
            lines.append(f"%D {r.year}")
        if r.venue:
            lines.append(f"%J {r.venue}")
        if r.doi:
            lines.append(f"%R {r.doi}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def export(fmt: str, refs: list[ParsedRef]) -> str:
    if fmt == "bibtex":
        return export_bibtex(refs)
    if fmt == "ris":
        return export_ris(refs)
    if fmt == "endnote":
        return export_endnote(refs)
    raise ValueError(f"unknown format: {fmt}")
