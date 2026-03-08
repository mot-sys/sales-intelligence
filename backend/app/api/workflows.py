"""
Workflow Builder API
If-this-then-that automation for GTM teams.

Endpoints:
  GET    /api/workflows          — list all workflows
  POST   /api/workflows          — create workflow
  PUT    /api/workflows/{id}     — update workflow
  DELETE /api/workflows/{id}     — delete workflow
  PATCH  /api/workflows/{id}/toggle — pause / activate
  POST   /api/workflows/{id}/run — manually run workflow against all leads
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_customer_id
from app.db.models import Alert, Lead, Workflow
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class ConditionSchema(BaseModel):
    field: str          # score | priority | source | industry
    op: str             # gt | lt | eq | neq | contains
    value: Any          # 80 | "hot" | "clay" | "SaaS"


class ActionSchema(BaseModel):
    type: str           # create_alert | update_priority | log
    params: Dict[str, Any] = {}


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str = "manual"   # score_threshold | alert_created | manual
    conditions: List[ConditionSchema] = []
    actions: List[ActionSchema] = []


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    conditions: Optional[List[ConditionSchema]] = None
    actions: Optional[List[ActionSchema]] = None


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _wf_to_dict(wf: Workflow) -> dict:
    return {
        "id": str(wf.id),
        "name": wf.name,
        "description": wf.description,
        "status": wf.status,
        "trigger_type": wf.trigger_type,
        "conditions": wf.conditions or [],
        "actions": wf.actions or [],
        "last_run": wf.last_run.isoformat() if wf.last_run else None,
        "run_count": wf.run_count,
        "created_at": wf.created_at.isoformat() if wf.created_at else None,
        "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
    }


def _evaluate_condition(lead_dict: dict, cond: dict) -> bool:
    """Evaluate a single condition against a lead dict."""
    field = cond.get("field", "")
    op = cond.get("op", "eq")
    value = cond.get("value")

    lead_value = lead_dict.get(field)
    if lead_value is None:
        return False

    try:
        if op == "gt":
            return float(lead_value) > float(value)
        elif op == "lt":
            return float(lead_value) < float(value)
        elif op == "eq":
            return str(lead_value).lower() == str(value).lower()
        elif op == "neq":
            return str(lead_value).lower() != str(value).lower()
        elif op == "contains":
            return str(value).lower() in str(lead_value).lower()
        return False
    except (TypeError, ValueError):
        return False


def _conditions_met(lead_dict: dict, conditions: List[dict]) -> bool:
    """All conditions must be true (AND logic)."""
    if not conditions:
        return True
    return all(_evaluate_condition(lead_dict, c) for c in conditions)


async def _execute_action(
    action: dict,
    lead: Lead,
    customer_id: str,
    db: AsyncSession,
) -> dict:
    """Execute a single action and return a result summary."""
    action_type = action.get("type", "")
    params = action.get("params", {})

    if action_type == "update_priority":
        priority = params.get("priority", "warm")
        if priority in ("hot", "warm", "cold"):
            await db.execute(
                sa_update(Lead)
                .where(Lead.id == lead.id)
                .values(priority=priority)
            )
            return {"action": "update_priority", "lead": lead.company_name, "priority": priority}

    elif action_type == "create_alert":
        priority = params.get("priority", "medium")
        message = params.get("message", f"Workflow triggered for {lead.company_name}")
        alert = Alert(
            customer_id=uuid.UUID(customer_id),
            type="workflow_trigger",
            priority=priority,
            source="workflow",
            headline=message,
            context={"lead_id": str(lead.id), "company": lead.company_name, "score": lead.score},
            recommendation=params.get("recommendation", "Review this lead."),
            status="pending",
        )
        db.add(alert)
        return {"action": "create_alert", "lead": lead.company_name, "priority": priority}

    elif action_type == "log":
        message = params.get("message", "Workflow executed")
        logger.info("Workflow log: %s | Lead: %s", message, lead.company_name)
        return {"action": "log", "lead": lead.company_name, "message": message}

    return {"action": action_type, "status": "unknown_action_type"}


# ─────────────────────────────────────────────
# GET /workflows
# ─────────────────────────────────────────────

@router.get("")
@router.get("/")
async def list_workflows(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.customer_id == customer_id)
        .order_by(Workflow.created_at.desc())
    )
    workflows = result.scalars().all()
    return {"workflows": [_wf_to_dict(wf) for wf in workflows]}


# ─────────────────────────────────────────────
# POST /workflows
# ─────────────────────────────────────────────

@router.post("")
async def create_workflow(
    body: WorkflowCreate,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    wf = Workflow(
        customer_id=uuid.UUID(customer_id),
        name=body.name,
        description=body.description,
        trigger_type=body.trigger_type,
        conditions=[c.dict() for c in body.conditions],
        actions=[a.dict() for a in body.actions],
        status="active",
        run_count=0,
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return _wf_to_dict(wf)


# ─────────────────────────────────────────────
# PUT /workflows/{id}
# ─────────────────────────────────────────────

@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    wf = await db.scalar(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.customer_id == customer_id,
        )
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if body.name is not None:
        wf.name = body.name
    if body.description is not None:
        wf.description = body.description
    if body.trigger_type is not None:
        wf.trigger_type = body.trigger_type
    if body.conditions is not None:
        wf.conditions = [c.dict() for c in body.conditions]
    if body.actions is not None:
        wf.actions = [a.dict() for a in body.actions]

    await db.commit()
    await db.refresh(wf)
    return _wf_to_dict(wf)


# ─────────────────────────────────────────────
# DELETE /workflows/{id}
# ─────────────────────────────────────────────

@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: uuid.UUID,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    wf = await db.scalar(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.customer_id == customer_id,
        )
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    await db.delete(wf)
    await db.commit()
    return {"message": "Workflow deleted", "id": str(workflow_id)}


# ─────────────────────────────────────────────
# PATCH /workflows/{id}/toggle
# ─────────────────────────────────────────────

@router.patch("/{workflow_id}/toggle")
async def toggle_workflow(
    workflow_id: uuid.UUID,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    wf = await db.scalar(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.customer_id == customer_id,
        )
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf.status = "paused" if wf.status == "active" else "active"
    await db.commit()
    return {"id": str(wf.id), "status": wf.status}


# ─────────────────────────────────────────────
# POST /workflows/{id}/run
# ─────────────────────────────────────────────

@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: uuid.UUID,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually execute a workflow against all leads for this customer.
    Evaluates conditions and fires actions for every matching lead.
    Returns a summary of what was done.
    """
    wf = await db.scalar(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.customer_id == customer_id,
        )
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Fetch all leads for this customer
    leads_result = await db.execute(
        select(Lead).where(Lead.customer_id == customer_id).limit(500)
    )
    leads = leads_result.scalars().all()

    matched = 0
    results = []

    for lead in leads:
        lead_dict = {
            "score": lead.score or 0,
            "priority": lead.priority or "cold",
            "source": lead.source or "",
            "industry": lead.industry or "",
            "company_name": lead.company_name or "",
        }

        if _conditions_met(lead_dict, wf.conditions or []):
            matched += 1
            for action in (wf.actions or []):
                try:
                    result = await _execute_action(action, lead, customer_id, db)
                    results.append(result)
                except Exception as exc:
                    logger.error("Action failed for lead %s: %s", lead.id, exc)
                    results.append({"action": action.get("type"), "error": str(exc)})

    # Update last_run + run_count
    await db.execute(
        sa_update(Workflow)
        .where(Workflow.id == workflow_id)
        .values(
            last_run=datetime.utcnow(),
            run_count=Workflow.run_count + 1,
        )
    )
    await db.commit()

    return {
        "workflow_id": str(workflow_id),
        "leads_evaluated": len(leads),
        "leads_matched": matched,
        "actions_fired": len(results),
        "results": results[:50],  # Cap response size
    }
