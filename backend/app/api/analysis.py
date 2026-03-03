"""
Analysis API Routes
Real revenue analytics for CEO, RevOps, and GTM personas.

Endpoints:
  GET /api/analysis/funnel    — stage conversion rates + deal velocity
  GET /api/analysis/health    — CRM health score with issue breakdown
  GET /api/analysis/forecast  — weighted revenue forecast
  GET /api/analysis/accounts  — prioritised account list for GTM
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_customer_id_dev as get_current_customer_id
from app.db.models import Alert, Lead, SalesforceOpportunity
from app.db.session import get_db

router = APIRouter()


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

# HubSpot stage → probability (close rate)
# Maps both raw HubSpot stage keys and display names
STAGE_PROBABILITY: Dict[str, float] = {
    # HubSpot internal keys
    "appointmentscheduled":      0.20,
    "qualifiedtobuy":            0.40,
    "presentationscheduled":     0.60,
    "decisionmakerboughtin":     0.70,
    "contractsent":              0.85,
    "closedwon":                 1.00,
    "closedlost":                0.00,
    # Salesforce defaults
    "prospecting":               0.10,
    "qualification":             0.20,
    "needs analysis":            0.25,
    "value proposition":         0.35,
    "id. decision makers":       0.45,
    "perception analysis":       0.55,
    "proposal/price quote":      0.65,
    "negotiation/review":        0.80,
    "closed won":                1.00,
    "closed lost":               0.00,
}

# Stage order for funnel (top → bottom)
STAGE_ORDER = [
    "appointmentscheduled",
    "qualifiedtobuy",
    "presentationscheduled",
    "decisionmakerboughtin",
    "contractsent",
    "closedwon",
    "closedlost",
    # Salesforce
    "prospecting",
    "qualification",
    "needs analysis",
    "value proposition",
    "id. decision makers",
    "perception analysis",
    "proposal/price quote",
    "negotiation/review",
    "closed won",
    "closed lost",
]

STALE_DAYS = getattr(settings, "ALERT_STALE_DEAL_DAYS", 14)


def _label(stage: str) -> str:
    """Convert a snake_case / camelCase stage key to a display label."""
    import re
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", stage or "Unknown")
    return s.replace("_", " ").title()


def _stage_prob(stage: str) -> float:
    return STAGE_PROBABILITY.get((stage or "").lower(), 0.30)


# ─────────────────────────────────────────────
# 1. FUNNEL — stage conversion rates + velocity
# ─────────────────────────────────────────────

@router.get("/funnel")
async def get_funnel_metrics(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns per-stage metrics for the pipeline funnel.

    For each stage:
      - count        : deals currently in this stage
      - total_value  : sum of deal amounts
      - avg_velocity : average days deals have been in this stage (approximated
                       by days since last_activity_date for deals lacking a
                       stage-entry timestamp)
      - probability  : configured close probability for this stage
      - conversion   : estimated conversion % to the next stage (based on
                       historical deal counts — ratio of next stage / this stage)
    """
    result = await db.execute(
        select(SalesforceOpportunity)
        .where(SalesforceOpportunity.customer_id == customer_id)
    )
    opps = result.scalars().all()

    now = datetime.utcnow()

    # Group by stage
    by_stage: Dict[str, Dict] = {}
    for opp in opps:
        stage_key = (opp.stage or "unknown").lower()
        if stage_key not in by_stage:
            by_stage[stage_key] = {
                "stage": opp.stage or "Unknown",
                "stage_key": stage_key,
                "count": 0,
                "total_value": 0.0,
                "days_sum": 0,
                "days_count": 0,
                "probability": _stage_prob(stage_key),
            }
        bucket = by_stage[stage_key]
        bucket["count"] += 1
        bucket["total_value"] += opp.amount or 0

        # Approximate velocity using days since last activity
        if opp.last_activity_date:
            days = (now - opp.last_activity_date).days
            bucket["days_sum"] += days
            bucket["days_count"] += 1

    # Sort stages by configured order, then alpha for unknowns
    ordered_keys = [k for k in STAGE_ORDER if k in by_stage]
    for k in sorted(by_stage.keys()):
        if k not in ordered_keys:
            ordered_keys.append(k)

    funnel_stages = []
    counts = [by_stage[k]["count"] for k in ordered_keys]

    for i, key in enumerate(ordered_keys):
        b = by_stage[key]
        avg_vel = (
            round(b["days_sum"] / b["days_count"], 1)
            if b["days_count"] > 0 else None
        )
        # Conversion to next stage = next_stage_count / this_stage_count
        conv = None
        if i < len(counts) - 1 and b["count"] > 0:
            conv = round((counts[i + 1] / b["count"]) * 100, 1)

        funnel_stages.append({
            "stage": b["stage"],
            "stage_key": key,
            "label": _label(b["stage"]),
            "count": b["count"],
            "total_value": b["total_value"],
            "total_value_display": f'€{b["total_value"]:,.0f}' if b["total_value"] else "€0",
            "avg_velocity_days": avg_vel,
            "probability": b["probability"],
            "conversion_to_next_pct": conv,
        })

    total_deals = len(opps)
    total_value = sum(o.amount or 0 for o in opps)

    return {
        "total_deals": total_deals,
        "total_value": total_value,
        "total_value_display": f"€{total_value:,.0f}",
        "stages": funnel_stages,
    }


