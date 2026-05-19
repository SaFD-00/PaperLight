"""Highlight entity — PRD §8.5. bbox JSON; category 4종 + user_custom."""

from __future__ import annotations

import time

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


def _now_ms() -> int:
    return int(time.time() * 1000)


class Highlight(Base):
    __tablename__ = "highlights"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    paper_id: Mapped[str] = mapped_column(
        String, ForeignKey("papers.id"), nullable=False, index=True
    )
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    bbox: Mapped[dict] = mapped_column(JSON, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String, nullable=False, default="user_custom")
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="user")
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=_now_ms)
