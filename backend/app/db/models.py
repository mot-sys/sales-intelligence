"""
Database Models
SQLAlchemy ORM models for all database tables.
"""

from sqlalchemy import (
    Column, String, Integer, BigInteger, Text, Boolean,
    ForeignKey, Index, CheckConstraint, TIMESTAMP, JSON, Date, Numeric
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.session import Base  # single shared Base so create_all sees all models


class Customer(Base):
    """Customer/Account (multi-tenant)"""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # bcrypt hash
    plan = Column(String(50), nullable=False, default="starter")  # starter/pro/enterprise

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    integrations = relationship("Integration", back_populates="customer", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="customer", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="customer", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="customer", cascade="all, delete-orphan")
    sf_opportunities = relationship("SalesforceOpportunity", back_populates="customer", cascade="all, delete-orphan")
    sf_accounts = relationship("SalesforceAccount", back_populates="customer", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="customer", cascade="all, delete-orphan")
    ai_actions = relationship("AIAction", back_populates="customer", cascade="all, delete-orphan")
    weekly_reports = relationship("WeeklyReport", back_populates="customer", cascade="all, delete-orphan")
    notion_initiatives = relationship("NotionInitiative", back_populates="customer", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="customer", cascade="all, delete-orphan")
    gtm_config = relationship("GTMConfig", back_populates="customer", uselist=False, cascade="all, delete-orphan")
    forecast_snapshots = relationship("ForecastSnapshot", back_populates="customer", cascade="all, delete-orphan")
    kpi_snapshots      = relationship("KpiSnapshot", back_populates="customer", cascade="all, delete-orphan")
    accounts           = relationship("Account", back_populates="customer", cascade="all, delete-orphan")
    recommendations    = relationship("Recommendation", back_populates="customer", cascade="all, delete-orphan")
    crm_activities     = relationship("CRMActivity", back_populates="customer", cascade="all, delete-orphan")
    users              = relationship("User", back_populates="customer", cascade="all, delete-orphan")


class Integration(Base):
    """External service connections (HubSpot, Salesforce, Clay, etc.)"""
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    # Integration details
    service = Column(String(50), nullable=False)  # clay/salesforce/snitcher/hubspot/notion
    status = Column(String(20), nullable=False, default="disconnected")  # connected/error/disconnected
    credentials = Column(JSON, nullable=False)  # API keys, tokens etc. (encrypt in production)
    config = Column(JSON, nullable=True)         # Optional integration-specific config

    # Sync settings
    last_sync = Column(TIMESTAMP, nullable=True)
    sync_frequency = Column(String(20), nullable=False, default="2h")  # 2h/6h/daily

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="integrations")
    sync_logs = relationship("IntegrationSyncLog", back_populates="integration", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        Index("idx_customer_service", "customer_id", "service", unique=True),
        Index("idx_integration_status", "customer_id", "status"),
    )


class IntegrationSyncLog(Base):
    """
    Per-sync log for every integration sync attempt.
    Allows tracking of sync health, error patterns, and data volumes.
    """
    __tablename__ = "integration_sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    service = Column(String(50), nullable=False)          # Denormalized for fast queries without join
    status = Column(String(20), nullable=False)           # success/partial/failed

    records_synced = Column(Integer, nullable=False, default=0)
    records_created = Column(Integer, nullable=False, default=0)
    records_updated = Column(Integer, nullable=False, default=0)
    records_failed = Column(Integer, nullable=False, default=0)

    duration_ms = Column(Integer, nullable=True)          # How long the sync took
    error_summary = Column(Text, nullable=True)           # Short description of any errors
    errors = Column(JSON, nullable=True)                  # Full list of error details

    started_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    integration = relationship("Integration", back_populates="sync_logs")

    __table_args__ = (
        Index("idx_sync_log_customer", "customer_id", "started_at"),
        Index("idx_sync_log_service", "customer_id", "service", "started_at"),
        Index("idx_sync_log_integration", "integration_id", "started_at"),
    )


