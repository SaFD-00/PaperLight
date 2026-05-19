"""User entity — PRD §8.5. Phase 1 S7a: google_sub nullable until OAuth (S7b)."""

from __future__ import annotations

import time

from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


def _now_ms() -> int:
    return int(time.time() * 1000)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    google_sub: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    default_content_language: Mapped[str] = mapped_column(String, nullable=False, default="ko")
    density: Mapped[str] = mapped_column(String, nullable=False, default="cozy")
    theme: Mapped[str] = mapped_column(String, nullable=False, default="auto")
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=_now_ms)
    soft_deleted_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
