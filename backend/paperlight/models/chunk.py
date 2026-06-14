"""Chunk entity — S9 ingestion. 본문 텍스트와 임베딩(packed float32)을 함께 SQLite에 저장."""

from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base
from paperlight.utils.time import now_ms


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # uuid4
    paper_id: Mapped[str] = mapped_column(
        String, ForeignKey("papers.id"), nullable=False, index=True
    )
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page_num: Mapped[int] = mapped_column(Integer, nullable=False)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False)
    token_estimate: Mapped[int] = mapped_column(Integer, nullable=False)
    # bge-m3 임베딩을 packed float32 bytes로 저장(코사인 검색용). 미임베딩 청크는 NULL.
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)
