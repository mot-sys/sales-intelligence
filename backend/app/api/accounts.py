"""
Accounts API  —  P1.1 / P1.2 / P1.3 / P1.4 / P1.5 / P1.8

Routes:
  GET  /accounts                       — list canonical accounts
  GET  /accounts/{id}                  — single account with open deals + health
  GET  /accounts/{id}/recommendations  — recs for a specific account
  POST /accounts/recommendations/compute — regenerate all recs (manual trigger)
  GET  /accounts/recommendations        — all pending recs
  PUT  /accounts/recommendations/{id}   — update rec status

  GET  /intelligence/bottleneck         — P1.4 funnel bottleneck analysis
  GET  /intelligence/management-tasks   — P1.8 prioritised action list for mgmt
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_customer_id
from app.db.session import get_db
from app.db import crud
from app.db.models import (
    Account, SalesforceOpportunity, GTMConfig, Recommendation,
)

router = APIRouter()


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class AccountOut(BaseModel):
    id: str
    name: str
    domain: Optional[str]
    industry: Optional[str]
    employee_count: Optional[int]
    revenue: Optional[int]
    location: Optional[str]
    icp_score: Optional[int]
    icp_tier: Optional[str]
    in_crm: bool
    has_open_deal: bool
    sources: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OpportunityHealth(BaseModel):
    sf_opportunity_id: str
    account_name: Optional[str]
    amount: Optional[int]
    stage: Optional[str]
    close_date: Optional[datetime]
    owner_name: Optional[str]
    health_score: Optional[int]
    health_risk_flags: Optional[List[str]]
    days_since_activity: Optional[int]
    is_stalled: bool


class AccountDetailOut(AccountOut):
    open_deals: List[OpportunityHealth] = []


class RecOut(BaseModel):
    id: str
    rec_type: str
    priority: str
    title: str
    description: Optional[str]
    status: str
    sf_opp_id: Optional[str]
    owner_name: Optional[str]
    account_id: Optional[str]
    generated_at: datetime
    expires_at: Optional[datetime]
    actioned_at: Optional[datetime]

    class Config:
        from_attributes = True


class RecStatusUpdate(BaseModel):
    status: str  # actioned / dismissed


# ─────────────────────────────────────────────
# ACCOUNTS
# ─────────────────────────────────────────────

@router.get("", response_model=List[AccountOut])
async def list_accounts(
    icp_tier: Optional[str] = Query(None, description="A/B/C/D"),
    has_open_deal: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """List canonical accounts, optionally filtered by ICP tier / deal status."""
    accounts = await crud.get_accounts(
        db, customer_id,
        icp_tier=icp_tier,
        has_open_deal=has_open_deal,
        search=search,
        skip=skip,
        limit=limit,
    )
    return [_account_out(a) for a in accounts]


@router.get("/{account_id}", response_model=AccountDetailOut)
async def get_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Get a single account with its open deals and health scores."""
    account = await crud.get_account(db, account_id, customer_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Load open deals for this account (matched by name)
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.account_name == account.name,
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
        ).order_by(SalesforceOpportunity.amount.desc().nullslast())
    )
    opps = opps_result.scalars().all()

    return {
        **_account_out(account),
        "open_deals": [_opp_health(o) for o in opps],
    }


# ─────────────────────────────────────────────
# RECOMMENDATIONS  (P1.5)
# ─────────────────────────────────────────────

