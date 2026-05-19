"""PaperTag (Paper ↔ Tag) — PRD §8.5."""

from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


class PaperTag(Base):
    __tablename__ = "paper_tags"

    paper_id: Mapped[str] = mapped_column(String, ForeignKey("papers.id"), primary_key=True)
    tag_id: Mapped[str] = mapped_column(String, ForeignKey("tags.id"), primary_key=True)
