"""Tab model — Phase 1 S7a: user-scoped (user_id FK NOT NULL)."""

from __future__ import annotations

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from paperlight.storage.db import Base


class Tab(Base):
    __tablename__ = "tabs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    paper_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_library: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    opened_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    last_active_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False)

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "paperId": self.paper_id,
            "title": self.title,
            "position": self.position,
            "pinned": self.pinned,
            "isLibrary": self.is_library,
            "openedAt": self.opened_at,
            "lastActiveAt": self.last_active_at,
            "updatedAt": self.updated_at,
        }