class Lead(Base):
    """Lead/Company with scoring"""
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    # Company information
    company_name = Column(String(255), nullable=False)
    company_domain = Column(String(255), nullable=True)
    industry = Column(String(100), nullable=True)
    employee_count = Column(Integer, nullable=True)
    revenue = Column(BigInteger, nullable=True)
    location = Column(String(255), nullable=True)

    # Contact information
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_title = Column(String(255), nullable=True)
    contact_linkedin = Column(String(500), nullable=True)

    # Scoring
    score = Column(Integer, default=0, nullable=False)
    priority = Column(String(20), nullable=True)  # hot/warm/cold
    recommendation = Column(Text, nullable=True)

    # Ownership (internal sales rep responsible for this lead)
    owner_name = Column(String(255), nullable=True)

    # Metadata
    source = Column(String(50), nullable=False)  # clay/salesforce/snitcher/hubspot
    external_id = Column(String(255), nullable=True)
    last_activity = Column(TIMESTAMP, nullable=True)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="leads")
    signals = relationship("Signal", back_populates="lead", cascade="all, delete-orphan")
    scoring_history = relationship("ScoringHistory", back_populates="lead", cascade="all, delete-orphan")
    outbound_actions = relationship("OutboundAction", back_populates="lead", cascade="all, delete-orphan")
    conversion_data = relationship("ConversionData", back_populates="lead", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="lead", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="check_score_range"),
        Index("idx_customer_score", "customer_id", "score"),
        Index("idx_customer_priority", "customer_id", "priority"),
        Index("idx_company_name", "customer_id", "company_name"),
        Index("idx_last_activity", "customer_id", "last_activity"),
        # Dedup index — used by upsert_lead() to find existing records
        Index("idx_lead_external_id", "customer_id", "source", "external_id"),
        # Source filtering
        Index("idx_lead_source", "customer_id", "source"),
    )


class Signal(Base):
    """Signals detected for leads"""
    __tablename__ = "signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    # Signal details
    type = Column(String(50), nullable=False)  # funding/hiring/tech_change/intent/content
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    score_impact = Column(Integer, default=0, nullable=False)

    # Source
    source = Column(String(50), nullable=False)
    external_url = Column(String(500), nullable=True)
    detected_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Flexible metadata — named extra_data because 'metadata' is reserved by SQLAlchemy
    extra_data = Column(JSON, nullable=True)

    # Timestamp
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    lead = relationship("Lead", back_populates="signals")
    customer = relationship("Customer", back_populates="signals")

    # Constraints
    __table_args__ = (
        Index("idx_lead_signals", "lead_id", "detected_at"),
        Index("idx_customer_signals", "customer_id", "type", "detected_at"),
    )


class ScoringHistory(Base):
    """Historical scores for ML training"""
    __tablename__ = "scoring_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    score = Column(Integer, nullable=False)
    signals_present = Column(JSON, nullable=True)  # Snapshot of signals at scoring time
    model_version = Column(String(50), nullable=True)

    scored_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    lead = relationship("Lead", back_populates="scoring_history")

    # Constraints
    __table_args__ = (
        Index("idx_customer_scoring", "customer_id", "scored_at"),
        Index("idx_scoring_lead_id", "lead_id"),
    )


class OutboundAction(Base):
    """Actions taken on leads"""
    __tablename__ = "outbound_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    action_type = Column(String(50), nullable=False)  # add_to_sequence/skip/manual_outreach
    sequence_id = Column(String(255), nullable=True)  # Email sequence ID
    status = Column(String(50), nullable=False, default="pending")  # pending/completed/failed

    notes = Column(Text, nullable=True)
    performed_by = Column(UUID(as_uuid=True), nullable=True)  # User ID

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    completed_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="outbound_actions")

    # Constraints
    __table_args__ = (
        Index("idx_customer_actions", "customer_id", "created_at"),
        Index("idx_outbound_lead_id", "lead_id"),
    )


class ConversionData(Base):
    """Conversion outcomes for ML training"""
    __tablename__ = "conversion_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    outcome = Column(String(50), nullable=False)  # meeting_booked/deal_closed/lost/no_response
    revenue = Column(BigInteger, nullable=True)  # If deal closed
    days_to_conversion = Column(Integer, nullable=True)

    signals_at_scoring = Column(JSON, nullable=True)  # Signals when lead was scored
    score_at_time = Column(Integer, nullable=True)

    outcome_date = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    lead = relationship("Lead", back_populates="conversion_data")

    # Constraints
    __table_args__ = (
        Index("idx_customer_conversions", "customer_id", "outcome", "outcome_date"),
        Index("idx_conversion_lead_id", "lead_id"),
    )


