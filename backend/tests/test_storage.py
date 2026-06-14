"""Storage backend tests — local filesystem object store (single-user, no auth)."""

from __future__ import annotations

import os
import tempfile

import pytest

from paperlight.storage.object_store import (
    LocalObjectStore,
    note_key,
    pdf_key,
    reset_object_store,
)


@pytest.fixture
def data_dir(monkeypatch: pytest.MonkeyPatch) -> str:
    d = tempfile.mkdtemp(prefix="paperlight-store-")
    monkeypatch.setenv("PAPERLIGHT_DATA_DIR", d)
    reset_object_store()
    return d


def test_local_object_store_pdf_roundtrip(data_dir: str) -> None:
    store = LocalObjectStore()
    key = pdf_key("paper-1")
    store.put_pdf(key, b"%PDF-1.7 data")
    assert store.get_pdf(key) == b"%PDF-1.7 data"
    # 디스크에 실제로 기록되었는지 확인
    assert os.path.exists(os.path.join(data_dir, key))


def test_local_object_store_text_roundtrip(data_dir: str) -> None:
    store = LocalObjectStore()
    key = note_key("note-1")
    store.put_text(key, "# 노트\n본문")
    assert store.get_text(key) == "# 노트\n본문"


def test_get_pdf_missing_raises(data_dir: str) -> None:
    store = LocalObjectStore()
    with pytest.raises(FileNotFoundError):
        store.get_pdf(pdf_key("does-not-exist"))
