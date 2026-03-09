"""P1.6 + Forecast Accuracy — forecast_snapshots and crm_activities tables

Revision ID: 004
Revises: 003
Create Date: 2026-03-09
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── forecast_snapshots ──────────────────────────────────────────────────
    op.create_table(
        "forecast_snapshots",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id",    postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date",  sa.Date(), nullable=False),
        sa.Column("revenue_target", sa.Numeric(15, 2), nullable=True),
        sa.Column("months_data",    postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at",     sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_forecast_snap_customer", "forecast_snapshots",
                    ["customer_id", "snapshot_date"])

    # ── crm_activities ──────────────────────────────────────────────────────
    op.create_table(
        "crm_activities",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source",        sa.String(50),  nullable=False),
        sa.Column("external_id",   sa.String(255), nullable=False),
        sa.Column("activity_type", sa.String(50),  nullable=True),
        sa.Column("occurred_at",   sa.TIMESTAMP(), nullable=True),
        sa.Column("owner_name",    sa.String(255), nullable=True),
        sa.Column("contact_name",  sa.String(255), nullable=True),
        sa.Column("company_name",  sa.String(255), nullable=True),
        sa.Column("subject",       sa.String(500), nullable=True),
        sa.Column("body",          sa.Text(),      nullable=True),
        sa.Column("deal_id",       sa.String(255), nullable=True),
        sa.Column("synced_at",     sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at",    sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_crm_activity_customer",    "crm_activities",
                    ["customer_id", "occurred_at"])
    op.create_index("idx_crm_activity_dedup",       "crm_activities",
                    ["customer_id", "source", "external_id"], unique=True)
    op.create_index("idx_crm_activity_owner",       "crm_activities",
                    ["customer_id", "owner_name"])
    op.create_index("idx_crm_activity_type",        "crm_activities",
                    ["customer_id", "activity_type"])


def downgrade() -> None:
    op.drop_table("crm_activities")
    op.drop_table("forecast_snapshots")