class Alert(Base):
    """Revenue signal alerts surfaced to sales reps"""
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)

    # Alert classification
    type = Column(String(50), nullable=False)      # stalled_deal|intent_spike|score_jump|daily_digest
    priority = Column(String(20), nullable=False)  # urgent|high|medium|low
    source = Column(String(50), nullable=False)    # salesforce|snitcher|clay|scoring|hubspot

    # Content
    headline = Column(String(500), nullable=False)
    context_json = Column(JSON, nullable=True)     # What triggered this alert
    recommendation = Column(Text, nullable=True)   # AI-generated action recommendation

    # State
    status = Column(String(20), nullable=False, default="pending")  # pending|snoozed|dismissed|actioned
    snoozed_until = Column(TIMESTAMP, nullable=True)
    external_ref = Column(String(255), nullable=True)  # SF opportunity ID etc.

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)
    actioned_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="alerts")
    lead = relationship("Lead", back_populates="alerts")
    actions = relationship("AlertAction", back_populates="alert", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_alert_customer_status", "customer_id", "status", "created_at"),
        Index("idx_alert_customer_type", "customer_id", "type"),
        Index("idx_alert_customer_priority", "customer_id", "priority", "status"),
        Index("idx_alert_lead_id", "lead_id"),
    )


class AlertAction(Base):
    """Actions taken on alerts (dismiss, snooze, add to sequence, create SF task)"""
    __tablename__ = "alert_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    action_type = Column(String(50), nullable=False)  # add_to_sequence|create_sf_task|dismiss|snooze
    payload = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending|completed|failed
    error_message = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    completed_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    alert = relationship("Alert", back_populates="actions")

    __table_args__ = (
        Index("idx_alert_actions_customer", "customer_id", "created_at"),
        Index("idx_alert_action_alert_id", "alert_id"),
    )


class SalesforceOpportunity(Base):
    """
    Synced CRM opportunities — used for pipeline view and AI context.
    Stores both real Salesforce deals (sf_...) and HubSpot deals (hs_... prefix).
    """
    __tablename__ = "salesforce_opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    sf_opportunity_id = Column(String(255), nullable=False)  # "hs_<id>" for HubSpot

    account_name = Column(String(255), nullable=True)
    amount = Column(BigInteger, nullable=True)
    stage = Column(String(100), nullable=True)
    close_date = Column(TIMESTAMP, nullable=True)
    owner_name = Column(String(255), nullable=True)
    last_activity_date = Column(TIMESTAMP, nullable=True)
    is_stalled = Column(Boolean, default=False, nullable=False)

    # P1.3 — opportunity health scoring
    health_score       = Column(Integer, nullable=True)   # 0-100 (100 = perfectly healthy)
    health_risk_flags  = Column(JSON, nullable=True)      # e.g. ["no_activity_14d", "no_close_date"]
    days_since_activity = Column(Integer, nullable=True)  # computed on every sync

    raw_data = Column(JSON, nullable=True)
    synced_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="sf_opportunities")

    __table_args__ = (
        Index("idx_sf_opp_customer_id", "customer_id", "sf_opportunity_id", unique=True),
        Index("idx_sf_opp_stalled", "customer_id", "is_stalled"),
        Index("idx_sf_opp_activity", "customer_id", "last_activity_date"),
    )


class SalesforceAccount(Base):
    """Synced Salesforce/HubSpot accounts for domain matching"""
    __tablename__ = "salesforce_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    sf_account_id = Column(String(255), nullable=False)  # "hs_<id>" for HubSpot companies

    name = Column(String(255), nullable=True)
    domain = Column(String(255), nullable=True)
    industry = Column(String(100), nullable=True)
    employee_count = Column(Integer, nullable=True)

    raw_data = Column(JSON, nullable=True)
    synced_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="sf_accounts")

    __table_args__ = (
        Index("idx_sf_acc_customer_id", "customer_id", "sf_account_id", unique=True),
        Index("idx_sf_acc_domain", "customer_id", "domain"),
    )


# ─────────────────────────────────────────────────────────
# AI / CHAT TABLES
# ─────────────────────────────────────────────────────────

class ChatSession(Base):
    """
    A single AI chat conversation.
    Groups multiple messages into a named conversation thread.
    Chat history is persisted so users can resume previous conversations.
    """
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(500), nullable=True)      # Auto-generated from first message
    message_count = Column(Integer, nullable=False, default=0)
    last_message_at = Column(TIMESTAMP, nullable=True)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session",
                            cascade="all, delete-orphan",
                            order_by="ChatMessage.created_at")

    __table_args__ = (
        Index("idx_chat_session_customer", "customer_id", "last_message_at"),
    )


