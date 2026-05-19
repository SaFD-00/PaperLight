"""Cache entity — LLM response hash cache (PRD §7.5 캐시 키)."""

from __future__ import annotations

from sqlalchemy import JSON, BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


class Cache(Base):
    __tablename__ = "caches"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    task: Mapped[str] = mapped_column(String, nullable=False, index=True)
    paper_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    response: Mapped[dict] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
