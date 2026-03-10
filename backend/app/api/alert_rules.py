"""
Custom Alert Rules API  (P2.8)

Endpoints:
  GET    /api/alert-rules          — list all rules for the org
  POST   /api/alert-rules          — create a new rule
  PUT    /api/alert-rules/{id}     — update a rule
  DELETE /api/alert-rules/{id}     — delete a rule
  POST   /api/alert-rules/{id}/toggle  — enable / disable
  POST   /api/alert-rules/evaluate — run all enabled rules right now, return matches

Trigger types:
  deal_stalled      — deal goes N days without activity
  deal_closing_soon — deal closes in <= N days with no activity in last M days
  deal_amount_gt    — any open deal with amount > X
  pipeline_below    — total open pipeline < X% of revenue target
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_customer_id
from app.db.models import CustomAlertRule, GTMConfig, SalesforceOpportunity
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_TRIGGER_TYPES = {"deal_stalled", "deal_closing_soon", "deal_amount_gt", "pipeline_below"}
VALID_SEVERITIES    = {"low", "medium", "high", "critical"}


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class RuleCreate(BaseModel):
    name:          str  = Field(..., min_length=1, max_length=255)
    trigger_type:  str
    conditions:    Dict[str, Any] = Field(default_factory=dict)
    severity:      str  = "medium"
    enabled:       bool = True
    cooldown_hours: int = Field(default=24, ge=1, le=720)

    @field_validator("trigger_type")
    @classmethod
    def validate_trigger(cls, v):
        if v not in VALID_TRIGGER_TYPES:
            raise ValueError(f"trigger_type must be one of {VALID_TRIGGER_TYPES}")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v not in VALID_SEVERITIES:
            raise ValueError(f"severity must be one of {VALID_SEVERITIES}")
        return v


class RuleUpdate(BaseModel):
    name:           Optional[str]            = None
    trigger_type:   Optional[str]            = None
    conditions:     Optional[Dict[str, Any]] = None
    severity:       Optional[str]            = None
    enabled:        Optional[bool]           = None
    cooldown_hours: Optional[int]            = None


def _serialize(r: CustomAlertRule) -> Dict:
    return {
        "id":             str(r.id),
        "name":           r.name,
        "trigger_type":   r.trigger_type,
        "conditions":     r.conditions,
        "severity":       r.severity,
        "enabled":        r.enabled,
        "cooldown_hours": r.cooldown_hours,
        "created_at":     r.created_at.isoformat() if r.created_at else None,
        "updated_at":     r.updated_at.isoformat() if r.updated_at else None,
    }


# ─────────────────────────────────────────────
# CRUD ENDPOINTS
# ─────────────────────────────────────────────

@router.get("", response_model=List[Dict])
async def list_rules(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """List all custom alert rules for this organisation."""
    result = await db.execute(
        select(CustomAlertRule)
        .where(CustomAlertRule.customer_id == customer_id)
        .order_by(CustomAlertRule.created_at.asc())
    )
    return [_serialize(r) for r in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Dict)
async def create_rule(
    body: RuleCreate,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom alert rule."""
    rule = CustomAlertRule(
        customer_id    = UUID(customer_id),
        name           = body.name,
        trigger_type   = body.trigger_type,
        conditions     = _sanitize_conditions(body.trigger_type, body.conditions),
        severity       = body.severity,
        enabled        = body.enabled,
        cooldown_hours = body.cooldown_hours,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    logger.info("Custom alert rule '%s' created for org %s", rule.name, customer_id)
    return _serialize(rule)


@router.put("/{rule_id}", response_model=Dict)
async def update_rule(
    rule_id: UUID,
    body: RuleUpdate,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing custom alert rule."""
    rule = await _get_rule_or_404(db, rule_id, customer_id)

    if body.name           is not None: rule.name           = body.name
    if body.severity       is not None: rule.severity       = body.severity
    if body.enabled        is not None: rule.enabled        = body.enabled
    if body.cooldown_hours is not None: rule.cooldown_hours = body.cooldown_hours
    if body.trigger_type   is not None:
        rule.trigger_type = body.trigger_type
    if body.conditions is not None:
        rule.conditions = _sanitize_conditions(rule.trigger_type, body.conditions)

    await db.commit()
    await db.refresh(rule)
    return _serialize(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: UUID,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom alert rule."""
    rule = await _get_rule_or_404(db, rule_id, customer_id)
    await db.delete(rule)
    await db.commit()


@router.post("/{rule_id}/toggle", response_model=Dict)
async def toggle_rule(
    rule_id: UUID,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable a rule."""
    rule = await _get_rule_or_404(db, rule_id, customer_id)
    rule.enabled = not rule.enabled
    await db.commit()
    await db.refresh(rule)
    return _serialize(rule)


# ─────────────────────────────────────────────
# RULE EVALUATION  (dry-run + production)
# ─────────────────────────────────────────────

@router.post("/evaluate")
async def evaluate_rules(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluate all enabled custom rules against current pipeline data.
    Returns matches without creating actual alert records (dry-run).
    Useful for testing rules before they fire in production.
    """
    matches = await _run_evaluation(db, customer_id, dry_run=True)
    return {
        "matches":    matches,
        "total":      len(matches),
        "evaluated_at": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────
# SHARED EVALUATION ENGINE
# called by tasks.py for scheduled evaluation
# ─────────────────────────────────────────────

async def evaluate_custom_rules_for_customer(
    db: AsyncSession,
    customer_id: str,
) -> List[Dict]:
    """
    Evaluate all enabled custom rules and create Alert records for matches.
    Called by the Celery weekly task and on-demand from the API.
    Returns a list of fired alert dicts.
    """
    return await _run_evaluation(db, customer_id, dry_run=False)


async def _run_evaluation(
    db: AsyncSession,
    customer_id: str,
    dry_run: bool = False,
) -> List[Dict]:
    """Core evaluation engine. When dry_run=False, also creates Alert DB rows."""
    from app.core.alerts import create_alert  # avoid circular import

    # Load all enabled rules
    rules_result = await db.execute(
        select(CustomAlertRule).where(
            CustomAlertRule.customer_id == customer_id,
            CustomAlertRule.enabled == True,  # noqa: E712
        )
    )
    rules = rules_result.scalars().all()
    if not rules:
        return []

    # Load GTM config for pipeline_below rule
    gtm = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == customer_id))
    revenue_target = float((gtm.goals or {}).get("revenue_target", 0) or 0) if gtm else 0.0

    # Load open opportunities
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
        )
    )
    open_opps = opps_result.scalars().all()

    now = datetime.utcnow()
    fired: List[Dict] = []

    for rule in rules:
        cond = rule.conditions or {}
        matches = []

        if rule.trigger_type == "deal_stalled":
            days_inactive = int(cond.get("days_inactive", 21))
            min_amount    = float(cond.get("min_amount", 0) or 0)
            cutoff        = now - timedelta(days=days_inactive)
            for o in open_opps:
                amount = float(o.amount or 0)
                if amount < min_amount:
                    continue
                last_act = _naive(o.last_activity_date) if o.last_activity_date else None
                if last_act is None or last_act < cutoff:
                    days_gone = (now - last_act).days if last_act else None
                    matches.append({
                        "opp_id":    o.sf_opportunity_id,
                        "account":   o.account_name,
                        "amount":    o.amount,
                        "stage":     o.stage,
                        "owner":     o.owner_name,
                        "days_inactive": days_gone,
                    })

        elif rule.trigger_type == "deal_closing_soon":
            days_to_close = int(cond.get("days_to_close", 14))
            days_inactive = int(cond.get("days_inactive", 7))
            min_amount    = float(cond.get("min_amount", 0) or 0)
            close_cutoff  = now + timedelta(days=days_to_close)
            act_cutoff    = now - timedelta(days=days_inactive)
            for o in open_opps:
                if float(o.amount or 0) < min_amount:
                    continue
                cd = _naive(o.close_date) if o.close_date else None
                la = _naive(o.last_activity_date) if o.last_activity_date else None
                if cd and now <= cd <= close_cutoff:
                    if la is None or la < act_cutoff:
                        days_left = (cd - now).days
                        matches.append({
                            "opp_id":     o.sf_opportunity_id,
                            "account":    o.account_name,
                            "amount":     o.amount,
                            "close_date": cd.isoformat(),
                            "days_left":  days_left,
                            "owner":      o.owner_name,
                        })

        elif rule.trigger_type == "deal_amount_gt":
            min_amount   = float(cond.get("min_amount", 100_000) or 0)
            filter_stage = cond.get("stage")  # None means any open stage
            for o in open_opps:
                if float(o.amount or 0) > min_amount:
                    if filter_stage is None or o.stage == filter_stage:
                        matches.append({
                            "opp_id":  o.sf_opportunity_id,
                            "account": o.account_name,
                            "amount":  o.amount,
                            "stage":   o.stage,
                            "owner":   o.owner_name,
                        })

        elif rule.trigger_type == "pipeline_below":
            coverage_pct = float(cond.get("coverage_pct", 200) or 200)
            if revenue_target > 0:
                total_pipeline = sum(float(o.amount or 0) for o in open_opps)
                actual_pct = (total_pipeline / revenue_target * 100)
                if actual_pct < coverage_pct:
                    matches.append({
                        "pipeline_value":  total_pipeline,
                        "revenue_target":  revenue_target,
                        "actual_pct":      round(actual_pct, 1),
                        "threshold_pct":   coverage_pct,
                    })

        if not matches:
            continue

        headline = _build_headline(rule, matches)
        fired.append({
            "rule_id":      str(rule.id),
            "rule_name":    rule.name,
            "trigger_type": rule.trigger_type,
            "severity":     rule.severity,
            "headline":     headline,
            "match_count":  len(matches),
            "matches":      matches[:10],  # cap for response size
        })

        if not dry_run:
            try:
                await create_alert(
                    db=db,
                    customer_id=customer_id,
                    alert_type="custom_rule",
                    headline=headline,
                    priority=rule.severity,
                    context={"rule_id": str(rule.id), "matches": matches[:5]},
                    recommendation=f"Review deals matching rule '{rule.name}'",
                )
            except Exception as exc:
                logger.warning("Failed to create alert for rule %s: %s", rule.id, exc)

    if not dry_run and fired:
        await db.commit()

    return fired


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _sanitize_conditions(trigger_type: str, conditions: Dict) -> Dict:
    """Ensure required condition keys are present with sensible defaults."""
    defaults = {
        "deal_stalled":      {"days_inactive": 21, "min_amount": 0},
        "deal_closing_soon": {"days_to_close": 14, "days_inactive": 7, "min_amount": 0},
        "deal_amount_gt":    {"min_amount": 100_000, "stage": None},
        "pipeline_below":    {"coverage_pct": 200},
    }
    merged = {**defaults.get(trigger_type, {}), **conditions}
    return merged


