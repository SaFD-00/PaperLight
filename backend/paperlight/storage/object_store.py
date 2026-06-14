"""Local filesystem object store for original PDFs and markdown note backups.

PaperLight is a single-user self-hosted app, so blobs live on disk under
`PAPERLIGHT_DATA_DIR` (default `./data`). The PDF is served directly by the
`/api/papers/{id}/pdf` route — no presigning, no auth.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

PDF_KEY_TEMPLATE = "papers/{paper_id}/original.pdf"
NOTE_KEY_TEMPLATE = "notes/{note_id}.md"


def pdf_key(paper_id: str) -> str:
    return PDF_KEY_TEMPLATE.format(paper_id=paper_id)


def note_key(note_id: str) -> str:
    return NOTE_KEY_TEMPLATE.format(note_id=note_id)


def _data_dir() -> Path:
    return Path(os.environ.get("PAPERLIGHT_DATA_DIR", "./data")).resolve()


def _public_base_url() -> str:
    return os.environ.get("PAPERLIGHT_PUBLIC_URL", "http://localhost:8000").rstrip("/")


def pdf_url(paper_id: str) -> str:
    """Absolute URL the pdf.js iframe loads (served by the /pdf route)."""
    return f"{_public_base_url()}/api/papers/{paper_id}/pdf"


class ObjectStore(Protocol):
    def put_pdf(self, key: str, data: bytes) -> None: ...
    def get_pdf(self, key: str) -> bytes: ...
    def put_text(self, key: str, text: str) -> None: ...
    def get_text(self, key: str) -> str: ...


class LocalObjectStore:
    """Disk-backed store under PAPERLIGHT_DATA_DIR."""

    def __init__(self) -> None:
        self._root = _data_dir()

    def _path(self, key: str) -> Path:
        return self._root / key

    def put_pdf(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get_pdf(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except FileNotFoundError as err:
            raise FileNotFoundError(key) from err

    def put_text(self, key: str, text: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def get_text(self, key: str) -> str:
        try:
            return self._path(key).read_text(encoding="utf-8")
        except FileNotFoundError as err:
            raise FileNotFoundError(key) from err


_store: ObjectStore | None = None


def get_object_store() -> ObjectStore:
    global _store
    if _store is None:
        _store = LocalObjectStore()
    return _store


def reset_object_store() -> None:
    """Test-only: drop the singleton so the next call rebuilds from env."""
    global _store
    _store = None
