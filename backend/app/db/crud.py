"""
Database CRUD Operations
Async database operations for all models.
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

from sqlalchemy import select, func, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Lead, Signal, ScoringHistory, Customer, OutboundAction, Alert, AlertAction,
    SalesforceOpportunity, SalesforceAccount,
    ChatSession, ChatMessage, AIAction, IntegrationSyncLog, AISettings, WeeklyReport,
    NotionInitiative, IntegrationSyncState, KpiSnapshot,
    Account, AccountSource, Recommendation, GTMConfig, CRMActivity,
)


# ─────────────────────────────────────────────
# LEAD OPERATIONS
# ─────────────────────────────────────────────

async def get_leads(
    db: AsyncSession,
    customer_id: str,
    skip: int = 0,
    limit: int = 100,
    priority: Optional[str] = None,
    industry: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Lead]:
    """Get paginated leads for a customer with optional filters."""
    query = (
        select(Lead)
        .where(Lead.customer_id == customer_id)
        .options(selectinload(Lead.signals))
    )

    if priority:
        query = query.where(Lead.priority == priority)
    if industry:
        query = query.where(Lead.industry.ilike(f"%{industry}%"))
    if search:
        query = query.where(
            Lead.company_name.ilike(f"%{search}%")
            | Lead.contact_name.ilike(f"%{search}%")
        )

    query = query.order_by(Lead.score.desc(), Lead.updated_at.desc())
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


async def count_leads(
    db: AsyncSession,
    customer_id: str,
    priority: Optional[str] = None,
    industry: Optional[str] = None,
    search: Optional[str] = None,
) -> int:
    """Count leads matching filters."""
    query = select(func.count(Lead.id)).where(Lead.customer_id == customer_id)

    if priority:
        query = query.where(Lead.priority == priority)
    if industry:
        query = query.where(Lead.industry.ilike(f"%{industry}%"))
    if search:
        query = query.where(
            Lead.company_name.ilike(f"%{search}%")
            | Lead.contact_name.ilike(f"%{search}%")
        )

    return await db.scalar(query) or 0


async def get_lead(
    db: AsyncSession,
    lead_id: str,
    customer_id: str,
) -> Optional[Lead]:
    """Get a single lead with signals loaded."""
    result = await db.execute(
        select(Lead)
        .where(Lead.id == lead_id, Lead.customer_id == customer_id)
        .options(
            selectinload(Lead.signals),
            selectinload(Lead.scoring_history),
        )
    )
    return result.scalar_one_or_none()


async def create_lead(db: AsyncSession, lead_data: Dict) -> Lead:
    """Create a new lead. Returns the created lead."""
    lead = Lead(**lead_data)
    db.add(lead)
    await db.flush()
    await db.refresh(lead)
    return lead


async def get_lead_by_external_id(
    db: AsyncSession,
    external_id: str,
    customer_id: str,
    source: str,
) -> Optional[Lead]:
    """Look up a lead by external ID (e.g. Clay row ID)."""
    result = await db.execute(
        select(Lead).where(
            Lead.external_id == external_id,
            Lead.customer_id == customer_id,
            Lead.source == source,
        )
    )
    return result.scalar_one_or_none()


async def upsert_lead(
    db: AsyncSession,
    lead_data: Dict,
    customer_id: str,
    source: str,
    external_id: Optional[str] = None,
) -> Lead:
    """Create or update a lead (idempotent sync operation)."""
    if external_id:
        existing = await get_lead_by_external_id(db, external_id, customer_id, source)
        if existing:
            for key, value in lead_data.items():
                if value is not None:
                    setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            await db.flush()
            await db.refresh(existing)
            lead = existing
        else:
            lead = await create_lead(db, {**lead_data, "customer_id": customer_id, "source": source, "external_id": external_id})
    else:
        lead = await create_lead(db, {**lead_data, "customer_id": customer_id, "source": source, "external_id": external_id})

    # Generate embedding for semantic search (non-blocking — skip on error)
    try:
        from app.core.embeddings import embed_text, compose_lead_text
        text = compose_lead_text(lead)
        if text:
            emb = await embed_text(text)
            if emb:
                lead.embedding = emb
                await db.flush()
    except Exception as emb_err:
        logger.warning("Lead embedding failed (non-fatal): %s", emb_err)

    return lead


async def update_lead_score(
    db: AsyncSession,
    lead_id: str,
    score: int,
    priority: str,
    recommendation: str,
) -> Optional[Lead]:
    """Update lead score, priority, and recommendation."""
    await db.execute(
        update(Lead)
        .where(Lead.id == lead_id)
        .values(
            score=score,
            priority=priority,
            recommendation=recommendation,
            updated_at=datetime.utcnow(),
        )
    )
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    return result.scalar_one_or_none()


async def update_lead_priority(
    db: AsyncSession,
    lead_id: str,
    customer_id: str,
    priority: str,
) -> Optional[Lead]:
    """Manually override a lead's priority."""
    await db.execute(
        update(Lead)
        .where(Lead.id == lead_id, Lead.customer_id == customer_id)
        .values(priority=priority, updated_at=datetime.utcnow())
    )
    return await get_lead(db, lead_id, customer_id)


# ─────────────────────────────────────────────
# SIGNAL OPERATIONS
# ─────────────────────────────────────────────

async def create_signal(db: AsyncSession, signal_data: Dict) -> Signal:
    """Create a new signal."""
    signal = Signal(**signal_data)
    db.add(signal)
    await db.flush()
    await db.refresh(signal)
    return signal


async def get_signals_for_lead(
    db: AsyncSession,
    lead_id: str,
) -> List[Signal]:
    """Get all signals for a lead, most recent first."""
    result = await db.execute(
        select(Signal)
        .where(Signal.lead_id == lead_id)
        .order_by(Signal.detected_at.desc())
    )
    return result.scalars().all()


async def create_signals_bulk(
    db: AsyncSession,
    signals: List[Dict],
) -> List[Signal]:
    """Create multiple signals at once."""
    created = []
    for signal_data in signals:
        signal = Signal(**signal_data)
        db.add(signal)
        created.append(signal)
    await db.flush()
    return created


# ─────────────────────────────────────────────
# SCORING HISTORY
# ─────────────────────────────────────────────

