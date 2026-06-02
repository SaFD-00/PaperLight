"""phase1 init: 10-entity schema + tab user_id

Revision ID: 0001_phase1_init
Revises:
Create Date: 2026-05-20

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_phase1_init"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("google_sub", sa.String(), nullable=True, unique=True),
        sa.Column("default_content_language", sa.String(), nullable=False, server_default="ko"),
        sa.Column("density", sa.String(), nullable=False, server_default="cozy"),
        sa.Column("theme", sa.String(), nullable=False, server_default="auto"),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("soft_deleted_at", sa.BigInteger(), nullable=True),
    )

    op.create_table(
        "papers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("authors", sa.JSON(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("venue", sa.String(), nullable=True),
        sa.Column("arxiv_id", sa.String(), nullable=True, index=True),
        sa.Column("doi", sa.String(), nullable=True, index=True),
        sa.Column("pdf_r2_key", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="to_read"),
        sa.Column("progress_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ingestion_status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("soft_deleted_at", sa.BigInteger(), nullable=True),
    )

    op.create_table(
        "collections",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column(
            "parent_id",
            sa.String(),
            sa.ForeignKey("collections.id"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_special", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("special_kind", sa.String(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "library_items",
        sa.Column("paper_id", sa.String(), sa.ForeignKey("papers.id"), primary_key=True),
        sa.Column("collection_id", sa.String(), sa.ForeignKey("collections.id"), primary_key=True),
        sa.Column("added_at", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_tag_user_name"),
    )

    op.create_table(
        "paper_tags",
        sa.Column("paper_id", sa.String(), sa.ForeignKey("papers.id"), primary_key=True),
        sa.Column("tag_id", sa.String(), sa.ForeignKey("tags.id"), primary_key=True),
    )

    op.create_table(
        "notes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("paper_id", sa.String(), sa.ForeignKey("papers.id"), nullable=False, index=True),
        sa.Column("markdown_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("s3_backup_key", sa.String(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "highlights",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("paper_id", sa.String(), sa.ForeignKey("papers.id"), nullable=False, index=True),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("bbox", sa.JSON(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(), nullable=False, server_default="user_custom"),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default="user"),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "podcasts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("paper_id", sa.String(), sa.ForeignKey("papers.id"), nullable=False, index=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("script_md", sa.Text(), nullable=True),
        sa.Column("audio_r2_key", sa.String(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "caches",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("task", sa.String(), nullable=False, index=True),
        sa.Column("paper_id", sa.String(), nullable=True, index=True),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=True, index=True),
    )

    op.create_table(
        "tabs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("paper_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_library", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("opened_at", sa.BigInteger(), nullable=False),
        sa.Column("last_active_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("tabs")
    op.drop_table("caches")
    op.drop_table("podcasts")
    op.drop_table("highlights")
    op.drop_table("notes")
    op.drop_table("paper_tags")
    op.drop_table("tags")
    op.drop_table("library_items")
    op.drop_table("collections")
    op.drop_table("papers")
    op.drop_table("users")