class ChatMessage(Base):
    """
    A single message in a ChatSession.
    Stores both user questions and AI responses, including tool calls.
    """
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    role = Column(String(20), nullable=False)       # user | assistant
    content = Column(Text, nullable=False)          # Message text

    # AI metadata (assistant messages only)
    tool_calls = Column(JSON, nullable=True)        # Tools called by AI in this turn
    tokens_used = Column(Integer, nullable=True)    # Token count for cost tracking
    model = Column(String(100), nullable=True)      # e.g. claude-3-haiku-20240307

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        Index("idx_chat_message_session", "session_id", "created_at"),
        Index("idx_chat_message_customer", "customer_id", "created_at"),
    )


class AIAction(Base):
    """
    Log of every real action the AI has taken on behalf of a user.
    E.g. creating a HubSpot task, sending an email, updating a deal.
    Provides full audit trail of AI-driven operations.
    """
    __tablename__ = "ai_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    # Which chat triggered this action (optional — could also come from automation)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True)

    # What the AI did
    action_type = Column(String(100), nullable=False)   # create_hubspot_task | send_email | update_deal | etc.
    integration = Column(String(50), nullable=True)     # hubspot | salesforce | outreach | etc.

    # Input + Output
    inputs = Column(JSON, nullable=True)                # Parameters passed to the tool
    result = Column(JSON, nullable=True)                # Response from the integration API
    status = Column(String(20), nullable=False, default="success")  # success | failed | pending

    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="ai_actions")

    __table_args__ = (
        Index("idx_ai_action_customer", "customer_id", "created_at"),
        Index("idx_ai_action_type", "customer_id", "action_type"),
        Index("idx_ai_action_session", "session_id"),
    )


class WeeklyReport(Base):
    """
    AI-generated weekly sales report.
    One report per customer per week (keyed by the Monday of that week).
    Stores the raw data snapshot + three AI-written narrative sections.
    """
    __tablename__ = "weekly_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )

    # The Monday (00:00 UTC) this report covers (last 7 days from that date)
    week_start = Column(TIMESTAMP, nullable=False)
    generated_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Raw data used to generate the report (pipeline stats, tasks, alerts, etc.)
    data_snapshot = Column(JSON, nullable=True)

    # AI-generated markdown narrative sections
    section_what_happened = Column(Text, nullable=True)   # Hvad skete der
    section_this_week = Column(Text, nullable=True)       # Hvad skal der ske
    section_management = Column(Text, nullable=True)      # Sales management hjælp

    model_used = Column(String(100), nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="weekly_reports")

    __table_args__ = (
        Index("idx_weekly_report_customer", "customer_id", "week_start"),
    )


# ─────────────────────────────────────────────────────────
# WORKFLOWS
# ─────────────────────────────────────────────────────────

class Workflow(Base):
    """
    If-this-then-that automation rules.
    Each workflow has conditions (evaluated against leads/alerts)
    and actions (what happens when conditions are met).
    """
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active / paused

    # Trigger type determines WHEN this workflow evaluates
    # score_threshold  → runs after any lead is scored
    # alert_created    → runs when a new alert is created
    # manual           → run-on-demand only
    trigger_type = Column(String(50), nullable=False, default="manual")

    # Conditions: list of {field, op, value}
    # Supported fields: score, priority, source, industry
    # Supported ops: gt, lt, eq, neq, contains
    conditions = Column(JSON, nullable=False, default=list)

    # Actions: list of {type, params}
    # Supported types: create_alert, update_priority, log
    actions = Column(JSON, nullable=False, default=list)

    last_run = Column(TIMESTAMP, nullable=True)
    run_count = Column(Integer, nullable=False, default=0)

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    customer = relationship("Customer", back_populates="workflows")

    __table_args__ = (
        Index("idx_workflow_customer_status", "customer_id", "status"),
    )