async def save_scoring_history(
    db: AsyncSession,
    lead_id: str,
    customer_id: str,
    score: int,
    signals_present: List[Dict],
    model_version: str = "v1",
) -> ScoringHistory:
    """Save a scoring event for ML training data."""
    history = ScoringHistory(
        lead_id=lead_id,
        customer_id=customer_id,
        score=score,
        signals_present=signals_present,
        model_version=model_version,
    )
    db.add(history)
    await db.flush()
    return history


# ─────────────────────────────────────────────
# CUSTOMER OPERATIONS
# ─────────────────────────────────────────────

async def get_customer_by_email(db: AsyncSession, email: str) -> Optional[Customer]:
    """Look up a customer by email address."""
    result = await db.execute(select(Customer).where(Customer.email == email))
    return result.scalar_one_or_none()


async def create_customer(db: AsyncSession, name: str, email: str, hashed_password: str, plan: str = "starter") -> Customer:
    """Create a new customer account."""
    customer = Customer(name=name, email=email, password_hash=hashed_password, plan=plan)
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


# ─────────────────────────────────────────────
# ANALYTICS HELPERS
# ─────────────────────────────────────────────

async def get_lead_stats(db: AsyncSession, customer_id: str) -> Dict:
    """Get aggregate lead statistics for dashboard."""
    total = await db.scalar(
        select(func.count(Lead.id)).where(Lead.customer_id == customer_id)
    ) or 0

    hot = await db.scalar(
        select(func.count(Lead.id)).where(
            Lead.customer_id == customer_id, Lead.priority == "hot"
        )
    ) or 0

    warm = await db.scalar(
        select(func.count(Lead.id)).where(
            Lead.customer_id == customer_id, Lead.priority == "warm"
        )
    ) or 0

    avg_score = await db.scalar(
        select(func.avg(Lead.score)).where(Lead.customer_id == customer_id)
    ) or 0

    active_signals = await db.scalar(
        select(func.count(Signal.id)).where(Signal.customer_id == customer_id)
    ) or 0

    return {
        "total_leads": total,
        "hot_leads": hot,
        "warm_leads": warm,
        "cold_leads": total - hot - warm,
        "average_score": round(float(avg_score), 1),
        "active_signals": active_signals,
    }


async def get_signal_breakdown(db: AsyncSession, customer_id: str) -> Dict:
    """Count signals by type."""
    result = await db.execute(
        select(Signal.type, func.count(Signal.id).label("count"))
        .where(Signal.customer_id == customer_id)
        .group_by(Signal.type)
    )
    rows = result.all()
    counts = {row.type: row.count for row in rows}
    return {
        "funding": counts.get("funding", 0),
        "hiring": counts.get("hiring", 0),
        "tech_change": counts.get("tech_change", 0),
        "intent": counts.get("intent", 0),
        "content": counts.get("content", 0),
    }


# ─────────────────────────────────────────────
# ALERT OPERATIONS
# ─────────────────────────────────────────────

async def get_alerts(
    db: AsyncSession,
    customer_id: str,
    status: Optional[str] = None,
    alert_type: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[Alert]:
    """Get paginated alerts for a customer with optional filters."""
    query = (
        select(Alert)
        .where(Alert.customer_id == customer_id)
        .options(selectinload(Alert.lead))
    )
    if status:
        query = query.where(Alert.status == status)
    if alert_type:
        query = query.where(Alert.type == alert_type)
    if priority:
        query = query.where(Alert.priority == priority)

    query = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_alert(db: AsyncSession, alert_id: str, customer_id: str) -> Optional[Alert]:
    """Get a single alert by ID."""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def create_alert(
    db: AsyncSession,
    customer_id: str,
    alert_type: str,
    priority: str,
    source: str,
    headline: str,
    context_json: Optional[Dict] = None,
    recommendation: Optional[str] = None,
    lead_id: Optional[str] = None,
    external_ref: Optional[str] = None,
) -> Optional[Alert]:
    """Create an alert with 24h dedup: same type+lead won't alert twice in 24h."""
    from datetime import timedelta
    if lead_id:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        existing = await db.scalar(
            select(Alert).where(
                Alert.customer_id == customer_id,
                Alert.lead_id == lead_id,
                Alert.type == alert_type,
                Alert.created_at >= cutoff,
                Alert.status != "dismissed",
            )
        )
        if existing:
            return None  # Dedup: already alerted

    alert = Alert(
        customer_id=customer_id,
        lead_id=lead_id,
        type=alert_type,
        priority=priority,
        source=source,
        headline=headline,
        context_json=context_json,
        recommendation=recommendation,
        external_ref=external_ref,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return alert


async def update_alert_status(
    db: AsyncSession,
    alert_id: str,
    status: str,
    snoozed_until: Optional[datetime] = None,
    actioned_at: Optional[datetime] = None,
) -> Optional[Alert]:
    """Update alert status (pending→dismissed/snoozed/actioned)."""
    values: Dict = {"status": status, "updated_at": datetime.utcnow()}
    if snoozed_until:
        values["snoozed_until"] = snoozed_until
    if actioned_at:
        values["actioned_at"] = actioned_at

    await db.execute(update(Alert).where(Alert.id == alert_id).values(**values))
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    return result.scalar_one_or_none()


async def get_alert_stats(db: AsyncSession, customer_id: str) -> Dict:
    """Get alert counts by status and priority for dashboard widget."""
    # Count by status
    status_rows = await db.execute(
        select(Alert.status, func.count(Alert.id).label("count"))
        .where(Alert.customer_id == customer_id)
        .group_by(Alert.status)
    )
    by_status = {row.status: row.count for row in status_rows}

    # Count urgent+high pending
    urgent = await db.scalar(
        select(func.count(Alert.id)).where(
            Alert.customer_id == customer_id,
            Alert.status == "pending",
            Alert.priority.in_(["urgent", "high"]),
        )
    ) or 0

    return {
        "pending": by_status.get("pending", 0),
        "snoozed": by_status.get("snoozed", 0),
        "dismissed": by_status.get("dismissed", 0),
        "actioned": by_status.get("actioned", 0),
        "urgent_high_pending": urgent,
    }


async def create_alert_action(
    db: AsyncSession,
    alert_id: str,
    customer_id: str,
    action_type: str,
    payload: Optional[Dict] = None,
) -> AlertAction:
    """Record an action taken on an alert."""
    action = AlertAction(
        alert_id=alert_id,
        customer_id=customer_id,
        action_type=action_type,
        payload=payload,
    )
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return action


async def update_alert_action_status(
    db: AsyncSession,
    action_id: str,
    status: str,
    error_message: Optional[str] = None,
) -> None:
    """Update AlertAction status after execution."""
    values: Dict = {"status": status}
    if status == "completed":
        values["completed_at"] = datetime.utcnow()
    if error_message:
        values["error_message"] = error_message
    await db.execute(update(AlertAction).where(AlertAction.id == action_id).values(**values))


# ─────────────────────────────────────────────
# SALESFORCE OPERATIONS
# ─────────────────────────────────────────────

async def upsert_sf_opportunity(
    db: AsyncSession,
    customer_id: str,
    sf_id: str,
    data: Dict,
) -> SalesforceOpportunity:
    """Create or update a Salesforce opportunity record."""
    result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.sf_opportunity_id == sf_id,
        )
    )
    opp = result.scalar_one_or_none()
    if opp:
        for k, v in data.items():
            setattr(opp, k, v)
        opp.synced_at = datetime.utcnow()
    else:
        opp = SalesforceOpportunity(
            customer_id=customer_id,
            sf_opportunity_id=sf_id,
            synced_at=datetime.utcnow(),
            **data,
        )
        db.add(opp)
    await db.flush()
    await db.refresh(opp)

    # Generate embedding for semantic search (non-blocking — skip on error)
    try:
        from app.core.embeddings import embed_text, compose_opportunity_text
        text = compose_opportunity_text(opp)
        if text:
            emb = await embed_text(text)
            if emb:
                opp.embedding = emb
                await db.flush()
    except Exception as emb_err:
        logger.warning("Opportunity embedding failed (non-fatal): %s", emb_err)

    return opp


