"""Initial schema — all tables from models.py

Revision ID: 001
Revises:
Create Date: 2026-03-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── customers ────────────────────────────────────────────────────────────
    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("plan", sa.String(50), nullable=False, server_default="starter"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_customers_email", "customers", ["email"])

    # ── integrations ─────────────────────────────────────────────────────────
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="disconnected"),
        sa.Column("credentials", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("config", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("last_sync", sa.TIMESTAMP(), nullable=True),
        sa.Column("sync_frequency", sa.String(20), nullable=False, server_default="2h"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_customer_service", "integrations", ["customer_id", "service"], unique=True)
    op.create_index("idx_integration_status", "integrations", ["customer_id", "status"])

    # ── integration_sync_logs ─────────────────────────────────────────────────
    op.create_table(
        "integration_sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("records_synced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("errors", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("started_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("idx_sync_log_customer", "integration_sync_logs", ["customer_id", "started_at"])
    op.create_index("idx_sync_log_service", "integration_sync_logs", ["customer_id", "service", "started_at"])
    op.create_index("idx_sync_log_integration", "integration_sync_logs", ["integration_id", "started_at"])

    # ── leads ─────────────────────────────────────────────────────────────────
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("company_domain", sa.String(255), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("employee_count", sa.Integer(), nullable=True),
        sa.Column("revenue", sa.BigInteger(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_title", sa.String(255), nullable=True),
        sa.Column("contact_linkedin", sa.String(500), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("priority", sa.String(20), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("owner_name", sa.String(255), nullable=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("last_activity", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("score >= 0 AND score <= 100", name="check_score_range"),
    )
    op.create_index("idx_customer_score", "leads", ["customer_id", "score"])
    op.create_index("idx_customer_priority", "leads", ["customer_id", "priority"])
    op.create_index("idx_company_name", "leads", ["customer_id", "company_name"])
    op.create_index("idx_last_activity", "leads", ["customer_id", "last_activity"])
    op.create_index("idx_lead_external_id", "leads", ["customer_id", "source", "external_id"])
    op.create_index("idx_lead_source", "leads", ["customer_id", "source"])

    # ── signals ───────────────────────────────────────────────────────────────
    op.create_table(
        "signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("score_impact", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("external_url", sa.String(500), nullable=True),
        sa.Column("detected_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("extra_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_lead_signals", "signals", ["lead_id", "detected_at"])
    op.create_index("idx_customer_signals", "signals", ["customer_id", "type", "detected_at"])

    # ── scoring_history ───────────────────────────────────────────────────────
    op.create_table(
        "scoring_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("signals_present", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("scored_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_customer_scoring", "scoring_history", ["customer_id", "scored_at"])
    op.create_index("idx_scoring_lead_id", "scoring_history", ["lead_id"])

    # ── outbound_actions ──────────────────────────────────────────────────────
    op.create_table(
        "outbound_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("sequence_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("performed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("idx_customer_actions", "outbound_actions", ["customer_id", "created_at"])
    op.create_index("idx_outbound_lead_id", "outbound_actions", ["lead_id"])

    # ── conversion_data ───────────────────────────────────────────────────────
    op.create_table(
        "conversion_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outcome", sa.String(50), nullable=False),
        sa.Column("revenue", sa.BigInteger(), nullable=True),
        sa.Column("days_to_conversion", sa.Integer(), nullable=True),
        sa.Column("signals_at_scoring", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("score_at_time", sa.Integer(), nullable=True),
        sa.Column("outcome_date", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_customer_conversions", "conversion_data", ["customer_id", "outcome", "outcome_date"])
    op.create_index("idx_conversion_lead_id", "conversion_data", ["lead_id"])

    # ── alerts ────────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("headline", sa.String(500), nullable=False),
        sa.Column("context_json", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("snoozed_until", sa.TIMESTAMP(), nullable=True),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("actioned_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("idx_alert_customer_status", "alerts", ["customer_id", "status", "created_at"])
    op.create_index("idx_alert_customer_type", "alerts", ["customer_id", "type"])
    op.create_index("idx_alert_customer_priority", "alerts", ["customer_id", "priority", "status"])
    op.create_index("idx_alert_lead_id", "alerts", ["lead_id"])

    # ── alert_actions ─────────────────────────────────────────────────────────
    op.create_table(
        "alert_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("idx_alert_actions_customer", "alert_actions", ["customer_id", "created_at"])
    op.create_index("idx_alert_action_alert_id", "alert_actions", ["alert_id"])

    # ── salesforce_opportunities ──────────────────────────────────────────────
    op.create_table(
        "salesforce_opportunities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sf_opportunity_id", sa.String(255), nullable=False),
        sa.Column("account_name", sa.String(255), nullable=True),
        sa.Column("amount", sa.BigInteger(), nullable=True),
        sa.Column("stage", sa.String(100), nullable=True),
        sa.Column("close_date", sa.TIMESTAMP(), nullable=True),
        sa.Column("owner_name", sa.String(255), nullable=True),
        sa.Column("last_activity_date", sa.TIMESTAMP(), nullable=True),
        sa.Column("is_stalled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("raw_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("synced_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_sf_opp_customer_id", "salesforce_opportunities",
                    ["customer_id", "sf_opportunity_id"], unique=True)
    op.create_index("idx_sf_opp_stalled", "salesforce_opportunities", ["customer_id", "is_stalled"])
    op.create_index("idx_sf_opp_activity", "salesforce_opportunities",
                    ["customer_id", "last_activity_date"])

    # ── salesforce_accounts ───────────────────────────────────────────────────
    op.create_table(
        "salesforce_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sf_account_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("employee_count", sa.Integer(), nullable=True),
        sa.Column("raw_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("synced_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_sf_acc_customer_id", "salesforce_accounts",
                    ["customer_id", "sf_account_id"], unique=True)
    op.create_index("idx_sf_acc_domain", "salesforce_accounts", ["customer_id", "domain"])

    # ── chat_sessions ─────────────────────────────────────────────────────────
    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_message_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_chat_session_customer", "chat_sessions",
                    ["customer_id", "last_message_at"])

    # ── chat_messages ─────────────────────────────────────────────────────────
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_calls", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_chat_message_session", "chat_messages", ["session_id", "created_at"])
    op.create_index("idx_chat_message_customer", "chat_messages", ["customer_id", "created_at"])

    # ── ai_actions ────────────────────────────────────────────────────────────
    op.create_table(
        "ai_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("integration", sa.String(50), nullable=True),
        sa.Column("inputs", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("result", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_ai_action_customer", "ai_actions", ["customer_id", "created_at"])
    op.create_index("idx_ai_action_type", "ai_actions", ["customer_id", "action_type"])
    op.create_index("idx_ai_action_session", "ai_actions", ["session_id"])

    # ── weekly_reports ────────────────────────────────────────────────────────
    op.create_table(
        "weekly_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.TIMESTAMP(), nullable=False),
        sa.Column("generated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("data_snapshot", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("section_what_happened", sa.Text(), nullable=True),
        sa.Column("section_this_week", sa.Text(), nullable=True),
        sa.Column("section_management", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(100), nullable=True),
    )
    op.create_index("idx_weekly_report_customer", "weekly_reports",
                    ["customer_id", "week_start"])

    # ── workflows ─────────────────────────────────────────────────────────────
    op.create_table(
        "workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("trigger_type", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("conditions", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("actions", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("last_run", sa.TIMESTAMP(), nullable=True),
        sa.Column("run_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_workflow_customer_status", "workflows", ["customer_id", "status"])

    # ── ai_settings ───────────────────────────────────────────────────────────
    op.create_table(
        "ai_settings",
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("skills", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("company_context", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )

    # ── notion_initiatives ────────────────────────────────────────────────────
    op.create_table(
        "notion_initiatives",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notion_page_id", sa.String(255), nullable=False),
        sa.Column("database_id", sa.String(255), nullable=True),
        sa.Column("database_name", sa.String(255), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("department", sa.String(255), nullable=True),
        sa.Column("owner", sa.String(500), nullable=True),
        sa.Column("status", sa.String(100), nullable=True),
        sa.Column("due_date", sa.TIMESTAMP(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("priority", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notion_url", sa.String(500), nullable=True),
        sa.Column("raw_properties", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("synced_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_notion_customer_sync", "notion_initiatives", ["customer_id", "synced_at"])
    op.create_index("idx_notion_page_unique", "notion_initiatives",
                    ["customer_id", "notion_page_id"], unique=True)
    op.create_index("idx_notion_department", "notion_initiatives", ["customer_id", "department"])

    # ── gtm_configs ───────────────────────────────────────────────────────────
    op.create_table(
        "gtm_configs",
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("company_description", sa.Text(), nullable=True),
        sa.Column("value_proposition", sa.Text(), nullable=True),
        sa.Column("competitors", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("offerings", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("icp", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("goals", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )

    # ── forecast_snapshots ────────────────────────────────────────────────────
    op.create_table(
        "forecast_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("revenue_target", sa.Numeric(15, 2), nullable=True),
        sa.Column("months_data", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_forecast_snapshot_customer", "forecast_snapshots",
                    ["customer_id", "snapshot_date"])


def downgrade() -> None:
    op.drop_table("forecast_snapshots")
    op.drop_table("gtm_configs")
    op.drop_table("notion_initiatives")
    op.drop_table("ai_settings")
    op.drop_table("workflows")
    op.drop_table("weekly_reports")
    op.drop_table("ai_actions")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("salesforce_accounts")
    op.drop_table("salesforce_opportunities")
    op.drop_table("alert_actions")
    op.drop_table("alerts")
    op.drop_table("conversion_data")
    op.drop_table("outbound_actions")
    op.drop_table("scoring_history")
    op.drop_table("signals")
    op.drop_table("leads")
    op.drop_table("integration_sync_logs")
    op.drop_table("integrations")
    op.drop_table("customers")
