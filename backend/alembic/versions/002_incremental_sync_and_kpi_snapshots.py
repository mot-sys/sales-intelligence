"""Add integration_sync_states and kpi_snapshots tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── integration_sync_states ───────────────────────────────────────────────
    op.create_table(
        "integration_sync_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("object_type", sa.String(50), nullable=False),
        sa.Column("cursor", sa.String(500), nullable=True),
        sa.Column("last_synced_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "idx_sync_state_integration_type",
        "integration_sync_states",
        ["integration_id", "object_type"],
        unique=True,
    )
    op.create_index("idx_sync_state_customer", "integration_sync_states", ["customer_id"])

    # ── kpi_snapshots ─────────────────────────────────────────────────────────
    op.create_table(
        "kpi_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("metrics", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        # {
        #   pipeline_value, open_deals, closed_won_value, closed_won_count,
        #   avg_deal_size, win_rate_pct, meetings_held, stalled_deals,
        #   leads_synced, hot_leads, warm_leads, cold_leads
        # }
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "idx_kpi_snapshot_customer_date",
        "kpi_snapshots",
        ["customer_id", "snapshot_date"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("kpi_snapshots")
    op.drop_table("integration_sync_states")
