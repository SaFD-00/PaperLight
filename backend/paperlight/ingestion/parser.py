"""PDF parser — S9. PyMuPDF(default, 경량). marker는 `INGEST_PARSER=marker` follow-up."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class PageText:
    page_num: int  # 1-based
    text: str


def parse_pdf(data: bytes) -> list[PageText]:
    parser = os.environ.get("INGEST_PARSER", "pymupdf")
    if parser == "marker":
        raise NotImplementedError(
            "INGEST_PARSER=marker is not implemented yet (follow-up PR); use pymupdf"
        )
    return _parse_pymupdf(data)


def _parse_pymupdf(data: bytes) -> list[PageText]:
    import pymupdf

    pages: list[PageText] = []
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        for i, page in enumerate(doc):
            pages.append(PageText(page_num=i + 1, text=page.get_text("text")))
    return pages
