"""Embedder — S9. pluggable: `stub`(기본, 결정적 dim=1024) / `fastembed`(bge-m3, opt-in)."""

from __future__ import annotations

import hashlib
import os

import numpy as np

EMBED_DIM = 1024

_fastembed_model = None


def embed(texts: list[str]) -> list[list[float]]:
    backend = os.environ.get("INGEST_EMBEDDER", "stub")
    if backend == "fastembed":
        return _embed_fastembed(texts)
    return [_stub_vector(t) for t in texts]


def pack_embedding(vec: list[float]) -> bytes:
    """Serialize an embedding to compact float32 bytes for SQLite storage."""
    return np.asarray(vec, dtype=np.float32).tobytes()


def unpack_embedding(blob: bytes) -> np.ndarray:
    """Inverse of pack_embedding."""
    return np.frombuffer(blob, dtype=np.float32)


def _stub_vector(text: str) -> list[float]:
    seed = int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "big")
    rng = np.random.default_rng(seed)
    vec = rng.standard_normal(EMBED_DIM)
    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        vec[0] = 1.0
        norm = 1.0
    return (vec / norm).astype(float).tolist()


def _embed_fastembed(texts: list[str]) -> list[list[float]]:
    global _fastembed_model
    if _fastembed_model is None:
        from fastembed import TextEmbedding

        _fastembed_model = TextEmbedding(os.environ.get("INGEST_EMBED_MODEL", "BAAI/bge-m3"))
    return [list(map(float, vec)) for vec in _fastembed_model.embed(texts)]
