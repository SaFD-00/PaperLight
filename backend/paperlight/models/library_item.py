"""LibraryItem (Paper ↔ Collection) — PRD §8.5."""

from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base
from paperlight.utils.time import now_ms


class LibraryItem(Base):
    __tablename__ = "library_items"

    paper_id: Mapped[str] = mapped_column(String, ForeignKey("papers.id"), primary_key=True)
    collection_id: Mapped[str] = mapped_column(
        String, ForeignKey("collections.id"), primary_key=True
    )
    added_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)
