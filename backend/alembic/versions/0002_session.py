"""S7b: add sessions table for refresh-token rotation

Revision ID: 0002_session
Revises: 0001_phase1_init
Create Date: 2026-05-20

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_session"
down_revision: str | None = "0001_phase1_init"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sessions",
        sa.Column("jti", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("family_id", sa.String(), nullable=False, index=True),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("revoked_at", sa.BigInteger(), nullable=True, index=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("user_agent", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sessions")