async def upsert_sf_account(
    db: AsyncSession,
    customer_id: str,
    sf_id: str,
    data: Dict,
) -> SalesforceAccount:
    """Create or update a Salesforce account record."""
    result = await db.execute(
        select(SalesforceAccount).where(
            SalesforceAccount.customer_id == customer_id,
            SalesforceAccount.sf_account_id == sf_id,
        )
    )
    acc = result.scalar_one_or_none()
    if acc:
        for k, v in data.items():
            setattr(acc, k, v)
        acc.synced_at = datetime.utcnow()
    else:
        acc = SalesforceAccount(
            customer_id=customer_id,
            sf_account_id=sf_id,
            synced_at=datetime.utcnow(),
            **data,
        )
        db.add(acc)
    await db.flush()
    await db.refresh(acc)
    return acc


async def get_stale_opportunities(
    db: AsyncSession,
    customer_id: str,
    days: int = 7,
) -> List[SalesforceOpportunity]:
    """Return open opportunities with no activity in `days` days."""
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            or_(
                SalesforceOpportunity.last_activity_date < cutoff,
                SalesforceOpportunity.last_activity_date.is_(None),
            ),
        )
    )
    return result.scalars().all()


async def get_all_active_customers(db: AsyncSession) -> List[Customer]:
    """Get all customer rows (used for tasks that run for every org)."""
    result = await db.execute(select(Customer))
    return result.scalars().all()


async def get_customers_with_integration(
    db: AsyncSession,
    service: str,
) -> List[Customer]:
    """Get all customers that have a connected integration for a given service."""
    from app.db.models import Integration
    result = await db.execute(
        select(Customer)
        .join(Integration, and_(
            Integration.customer_id == Customer.id,
            Integration.service == service,
            Integration.status == "connected",
        ))
    )
    return result.scalars().all()


# ─────────────────────────────────────────────
# CHAT SESSION & MESSAGE OPERATIONS
# ─────────────────────────────────────────────