def _naive(dt) -> Optional[datetime]:
    """Strip timezone info so comparisons with utcnow() work."""
    if dt is None:
        return None
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def _build_headline(rule: CustomAlertRule, matches: List[Dict]) -> str:
    n = len(matches)
    if rule.trigger_type == "deal_stalled":
        return f"[{rule.name}] {n} deal{'s' if n > 1 else ''} stalled"
    if rule.trigger_type == "deal_closing_soon":
        return f"[{rule.name}] {n} deal{'s' if n > 1 else ''} closing soon with no activity"
    if rule.trigger_type == "deal_amount_gt":
        return f"[{rule.name}] {n} high-value deal{'s' if n > 1 else ''} matched"
    if rule.trigger_type == "pipeline_below":
        pct = matches[0].get("actual_pct", "?")
        return f"[{rule.name}] Pipeline at {pct}% of target — below threshold"
    return f"[{rule.name}] Rule matched ({n} item{'s' if n > 1 else ''})"


async def _get_rule_or_404(db: AsyncSession, rule_id: UUID, customer_id: str) -> CustomAlertRule:
    rule = await db.scalar(
        select(CustomAlertRule).where(
            CustomAlertRule.id == rule_id,
            CustomAlertRule.customer_id == customer_id,
        )
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule
