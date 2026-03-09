"""P1.1/P1.2/P1.3/P1.5 — canonical accounts, account_sources, recommendations, opp health columns

Revision ID: 003
Revises: 002
Create Date: 2026-03-09
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── P1.3: add health score columns to salesforce_opportunities ──────────
    op.add_column(
        "salesforce_opportunities",
        sa.Column("health_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "salesforce_opportunities",
        sa.Column("health_risk_flags", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "salesforce_opportunities",
        sa.Column("days_since_activity", sa.Integer(), nullable=True),
    )

    # ── P1.1: accounts ───────────────────────────────────────────────────────
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("employee_count", sa.Integer(), nullable=True),
        sa.Column("revenue", sa.BigInteger(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("technologies", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        # P1.2
        sa.Column("icp_score", sa.Integer(), nullable=True),
        sa.Column("icp_tier", sa.String(1), nullable=True),
        # CRM status flags
        sa.Column("in_crm", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("has_open_deal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sources", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.func.now(), nullable=False),
    )
    # Partial unique index: domain dedup only when domain is not null
    op.create_index(
        "idx_account_customer_domain",
        "accounts",
        ["customer_id", "domain"],
        unique=True,
        postgresql_where=sa.text("domain IS NOT NULL"),
    )
    op.create_index("idx_account_icp_tier", "accounts", ["customer_id", "icp_tier"])
    op.create_index("idx_account_has_open_deal", "accounts", ["customer_id", "has_open_deal"])

    # ── P1.1: account_sources ───────────────────────────────────────────────
    op.create_table(
        "account_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("synced_at", sa.TIMESTAMP(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "idx_acct_source_unique", "account_sources",
        ["account_id", "source", "external_id"], unique=True,
    )
    op.create_index(
        "idx_acct_source_lookup", "account_sources",
        ["customer_id", "source", "external_id"],
    )

    # ── P1.5: recommendations ───────────────────────────────────────────────
    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rec_type", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sf_opp_id", sa.String(255), nullable=True),
        sa.Column("owner_name", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("generated_at", sa.TIMESTAMP(), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("actioned_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_rec_customer_status", "recommendations",
                    ["customer_id", "status", "created_at"])
    op.create_index("idx_rec_customer_type", "recommendations",
                    ["customer_id", "rec_type"])
    op.create_index("idx_rec_account", "recommendations", ["account_id"])


def downgrade() -> None:
    op.drop_table("recommendations")
    op.drop_table("account_sources")
    op.drop_index("idx_account_has_open_deal", table_name="accounts")
    op.drop_index("idx_account_icp_tier", table_name="accounts")
    op.drop_index("idx_account_customer_domain", table_name="accounts")
    op.drop_table("accounts")
    op.drop_column("salesforce_opportunities", "days_since_activity")
    op.drop_column("salesforce_opportunities", "health_risk_flags")
    op.drop_column("salesforce_opportunities", "health_score")
