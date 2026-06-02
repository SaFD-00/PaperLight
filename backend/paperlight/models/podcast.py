"""Podcast entity — PRD §8.5. Phase 2 사용; Phase 1에서는 schema만 준비."""

from __future__ import annotations

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base
from paperlight.utils.time import now_ms


class Podcast(Base):
    __tablename__ = "podcasts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    paper_id: Mapped[str] = mapped_column(
        String, ForeignKey("papers.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    options: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    script_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_r2_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)
