"""P2.1 — Multi-user per organisation: users table

Revision ID: 005
Revises: 004
Create Date: 2026-03-10
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id",    postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email",          sa.String(255), nullable=False),
        sa.Column("name",           sa.String(255), nullable=True),
        sa.Column("password_hash",  sa.String(255), nullable=True),
        sa.Column("role",           sa.String(50),  nullable=False, server_default="member"),
        sa.Column("is_active",      sa.Boolean(),   nullable=False, server_default=sa.text("true")),
        sa.Column("invite_token",   sa.String(255), nullable=True),
        sa.Column("invite_expires", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at",     sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",     sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    # Unique per (customer_id, email) — one user record per email per org
    op.create_index(
        "ix_users_customer_email",
        "users",
        ["customer_id", "email"],
        unique=True,
    )
    # Fast lookup of pending invites by token
    op.create_index(
        "ix_users_invite_token",
        "users",
        ["invite_token"],
        unique=True,
        postgresql_where=sa.text("invite_token IS NOT NULL"),
    )
    op.create_index("ix_users_customer_id", "users", ["customer_id"])


def downgrade() -> None:
    op.drop_table("users")
