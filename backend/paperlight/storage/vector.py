"""Qdrant vector store wrapper — ARCH §6.2.

env `QDRANT_URL` 가 있으면 실 서버(docker), 없으면 `:memory:`(오프라인 테스트).
collection `paper_chunks` (dim=1024, cosine), payload=paper_id/page/text.
"""

from __future__ import annotations

import os
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

COLLECTION = "paper_chunks"
VECTOR_DIM = 1024


class VectorStore:
    def __init__(self) -> None:
        url = os.environ.get("QDRANT_URL")
        if url:
            self._client = QdrantClient(url=url, api_key=os.environ.get("QDRANT_API_KEY"))
        else:
            self._client = QdrantClient(location=":memory:")

    def ensure_collection(self, dim: int = VECTOR_DIM) -> None:
        if not self._client.collection_exists(COLLECTION):
            self._client.create_collection(
                collection_name=COLLECTION,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )

    def upsert(self, points: list[tuple[str, list[float], dict[str, Any]]]) -> None:
        self.ensure_collection()
        self._client.upsert(
            collection_name=COLLECTION,
            points=[
                PointStruct(id=pid, vector=vec, payload=payload) for pid, vec, payload in points
            ],
        )

    def search(
        self, vector: list[float], *, top_k: int = 5, paper_id: str | None = None
    ) -> list[dict[str, Any]]:
        self.ensure_collection()
        query_filter = (
            Filter(must=[FieldCondition(key="paper_id", match=MatchValue(value=paper_id))])
            if paper_id is not None
            else None
        )
        resp = self._client.query_points(
            collection_name=COLLECTION, query=vector, limit=top_k, query_filter=query_filter
        )
        return [{"id": str(p.id), "score": p.score, "payload": p.payload} for p in resp.points]

    def delete_paper(self, paper_id: str) -> None:
        if self._client.collection_exists(COLLECTION):
            self._client.delete(
                collection_name=COLLECTION,
                points_selector=Filter(
                    must=[FieldCondition(key="paper_id", match=MatchValue(value=paper_id))]
                ),
            )


_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store


def reset_vector_store() -> None:
    """Test-only: drop the singleton so each test gets a fresh :memory: client."""
    global _store
    _store = None
