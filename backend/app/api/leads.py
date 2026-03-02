"""
Leads API Routes
CRUD operations for leads with real database queries and scoring.
"""

import logging
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db import crud
from app.ml.scorer import score_lead
from app.core.security import get_current_customer_id_dev as get_current_customer_id

logger = logging.getLogger(__name__)

router = APIRouter()


def _lead_to_dict(lead) -> dict:
    """Serialise a Lead ORM object to a plain dict."""
    return {
        "id": str(lead.id),
        "company_name": lead.company_name,
        "company_domain": lead.company_domain,
        "industry": lead.industry,
        "employee_count": lead.employee_count,
        "revenue": lead.revenue,
        "location": lead.location,
        "contact_name": lead.contact_name,
        "contact_email": lead.contact_email,
        "contact_title": lead.contact_title,
        "contact_linkedin": lead.contact_linkedin,
        "score": lead.score,
        "priority": lead.priority,
        "recommendation": lead.recommendation,
        "owner_name": lead.owner_name,
        "source": lead.source,
        "external_id": lead.external_id,
        "last_activity": lead.last_activity.isoformat() if lead.last_activity else None,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


def _signal_to_dict(signal) -> dict:
    """Serialise a Signal ORM object to a plain dict."""
    return {
        "id": str(signal.id),
        "type": signal.type,
        "title": signal.title,
        "description": signal.description,
        "score_impact": signal.score_impact,
        "source": signal.source,
        "external_url": signal.external_url,
        "detected_at": signal.detected_at.isoformat() if signal.detected_at else None,
        "metadata": signal.extra_data,
    }


# ─────────────────────────────────────────────
# GET /leads/
# ─────────────────────────────────────────────

@router.get("")
@router.get("/")
async def get_leads(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
    priority: Optional[str] = Query(None, description="Filter by priority: hot/warm/cold"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    search: Optional[str] = Query(None, description="Search by company/contact name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    List leads for the current customer with optional filters.

    Returns paginated lead data sorted by score (highest first).
    """
    try:
        if priority and priority not in ("hot", "warm", "cold"):
            raise HTTPException(status_code=400, detail="priority must be hot, warm, or cold")

        leads = await crud.get_leads(
            db,
            customer_id=customer_id,
            skip=skip,
            limit=limit,
            priority=priority,
            industry=industry,
            search=search,
        )
        total = await crud.count_leads(
            db,
            customer_id=customer_id,
            priority=priority,
            industry=industry,
            search=search,
        )

        return {
            "total": total,
            "leads": [_lead_to_dict(lead) for lead in leads],
            "page": skip // limit + 1,
            "page_size": limit,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error fetching leads for customer %s: %s", customer_id, exc)
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────
# GET /leads/{lead_id}
# ─────────────────────────────────────────────

@router.get("/{lead_id}")
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Get detailed information about a specific lead.

    Includes all signals, the latest scoring breakdown, and the
    AI-generated recommendation.
    """
    try:
        lead = await crud.get_lead(db, str(lead_id), customer_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        signals = lead.signals or []
        signal_dicts = [_signal_to_dict(s) for s in signals]

        # Re-compute breakdown without persisting (for display only)
        from app.ml.scorer import scorer
        breakdown = scorer.score_lead(
            _lead_to_dict(lead),
            [{"type": s.type, "title": s.title, "detected_at": s.detected_at} for s in signals],
        ).get("breakdown", {})

        return {
            **_lead_to_dict(lead),
            "signals": signal_dicts,
            "scoring_breakdown": breakdown,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error fetching lead %s: %s", lead_id, exc)
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────
# POST /leads/{lead_id}/score
# ─────────────────────────────────────────────

@router.post("/{lead_id}/score")
async def rescore_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Manually trigger re-scoring of a lead.

    Fetches the latest signals, runs the scoring engine, and persists
    the new score/priority/recommendation to the database.
    """
    try:
        lead = await crud.get_lead(db, str(lead_id), customer_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        signals = await crud.get_signals_for_lead(db, str(lead_id))
        signal_dicts_for_scorer = [
            {
                "type": s.type,
                "title": s.title,
                "detected_at": s.detected_at,
            }
            for s in signals
        ]

        result = score_lead(_lead_to_dict(lead), signal_dicts_for_scorer)

        updated = await crud.update_lead_score(
            db,
            lead_id=str(lead_id),
            score=result["score"],
            priority=result["priority"],
            recommendation=result["recommendation"],
        )

        # Persist scoring history for future ML training
        await crud.save_scoring_history(
            db,
            lead_id=str(lead_id),
            customer_id=customer_id,
            score=result["score"],
            signals_present=[{"type": s.type, "title": s.title} for s in signals],
        )

        return {
            "message": "Lead rescored successfully",
            "lead_id": str(lead_id),
            "score": result["score"],
            "priority": result["priority"],
            "recommendation": result["recommendation"],
            "breakdown": result["breakdown"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error rescoring lead %s: %s", lead_id, exc)
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────
# PUT /leads/{lead_id}/priority
# ─────────────────────────────────────────────

@router.put("/{lead_id}/priority")
async def update_priority(
    lead_id: uuid.UUID,
    priority: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Manually override lead priority (hot/warm/cold).

    Useful when a salesperson has extra context that the scoring engine
    doesn't capture.
    """
    if priority not in ("hot", "warm", "cold"):
        raise HTTPException(status_code=400, detail="priority must be hot, warm, or cold")

    try:
        lead = await crud.update_lead_priority(db, str(lead_id), customer_id, priority)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        return {
            "message": "Priority updated successfully",
            "lead_id": str(lead_id),
            "priority": priority,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error updating priority for lead %s: %s", lead_id, exc)
        raise HTTPException(status_code=500, detail="Internal server error")