class AISettings(Base):
    """
    Per-customer AI configuration: model choice, custom skills/instructions,
    and persona context injected into the system prompt on every chat turn.

    One row per customer — upsert on save.
    """
    __tablename__ = "ai_settings"

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Model selection — overrides ANTHROPIC_MODEL env var for this customer
    # Accepted values: claude-3-5-sonnet-20241022 | claude-3-opus-20240229 |
    #                  claude-3-5-haiku-20241022
    model = Column(String(100), nullable=True)

    # Skills: list of short instruction strings shown at top of system prompt
    # e.g. ["Respond only in Danish", "Our ICP: B2B SaaS 50-500 employees"]
    skills = Column(JSON, nullable=True, default=list)

    # Freeform company/sales context paragraph added to every prompt
    company_context = Column(Text, nullable=True)

    # Timestamps
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ─────────────────────────────────────────────────────────
# NOTION / CMT
# ─────────────────────────────────────────────────────────

class NotionInitiative(Base):
    """
    A single page/task synced from a Notion database.
    Used to power the CMT (C-level Management Team) dashboard.
    Each database represents a department; each page is an initiative/task.
    """
    __tablename__ = "notion_initiatives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Notion identifiers
    notion_page_id = Column(String(255), nullable=False)
    database_id = Column(String(255), nullable=True)
    database_name = Column(String(255), nullable=True)   # e.g. "Sales", "Marketing"

    # Mapped fields (heuristically extracted from Notion properties)
    title = Column(String(500), nullable=True)
    department = Column(String(255), nullable=True)       # database name or explicit property
    owner = Column(String(500), nullable=True)            # person name(s)
    status = Column(String(100), nullable=True)           # e.g. "In Progress", "Done"
    due_date = Column(TIMESTAMP, nullable=True)
    progress = Column(Integer, nullable=True)             # 0–100
    priority = Column(String(50), nullable=True)          # high / medium / low
    description = Column(Text, nullable=True)
    notion_url = Column(String(500), nullable=True)

    # Full extracted properties for display/debugging
    raw_properties = Column(JSON, nullable=True)

    synced_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="notion_initiatives")

    __table_args__ = (
        Index("idx_notion_customer_sync", "customer_id", "synced_at"),
        Index("idx_notion_page_unique", "customer_id", "notion_page_id", unique=True),
        Index("idx_notion_department", "customer_id", "department"),
    )


# ─────────────────────────────────────────────────────────
# GTM CONFIGURATION
# ─────────────────────────────────────────────────────────

class GTMConfig(Base):
    """
    Per-customer GTM (Go-To-Market) configuration.
    Stores sales strategy, ICP definition, and revenue goals.
    One row per customer — upsert on save (like AISettings).
    """
    __tablename__ = "gtm_configs"

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # ── Strategy ───────────────────────────────────────────
    company_description = Column(Text, nullable=True)     # Elevator pitch / what we do
    value_proposition   = Column(Text, nullable=True)     # Core differentiation
    # [{name, weakness, how_we_win}]
    competitors         = Column(JSON, nullable=True)
    # [{name, description, price_range}]
    offerings           = Column(JSON, nullable=True)

    # ── ICP ────────────────────────────────────────────────
    # {
    #   personas: [{title, department, pain_points}],
    #   company_filters: {
    #     industries: [str], employee_min: int, employee_max: int,
    #     geographies: [str], technologies: [str]
    #   },
    #   tam_total: int,
    #   tam_notes: str
    # }
    icp = Column(JSON, nullable=True)

    # ── Goals ──────────────────────────────────────────────
    # {
    #   period: "annual"|"quarterly",
    #   revenue_target: int,          # € / DKK amount
    #   acv: int,                     # average contract value
    #   win_rate_pct: float,          # 0–100
    #   opp_to_meeting_rate_pct: float,
    #   outreach_response_rate_pct: float,
    #   current_arr: int
    # }
    goals = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="gtm_config")


class ForecastSnapshot(Base):
    """Saved forecast snapshot for accuracy tracking.
    One row per manual snapshot save. months_data is a JSON array of
    { month, label, conservative, base, optimistic, count } dicts.
    Actuals are computed at query time from SalesforceOpportunity data.
    """
    __tablename__ = "forecast_snapshots"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    snapshot_date  = Column(Date, nullable=False)          # date snapshot was saved (today)
    revenue_target = Column(Numeric(15, 2), nullable=True) # target at time of snapshot (context)
    months_data    = Column(JSON, nullable=False)
    # [{ month:"2025-03", label:"Mar 25", conservative:X, base:Y, optimistic:Z, count:N }]

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="forecast_snapshots")


