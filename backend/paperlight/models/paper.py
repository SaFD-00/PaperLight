"""Paper entity — PRD §8.5."""

from __future__ import annotations

import time

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


def _now_ms() -> int:
    return int(time.time() * 1000)


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    authors: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    venue: Mapped[str | None] = mapped_column(String, nullable=True)
    arxiv_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    doi: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    pdf_r2_key: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="to_read")
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ingestion_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=_now_ms)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=_now_ms)
    soft_deleted_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
