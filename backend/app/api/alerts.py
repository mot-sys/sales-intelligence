"""
Alerts API
Endpoints for listing, actioning, and dismissing revenue signal alerts.
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db import crud
from app.core.security import get_current_customer_id_dev

router = APIRouter()


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class AlertActionRequest(BaseModel):
    action_type: str  # dismiss | snooze | add_to_sequence | mark_actioned
    payload: Optional[Dict] = None  # e.g. {"hours": 24} for snooze


def _serialize_alert(alert) -> Dict:
    lead_info = None
    if alert.lead:
        lead_info = {
            "id": str(alert.lead.id),
            "company_name": alert.lead.company_name,
            "company_domain": alert.lead.company_domain,
            "contact_name": alert.lead.contact_name,
            "contact_title": alert.lead.contact_title,
            "owner_name": alert.lead.owner_name,
            "score": alert.lead.score,
            "priority": alert.lead.priority,
        }

    return {
        "id": str(alert.id),
        "type": alert.type,
        "priority": alert.priority,
        "source": alert.source,
        "headline": alert.headline,
        "context": alert.context_json,
        "recommendation": alert.recommendation,
        "status": alert.status,
        "snoozed_until": alert.snoozed_until.isoformat() if alert.snoozed_until else None,
        "external_ref": alert.external_ref,
        "lead": lead_info,
        "created_at": alert.created_at.isoformat(),
        "actioned_at": alert.actioned_at.isoformat() if alert.actioned_at else None,
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/stats")
async def get_alert_stats(
    customer_id: str = Depends(get_current_customer_id_dev),
    db: AsyncSession = Depends(get_db),
):
    """Get alert counts by status and priority for the dashboard widget."""
    return await crud.get_alert_stats(db, customer_id)


@router.get("")
@router.get("/")
async def list_alerts(
    status: Optional[str] = Query(None, description="Filter: pending|snoozed|dismissed|actioned"),
    alert_type: Optional[str] = Query(None, alias="type"),
    priority: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: str = Depends(get_current_customer_id_dev),
    db: AsyncSession = Depends(get_db),
):
    """
    List alerts for the authenticated customer.
    Defaults to showing all pending alerts ordered by created_at desc.
    """
    alerts = await crud.get_alerts(
        db,
        customer_id=customer_id,
        status=status,
        alert_type=alert_type,
        priority=priority,
        skip=skip,
        limit=limit,
    )
    return {
        "alerts": [_serialize_alert(a) for a in alerts],
        "count": len(alerts),
    }


@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    customer_id: str = Depends(get_current_customer_id_dev),
    db: AsyncSession = Depends(get_db),
):
    """Get a single alert by ID."""
    alert = await crud.get_alert(db, alert_id, customer_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _serialize_alert(alert)


@router.post("/{alert_id}/action")
async def action_alert(
    alert_id: str,
    body: AlertActionRequest,
    customer_id: str = Depends(get_current_customer_id_dev),
    db: AsyncSession = Depends(get_db),
):
    """
    Take an action on an alert.

    action_type options:
      - dismiss:         mark alert as dismissed
      - snooze:          snooze for N hours (payload: {"hours": 24})
      - add_to_sequence: record intent to add to sequence — no external API call (read-only platform)
      - mark_actioned:   mark alert as actioned — no external API call (read-only platform)
    """
    alert = await crud.get_alert(db, alert_id, customer_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    action_record = await crud.create_alert_action(
        db, alert_id, customer_id, body.action_type, body.payload
    )

    try:
        if body.action_type == "dismiss":
            await crud.update_alert_status(db, alert_id, "dismissed")
            await crud.update_alert_action_status(db, str(action_record.id), "completed")

        elif body.action_type == "snooze":
            hours = (body.payload or {}).get("hours", 24)
            snooze_until = datetime.utcnow() + timedelta(hours=hours)
            await crud.update_alert_status(
                db, alert_id, "snoozed", snoozed_until=snooze_until
            )
            await crud.update_alert_action_status(db, str(action_record.id), "completed")

        elif body.action_type in ("add_to_sequence", "mark_actioned"):
            # Read-only platform: we record the intent in our DB only.
            # No calls are made to Salesforce, HubSpot, or any other external service.
            await crud.update_alert_status(
                db, alert_id, "actioned", actioned_at=datetime.utcnow()
            )
            await crud.update_alert_action_status(db, str(action_record.id), "completed")

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action_type: {body.action_type}")

    except HTTPException:
        await crud.update_alert_action_status(
            db, str(action_record.id), "failed", error_message="Action failed"
        )
        await db.commit()
        raise

    await db.commit()

    updated_alert = await crud.get_alert(db, alert_id, customer_id)
    return {
        "success": True,
        "action": body.action_type,
        "alert": _serialize_alert(updated_alert),
    }