class IntegrationSyncState(Base):
    """
    Cursor-based incremental sync state.
    One row per (integration_id, object_type). Stores the last-seen cursor
    so each sync only fetches records changed since the previous run.

    object_type examples: "leads", "opportunities", "accounts", "deals", "companies"
    cursor examples: ISO timestamp string, page token, last-seen record ID
    """
    __tablename__ = "integration_sync_states"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False)
    customer_id    = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    object_type    = Column(String(50), nullable=False)   # e.g. "leads", "opportunities"
    cursor         = Column(String(500), nullable=True)   # last sync cursor / timestamp
    last_synced_at = Column(TIMESTAMP, nullable=True)     # when the last successful sync completed

    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_sync_state_integration_type", "integration_id", "object_type", unique=True),
        Index("idx_sync_state_customer", "customer_id"),
    )


class KpiSnapshot(Base):
    """
    Weekly KPI snapshot for plan-vs-actual and trend analysis.
    One row per (customer_id, snapshot_date). Taken every Monday by Celery beat.
    metrics JSON stores all pipeline/activity metrics for that week.
    """
    __tablename__ = "kpi_snapshots"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    snapshot_date = Column(Date, nullable=False)   # Monday the snapshot covers
    metrics       = Column(JSON, nullable=False)
    # {
    #   pipeline_value, open_deals, closed_won_value, closed_won_count,
    #   avg_deal_size, win_rate_pct, meetings_held, stalled_deals,
    #   leads_synced, hot_leads, warm_leads, cold_leads
    # }

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    customer = relationship("Customer", back_populates="kpi_snapshots")

    __table_args__ = (
        Index("idx_kpi_snapshot_customer_date", "customer_id", "snapshot_date", unique=True),
    )


# ─────────────────────────────────────────────────────────
# P1.1 — CANONICAL ACCOUNT MODEL
# ─────────────────────────────────────────────────────────

class Account(Base):
    """
    Canonical account entity — the single source of truth for a company.

    Deduplication key: (customer_id, domain). When domain is null, each
    source record creates its own Account (no cross-source merge possible
    without a domain).

    Populated by: Clay sync, HubSpot companies sync, Salesforce accounts sync.
    ICP score computed by compute_icp_score() on every upsert.
    """
    __tablename__ = "accounts"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    # ── Identity ───────────────────────────────────────────────────────────
    domain   = Column(String(255), nullable=True)   # canonical dedup key
    name     = Column(String(255), nullable=False)

    # ── Company attributes ─────────────────────────────────────────────────
    industry       = Column(String(100), nullable=True)
    employee_count = Column(Integer, nullable=True)
    revenue        = Column(BigInteger, nullable=True)
    location       = Column(String(255), nullable=True)
    website        = Column(String(500), nullable=True)
    linkedin_url   = Column(String(500), nullable=True)
    technologies   = Column(JSON, nullable=True)    # list of tech strings

    # ── ICP scoring (P1.2) ─────────────────────────────────────────────────
    icp_score = Column(Integer, nullable=True)       # 0–100, null = not yet scored
    icp_tier  = Column(String(1), nullable=True)     # A / B / C / D

    # ── CRM status (denormalised for fast queries) ─────────────────────────
    in_crm       = Column(Boolean, default=False, nullable=False)  # has SF/HubSpot record
    has_open_deal = Column(Boolean, default=False, nullable=False)  # has active opportunity

    # ── Sources that contributed to this account ───────────────────────────
    # e.g. ["clay", "hubspot"]  — denormalised list for quick filtering
    sources = Column(JSON, nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="accounts")
    account_sources = relationship("AccountSource", back_populates="account",
                                   cascade="all, delete-orphan")

    __table_args__ = (
        # Domain-based dedup: one canonical account per domain per customer.
        # The partial unique index lets multiple domain=NULL rows coexist.
        Index("idx_account_customer_domain", "customer_id", "domain", unique=True),
        Index("idx_account_icp_tier", "customer_id", "icp_tier"),
        Index("idx_account_has_open_deal", "customer_id", "has_open_deal"),
    )


class AccountSource(Base):
    """
    Junction table: tracks which source systems contributed data to an Account.
    One row per (account_id, source, external_id).
    Keeps the raw external ID so we can re-sync / update the canonical record.
    """
    __tablename__ = "account_sources"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id  = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    source      = Column(String(50), nullable=False)   # clay / salesforce / hubspot / snitcher
    external_id = Column(String(255), nullable=False)  # ID in the source system

    # Optional back-references to raw source rows
    lead_id     = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)

    synced_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    account = relationship("Account", back_populates="account_sources")

    __table_args__ = (
        Index("idx_acct_source_unique", "account_id", "source", "external_id", unique=True),
        Index("idx_acct_source_lookup", "customer_id", "source", "external_id"),
    )


