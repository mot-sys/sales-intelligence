"""
Alert Engine
Creates, deduplicates, and generates recommendations for revenue signal alerts.
"""

from typing import Dict, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.models import Alert
from app.core.config import settings


# ─────────────────────────────────────────────
# RULE-BASED RECOMMENDATIONS
# ─────────────────────────────────────────────

_RULE_BASED: Dict[str, str] = {
    "stalled_deal": (
        "Deal has gone cold — schedule a check-in call and create a follow-up task "
        "in Salesforce. Consider sending a value-add resource to re-engage."
    ),
    "intent_spike": (
        "Prospect is showing high buying intent — reach out within 2 hours while they're "
        "still actively researching. Lead with how you solve their specific pain point."
    ),
    "score_jump": (
        "Lead score jumped significantly due to new signals. Review the signals and "
        "prioritize for immediate outreach before a competitor does."
    ),
    "daily_digest": (
        "Review today's priority alerts and take action on urgent items first. "
        "Dismiss or snooze items that need more nurturing time."
    ),
}


async def generate_recommendation(alert_type: str, context: Dict) -> str:
    """
    Generate an AI recommendation for an alert.
    Uses OpenAI if configured, falls back to rule-based strings.
    """
    if settings.OPENAI_API_KEY:
        try:
            return await _openai_recommendation(alert_type, context)
        except Exception:
            pass  # Fall through to rule-based

    return _RULE_BASED.get(alert_type, "Review this alert and take appropriate action.")


async def _openai_recommendation(alert_type: str, context: Dict) -> str:
    """Call OpenAI to generate a contextual recommendation."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    prompt = f"""You are a sales intelligence assistant. Generate a concise, actionable recommendation (2-3 sentences) for this sales alert.

Alert type: {alert_type}
Context: {context}

Be specific to the context. Focus on what the sales rep should do next and why."""

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()


# ─────────────────────────────────────────────
# ALERT CREATION
# ─────────────────────────────────────────────

async def create_alert(
    db: AsyncSession,
    customer_id: str,
    alert_type: str,
    priority: str,
    source: str,
    headline: str,
    context_json: Optional[Dict] = None,
    lead_id: Optional[str] = None,
    external_ref: Optional[str] = None,
) -> Optional[Alert]:
    """
    Create an alert with automatic dedup and AI recommendation generation.
    Returns None if deduped (alert already exists for this lead+type in 24h).
    """
    recommendation = await generate_recommendation(alert_type, context_json or {})

    alert = await crud.create_alert(
        db=db,
        customer_id=customer_id,
        alert_type=alert_type,
        priority=priority,
        source=source,
        headline=headline,
        context_json=context_json,
        recommendation=recommendation,
        lead_id=lead_id,
        external_ref=external_ref,
    )

    if alert:
        await db.commit()

    return alert


async def create_stalled_deal_alert(
    db: AsyncSession,
    customer_id: str,
    opportunity_name: str,
    days_stalled: int,
    amount: Optional[int],
    sf_opportunity_id: str,
    close_date: Optional[str] = None,
    owner_name: Optional[str] = None,
) -> Optional[Alert]:
    """Convenience helper for stalled deal alerts."""
    amount_str = f"€{amount:,}" if amount else "unknown amount"
    close_str = f", closes {close_date}" if close_date else ""

    return await create_alert(
        db=db,
        customer_id=customer_id,
        alert_type="stalled_deal",
        priority="urgent" if days_stalled >= 14 else "high",
        source="salesforce",
        headline=f"{opportunity_name} stalled for {days_stalled} days",
        context_json={
            "opportunity_name": opportunity_name,
            "days_stalled": days_stalled,
            "amount": amount,
            "amount_display": amount_str,
            "close_date": close_date,
            "owner_name": owner_name,
            "sf_opportunity_id": sf_opportunity_id,
            "detail": f"{amount_str} opportunity with no Salesforce activity for {days_stalled} days{close_str}.",
        },
        external_ref=sf_opportunity_id,
    )


async def create_intent_spike_alert(
    db: AsyncSession,
    customer_id: str,
    company_name: str,
    company_domain: str,
    pages_visited: int,
    pages: list,
    lead_id: Optional[str] = None,
) -> Optional[Alert]:
    """Convenience helper for intent spike alerts."""
    pricing_visit = any("pricing" in p.lower() for p in pages)
    priority = "urgent" if pricing_visit else "high"

    return await create_alert(
        db=db,
        customer_id=customer_id,
        alert_type="intent_spike",
        priority=priority,
        source="snitcher",
        headline=f"{company_name} visited {pages_visited} pages" + (" including pricing" if pricing_visit else ""),
        context_json={
            "company_name": company_name,
            "company_domain": company_domain,
            "pages_visited": pages_visited,
            "pages": pages,
            "pricing_page_visited": pricing_visit,
        },
        lead_id=lead_id,
    )
