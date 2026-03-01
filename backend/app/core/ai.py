"""
AI Service
Builds structured pipeline context from live DB data and handles LLM chat queries.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# CONTEXT BUILDER
# ─────────────────────────────────────────────

async def build_pipeline_context(db: AsyncSession, customer_id: str) -> Dict:
    """
    Fetch and structure all relevant pipeline data for a customer into a single
    context dict.  This dict is passed verbatim to the LLM as grounding data.

    Sources:
      - SalesforceOpportunity  (includes HubSpot deals with hs_ prefix)
      - Alert                  (pending alerts only)
      - Lead                   (top-scored leads + their signals)
    """
    from app.db.models import Alert, Lead, SalesforceOpportunity, Signal

    # ── Open deals ──────────────────────────────────────────────────────────
    opps_result = await db.execute(
        select(SalesforceOpportunity)
        .where(SalesforceOpportunity.customer_id == customer_id)
        .order_by(SalesforceOpportunity.last_activity_date.asc().nullsfirst())
        .limit(50)
    )
    opps = opps_result.scalars().all()

    open_deals: List[Dict] = []
    total_value = 0
    stages: Dict[str, int] = {}
    stalled_count = 0

    for opp in opps:
        amount = opp.amount or 0
        total_value += amount
        stage = opp.stage or "Unknown"
        stages[stage] = stages.get(stage, 0) + 1

        days_inactive: Optional[int] = None
        if opp.last_activity_date:
            days_inactive = (datetime.utcnow() - opp.last_activity_date).days

        is_stalled = opp.is_stalled or (
            days_inactive is not None and days_inactive >= settings.ALERT_STALE_DEAL_DAYS
        )
        if is_stalled:
            stalled_count += 1

        open_deals.append({
            "name": opp.account_name,
            "amount": amount,
            "amount_display": f"€{amount:,}" if amount else "unknown",
            "stage": stage,
            "close_date": opp.close_date.strftime("%Y-%m-%d") if opp.close_date else None,
            "owner": opp.owner_name,
            "days_since_last_activity": days_inactive,
            "is_stalled": is_stalled,
            "crm": "hubspot" if (opp.sf_opportunity_id or "").startswith("hs_") else "salesforce",
        })

    # ── Pending alerts ───────────────────────────────────────────────────────
    alerts_result = await db.execute(
        select(Alert)
        .where(and_(Alert.customer_id == customer_id, Alert.status == "pending"))
        .order_by(Alert.created_at.desc())
        .limit(30)
    )
    pending_alerts = alerts_result.scalars().all()

    alerts_list = [
        {
            "type": a.type,
            "priority": a.priority,
            "headline": a.headline,
            "source": a.source,
            "recommendation": a.recommendation,
            "context": a.context_json,
            "age_hours": round(
                (datetime.utcnow() - a.created_at).total_seconds() / 3600, 1
            ) if a.created_at else None,
        }
        for a in pending_alerts
    ]

    # ── Top leads + their recent signals ────────────────────────────────────
    leads_result = await db.execute(
        select(Lead)
        .where(Lead.customer_id == customer_id)
        .order_by(Lead.score.desc().nullslast())
        .limit(25)
    )
    leads = leads_result.scalars().all()

    leads_list = []
    for lead in leads:
        # Fetch signals for this lead
        sigs_result = await db.execute(
            select(Signal)
            .where(Signal.lead_id == lead.id)
            .order_by(Signal.detected_at.desc())
            .limit(5)
        )
        sigs = sigs_result.scalars().all()

        leads_list.append({
            "company": lead.company_name,
            "domain": lead.company_domain,
            "score": lead.score,
            "priority": lead.priority,
            "industry": lead.industry,
            "employee_count": lead.employee_count,
            "contact": f"{lead.contact_name or ''} — {lead.contact_title or ''}".strip(" —"),
            "owner": lead.owner_name,
            "source": lead.source,
            "signals": [
                {
                    "type": s.type,
                    "title": s.title,
                    "detected_days_ago": (
                        (datetime.utcnow() - s.detected_at).days
                        if s.detected_at else None
                    ),
                }
                for s in sigs
            ],
        })

    return {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "pipeline_summary": {
            "total_open_deals": len(open_deals),
            "total_pipeline_value": total_value,
            "total_pipeline_display": f"€{total_value:,}",
            "deals_by_stage": stages,
            "stalled_deals": stalled_count,
            "pending_alerts": len(alerts_list),
            "urgent_or_high_alerts": sum(
                1 for a in alerts_list if a["priority"] in ("urgent", "high")
            ),
            "top_lead_score": leads_list[0]["score"] if leads_list else None,
        },
        "open_deals": open_deals,
        "pending_alerts": alerts_list,
        "top_leads": leads_list,
    }


# ─────────────────────────────────────────────
# LLM CHAT
# ─────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert B2B sales intelligence assistant embedded in a revenue signal platform.
You have real-time access to the user's CRM pipeline, scored leads, and active alerts.

Today: {today}

=== LIVE PIPELINE DATA ===
{context_json}
=========================

Rules:
- Be concise, direct, and actionable. Skip filler sentences.
- Always reference real deal names, companies, and numbers from the data above.
- Prioritise urgent/high-priority items unless asked otherwise.
- Use bullet points when listing 3 or more items.
- Answer in the same language the user writes in (English or Danish).
- Never make up data that isn't in the context above.
"""

SUGGESTED_QUESTIONS = [
    "Hvad skal jeg fokusere på denne uge?",
    "Hvilke deals er mest i fare for at gå tabt?",
    "Hvilke leads bør jeg kontakte i dag?",
    "Giv mig et overblik over min pipeline",
    "Hvilke deals ser ud til at vinde?",
    "Hvor stor er min samlede pipeline?",
]


async def chat_with_pipeline(
    question: str,
    context: Dict,
    history: Optional[List[Dict]] = None,
) -> str:
    """
    Send a question + full pipeline context to the LLM and return the answer.

    Args:
        question:  The user's natural-language question.
        context:   Output of build_pipeline_context().
        history:   Optional prior messages [{role, content}, ...] for multi-turn.

    Raises:
        ValueError  if OPENAI_API_KEY is not set.
        Exception   for OpenAI API errors (caller should handle).
    """
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    system_content = _SYSTEM_PROMPT.format(
        today=datetime.utcnow().strftime("%A, %B %d %Y"),
        context_json=json.dumps(context, indent=2, default=str),
    )

    messages = [{"role": "system", "content": system_content}]

    # Inject prior conversation turns (last 10 to stay within token budget)
    if history:
        messages.extend(history[-10:])

    messages.append({"role": "user", "content": question})

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        max_tokens=700,
        temperature=0.3,  # Low temperature for factual, grounded answers
    )

    return response.choices[0].message.content.strip()