async def create_chat_session(
    db: AsyncSession,
    customer_id: str,
    title: Optional[str] = None,
) -> ChatSession:
    """Create a new chat session for a customer."""
    session = ChatSession(
        customer_id=customer_id,
        title=title,
        message_count=0,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_chat_sessions(
    db: AsyncSession,
    customer_id: str,
    limit: int = 20,
) -> List[ChatSession]:
    """Get recent chat sessions for a customer, newest first."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.customer_id == customer_id)
        .order_by(ChatSession.last_message_at.desc().nullslast())
        .limit(limit)
    )
    return result.scalars().all()


async def get_chat_session(
    db: AsyncSession,
    session_id: str,
    customer_id: str,
) -> Optional[ChatSession]:
    """Get a single chat session by ID (scoped to customer)."""
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.id == session_id,
            ChatSession.customer_id == customer_id,
        )
        .options(selectinload(ChatSession.messages))
    )
    return result.scalar_one_or_none()


async def add_chat_message(
    db: AsyncSession,
    session_id: str,
    customer_id: str,
    role: str,
    content: str,
    tool_calls: Optional[List] = None,
    tokens_used: Optional[int] = None,
    model: Optional[str] = None,
) -> ChatMessage:
    """
    Add a message to a chat session and update session metadata.
    Also auto-generates a session title from the first user message.
    """
    msg = ChatMessage(
        session_id=session_id,
        customer_id=customer_id,
        role=role,
        content=content,
        tool_calls=tool_calls,
        tokens_used=tokens_used,
        model=model,
    )
    db.add(msg)

    # Update session metadata
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(
            message_count=ChatSession.message_count + 1,
            last_message_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )

    # Auto-title: use first user message (truncated)
    if role == "user":
        session = await db.scalar(select(ChatSession).where(ChatSession.id == session_id))
        if session and not session.title:
            title = content[:80] + ("…" if len(content) > 80 else "")
            await db.execute(
                update(ChatSession)
                .where(ChatSession.id == session_id)
                .values(title=title)
            )

    await db.flush()
    await db.refresh(msg)
    return msg


async def get_chat_messages(
    db: AsyncSession,
    session_id: str,
    customer_id: str,
    limit: int = 50,
) -> List[ChatMessage]:
    """Get messages for a chat session, oldest first."""
    result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.session_id == session_id,
            ChatMessage.customer_id == customer_id,
        )
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


# ─────────────────────────────────────────────
# AI ACTION LOG
# ─────────────────────────────────────────────

async def log_ai_action(
    db: AsyncSession,
    customer_id: str,
    action_type: str,
    inputs: Optional[Dict] = None,
    result: Optional[Dict] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    integration: Optional[str] = None,
    session_id: Optional[str] = None,
    message_id: Optional[str] = None,
) -> AIAction:
    """
    Log an AI-executed action (e.g. creating a HubSpot task).
    Call this whenever the AI uses a tool that takes a real-world action.
    """
    action = AIAction(
        customer_id=customer_id,
        action_type=action_type,
        integration=integration,
        inputs=inputs,
        result=result,
        status=status,
        error_message=error_message,
        session_id=session_id,
        message_id=message_id,
    )
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return action


async def get_ai_actions(
    db: AsyncSession,
    customer_id: str,
    limit: int = 50,
    action_type: Optional[str] = None,
) -> List[AIAction]:
    """Get recent AI actions for a customer."""
    query = (
        select(AIAction)
        .where(AIAction.customer_id == customer_id)
        .order_by(AIAction.created_at.desc())
        .limit(limit)
    )
    if action_type:
        query = query.where(AIAction.action_type == action_type)
    result = await db.execute(query)
    return result.scalars().all()


# ─────────────────────────────────────────────
# INTEGRATION SYNC LOGS
# ─────────────────────────────────────────────

async def log_integration_sync(
    db: AsyncSession,
    integration_id: str,
    customer_id: str,
    service: str,
    status: str,
    records_synced: int = 0,
    records_created: int = 0,
    records_updated: int = 0,
    records_failed: int = 0,
    duration_ms: Optional[int] = None,
    error_summary: Optional[str] = None,
    errors: Optional[List] = None,
) -> IntegrationSyncLog:
    """Record the outcome of an integration sync."""
    log = IntegrationSyncLog(
        integration_id=integration_id,
        customer_id=customer_id,
        service=service,
        status=status,
        records_synced=records_synced,
        records_created=records_created,
        records_updated=records_updated,
        records_failed=records_failed,
        duration_ms=duration_ms,
        error_summary=error_summary,
        errors=errors,
        completed_at=datetime.utcnow(),
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


async def get_integration_sync_logs(
    db: AsyncSession,
    customer_id: str,
    service: Optional[str] = None,
    limit: int = 20,
) -> List[IntegrationSyncLog]:
    """Get recent sync logs, optionally filtered by service."""
    query = (
        select(IntegrationSyncLog)
        .where(IntegrationSyncLog.customer_id == customer_id)
        .order_by(IntegrationSyncLog.started_at.desc())
        .limit(limit)
    )
    if service:
        query = query.where(IntegrationSyncLog.service == service)
    result = await db.execute(query)
    return result.scalars().all()


# ─────────────────────────────────────────────
# AI SETTINGS CRUD
# ─────────────────────────────────────────────

async def get_ai_settings(db: AsyncSession, customer_id: str) -> Optional[AISettings]:
    """Return the AI settings row for this customer, or None if not configured yet."""
    result = await db.execute(
        select(AISettings).where(AISettings.customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def upsert_ai_settings(
    db: AsyncSession,
    customer_id: str,
    model: Optional[str] = None,
    skills: Optional[list] = None,
    company_context: Optional[str] = None,
) -> AISettings:
    """
    Create or fully replace the AI settings for this customer.
    All fields are replaced — pass existing values to keep them unchanged.
    """
    existing = await get_ai_settings(db, customer_id)
    if existing:
        existing.model = model
        existing.skills = skills or []
        existing.company_context = company_context
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        row = AISettings(
            customer_id=customer_id,
            model=model,
            skills=skills or [],
            company_context=company_context,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row


# ─────────────────────────────────────────────
# WEEKLY REPORT CRUD
# ─────────────────────────────────────────────

async def get_latest_weekly_report(
    db: AsyncSession,
    customer_id: str,
) -> Optional[WeeklyReport]:
    """Return the most recently generated weekly report for this customer."""
    result = await db.execute(
        select(WeeklyReport)
        .where(WeeklyReport.customer_id == customer_id)
        .order_by(WeeklyReport.generated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def save_weekly_report(
    db: AsyncSession,
    customer_id: str,
    week_start: datetime,
    data_snapshot: Optional[Dict] = None,
    section_what_happened: Optional[str] = None,
    section_this_week: Optional[str] = None,
    section_management: Optional[str] = None,
    model_used: Optional[str] = None,
) -> WeeklyReport:
    """
    Upsert the weekly report for a given week_start.
    If a report already exists for this customer+week_start, it is replaced.
    """
    existing = await db.scalar(
        select(WeeklyReport).where(
            WeeklyReport.customer_id == customer_id,
            WeeklyReport.week_start == week_start,
        )
    )
    if existing:
        existing.generated_at = datetime.utcnow()
        existing.data_snapshot = data_snapshot
        existing.section_what_happened = section_what_happened
        existing.section_this_week = section_this_week
        existing.section_management = section_management
        existing.model_used = model_used
        await db.commit()
        await db.refresh(existing)
        return existing

    report = WeeklyReport(
        customer_id=customer_id,
        week_start=week_start,
        data_snapshot=data_snapshot,
        section_what_happened=section_what_happened,
        section_this_week=section_this_week,
        section_management=section_management,
        model_used=model_used,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


# ─────────────────────────────────────────────
# NOTION / CMT CRUD
# ─────────────────────────────────────────────

async def upsert_notion_initiative(
    db: AsyncSession,
    customer_id: str,
    data: Dict,
) -> NotionInitiative:
    """
    Create or update a NotionInitiative by notion_page_id.
    `data` should contain the mapped fields from NotionIntegration._map_page().
    """
    page_id = data.get("notion_page_id")
    existing = await db.scalar(
        select(NotionInitiative).where(
            NotionInitiative.customer_id == customer_id,
            NotionInitiative.notion_page_id == page_id,
        )
    )
    if existing:
        for k, v in data.items():
            if hasattr(existing, k):
                setattr(existing, k, v)
        existing.synced_at = datetime.utcnow()
        await db.flush()
        await db.refresh(existing)
        return existing

    initiative = NotionInitiative(
        customer_id=customer_id,
        synced_at=datetime.utcnow(),
        **{k: v for k, v in data.items() if hasattr(NotionInitiative, k)},
    )
    db.add(initiative)
    await db.flush()
    await db.refresh(initiative)
    return initiative


async def get_notion_initiatives(
    db: AsyncSession,
    customer_id: str,
    department: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
) -> List[NotionInitiative]:
    """Get notion initiatives for a customer, optionally filtered."""
    query = (
        select(NotionInitiative)
        .where(NotionInitiative.customer_id == customer_id)
        .order_by(NotionInitiative.due_date.asc().nullslast())
        .limit(limit)
    )
    if department:
        query = query.where(NotionInitiative.department.ilike(f"%{department}%"))
    if status:
        query = query.where(NotionInitiative.status.ilike(f"%{status}%"))
    result = await db.execute(query)
    return result.scalars().all()


async def delete_notion_initiatives_for_database(
    db: AsyncSession,
    customer_id: str,
    database_id: str,
) -> int:
    """Delete all initiatives for a specific Notion database (used before re-sync)."""
    from sqlalchemy import delete as sa_delete
    result = await db.execute(
        sa_delete(NotionInitiative).where(
            NotionInitiative.customer_id == customer_id,
            NotionInitiative.database_id == database_id,
        )
    )
    return result.rowcount


# ─────────────────────────────────────────────
# INCREMENTAL SYNC — cursor management
# ─────────────────────────────────────────────

async def get_sync_cursor(
    db: AsyncSession,
    integration_id: str,
    object_type: str,
) -> Optional[str]:
    """Return the last-saved sync cursor for a (integration, object_type) pair, or None."""
    row = await db.scalar(
        select(IntegrationSyncState).where(
            IntegrationSyncState.integration_id == integration_id,
            IntegrationSyncState.object_type == object_type,
        )
    )
    return row.cursor if row else None


async def save_sync_cursor(
    db: AsyncSession,
    integration_id: str,
    customer_id: str,
    object_type: str,
    cursor: str,
) -> None:
    """Upsert the sync cursor for a (integration, object_type) pair."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = (
        pg_insert(IntegrationSyncState)
        .values(
            id=uuid.uuid4(),
            integration_id=integration_id,
            customer_id=customer_id,
            object_type=object_type,
            cursor=cursor,
            last_synced_at=datetime.utcnow(),
        )
        .on_conflict_do_update(
            index_elements=["integration_id", "object_type"],
            set_={"cursor": cursor, "last_synced_at": datetime.utcnow()},
        )
    )
    await db.execute(stmt)


