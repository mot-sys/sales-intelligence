"""
GTM (Go-To-Market) Configuration & Intelligence API

Endpoints:
  GET  /api/gtm/config        — retrieve strategy, ICP, goals
  PUT  /api/gtm/config        — upsert config (merge partial updates)
  GET  /api/gtm/intelligence  — compute board-level GTM KPIs
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, timedelta, timezone
import math

from app.db.session import get_db
from app.db.models import (
    GTMConfig,
    SalesforceOpportunity,
    SalesforceAccount,
    Lead,
    Signal,
    ConversionData,
    Alert,
)
from app.core.security import get_current_customer_id_dev as get_current_customer_id

router = APIRouter()


# ─────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────

class GTMConfigUpdate(BaseModel):
    company_description: Optional[str] = None
    value_proposition:   Optional[str] = None
    competitors:         Optional[List[Any]] = None
    offerings:           Optional[List[Any]] = None
    icp:                 Optional[Any] = None
    goals:               Optional[Any] = None


class GTMConfigResponse(BaseModel):
    customer_id:         str
    company_description: Optional[str] = None
    value_proposition:   Optional[str] = None
    competitors:         Optional[List[Any]] = None
    offerings:           Optional[List[Any]] = None
    icp:                 Optional[Any] = None
    goals:               Optional[Any] = None
    updated_at:          Optional[str] = None


# ─────────────────────────────────────────────────────────
# Stage → probability mapping (mirrors analysis.py)
# ─────────────────────────────────────────────────────────

STAGE_PROBS = {
    "appointmentscheduled": 0.20,
    "qualifiedtobuy":       0.40,
    "presentationscheduled":0.50,
    "decisionmakerboughtin":0.60,
    "contractsent":         0.80,
    "closedwon":            1.00,
    "closedlost":           0.00,
    # Salesforce defaults
    "prospecting":          0.10,
    "qualification":        0.20,
    "needs analysis":       0.30,
    "value proposition":    0.40,
    "id. decision makers":  0.50,
    "perception analysis":  0.60,
    "proposal/price quote": 0.70,
    "negotiation/review":   0.80,
    "closed won":           1.00,
    "closed lost":          0.00,
}

CLOSED_LOST_STAGES = {"closedlost", "closed lost", "closed-lost"}
CLOSED_WON_STAGES  = {"closedwon",  "closed won",  "closed-won"}


def _stage_prob(stage: Optional[str]) -> float:
    if not stage:
        return 0.30
    normalized = stage.lower().replace(" ", "").replace("_", "").replace("-", "")
    return STAGE_PROBS.get(normalized, STAGE_PROBS.get(stage.lower(), 0.30))


def _is_closed_lost(stage: Optional[str]) -> bool:
    return (stage or "").lower().replace(" ", "-") in {"closed-lost", "closedlost", "closed lost"}


def _is_closed_won(stage: Optional[str]) -> bool:
    return (stage or "").lower().replace(" ", "-") in {"closed-won", "closedwon", "closed won"}


def _is_open(stage: Optional[str]) -> bool:
    return not _is_closed_lost(stage) and not _is_closed_won(stage)


# ─────────────────────────────────────────────────────────
# Activity formula helper
# ─────────────────────────────────────────────────────────

def _calc_activity(goals: dict) -> dict:
    revenue_target        = float(goals.get("revenue_target", 0) or 0)
    acv                   = float(goals.get("acv", 0) or 0)
    win_rate              = float(goals.get("win_rate_pct", 25) or 25) / 100
    opp_to_meeting        = float(goals.get("opp_to_meeting_rate_pct", 30) or 30) / 100
    outreach_response     = float(goals.get("outreach_response_rate_pct", 10) or 10) / 100
    period                = goals.get("period", "annual")

    weeks = 13 if period == "quarterly" else 52

    if acv <= 0 or win_rate <= 0:
        return {}

    deals_needed        = math.ceil(revenue_target / acv)
    opps_needed         = math.ceil(deals_needed / win_rate)           if win_rate > 0        else 0
    meetings_needed     = math.ceil(opps_needed / opp_to_meeting)      if opp_to_meeting > 0  else 0
    accounts_to_contact = math.ceil(meetings_needed / outreach_response) if outreach_response > 0 else 0

    return {
        "deals_needed":        deals_needed,
        "opps_needed":         opps_needed,
        "meetings_needed":     meetings_needed,
        "accounts_to_contact": accounts_to_contact,
        "weekly_accounts":     round(accounts_to_contact / weeks, 1),
        "weekly_meetings":     round(meetings_needed / weeks, 1),
        "weekly_opps":         round(opps_needed / weeks, 1),
        "period":              period,
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/config
# ─────────────────────────────────────────────────────────

@router.get("/config")
async def get_gtm_config(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    cid = UUID(customer_id)
    result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = result.scalar_one_or_none()

    if not cfg:
        return {
            "customer_id":         customer_id,
            "company_description": None,
            "value_proposition":   None,
            "competitors":         [],
            "offerings":           [],
            "icp":                 {
                "personas": [],
                "company_filters": {
                    "industries": [], "employee_min": 1, "employee_max": 5000,
                    "geographies": [], "technologies": [],
                },
                "tam_total": 0,
                "tam_notes": "",
            },
            "goals": {
                "period": "annual",
                "revenue_target": 0, "acv": 0,
                "win_rate_pct": 25,
                "opp_to_meeting_rate_pct": 30,
                "outreach_response_rate_pct": 10,
                "current_arr": 0,
            },
            "updated_at": None,
        }

    return {
        "customer_id":         customer_id,
        "company_description": cfg.company_description,
        "value_proposition":   cfg.value_proposition,
        "competitors":         cfg.competitors or [],
        "offerings":           cfg.offerings or [],
        "icp":                 cfg.icp or {},
        "goals":               cfg.goals or {},
        "updated_at":          cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


# ─────────────────────────────────────────────────────────
# PUT /api/gtm/config
# ─────────────────────────────────────────────────────────

@router.put("/config")
async def upsert_gtm_config(
    body: GTMConfigUpdate,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    cid = UUID(customer_id)
    result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = result.scalar_one_or_none()

    if not cfg:
        cfg = GTMConfig(customer_id=cid)
        db.add(cfg)

    # Merge only provided fields
    if body.company_description is not None:
        cfg.company_description = body.company_description
    if body.value_proposition is not None:
        cfg.value_proposition = body.value_proposition
    if body.competitors is not None:
        cfg.competitors = body.competitors
    if body.offerings is not None:
        cfg.offerings = body.offerings
    if body.icp is not None:
        cfg.icp = body.icp
    if body.goals is not None:
        cfg.goals = body.goals

    await db.commit()
    await db.refresh(cfg)

    return {
        "customer_id":         customer_id,
        "company_description": cfg.company_description,
        "value_proposition":   cfg.value_proposition,
        "competitors":         cfg.competitors or [],
        "offerings":           cfg.offerings or [],
        "icp":                 cfg.icp or {},
        "goals":               cfg.goals or {},
        "updated_at":          cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/intelligence
# ─────────────────────────────────────────────────────────

@router.get("/intelligence")
async def get_intelligence(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    cid = UUID(customer_id)
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # ── Load GTM config ────────────────────────────────────
    cfg_result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = cfg_result.scalar_one_or_none()

    icp   = (cfg.icp   or {}) if cfg else {}
    goals = (cfg.goals or {}) if cfg else {}

    icp_industries   = icp.get("company_filters", {}).get("industries", [])
    emp_min          = icp.get("company_filters", {}).get("employee_min", 0)
    emp_max          = icp.get("company_filters", {}).get("employee_max", 999999)
    tam_total        = int(icp.get("tam_total", 0) or 0)
    revenue_target   = float(goals.get("revenue_target", 0) or 0)

    # ── Fetch CRM data ─────────────────────────────────────
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )
    opps = opps_result.scalars().all()

    accts_result = await db.execute(
        select(SalesforceAccount).where(SalesforceAccount.customer_id == cid)
    )
    accts = accts_result.scalars().all()

    leads_result = await db.execute(
        select(Lead).where(Lead.customer_id == cid)
    )
    all_leads = leads_result.scalars().all()

    # ── TAM Coverage ──────────────────────────────────────
    if icp_industries:
        icp_accts = [
            a for a in accts
            if a.industry and any(
                ind.lower() in (a.industry or "").lower() for ind in icp_industries
            )
        ]
    else:
        icp_accts = list(accts)  # no filter → all accounts

    # Also filter by employee count if set
    if emp_min or emp_max < 999999:
        icp_accts = [
            a for a in icp_accts
            if a.employee_count is not None and emp_min <= a.employee_count <= emp_max
        ]

    crm_icp_count = len(icp_accts)
    tam_pct = round((crm_icp_count / tam_total * 100), 1) if tam_total > 0 else 0.0

    if tam_pct >= 80:
        tam_status = "strong"
    elif tam_pct >= 50:
        tam_status = "ok"
    elif tam_pct >= 25:
        tam_status = "low"
    else:
        tam_status = "critical"

    # ── Account Activation ────────────────────────────────
    # Active = last_activity in past 30 days OR open opportunity
    active_lead_ids = {
        str(l.id) for l in all_leads
        if l.last_activity and l.last_activity.replace(tzinfo=timezone.utc) >= thirty_days_ago
    }
    open_opp_accounts = {
        o.account_name for o in opps if _is_open(o.stage)
    }
    activated_count = len(active_lead_ids) + len(open_opp_accounts)

    # Target: derive from goals if set, else use total CRM accounts
    acv = float(goals.get("acv", 0) or 0)
    win_rate = float(goals.get("win_rate_pct", 25) or 25) / 100
    opp_to_meeting = float(goals.get("opp_to_meeting_rate_pct", 30) or 30) / 100
    response_rate = float(goals.get("outreach_response_rate_pct", 10) or 10) / 100

    if revenue_target > 0 and acv > 0 and win_rate > 0 and opp_to_meeting > 0 and response_rate > 0:
        act_calc = _calc_activity(goals)
        activation_target = act_calc.get("accounts_to_contact", max(len(accts), 1))
    else:
        activation_target = max(len(accts), 1)

    activation_pct = round(min(activated_count / activation_target * 100, 100), 1)

    if activation_pct >= 80:
        act_status = "strong"
    elif activation_pct >= 50:
        act_status = "ok"
    elif activation_pct >= 25:
        act_status = "low"
    else:
        act_status = "critical"

    # By-rep activation stats
    rep_stats: dict = {}
    for opp in opps:
        rep = opp.owner_name or "Unassigned"
        if rep not in rep_stats:
            rep_stats[rep] = {"activated": 0, "total": 0, "pipeline_value": 0}
        rep_stats[rep]["total"] += 1
        if _is_open(opp.stage):
            rep_stats[rep]["activated"] += 1
            rep_stats[rep]["pipeline_value"] += int(opp.amount or 0)

    by_rep = [
        {
            "name":           rep,
            "activated":      stats["activated"],
            "total_deals":    stats["total"],
            "pipeline_value": stats["pipeline_value"],
            "pct":            round(stats["activated"] / stats["total"] * 100, 0) if stats["total"] else 0,
        }
        for rep, stats in sorted(rep_stats.items(), key=lambda x: -x[1]["activated"])
    ]

    # ── ICP Match Rate ────────────────────────────────────
    open_opps   = [o for o in opps if _is_open(o.stage)]
    total_open  = len(open_opps)

    icp_account_names = {a.name.lower() for a in icp_accts if a.name}
    icp_matched = sum(
        1 for o in open_opps
        if o.account_name and o.account_name.lower() in icp_account_names
    ) if icp_account_names else 0

    icp_match_pct = round(icp_matched / total_open * 100, 1) if total_open > 0 else 0.0

    # ── Pipeline Coverage ─────────────────────────────────
    weighted_pipeline = sum(
        (o.amount or 0) * _stage_prob(o.stage) for o in opps if _is_open(o.stage)
    )
    pipeline_coverage_pct = round(weighted_pipeline / revenue_target * 100, 1) if revenue_target > 0 else 0.0

    if pipeline_coverage_pct >= 300:
        pipe_status = "strong"
    elif pipeline_coverage_pct >= 150:
        pipe_status = "ok"
    elif pipeline_coverage_pct >= 75:
        pipe_status = "low"
    else:
        pipe_status = "critical"

    # ── Activity Requirements ─────────────────────────────
    activity_req = _calc_activity(goals) if goals else {}

    # ── Win Patterns (from ConversionData + Signal) ───────
    conv_result = await db.execute(
        select(ConversionData).where(
            ConversionData.customer_id == cid,
            ConversionData.outcome == "deal_closed",
        )
    )
    conversions = conv_result.scalars().all()
    won_lead_ids = [c.lead_id for c in conversions]

    win_patterns = []
    if won_lead_ids:
        sig_result = await db.execute(
            select(Signal.type, sql_func.count(Signal.id).label("cnt"))
            .where(Signal.lead_id.in_(won_lead_ids))
            .group_by(Signal.type)
            .order_by(sql_func.count(Signal.id).desc())
            .limit(5)
        )
        total_won = max(len(won_lead_ids), 1)
        win_patterns = [
            {
                "signal_type":      row.type,
                "count":            row.cnt,
                "correlation_pct":  round(row.cnt / total_won * 100, 0),
            }
            for row in sig_result
        ]

    # ── Won / Lost deal counts ────────────────────────────
    won_deals  = sum(1 for o in opps if _is_closed_won(o.stage))
    lost_deals = sum(1 for o in opps if _is_closed_lost(o.stage))
    win_rate_actual = round(won_deals / (won_deals + lost_deals) * 100, 1) if (won_deals + lost_deals) > 0 else 0.0

    # ── Board-level alert strings ─────────────────────────
    board_alerts = []
    if tam_status == "critical":
        board_alerts.append(f"TAM dækning kritisk: kun {crm_icp_count} af {tam_total} ICP-virksomheder er i CRM")
    if act_status in ("critical", "low"):
        board_alerts.append(f"Account aktivering lav ({activation_pct}%) — {activation_target - activated_count} accounts mangler aktivering")
    if pipeline_coverage_pct < 100 and revenue_target > 0:
        gap = revenue_target - weighted_pipeline
        board_alerts.append(f"Pipeline dækning under mål — mangler {gap/1000:.0f}k i vægtet pipeline")
    if total_open > 0 and icp_match_pct < 60 and icp_industries:
        board_alerts.append(f"Kun {icp_match_pct}% af åbne deals matcher ICP — tjek om vi booker møder med de rette virksomheder")

    return {
        "tam_coverage": {
            "pct":               tam_pct,
            "crm_icp_accounts":  crm_icp_count,
            "tam_total":         tam_total,
            "gap":               max(tam_total - crm_icp_count, 0),
            "status":            tam_status,
        },
        "account_activation": {
            "pct":        activation_pct,
            "activated":  activated_count,
            "target":     activation_target,
            "gap":        max(activation_target - activated_count, 0),
            "status":     act_status,
            "by_rep":     by_rep,
        },
        "icp_match": {
            "pct":          icp_match_pct,
            "icp_deals":    icp_matched,
            "total_deals":  total_open,
            "non_icp_deals": total_open - icp_matched,
        },
        "pipeline_coverage": {
            "pct":              pipeline_coverage_pct,
            "weighted_pipeline": round(weighted_pipeline),
            "revenue_target":   round(revenue_target),
            "gap":              max(round(revenue_target - weighted_pipeline), 0),
            "status":           pipe_status,
        },
        "win_loss": {
            "won":            won_deals,
            "lost":           lost_deals,
            "win_rate_actual": win_rate_actual,
        },
        "activity_requirements": activity_req,
        "win_patterns":          win_patterns,
        "board_alerts":          board_alerts,
        "generated_at":          now.isoformat(),
    }