@router.get("/recommendations/list", response_model=List[RecOut])
async def list_recommendations(
    status: Optional[str] = Query("pending"),
    rec_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """List recommendations for the current customer."""
    await crud.expire_old_recommendations(db, customer_id)
    recs = await crud.get_recommendations(
        db, customer_id, status=status, rec_type=rec_type, limit=limit
    )
    return [_rec_out(r) for r in recs]


@router.post("/recommendations/compute")
async def compute_recommendations(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Manually trigger recommendation computation (also runs after every sync)."""
    recs = await crud.compute_and_save_recommendations(db, customer_id)
    await db.commit()
    return {"generated": len(recs)}


@router.put("/recommendations/{rec_id}", response_model=RecOut)
async def update_recommendation(
    rec_id: str,
    body: RecStatusUpdate,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Mark a recommendation as actioned or dismissed."""
    if body.status not in ("actioned", "dismissed"):
        raise HTTPException(status_code=400, detail="status must be 'actioned' or 'dismissed'")
    rec = await crud.update_recommendation_status(db, rec_id, customer_id, body.status)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    await db.commit()
    return _rec_out(rec)


# ─────────────────────────────────────────────
# P1.4  BOTTLENECK ANALYSIS
# ─────────────────────────────────────────────

@router.get("/intelligence/bottleneck")
async def get_bottleneck(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    P1.4: Identify the biggest constraint in the GTM funnel.

    Computes:
    - TAM coverage  (ICP accounts in CRM / TAM estimate)
    - Activation rate  (accounts with open deal / ICP accounts in CRM)
    - Pipeline coverage  (open pipeline / 3× revenue target)
    - Stall rate  (stalled deals / total open deals)
    - Avg days to close vs target cycle

    Returns all metrics + a 'bottleneck' field naming the worst one.
    """
    now = datetime.utcnow()
    gtm = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == customer_id))
    goals = (gtm.goals or {}) if gtm else {}
    icp_cfg = (gtm.icp or {}) if gtm else {}

    # ── ICP accounts in CRM ────────────────────────────────────────────────
    icp_in_crm = await db.scalar(
        select(func.count(Account.id)).where(
            Account.customer_id == customer_id,
            Account.icp_tier.in_(("A", "B")),
            Account.in_crm == True,  # noqa: E712
        )
    ) or 0

    total_icp_accounts = await db.scalar(
        select(func.count(Account.id)).where(
            Account.customer_id == customer_id,
            Account.icp_tier.in_(("A", "B")),
        )
    ) or 0

    tam_estimate = icp_cfg.get("tam_total") or 0
    tam_coverage_pct = round(icp_in_crm / tam_estimate * 100, 1) if tam_estimate else None

    # ── Activation rate ────────────────────────────────────────────────────
    activated = await db.scalar(
        select(func.count(Account.id)).where(
            Account.customer_id == customer_id,
            Account.icp_tier.in_(("A", "B")),
            Account.has_open_deal == True,  # noqa: E712
        )
    ) or 0
    activation_rate_pct = round(activated / icp_in_crm * 100, 1) if icp_in_crm else 0

    # ── Pipeline coverage ──────────────────────────────────────────────────
    pipeline_value = await db.scalar(
        select(func.coalesce(func.sum(SalesforceOpportunity.amount), 0)).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
        )
    ) or 0
    revenue_target = goals.get("revenue_target") or 0
    pipeline_coverage_ratio = round(pipeline_value / revenue_target, 2) if revenue_target else None

    # ── Stall rate ─────────────────────────────────────────────────────────
    total_open = await db.scalar(
        select(func.count(SalesforceOpportunity.id)).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
        )
    ) or 0
    stalled_count = await db.scalar(
        select(func.count(SalesforceOpportunity.id)).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.is_stalled == True,  # noqa: E712
        )
    ) or 0
    stall_rate_pct = round(stalled_count / total_open * 100, 1) if total_open else 0

    # ── Identify bottleneck ────────────────────────────────────────────────
    bottleneck = _identify_bottleneck(
        tam_coverage_pct=tam_coverage_pct,
        activation_rate_pct=activation_rate_pct,
        pipeline_coverage_ratio=pipeline_coverage_ratio,
        stall_rate_pct=stall_rate_pct,
    )

    return {
        "bottleneck": bottleneck,
        "metrics": {
            "tam_coverage_pct": tam_coverage_pct,
            "tam_estimate": tam_estimate,
            "icp_accounts_in_crm": icp_in_crm,
            "total_icp_accounts_known": total_icp_accounts,
            "activation_rate_pct": activation_rate_pct,
            "accounts_with_open_deal": activated,
            "pipeline_value": pipeline_value,
            "revenue_target": revenue_target,
            "pipeline_coverage_ratio": pipeline_coverage_ratio,
            "open_deals": total_open,
            "stalled_deals": stalled_count,
            "stall_rate_pct": stall_rate_pct,
        },
    }


def _identify_bottleneck(
    tam_coverage_pct: Optional[float],
    activation_rate_pct: float,
    pipeline_coverage_ratio: Optional[float],
    stall_rate_pct: float,
) -> Dict[str, Any]:
    """Determine which metric is furthest below its healthy threshold."""
    checks = []

    if tam_coverage_pct is not None and tam_coverage_pct < 10:
        checks.append({
            "name": "tam_coverage",
            "label": "TAM coverage",
            "value": tam_coverage_pct,
            "threshold": 10,
            "severity": "critical" if tam_coverage_pct < 5 else "warning",
            "message": (
                f"Only {tam_coverage_pct}% of your TAM is in CRM. "
                "Not enough accounts to prospect from."
            ),
        })

    if activation_rate_pct < 30:
        checks.append({
            "name": "activation_rate",
            "label": "ICP activation rate",
            "value": activation_rate_pct,
            "threshold": 30,
            "severity": "critical" if activation_rate_pct < 15 else "warning",
            "message": (
                f"Only {activation_rate_pct}% of ICP accounts have an open deal. "
                "More accounts need to be activated."
            ),
        })

    if pipeline_coverage_ratio is not None and pipeline_coverage_ratio < 3:
        checks.append({
            "name": "pipeline_coverage",
            "label": "Pipeline coverage",
            "value": pipeline_coverage_ratio,
            "threshold": 3.0,
            "severity": "critical" if pipeline_coverage_ratio < 1.5 else "warning",
            "message": (
                f"Pipeline is {pipeline_coverage_ratio}× target — need at least 3×. "
                "Increase prospecting volume."
            ),
        })

    if stall_rate_pct > 30:
        checks.append({
            "name": "stall_rate",
            "label": "Deal stall rate",
            "value": stall_rate_pct,
            "threshold": 30,
            "severity": "critical" if stall_rate_pct > 50 else "warning",
            "message": (
                f"{stall_rate_pct}% of open deals are stalled. "
                "Deals are getting stuck — inspect middle-funnel stages."
            ),
        })

    if not checks:
        return {"name": "none", "label": "No critical bottleneck", "message": "All metrics look healthy."}

    # Worst = highest severity, then lowest relative value vs threshold
    checks.sort(key=lambda c: (c["severity"] == "critical", c["value"] / c["threshold"]))
    return checks[0]


# ─────────────────────────────────────────────
# P1.8  MANAGEMENT TASKS
# ─────────────────────────────────────────────

@router.get("/intelligence/management-tasks")
async def get_management_tasks(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    P1.8: Prioritised action list for sales leadership.

    Returns structured list of tasks across categories:
    - stalled_deals_by_rep
    - closing_soon_no_activity
    - reps_below_target
    - icp_accounts_not_activated
    - coverage_gap
    """
    now = datetime.utcnow()
    gtm = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == customer_id))
    goals = (gtm.goals or {}) if gtm else {}
    win_rate_target = goals.get("win_rate_pct") or 30

    tasks: List[Dict] = []

    # ── 1. Stalled deals grouped by rep ───────────────────────────────────
    stalled_result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.is_stalled == True,  # noqa: E712
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
        ).order_by(SalesforceOpportunity.owner_name, SalesforceOpportunity.amount.desc().nullslast())
    )
    stalled_opps = stalled_result.scalars().all()

    by_rep: Dict[str, List] = {}
    for o in stalled_opps:
        rep = o.owner_name or "Unassigned"
        by_rep.setdefault(rep, []).append({
            "opp_id": o.sf_opportunity_id,
            "account": o.account_name,
            "amount": o.amount,
            "stage": o.stage,
            "days_since_activity": o.days_since_activity,
            "health_score": o.health_score,
        })

    for rep, deals in sorted(by_rep.items(), key=lambda x: len(x[1]), reverse=True):
        tasks.append({
            "category": "stalled_deals_by_rep",
            "priority": "high",
            "rep": rep,
            "count": len(deals),
            "title": f"{rep}: {len(deals)} stalled deal(s) need attention",
            "description": "Push forward or close these deals to clean the pipeline.",
            "deals": deals[:5],  # top 5
        })

    # ── 2. Closing soon with no activity ──────────────────────────────────
    soon = now + timedelta(days=14)
    inact = now - timedelta(days=7)
    closing_result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
            SalesforceOpportunity.close_date.between(now, soon),
            SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
            SalesforceOpportunity.last_activity_date < inact,
        ).order_by(SalesforceOpportunity.close_date.asc())
    )
    closing_opps = closing_result.scalars().all()
    if closing_opps:
        tasks.append({
            "category": "closing_soon_no_activity",
            "priority": "urgent",
            "count": len(closing_opps),
            "title": f"{len(closing_opps)} deal(s) closing within 14 days but no recent activity",
            "description": "These deals need immediate attention — contact the account or accept the loss.",
            "deals": [
                {
                    "opp_id": o.sf_opportunity_id,
                    "account": o.account_name,
                    "amount": o.amount,
                    "close_date": o.close_date.isoformat() if o.close_date else None,
                    "owner": o.owner_name,
                }
                for o in closing_opps[:10]
            ],
        })

    # ── 3. ICP A-tier accounts with no open deal ──────────────────────────
    icp_no_deal_result = await db.execute(
        select(Account).where(
            Account.customer_id == customer_id,
            Account.icp_tier == "A",
            Account.has_open_deal == False,  # noqa: E712
        ).order_by(Account.icp_score.desc()).limit(10)
    )
    icp_no_deal = icp_no_deal_result.scalars().all()
    if icp_no_deal:
        tasks.append({
            "category": "icp_accounts_not_activated",
            "priority": "medium",
            "count": len(icp_no_deal),
            "title": f"{len(icp_no_deal)} A-tier ICP account(s) have no active deal",
            "description": "These are your best-fit prospects. Assign to a rep and start outreach.",
            "accounts": [
                {
                    "id": str(a.id),
                    "name": a.name,
                    "domain": a.domain,
                    "icp_score": a.icp_score,
                    "industry": a.industry,
                    "employee_count": a.employee_count,
                }
                for a in icp_no_deal
            ],
        })

    # ── 4. Coverage gap ────────────────────────────────────────────────────
    target = goals.get("revenue_target") or 0
    if target:
        pipeline_val = await db.scalar(
            select(func.coalesce(func.sum(SalesforceOpportunity.amount), 0)).where(
                SalesforceOpportunity.customer_id == customer_id,
                SalesforceOpportunity.stage.notin_(("Closed Won", "Closed Lost")),
            )
        ) or 0
        if pipeline_val < target * 3:
            ratio = round(pipeline_val / target, 2) if target else 0
            tasks.append({
                "category": "coverage_gap",
                "priority": "high",
                "title": f"Pipeline coverage at {ratio}× — target is 3×",
                "description": (
                    f"Open pipeline: {pipeline_val:,.0f} vs target: {target:,.0f}. "
                    "Increase prospecting, add more accounts, or adjust the revenue target."
                ),
                "pipeline_value": pipeline_val,
                "revenue_target": target,
                "coverage_ratio": ratio,
            })

    # Sort: urgent first, then high, then medium
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    tasks.sort(key=lambda t: priority_order.get(t.get("priority", "low"), 3))

    return {
        "tasks": tasks,
        "total": len(tasks),
        "generated_at": now.isoformat(),
    }


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _account_out(a: Account) -> Dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "domain": a.domain,
        "industry": a.industry,
        "employee_count": a.employee_count,
        "revenue": a.revenue,
        "location": a.location,
        "icp_score": a.icp_score,
        "icp_tier": a.icp_tier,
        "in_crm": a.in_crm,
        "has_open_deal": a.has_open_deal,
        "sources": a.sources,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _opp_health(o: SalesforceOpportunity) -> Dict:
    return {
        "sf_opportunity_id": o.sf_opportunity_id,
        "account_name": o.account_name,
        "amount": o.amount,
        "stage": o.stage,
        "close_date": o.close_date.isoformat() if o.close_date else None,
        "owner_name": o.owner_name,
        "health_score": o.health_score,
        "health_risk_flags": o.health_risk_flags or [],
        "days_since_activity": o.days_since_activity,
        "is_stalled": o.is_stalled,
    }


def _rec_out(r: Recommendation) -> Dict:
    return {
        "id": str(r.id),
        "rec_type": r.rec_type,
        "priority": r.priority,
        "title": r.title,
        "description": r.description,
        "status": r.status,
        "sf_opp_id": r.sf_opp_id,
        "owner_name": r.owner_name,
        "account_id": str(r.account_id) if r.account_id else None,
        "generated_at": r.generated_at.isoformat() if r.generated_at else None,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "actioned_at": r.actioned_at.isoformat() if r.actioned_at else None,
    }