# ─────────────────────────────────────────────
# KPI SNAPSHOTS
# ─────────────────────────────────────────────

async def upsert_kpi_snapshot(
    db: AsyncSession,
    customer_id: str,
    snapshot_date,
    metrics: dict,
) -> KpiSnapshot:
    """
    Insert or replace a KPI snapshot for (customer_id, snapshot_date).
    Uses PostgreSQL INSERT ... ON CONFLICT DO UPDATE so re-running on the same
    Monday only updates the row rather than erroring.
    """
    import uuid as _uuid
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = (
        pg_insert(KpiSnapshot)
        .values(
            id=_uuid.uuid4(),
            customer_id=customer_id,
            snapshot_date=snapshot_date,
            metrics=metrics,
        )
        .on_conflict_do_update(
            index_elements=["customer_id", "snapshot_date"],
            set_={"metrics": metrics},
        )
        .returning(KpiSnapshot)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()


async def get_kpi_snapshots(
    db: AsyncSession,
    customer_id: str,
    limit: int = 12,
) -> List[KpiSnapshot]:
    """Return the most recent N KPI snapshots, newest first."""
    rows = await db.execute(
        select(KpiSnapshot)
        .where(KpiSnapshot.customer_id == customer_id)
        .order_by(KpiSnapshot.snapshot_date.desc())
        .limit(limit)
    )
    return list(rows.scalars().all())


# ─────────────────────────────────────────────────────────
# P1.1  CANONICAL ACCOUNT CRUD
# ─────────────────────────────────────────────────────────

async def get_account_by_domain(
    db: AsyncSession,
    customer_id: str,
    domain: str,
) -> Optional[Account]:
    """Look up an account by domain (the canonical dedup key)."""
    return await db.scalar(
        select(Account).where(
            Account.customer_id == customer_id,
            Account.domain == domain,
        )
    )


async def upsert_account(
    db: AsyncSession,
    customer_id: str,
    *,
    name: str,
    domain: Optional[str] = None,
    industry: Optional[str] = None,
    employee_count: Optional[int] = None,
    revenue: Optional[int] = None,
    location: Optional[str] = None,
    website: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    technologies: Optional[list] = None,
    in_crm: bool = False,
    source: Optional[str] = None,
) -> Account:
    """
    Create or update a canonical Account.

    Dedup logic:
      - If domain is provided → look for existing account with same domain.
      - If no match (or no domain) → create a new Account.

    After upsert the ICP score is (re)computed from the customer's GTMConfig.
    """
    account: Optional[Account] = None
    if domain:
        account = await get_account_by_domain(db, customer_id, domain)

    if account:
        # Merge: keep most informative value (non-null wins)
        account.name = name or account.name
        account.industry = industry or account.industry
        account.employee_count = employee_count or account.employee_count
        account.revenue = revenue or account.revenue
        account.location = location or account.location
        account.website = website or account.website
        account.linkedin_url = linkedin_url or account.linkedin_url
        if technologies:
            account.technologies = technologies
        if in_crm:
            account.in_crm = True
        # Merge source list
        existing_sources: list = account.sources or []
        if source and source not in existing_sources:
            existing_sources.append(source)
            account.sources = existing_sources
    else:
        account = Account(
            customer_id=customer_id,
            domain=domain,
            name=name,
            industry=industry,
            employee_count=employee_count,
            revenue=revenue,
            location=location,
            website=website,
            linkedin_url=linkedin_url,
            technologies=technologies,
            in_crm=in_crm,
            sources=[source] if source else [],
        )
        db.add(account)
        await db.flush()

    # P1.2 — recompute ICP score immediately
    gtm = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == customer_id))
    score, tier = compute_icp_score(account, gtm)
    account.icp_score = score
    account.icp_tier = tier

    await db.flush()
    await db.refresh(account)

    # Generate embedding for semantic search (non-blocking — skip on error)
    try:
        from app.core.embeddings import embed_text, compose_account_text
        text = compose_account_text(account)
        if text:
            emb = await embed_text(text)
            if emb:
                account.embedding = emb
                await db.flush()
    except Exception as emb_err:
        logger.warning("Account embedding failed (non-fatal): %s", emb_err)

    return account


