"""P2.8 — Custom alert rules: custom_alert_rules table

Revision ID: 006
Revises: 005
Create Date: 2026-03-10
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_alert_rules",
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name",         sa.String(255), nullable=False),
        sa.Column("trigger_type", sa.String(50),  nullable=False),
        sa.Column("conditions",   postgresql.JSON(astext_type=sa.Text()), nullable=False,
                  server_default=sa.text("'{}'")),
        sa.Column("severity",     sa.String(20),  nullable=False, server_default="medium"),
        sa.Column("enabled",      sa.Boolean(),   nullable=False, server_default=sa.text("true")),
        sa.Column("cooldown_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("created_at",   sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",   sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_custom_alert_rules_customer", "custom_alert_rules", ["customer_id"])


def downgrade() -> None:
    op.drop_table("custom_alert_rules")
