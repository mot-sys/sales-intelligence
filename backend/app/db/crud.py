"""
Database CRUD Operations
Async database operations for all models.
"""

from typing import Dict, List, Optional
from datetime import datetime
import uuid

from sqlalchemy import select, func, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Lead, Signal, ScoringHistory, Customer, OutboundAction, Alert, AlertAction, SalesforceOpportunity, SalesforceAccount


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
            return existing

    return await create_lead(db, {**lead_data, "customer_id": customer_id, "source": source, "external_id": external_id})


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