async def upsert_account_source(
    db: AsyncSession,
    account_id,
    customer_id: str,
    source: str,
    external_id: str,
    lead_id=None,
) -> AccountSource:
    """Record a source system row that contributed to this Account."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = (
        pg_insert(AccountSource)
        .values(
            id=uuid.uuid4(),
            account_id=account_id,
            customer_id=customer_id,
            source=source,
            external_id=external_id,
            lead_id=lead_id,
            synced_at=datetime.utcnow(),
        )
        .on_conflict_do_update(
            index_elements=["account_id", "source", "external_id"],
            set_={"synced_at": datetime.utcnow()},
        )
    )
    await db.execute(stmt)


async def get_accounts(
    db: AsyncSession,
    customer_id: str,
    icp_tier: Optional[str] = None,
    has_open_deal: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Account]:
    """List canonical accounts for a customer with optional filters."""
    q = select(Account).where(Account.customer_id == customer_id)
    if icp_tier:
        q = q.where(Account.icp_tier == icp_tier)
    if has_open_deal is not None:
        q = q.where(Account.has_open_deal == has_open_deal)
    if search:
        q = q.where(Account.name.ilike(f"%{search}%"))
    q = q.order_by(Account.icp_score.desc().nullslast(), Account.name.asc())
    q = q.offset(skip).limit(limit)
    return list((await db.execute(q)).scalars().all())


async def get_account(
    db: AsyncSession,
    account_id: str,
    customer_id: str,
) -> Optional[Account]:
    """Get a single account by ID."""
    return await db.scalar(
        select(Account).where(
            Account.id == account_id,
            Account.customer_id == customer_id,
        )
    )


async def refresh_account_deal_flag(
    db: AsyncSession,
    customer_id: str,
    account_name: str,
) -> None:
    """
    After a sync, update Account.has_open_deal for the account that matches
    account_name. Called after each opportunity upsert.
    """
    # Find any open (non-closed) opportunities for this account_name
    open_stages = ("Closed Won", "Closed Lost")
    has_deal = await db.scalar(
        select(func.count(SalesforceOpportunity.id)).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.account_name == account_name,
            SalesforceOpportunity.stage.notin_(open_stages),
        )
    ) or 0

    # Find the account by domain heuristic: match on name
    acct = await db.scalar(
        select(Account).where(
            Account.customer_id == customer_id,
            Account.name.ilike(account_name),
        )
    )
    if acct:
        acct.has_open_deal = has_deal > 0
        await db.flush()


# ─────────────────────────────────────────────────────────
# P1.2  ICP SCORING  (pure function — no DB I/O)
# ─────────────────────────────────────────────────────────

def compute_icp_score(account: Account, gtm: Optional[GTMConfig]) -> tuple[int, str]:
    """
    Compute an ICP fit score (0–100) and tier (A/B/C/D) for an Account
    based on the customer's GTMConfig.icp criteria.

    Scoring weights:
      - Industry match          25 pts
      - Employee count in range 25 pts
      - Geography match         20 pts
      - Technology match        20 pts
      - Revenue fit             10 pts

    Returns (score, tier).  Tier: A ≥ 75 | B ≥ 50 | C ≥ 25 | D < 25.
    If GTMConfig or icp is not set, returns (None, None).
    """
    if not gtm or not gtm.icp:
        return (None, None)

    icp = gtm.icp
    filters = icp.get("company_filters") or {}
    score = 0

    # ── Industry ──────────────────────────────────────────────────────────
    industries: list = filters.get("industries") or []
    if industries and account.industry:
        for ind in industries:
            if ind.lower() in (account.industry or "").lower():
                score += 25
                break
    elif not industries:
        score += 25   # no filter = all industries qualify

    # ── Employee count ────────────────────────────────────────────────────
    emp_min = filters.get("employee_min")
    emp_max = filters.get("employee_max")
    emp = account.employee_count
    if emp_min is None and emp_max is None:
        score += 25   # no filter
    elif emp is not None:
        in_range = (emp_min is None or emp >= emp_min) and \
                   (emp_max is None or emp <= emp_max)
        if in_range:
            score += 25
        elif emp_min and emp < emp_min * 0.5:
            score += 0   # way too small
        elif emp_max and emp > emp_max * 2:
            score += 0   # way too big
        else:
            score += 10  # partial fit

    # ── Geography ─────────────────────────────────────────────────────────
    geos: list = filters.get("geographies") or []
    if not geos:
        score += 20
    elif account.location:
        loc_lower = (account.location or "").lower()
        if any(g.lower() in loc_lower for g in geos):
            score += 20

    # ── Technologies ──────────────────────────────────────────────────────
    tech_required: list = filters.get("technologies") or []
    if not tech_required:
        score += 20
    elif account.technologies:
        acct_tech = [t.lower() for t in (account.technologies or [])]
        if any(t.lower() in acct_tech for t in tech_required):
            score += 20

    # ── Revenue fit (bonus) ───────────────────────────────────────────────
    acv = (gtm.goals or {}).get("acv") or 0
    if acv and account.revenue:
        # Companies with >10× ACV revenue tend to be good fits
        if account.revenue >= acv * 10:
            score += 10
        elif account.revenue >= acv * 3:
            score += 5

    score = min(100, score)
    if score >= 75:
        tier = "A"
    elif score >= 50:
        tier = "B"
    elif score >= 25:
        tier = "C"
    else:
        tier = "D"
    return (score, tier)


# ─────────────────────────────────────────────────────────
# P1.3  OPPORTUNITY HEALTH SCORING  (pure function)
# ─────────────────────────────────────────────────────────

def score_opportunity_health(opp: SalesforceOpportunity) -> tuple[int, list, int]:
    """
    Compute a health score (0–100), list of risk flags, and days_since_activity
    for a SalesforceOpportunity.

    Scoring (starts at 100, deductions applied):
      -30  no activity in 14+ days
      -20  no close date set
      -20  amount is 0 or missing
      -10  stage is stalled / stuck in early stage >30 days
      -10  close date is in the past (overdue)
      -10  no activity ever recorded

    Returns (health_score, risk_flags, days_since_activity).
    """
    from datetime import timedelta
    now = datetime.utcnow()
    score = 100
    flags: list[str] = []

    # Days since last activity
    if opp.last_activity_date:
        delta = now - opp.last_activity_date.replace(tzinfo=None) if hasattr(opp.last_activity_date, 'tzinfo') else now - opp.last_activity_date
        days_inactive = max(0, delta.days)
    else:
        days_inactive = 999  # never recorded

    if days_inactive >= 14:
        score -= 30
        flags.append("no_activity_14d")
    elif days_inactive == 999:
        score -= 10
        flags.append("no_activity_ever")

    # Close date checks
    if not opp.close_date:
        score -= 20
        flags.append("no_close_date")
    else:
        cd = opp.close_date.replace(tzinfo=None) if hasattr(opp.close_date, 'tzinfo') else opp.close_date
        if cd < now:
            score -= 10
            flags.append("close_date_overdue")

    # Amount check
    if not opp.amount or opp.amount == 0:
        score -= 20
        flags.append("missing_amount")

    # Stalled flag already computed
    if opp.is_stalled:
        score -= 10
        flags.append("stalled")

    return (max(0, score), flags, days_inactive if days_inactive < 999 else None)


async def update_opp_health(
    db: AsyncSession,
    opp: SalesforceOpportunity,
) -> SalesforceOpportunity:
    """Compute and persist health score for a single opportunity."""
    health_score, flags, days = score_opportunity_health(opp)
    opp.health_score = health_score
    opp.health_risk_flags = flags
    opp.days_since_activity = days
    await db.flush()
    return opp


# ─────────────────────────────────────────────────────────
# P1.5  RECOMMENDATIONS CRUD
# ─────────────────────────────────────────────────────────

async def get_recommendations(
    db: AsyncSession,
    customer_id: str,
    status: Optional[str] = "pending",
    rec_type: Optional[str] = None,
    limit: int = 50,
) -> List[Recommendation]:
    """List recommendations for a customer."""
    q = (
        select(Recommendation)
        .where(Recommendation.customer_id == customer_id)
        .order_by(
            # urgent/high first, then by generated_at
            Recommendation.priority.in_(["urgent", "high"]).desc(),
            Recommendation.generated_at.desc(),
        )
        .limit(limit)
    )
    if status:
        q = q.where(Recommendation.status == status)
    if rec_type:
        q = q.where(Recommendation.rec_type == rec_type)
    return list((await db.execute(q)).scalars().all())


async def upsert_recommendation(
    db: AsyncSession,
    customer_id: str,
    *,
    rec_type: str,
    title: str,
    description: Optional[str] = None,
    priority: str = "medium",
    account_id=None,
    sf_opp_id: Optional[str] = None,
    owner_name: Optional[str] = None,
    expires_at=None,
) -> Recommendation:
    """
    Create a new Recommendation.  De-duplication: if a pending rec with the
    same (customer_id, rec_type, sf_opp_id OR account_id) already exists,
    just refresh its generated_at rather than creating a duplicate.
    """
    existing = None
    if sf_opp_id:
        existing = await db.scalar(
            select(Recommendation).where(
                Recommendation.customer_id == customer_id,
                Recommendation.rec_type == rec_type,
                Recommendation.sf_opp_id == sf_opp_id,
                Recommendation.status == "pending",
            )
        )
    elif account_id:
        existing = await db.scalar(
            select(Recommendation).where(
                Recommendation.customer_id == customer_id,
                Recommendation.rec_type == rec_type,
                Recommendation.account_id == account_id,
                Recommendation.status == "pending",
            )
        )

    if existing:
        existing.title = title
        existing.description = description
        existing.priority = priority
        existing.generated_at = datetime.utcnow()
        existing.expires_at = expires_at
        await db.flush()
        return existing

    rec = Recommendation(
        customer_id=customer_id,
        rec_type=rec_type,
        title=title,
        description=description,
        priority=priority,
        account_id=account_id,
        sf_opp_id=sf_opp_id,
        owner_name=owner_name,
        expires_at=expires_at,
    )
    db.add(rec)
    await db.flush()
    return rec


async def update_recommendation_status(
    db: AsyncSession,
    rec_id: str,
    customer_id: str,
    status: str,
) -> Optional[Recommendation]:
    """Update a recommendation's status (actioned / dismissed)."""
    values: Dict = {"status": status, "updated_at": datetime.utcnow()}
    if status == "actioned":
        values["actioned_at"] = datetime.utcnow()
    await db.execute(
        update(Recommendation)
        .where(Recommendation.id == rec_id, Recommendation.customer_id == customer_id)
        .values(**values)
    )
    return await db.scalar(
        select(Recommendation).where(
            Recommendation.id == rec_id,
            Recommendation.customer_id == customer_id,
        )
    )


