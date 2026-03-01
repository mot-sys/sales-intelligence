"""
Database Models
SQLAlchemy ORM models for all database tables.
"""

from sqlalchemy import (
    Column, String, Integer, BigInteger, Text, Boolean, 
    ForeignKey, Index, CheckConstraint, TIMESTAMP, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


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


class Integration(Base):
    """External service connections"""
    __tablename__ = "integrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    
    # Integration details
    service = Column(String(50), nullable=False)  # clay/salesforce/snitcher/outreach
    status = Column(String(20), nullable=False, default="disconnected")  # connected/error/disconnected
    credentials = Column(JSON, nullable=False)  # Encrypted in production
    config = Column(JSON, nullable=True)
    
    # Sync settings
    last_sync = Column(TIMESTAMP, nullable=True)
    sync_frequency = Column(String(20), nullable=False, default="2h")  # 2h/6h/daily
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    customer = relationship("Customer", back_populates="integrations")
    
    # Constraints
    __table_args__ = (
        Index("idx_customer_service", "customer_id", "service", unique=True),
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
    source = Column(String(50), nullable=False)  # clay/salesforce/snitcher/outreach
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
    
    # Flexible metadata
    metadata = Column(JSON, nullable=True)
    
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
    )


class OutboundAction(Base):
    """Actions taken on leads"""
    __tablename__ = "outbound_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    
    action_type = Column(String(50), nullable=False)  # add_to_sequence/skip/manual_outreach
    sequence_id = Column(String(255), nullable=True)  # Outreach.io sequence ID
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
    source = Column(String(50), nullable=False)    # salesforce|snitcher|clay|scoring

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
    )


class SalesforceOpportunity(Base):
    """Synced Salesforce opportunities for stall detection"""
    __tablename__ = "salesforce_opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    sf_opportunity_id = Column(String(255), nullable=False)

    account_name = Column(String(255), nullable=True)
    amount = Column(BigInteger, nullable=True)
    stage = Column(String(100), nullable=True)
    close_date = Column(TIMESTAMP, nullable=True)
    owner_name = Column(String(255), nullable=True)
    last_activity_date = Column(TIMESTAMP, nullable=True)
    is_stalled = Column(Boolean, default=False, nullable=False)

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
    """Synced Salesforce accounts for domain matching"""
    __tablename__ = "salesforce_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    sf_account_id = Column(String(255), nullable=False)

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
