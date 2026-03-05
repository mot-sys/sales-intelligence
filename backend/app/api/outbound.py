"""
Outbound API Routes
Prioritized leads ready for outreach.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.db.session import get_db

router = APIRouter()


@router.get("/queue")
async def get_outbound_queue(
    db: AsyncSession = Depends(get_db),
    min_score: int = 60,
):
    """
    Get prioritized queue of leads for outbound.
    
    Only returns leads with score >= min_score, sorted by score.
    Each lead includes AI recommendation for approach.
    """
    # TODO: Query leads with scores >= min_score
    return {
        "leads": []
    }


@router.post("/{lead_id}/action")
async def perform_outbound_action(
    lead_id: uuid.UUID,
    action_type: str,
    sequence_id: str = None,
    notes: str = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Perform an outbound action on a lead.
    
    Actions:
        - add_to_sequence: Add to email sequence
        - skip: Mark as skipped
        - manual_outreach: Flag for manual followup
    """
    # TODO: Create outbound_action record
    
    return {
        "message": f"Action '{action_type}' performed successfully",
        "lead_id": str(lead_id)
    }


@router.get("/recommendations")
async def get_recommendations(
    db: AsyncSession = Depends(get_db),
):
    """
    Get AI-powered outbound recommendations.
    
    Returns actionable insights for current high-priority leads.
    """
    return {
        "recommendations": []
    }