async def expire_old_recommendations(
    db: AsyncSession,
    customer_id: str,
) -> int:
    """Mark expired pending recommendations as 'expired'."""
    result = await db.execute(
        update(Recommendation)
        .where(
            Recommendation.customer_id == customer_id,
            Recommendation.status == "pending",
            Recommendation.expires_at < datetime.utcnow(),
        )
        .values(status="expired", updated_at=datetime.utcnow())
    )
    return result.rowcount


async def compute_and_save_recommendations(
    db: AsyncSession,
    customer_id: str,
) -> List[Recommendation]:
    """
    Rule engine: examine current pipeline state and generate persisted Recommendations.
    Called after each sync and by the daily Celery task.

    Rules evaluated:
      1. Stalled deals (is_stalled=True, or no activity 14+ days on open deal)
      2. Closing soon with no recent activity (close_date within 14 days, no activity 7+ days)
      3. High-value ICP accounts with no open deal
      4. Coverage gap (pipeline value < 3× revenue target)
    """
    from datetime import timedelta
    now = datetime.utcnow()
    recs: List[Recommendation] = []

    # ── 1. Stalled deals ───────────────────────────────────────────────────
    stalled_opps = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.is_stalled == True,  # noqa: E712
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
        )
    )
    for opp in stalled_opps.scalars().all():
        rec = await upsert_recommendation(
            db,
            customer_id,
            rec_type="stalled_deal",
            title=f"Stalled deal: {opp.account_name}",
            description=(
                f"'{opp.account_name}' ({opp.stage}) has had no activity for "
                f"{opp.days_since_activity or '?'} days. "
                "Push forward or close the deal."
            ),
            priority="high" if (opp.amount or 0) > 100_000 else "medium",
            sf_opp_id=opp.sf_opportunity_id,
            owner_name=opp.owner_name,
            expires_at=now + timedelta(days=7),
        )
        recs.append(rec)

    # ── 2. Closing soon with no activity ──────────────────────────────────
    soon_cutoff = now + timedelta(days=14)
    activity_cutoff = now - timedelta(days=7)
    closing_soon = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.close_date.between(now, soon_cutoff),
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
            or_(
                SalesforceOpportunity.last_activity_date < activity_cutoff,
                SalesforceOpportunity.last_activity_date.is_(None),
            ),
        )
    )
    for opp in closing_soon.scalars().all():
        rec = await upsert_recommendation(
            db,
            customer_id,
            rec_type="closing_soon",
            title=f"Closing soon, no recent activity: {opp.account_name}",
            description=(
                f"Deal with '{opp.account_name}' closes "
                f"{opp.close_date.date() if opp.close_date else '?'} "
                "but has had no activity in 7+ days."
            ),
            priority="urgent",
            sf_opp_id=opp.sf_opportunity_id,
            owner_name=opp.owner_name,
            expires_at=opp.close_date,
        )
        recs.append(rec)

    # ── 3. ICP A/B accounts with no open deal ─────────────────────────────
    icp_no_deal = await db.execute(
        select(Account).where(
            Account.customer_id == customer_id,
            Account.icp_tier.in_(("A", "B")),
            Account.has_open_deal == False,  # noqa: E712
        ).limit(20)
    )
    for acct in icp_no_deal.scalars().all():
        rec = await upsert_recommendation(
            db,
            customer_id,
            rec_type="activate_account",
            title=f"ICP {acct.icp_tier}-tier account not in pipeline: {acct.name}",
            description=(
                f"'{acct.name}' scores {acct.icp_score}/100 on your ICP criteria "
                "but has no active deal. Consider outreach."
            ),
            priority="medium",
            account_id=acct.id,
            expires_at=now + timedelta(days=14),
        )
        recs.append(rec)

    # ── 4. Coverage gap ────────────────────────────────────────────────────
    gtm = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == customer_id))
    if gtm and gtm.goals:
        target = (gtm.goals or {}).get("revenue_target") or 0
        if target:
            pipeline_val = await db.scalar(
                select(func.coalesce(func.sum(SalesforceOpportunity.amount), 0)).where(
                    SalesforceOpportunity.customer_id == customer_id,
                    SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
                )
            ) or 0
            if pipeline_val < target * 3:
                rec = await upsert_recommendation(
                    db,
                    customer_id,
                    rec_type="coverage_gap",
                    title="Pipeline coverage below 3× target",
                    description=(
                        f"Current open pipeline is {pipeline_val:,.0f} vs "
                        f"3× target of {target * 3:,.0f}. "
                        "Increase prospecting or adjust the revenue target."
                    ),
                    priority="high",
                    expires_at=now + timedelta(days=7),
                )
                recs.append(rec)

    return recs