# ─────────────────────────────────────────────────────────
# P1.5 — RECOMMENDATIONS
# ─────────────────────────────────────────────────────────

class Recommendation(Base):
    """
    Persisted, actionable recommendation for a sales rep or manager.

    Generated daily by the rule engine (compute_recommendations).
    Lifecycle: pending → actioned / dismissed / expired.
    Expired recs are those whose expires_at has passed without action.
    """
    __tablename__ = "recommendations"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    # ── Classification ─────────────────────────────────────────────────────
    rec_type = Column(String(50), nullable=False)
    # stalled_deal | closing_soon | rep_coaching | activate_account | coverage_gap

    priority = Column(String(20), nullable=False, default="medium")
    # urgent / high / medium / low

    # ── Content ────────────────────────────────────────────────────────────
    title       = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    # ── Target entity (at most one of these is set) ────────────────────────
    account_id       = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    sf_opp_id        = Column(String(255), nullable=True)   # SalesforceOpportunity.sf_opportunity_id
    owner_name       = Column(String(255), nullable=True)   # sales rep

    # ── Lifecycle ──────────────────────────────────────────────────────────
    status       = Column(String(20), nullable=False, default="pending")
    # pending / actioned / dismissed / expired

    generated_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    expires_at   = Column(TIMESTAMP, nullable=True)   # auto-expire after N days
    actioned_at  = Column(TIMESTAMP, nullable=True)
    created_at   = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at   = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="recommendations")

    __table_args__ = (
        Index("idx_rec_customer_status", "customer_id", "status", "created_at"),
        Index("idx_rec_customer_type", "customer_id", "rec_type"),
        Index("idx_rec_account", "account_id"),
    )


class CRMActivity(Base):
    """
    Logged CRM activity synced from HubSpot (engagements) or Salesforce (Task/Event).
    One row per engagement/task/event; deduped on (customer_id, source, external_id).

    activity_type values: call | email | meeting | task | note
    source values:        hubspot | salesforce
    """
    __tablename__ = "crm_activities"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    source      = Column(String(50),  nullable=False)              # "hubspot" | "salesforce"
    external_id = Column(String(255), nullable=False)              # engagement/task/event ID in source CRM

    activity_type = Column(String(50), nullable=True)              # call | email | meeting | task | note
    occurred_at   = Column(TIMESTAMP, nullable=True)               # when the activity happened
    owner_name    = Column(String(255), nullable=True)             # sales rep who logged it
    contact_name  = Column(String(255), nullable=True)             # contact the activity is about
    company_name  = Column(String(255), nullable=True)             # company / deal name
    subject       = Column(String(500), nullable=True)             # task subject / call title
    body          = Column(Text,        nullable=True)             # notes / description
    deal_id       = Column(String(255), nullable=True)             # sf_opportunity_id of linked deal

    synced_at  = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="crm_activities")

    __table_args__ = (
        Index("idx_crm_activity_customer",    "customer_id", "occurred_at"),
        Index("idx_crm_activity_dedup",       "customer_id", "source", "external_id", unique=True),
        Index("idx_crm_activity_owner",       "customer_id", "owner_name"),
        Index("idx_crm_activity_type",        "customer_id", "activity_type"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# P2.1  MULTI-USER
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    """
    Individual user within a Customer (organisation).

    Roles:
      owner   — full access + can delete org, cannot be removed
      admin   — full access + invite/remove members
      member  — read/write to all data (default)
      viewer  — read-only

    An invite starts with password_hash=NULL and invite_token set.
    Accepting the invite sets password_hash and clears invite_token.
    """
    __tablename__ = "users"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    email          = Column(String(255), nullable=False)
    name           = Column(String(255), nullable=True)
    password_hash  = Column(String(255), nullable=True)   # NULL until invite is accepted
    role           = Column(String(50),  nullable=False, default="member")  # owner|admin|member|viewer
    is_active      = Column(Boolean, nullable=False, default=True)
    invite_token   = Column(String(255), nullable=True, unique=True, index=True)
    invite_expires = Column(TIMESTAMP, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_users_customer_email", "customer_id", "email", unique=True),
    )

    customer = relationship("Customer", back_populates="users")