# ─────────────────────────────────────────────
# 2. HEALTH — CRM data quality score
# ─────────────────────────────────────────────

@router.get("/health")
async def get_crm_health(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    CRM health score (0–100) with per-issue breakdown.

    Checks:
      - Deals missing close date
      - Deals missing amount
      - Deals missing owner
      - Stalled deals (no activity > STALE_DAYS)
      - Deals missing next activity / follow-up
    """
    result = await db.execute(
        select(SalesforceOpportunity)
        .where(SalesforceOpportunity.customer_id == customer_id)
    )
    opps = result.scalars().all()

    total = len(opps)
    if total == 0:
        return {
            "score": 100,
            "grade": "A",
            "total_deals": 0,
            "issues": [],
            "summary": "No deals to analyse.",
        }

    now = datetime.utcnow()
    issues = []
    penalty = 0

    # ── Missing close date ──
    missing_close = [o for o in opps if not o.close_date]
    if missing_close:
        pct = round(len(missing_close) / total * 100)
        issues.append({
            "type": "missing_close_date",
            "label": "Missing Close Date",
            "count": len(missing_close),
            "pct": pct,
            "severity": "high" if pct > 30 else "medium",
            "advice": "Deals without a close date are invisible to forecasting.",
            "deals": [o.account_name for o in missing_close[:5]],
        })
        penalty += min(25, pct * 0.5)

    # ── Missing amount ──
    missing_amount = [o for o in opps if not o.amount or o.amount == 0]
    if missing_amount:
        pct = round(len(missing_amount) / total * 100)
        issues.append({
            "type": "missing_amount",
            "label": "Missing Deal Amount",
            "count": len(missing_amount),
            "pct": pct,
            "severity": "high" if pct > 30 else "medium",
            "advice": "Unquantified deals distort pipeline value calculations.",
            "deals": [o.account_name for o in missing_amount[:5]],
        })
        penalty += min(20, pct * 0.4)

    # ── Missing owner ──
    missing_owner = [o for o in opps if not o.owner_name]
    if missing_owner:
        pct = round(len(missing_owner) / total * 100)
        issues.append({
            "type": "missing_owner",
            "label": "Unassigned Deals",
            "count": len(missing_owner),
            "pct": pct,
            "severity": "medium",
            "advice": "Unassigned deals have no accountable owner for follow-up.",
            "deals": [o.account_name for o in missing_owner[:5]],
        })
        penalty += min(15, pct * 0.3)

    # ── Stalled deals ──
    stalled = [
        o for o in opps
        if o.last_activity_date
        and (now - o.last_activity_date).days >= STALE_DAYS
        and (o.stage or "").lower() not in ("closedwon", "closedlost", "closed won", "closed lost")
    ]
    if stalled:
        pct = round(len(stalled) / total * 100)
        issues.append({
            "type": "stalled_deals",
            "label": f"Stalled >{STALE_DAYS}d",
            "count": len(stalled),
            "pct": pct,
            "severity": "urgent" if pct > 40 else "high",
            "advice": f"Deals with no activity for more than {STALE_DAYS} days are at risk of going cold.",
            "deals": [o.account_name for o in stalled[:5]],
        })
        penalty += min(25, pct * 0.6)

    # ── No activity at all ──
    no_activity = [o for o in opps if not o.last_activity_date]
    if no_activity:
        pct = round(len(no_activity) / total * 100)
        issues.append({
            "type": "no_activity_logged",
            "label": "No Activity Logged",
            "count": len(no_activity),
            "pct": pct,
            "severity": "medium",
            "advice": "Deals with no activity data can't be monitored for staleness.",
            "deals": [o.account_name for o in no_activity[:5]],
        })
        penalty += min(15, pct * 0.3)

    score = max(0, round(100 - penalty))
    grade = (
        "A" if score >= 90 else
        "B" if score >= 75 else
        "C" if score >= 60 else
        "D" if score >= 45 else
        "F"
    )

    return {
        "score": score,
        "grade": grade,
        "total_deals": total,
        "issues": issues,
        "clean_deals": total - len(set(
            o.id
            for lst in [missing_close, missing_amount, missing_owner, stalled, no_activity]
            for o in lst
        )),
        "summary": (
            f"{score}/100 — {grade} grade. "
            + (f"{len(issues)} issue type(s) detected." if issues else "Pipeline is clean!")
        ),
    }


# ─────────────────────────────────────────────
# 3. FORECAST — weighted revenue forecast
# ─────────────────────────────────────────────

@router.get("/forecast")
async def get_revenue_forecast(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Weighted revenue forecast using stage probabilities.

    Returns:
      - weighted_forecast   : sum(amount × stage_probability) for all open deals
      - best_case           : sum of all deal amounts
      - commit_forecast     : deals in stages >= 70% probability
      - by_month            : breakdown by close_date month
      - by_owner            : breakdown by owner
      - by_stage            : breakdown by stage (weighted)
    """
    result = await db.execute(
        select(SalesforceOpportunity)
        .where(
            and_(
                SalesforceOpportunity.customer_id == customer_id,
                # Exclude closed lost
            )
        )
    )
    opps = result.scalars().all()

    # Filter to open deals (not closed lost)
    open_opps = [
        o for o in opps
        if (o.stage or "").lower() not in ("closedlost", "closed lost")
    ]
    won_opps = [
        o for o in opps
        if (o.stage or "").lower() in ("closedwon", "closed won")
    ]

    weighted_total = 0.0
    best_case = 0.0
    commit_total = 0.0
    by_month: Dict[str, float] = {}
    by_owner: Dict[str, float] = {}
    by_stage: Dict[str, Dict] = {}

    for opp in open_opps:
        amount = opp.amount or 0
        prob = _stage_prob((opp.stage or "").lower())
        weighted = amount * prob

        weighted_total += weighted
        best_case += amount
        if prob >= 0.70:
            commit_total += amount

        # By month (close date)
        if opp.close_date:
            month_key = opp.close_date.strftime("%Y-%m")
        else:
            month_key = "No Date"
        by_month[month_key] = by_month.get(month_key, 0) + weighted

        # By owner
        owner = opp.owner_name or "Unassigned"
        by_owner[owner] = by_owner.get(owner, 0) + weighted

        # By stage
        stage_key = (opp.stage or "Unknown").lower()
        if stage_key not in by_stage:
            by_stage[stage_key] = {
                "label": _label(opp.stage or "Unknown"),
                "weighted": 0.0,
                "count": 0,
                "probability": prob,
            }
        by_stage[stage_key]["weighted"] += weighted
        by_stage[stage_key]["count"] += 1

    # Sort by_month chronologically
    sorted_months = sorted(
        [{"month": k, "weighted_value": v, "display": f"€{v:,.0f}"} for k, v in by_month.items()],
        key=lambda x: x["month"]
    )

    # Sort by_owner descending
    sorted_owners = sorted(
        [{"owner": k, "weighted_value": v, "display": f"€{v:,.0f}"} for k, v in by_owner.items()],
        key=lambda x: x["weighted_value"],
        reverse=True,
    )

    # Sort by_stage by probability descending
    sorted_stages = sorted(
        [
            {
                "stage": k,
                "label": v["label"],
                "weighted_value": v["weighted"],
                "count": v["count"],
                "probability": v["probability"],
                "display": f"€{v['weighted']:,.0f}",
            }
            for k, v in by_stage.items()
        ],
        key=lambda x: x["probability"],
        reverse=True,
    )

    # Already-won (closed won) this period
    won_total = sum(o.amount or 0 for o in won_opps)

    return {
        "weighted_forecast": round(weighted_total),
        "weighted_forecast_display": f"€{weighted_total:,.0f}",
        "best_case": round(best_case),
        "best_case_display": f"€{best_case:,.0f}",
        "commit_forecast": round(commit_total),
        "commit_forecast_display": f"€{commit_total:,.0f}",
        "closed_won": round(won_total),
        "closed_won_display": f"€{won_total:,.0f}",
        "open_deal_count": len(open_opps),
        "by_month": sorted_months,
        "by_owner": sorted_owners,
        "by_stage": sorted_stages,
    }


# ─────────────────────────────────────────────
# 4. ACCOUNTS — prioritised account list for GTM
# ─────────────────────────────────────────────

@router.get("/accounts")
async def get_prioritised_accounts(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """
    Ranked list of accounts to focus on today.

    Priority score = lead_score × stage_probability × recency_bonus.

    Returns accounts merged from leads + open deals, with:
      - priority_score   : combined priority 0–100
      - urgency_signal   : reason for urgency (e.g. stalled, high score, pending alert)
      - next_action      : AI-suggested next action from the lead record
      - has_open_deal    : whether there's an active deal in CRM
    """
    now = datetime.utcnow()

    # Fetch leads (scored)
    leads_result = await db.execute(
        select(Lead)
        .where(Lead.customer_id == customer_id)
        .order_by(Lead.score.desc().nullslast())
        .limit(100)
    )
    leads = leads_result.scalars().all()

    # Fetch open deals
    deals_result = await db.execute(
        select(SalesforceOpportunity)
        .where(
            and_(
                SalesforceOpportunity.customer_id == customer_id,
            )
        )
    )
    deals = deals_result.scalars().all()

    # Fetch pending alerts for urgency signals
    alerts_result = await db.execute(
        select(Alert)
        .where(
            and_(
                Alert.customer_id == customer_id,
                Alert.status == "pending",
            )
        )
    )
    alerts = alerts_result.scalars().all()

    # Build company → deal map
    deal_by_company: Dict[str, SalesforceOpportunity] = {}
    for d in deals:
        name = (d.account_name or "").lower()
        if name and name not in deal_by_company:
            deal_by_company[name] = d

    # Build company → alert map
    alert_by_company: Dict[str, List[Alert]] = {}
    for a in alerts:
        ctx = a.context_json or {}
        company = (
            ctx.get("company_name") or
            ctx.get("opportunity_name") or
            ctx.get("account_name") or ""
        ).lower()
        if company:
            alert_by_company.setdefault(company, []).append(a)

    accounts = []
    seen_companies = set()

    for lead in leads:
        company_key = (lead.company_name or "").lower()
        if company_key in seen_companies:
            continue
        seen_companies.add(company_key)

        score = lead.score or 0
        deal = deal_by_company.get(company_key)
        company_alerts = alert_by_company.get(company_key, [])

        # Stage probability from matched deal
        stage_prob = _stage_prob((deal.stage if deal else "").lower()) if deal else 0.30

        # Recency bonus: deals with recent activity rank higher
        recency_bonus = 1.0
        if deal and deal.last_activity_date:
            days_since = (now - deal.last_activity_date).days
            if days_since <= 3:
                recency_bonus = 1.3
            elif days_since <= 7:
                recency_bonus = 1.1
            elif days_since >= 14:
                recency_bonus = 0.7

        # Alert urgency boost
        alert_boost = 1.0
        if company_alerts:
            max_priority = min(
                [{"urgent": 0, "high": 1, "medium": 2, "low": 3}.get(a.priority, 3) for a in company_alerts]
            )
            alert_boost = 1.4 if max_priority == 0 else (1.2 if max_priority == 1 else 1.1)

        priority_score = min(100, round(score * stage_prob * recency_bonus * alert_boost))

        # Urgency signals
        signals = []
        if deal:
            days_inactive = (now - deal.last_activity_date).days if deal.last_activity_date else None
            if days_inactive is not None and days_inactive >= STALE_DAYS:
                signals.append(f"Deal stalled {days_inactive}d")
            if deal.close_date and deal.close_date <= (now + timedelta(days=14)).date():
                signals.append(f"Closes {deal.close_date.strftime('%b %d')}")
        for a in company_alerts[:2]:
            signals.append(a.headline[:60] if a.headline else a.type)

        accounts.append({
            "company": lead.company_name,
            "domain": lead.company_domain,
            "contact": lead.contact_name,
            "contact_title": lead.contact_title,
            "owner": lead.owner_name,
            "lead_score": score,
            "priority": lead.priority,
            "priority_score": priority_score,
            "industry": lead.industry,
            "employee_count": lead.employee_count,
            "has_open_deal": deal is not None,
            "deal_stage": _label(deal.stage) if deal else None,
            "deal_amount": deal.amount if deal else None,
            "deal_amount_display": f"€{deal.amount:,.0f}" if deal and deal.amount else None,
            "deal_close_date": deal.close_date.strftime("%Y-%m-%d") if deal and deal.close_date else None,
            "urgency_signals": signals,
            "next_action": lead.recommendation,
            "alert_count": len(company_alerts),
            "source": lead.source,
        })

    # Sort by priority_score descending
    accounts.sort(key=lambda x: x["priority_score"], reverse=True)

    return {
        "accounts": accounts[:limit],
        "total": len(accounts),
        "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
    }


# ─────────────────────────────────────────────
# Legacy stubs (kept for backwards compat)
# ─────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard_metrics(db: AsyncSession = Depends(get_db)):
    return {"message": "Use /api/analysis/funnel, /health, /forecast, /accounts instead."}


@router.get("/insights")
async def get_insights(db: AsyncSession = Depends(get_db)):
    return {"insights": []}


@router.get("/signals")
async def get_signal_breakdown(db: AsyncSession = Depends(get_db)):
    return {"funding": 0, "hiring": 0, "tech_change": 0, "intent": 0, "content": 0}


@router.get("/patterns")
async def get_conversion_patterns(db: AsyncSession = Depends(get_db)):
    return {"patterns": []}