# ─────────────────────────────────────────────
# CRM ACTIVITY OPERATIONS  (P1.6)
# ─────────────────────────────────────────────

async def upsert_crm_activity(
    db: AsyncSession,
    customer_id: str,
    source: str,
    external_id: str,
    data: Dict,
) -> CRMActivity:
    """
    Insert-or-update a CRM activity row keyed on (customer_id, source, external_id).

    data keys (all optional):
        activity_type, occurred_at, owner_name, contact_name,
        company_name, subject, body, deal_id
    """
    result = await db.execute(
        select(CRMActivity).where(
            CRMActivity.customer_id == customer_id,
            CRMActivity.source == source,
            CRMActivity.external_id == external_id,
        )
    )
    act = result.scalar_one_or_none()
    if act:
        for k, v in data.items():
            setattr(act, k, v)
        act.synced_at = datetime.utcnow()
    else:
        act = CRMActivity(
            customer_id=customer_id,
            source=source,
            external_id=external_id,
            synced_at=datetime.utcnow(),
            **data,
        )
        db.add(act)
    await db.flush()
    return act


async def get_activity_summary(
    db: AsyncSession,
    customer_id: str,
    days: int = 30,
) -> Dict:
    """
    Return a summary of CRM activities for the last `days` days.
    Used by the Intelligence tab activity breakdown.
    """
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)

    rows = await db.execute(
        select(
            CRMActivity.activity_type,
            CRMActivity.source,
            func.count(CRMActivity.id).label("count"),
        )
        .where(
            CRMActivity.customer_id == customer_id,
            CRMActivity.occurred_at >= cutoff,
        )
        .group_by(CRMActivity.activity_type, CRMActivity.source)
    )
    breakdown: Dict = {}
    total = 0
    for atype, source, count in rows:
        key = atype or "other"
        breakdown[key] = breakdown.get(key, 0) + count
        total += count

    # recent activities (last 10)
    recent_rows = await db.execute(
        select(CRMActivity)
        .where(
            CRMActivity.customer_id == customer_id,
            CRMActivity.occurred_at >= cutoff,
        )
        .order_by(CRMActivity.occurred_at.desc())
        .limit(10)
    )
    recent = [
        {
            "id":            str(r.id),
            "source":        r.source,
            "activity_type": r.activity_type,
            "occurred_at":   r.occurred_at.isoformat() if r.occurred_at else None,
            "owner_name":    r.owner_name,
            "contact_name":  r.contact_name,
            "company_name":  r.company_name,
            "subject":       r.subject,
            "deal_id":       r.deal_id,
        }
        for r in recent_rows.scalars()
    ]

    return {"total": total, "breakdown": breakdown, "recent": recent}


# ─────────────────────────────────────────────
# SEMANTIC SEARCH (pgvector)
# ─────────────────────────────────────────────

async def semantic_search_leads(
    db: AsyncSession,
    customer_id: str,
    query_embedding: list,
    limit: int = 5,
) -> list:
    """Return top-K leads sorted by cosine similarity to query_embedding."""
    if not query_embedding:
        return []
    try:
        result = await db.execute(
            select(Lead)
            .where(
                Lead.customer_id == customer_id,
                Lead.embedding.is_not(None),
            )
            .order_by(Lead.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        leads = result.scalars().all()
        return [
            {
                "company": l.company_name,
                "industry": l.industry,
                "score": l.score,
                "priority": l.priority,
                "recommendation": l.recommendation,
                "owner": l.owner_name,
                "source": l.source,
            }
            for l in leads
        ]
    except Exception as exc:
        logger.warning("semantic_search_leads failed: %s", exc)
        return []


async def semantic_search_opportunities(
    db: AsyncSession,
    customer_id: str,
    query_embedding: list,
    limit: int = 5,
) -> list:
    """Return top-K opportunities sorted by cosine similarity to query_embedding."""
    if not query_embedding:
        return []
    try:
        result = await db.execute(
            select(SalesforceOpportunity)
            .where(
                SalesforceOpportunity.customer_id == customer_id,
                SalesforceOpportunity.embedding.is_not(None),
            )
            .order_by(SalesforceOpportunity.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        opps = result.scalars().all()
        return [
            {
                "name": o.account_name,
                "stage": o.stage,
                "amount": o.amount,
                "owner": o.owner_name,
                "is_stalled": o.is_stalled,
            }
            for o in opps
        ]
    except Exception as exc:
        logger.warning("semantic_search_opportunities failed: %s", exc)
        return []
