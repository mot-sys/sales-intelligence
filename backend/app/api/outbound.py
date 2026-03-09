"""
Outbound API Routes
Prioritized leads ready for outreach + actionable recommendations.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Lead, OutboundAction, Recommendation
from app.core.security import get_current_customer_id
from app.db import crud

router = APIRouter()


# ─────────────────────────────────────────────
# GET /outbound/queue
# ─────────────────────────────────────────────

@router.get("/queue")
async def get_outbound_queue(
    min_score: int = 60,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Return prioritised leads ready for outbound — those with score >= min_score,
    sorted by score descending.

    Each lead is enriched with:
      - A plain-text recommendation for the rep
      - How many days since last activity
      - Priority tier (hot/warm/cold)
    """
    leads = await crud.get_leads(db, customer_id, limit=limit)
    qualified = [l for l in leads if (l.score or 0) >= min_score]

    now = datetime.utcnow()

    result = []
    for lead in qualified:
        last_act = lead.last_activity
        if last_act:
            last_act_naive = last_act.replace(tzinfo=None) if getattr(last_act, "tzinfo", None) else last_act
            days_since = (now - last_act_naive).days
        else:
            days_since = None

        result.append({
            "id":           str(lead.id),
            "company_name": lead.company_name,
            "contact_name": lead.contact_name,
            "email":        lead.email,
            "score":        lead.score,
            "priority":     lead.priority,
            "industry":     lead.industry,
            "source":       lead.source,
            "last_activity": lead.last_activity.isoformat() if lead.last_activity else None,
            "days_since_activity": days_since,
            "recommendation": lead.recommendation or _default_recommendation(lead, days_since),
            "website":      lead.website,
        })

    return {
        "leads":     result,
        "total":     len(result),
        "min_score": min_score,
    }


def _default_recommendation(lead: Lead, days_since: Optional[int]) -> str:
    """Generate a fallback outreach recommendation based on lead data."""
    priority = lead.priority or "cold"
    score    = lead.score or 0
    if priority == "hot" or score >= 80:
        return "High-priority lead — prioritise immediate personal outreach."
    if days_since is not None and days_since >= 14:
        return f"No activity for {days_since} days — follow up to keep the relationship warm."
    if priority == "warm" or score >= 60:
        return "Warm lead — send a personalised value-add email or schedule a discovery call."
    return "Add to nurture sequence and monitor engagement signals."


# ─────────────────────────────────────────────
# POST /outbound/{lead_id}/action
# ─────────────────────────────────────────────

@router.post("/{lead_id}/action")
async def perform_outbound_action(
    lead_id: uuid.UUID,
    action_type: str,
    sequence_id: Optional[str] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Record an outbound action for a lead.

    action_type values:
        add_to_sequence   — add to email/outreach sequence
        skip              — skip this lead for now
        manual_outreach   — flag for manual follow-up
        contacted         — mark as contacted
    """
    # Verify lead belongs to this customer
    lead = await db.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.customer_id == customer_id,
        )
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    action = OutboundAction(
        lead_id=lead_id,
        customer_id=customer_id,
        action_type=action_type,
        sequence_id=sequence_id,
        notes=notes,
        completed_at=datetime.utcnow(),
        status="completed",
    )
    db.add(action)

    # Update lead last_activity on manual outreach
    if action_type in ("manual_outreach", "contacted"):
        await db.execute(
            sa_update(Lead)
            .where(Lead.id == lead_id)
            .values(last_activity=datetime.utcnow())
        )

    await db.commit()

    return {
        "message":     f"Action '{action_type}' recorded",
        "lead_id":     str(lead_id),
        "action_type": action_type,
    }


# ─────────────────────────────────────────────
# GET /outbound/recommendations
# ─────────────────────────────────────────────

@router.get("/recommendations")
async def get_recommendations(
    status: Optional[str] = "pending",
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Return AI/rule-generated recommendations for this customer.

    Recommendations are computed and persisted during each CRM sync
    (see crud.compute_and_save_recommendations).

    Query params:
        status (str):  pending | actioned | dismissed | expired (default: pending)
        limit  (int):  max recs to return (default: 20)

    Response:
        { recommendations: [...], total: int }
    """
    recs = await crud.get_recommendations(db, customer_id, status=status, limit=limit)

    result = [
        {
            "id":           str(r.id),
            "rec_type":     r.rec_type,
            "priority":     r.priority,
            "title":        r.title,
            "description":  r.description,
            "owner_name":   r.owner_name,
            "sf_opp_id":    r.sf_opp_id,
            "status":       r.status,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            "expires_at":   r.expires_at.isoformat() if r.expires_at else None,
        }
        for r in recs
    ]

    return {"recommendations": result, "total": len(result)}


# ─────────────────────────────────────────────
# POST /outbound/recommendations/{rec_id}/action
# ─────────────────────────────────────────────

@router.post("/recommendations/{rec_id}/action")
async def action_recommendation(
    rec_id: uuid.UUID,
    action: str,  # "actioned" | "dismissed"
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Mark a recommendation as actioned or dismissed."""
    rec = await db.scalar(
        select(Recommendation).where(
            Recommendation.id == rec_id,
            Recommendation.customer_id == customer_id,
        )
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if action not in ("actioned", "dismissed"):
        raise HTTPException(status_code=422, detail="action must be 'actioned' or 'dismissed'")

    rec.status = action
    rec.actioned_at = datetime.utcnow()
    await db.commit()

    return {"id": str(rec_id), "status": action}
