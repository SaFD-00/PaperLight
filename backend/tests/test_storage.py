"""Storage backend tests — S9 (object_store + Qdrant vector)."""

from __future__ import annotations

import time
import uuid

from paperlight.storage.object_store import (
    LocalObjectStore,
    pdf_key,
    sign_pdf_token,
    verify_pdf_token,
)
from paperlight.storage.vector import VECTOR_DIM, VectorStore


def test_local_object_store_roundtrip() -> None:
    store = LocalObjectStore()
    key = pdf_key("paper-1")
    store.put_pdf(key, b"%PDF-1.7 data")
    assert store.get_pdf(key) == b"%PDF-1.7 data"


def test_local_presigned_url_has_signature_and_expiry() -> None:
    url = LocalObjectStore().presigned_get(pdf_key("paper-1"), ttl=600)
    assert "/api/papers/paper-1/pdf" in url
    assert "exp=" in url and "sig=" in url


def test_pdf_token_sign_verify_roundtrip() -> None:
    exp = int(time.time()) + 600
    sig = sign_pdf_token("paper-1", exp)
    assert verify_pdf_token("paper-1", exp, sig) is True
    assert verify_pdf_token("paper-1", exp, "bad") is False


def test_pdf_token_expired_rejected() -> None:
    exp = 1
    assert verify_pdf_token("paper-1", exp, sign_pdf_token("paper-1", exp)) is False


def test_vector_upsert_and_search_top1_is_self() -> None:
    store = VectorStore()  # :memory:
    vec_a = [1.0] + [0.0] * (VECTOR_DIM - 1)
    vec_b = [0.0, 1.0] + [0.0] * (VECTOR_DIM - 2)
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    store.upsert(
        [
            (id_a, vec_a, {"paper_id": "p1", "page": 1, "text": "alpha"}),
            (id_b, vec_b, {"paper_id": "p1", "page": 1, "text": "beta"}),
        ]
    )
    hits = store.search(vec_a, top_k=1, paper_id="p1")
    assert hits[0]["id"] == id_a
    assert hits[0]["payload"]["text"] == "alpha"


def test_vector_search_filters_by_paper() -> None:
    store = VectorStore()
    vec = [1.0] + [0.0] * (VECTOR_DIM - 1)
    store.upsert([(str(uuid.uuid4()), vec, {"paper_id": "p1", "page": 1, "text": "x"})])
    assert store.search(vec, top_k=5, paper_id="p2") == []
