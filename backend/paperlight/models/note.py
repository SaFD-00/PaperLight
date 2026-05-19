"""Note entity — PRD §8.5. Markdown text + optional S3 backup key."""

from __future__ import annotations

import time

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


def _now_ms() -> int:
    return int(time.time() * 1000)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    paper_id: Mapped[str] = mapped_column(
        String, ForeignKey("papers.id"), nullable=False, index=True
    )
    markdown_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    s3_backup_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=_now_ms)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=_now_ms)
