"""
GTM (Go-To-Market) Configuration & Intelligence API

Endpoints:
  GET  /api/gtm/config             — retrieve strategy, ICP, goals
  PUT  /api/gtm/config             — upsert config (merge partial updates)
  GET  /api/gtm/intelligence       — compute board-level GTM KPIs
  GET  /api/gtm/progress           — YTD gap analysis vs prorated target
  GET  /api/gtm/daily-report       — weekly scorekort (7 KPIs vs pace)
  GET  /api/gtm/forecast           — monthly pipeline forecast (3 scenarios)
  POST /api/gtm/forecast/snapshot  — save forecast snapshot for accuracy tracking
  GET  /api/gtm/forecast/history   — historical snapshots + actuals + accuracy stats
  GET  /api/gtm/learnings          — CRM win/loss pattern cards
  GET  /api/gtm/management-tasks   — auto-generated management action items
  POST /api/gtm/agent/analyze      — AI agent pipeline analysis (Anthropic)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, timedelta, timezone, date
import math

from app.db.session import get_db
from app.db.models import (
    GTMConfig,
    ForecastSnapshot,
    SalesforceOpportunity,
    SalesforceAccount,
    Lead,
    Signal,
    ConversionData,
    Alert,
)
from app.core.security import get_current_customer_id

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

    # ── YTD closed-won (for intelligence view) ────────────────
    ytd_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)

    def _naive(dt):
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

    ytd_start_naive = _naive(ytd_start)
    won_ytd = [
        o for o in opps
        if _is_closed_won(o.stage)
        and o.close_date is not None
        and _naive(o.close_date) >= ytd_start_naive
    ]
    revenue_won_ytd = sum(int(o.amount or 0) for o in won_ytd)

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
            "won":             won_deals,
            "lost":            lost_deals,
            "win_rate_actual": win_rate_actual,
            "revenue_won_ytd": revenue_won_ytd,
            "won_ytd_count":   len(won_ytd),
        },
        "activity_requirements": activity_req,
        "win_patterns":          win_patterns,
        "board_alerts":          board_alerts,
        "generated_at":          now.isoformat(),
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/progress
# ─────────────────────────────────────────────────────────

@router.get("/progress")
async def get_gtm_progress(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Compare actual YTD / QTD CRM performance against prorated targets.
    Returns gap analysis: how many deals / revenue still needed and at what weekly pace.
    """
    from uuid import UUID
    cid = UUID(customer_id)
    now = datetime.now(timezone.utc)

    # ── Load GTM config ──────────────────────────────────
    cfg_result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = cfg_result.scalar_one_or_none()
    goals = (cfg.goals or {}) if cfg else {}

    revenue_target = float(goals.get("revenue_target", 0) or 0)
    acv            = float(goals.get("acv", 0) or 0)
    win_rate       = float(goals.get("win_rate_pct", 25) or 25) / 100
    opp_to_meeting = float(goals.get("opp_to_meeting_rate_pct", 30) or 30) / 100
    response_rate  = float(goals.get("outreach_response_rate_pct", 10) or 10) / 100
    period         = goals.get("period", "annual")

    # ── Period boundaries ────────────────────────────────
    if period == "quarterly":
        quarter       = (now.month - 1) // 3        # 0-3
        q_start_month = quarter * 3 + 1
        q_end_month   = q_start_month + 3
        p_start = datetime(now.year, q_start_month, 1, tzinfo=timezone.utc)
        if q_end_month > 12:
            p_end = datetime(now.year + 1, q_end_month - 12, 1, tzinfo=timezone.utc)
        else:
            p_end = datetime(now.year, q_end_month, 1, tzinfo=timezone.utc)
    else:
        p_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        p_end   = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)

    total_days   = (p_end - p_start).days
    elapsed_days = min((now - p_start).days, total_days)
    elapsed_pct  = round(elapsed_days / total_days * 100, 1) if total_days > 0 else 0
    weeks_remaining = max((p_end - now).days / 7, 0.5)

    # ── Helper: strip timezone for naive DB comparison ───
    def _naive(dt):
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

    p_start_naive = _naive(p_start)

    # ── Fetch CRM data ───────────────────────────────────
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )
    all_opps = opps_result.scalars().all()

    # Closed-won within period
    won_period = [
        o for o in all_opps
        if _is_closed_won(o.stage)
        and o.close_date is not None
        and _naive(o.close_date) >= p_start_naive
    ]
    open_opps = [o for o in all_opps if _is_open(o.stage)]

    # Active leads (last 30 days)
    leads_result = await db.execute(
        select(Lead).where(Lead.customer_id == cid)
    )
    all_leads = leads_result.scalars().all()
    thirty_days_ago_naive = _naive(now - timedelta(days=30))
    active_leads = [
        l for l in all_leads
        if l.last_activity is not None
        and _naive(l.last_activity) >= thirty_days_ago_naive
    ]

    # ── Revenue metrics ──────────────────────────────────
    revenue_won         = sum(int(o.amount or 0) for o in won_period)
    revenue_remaining   = max(revenue_target - revenue_won, 0)
    revenue_prorated    = round(revenue_target * elapsed_pct / 100, 0) if revenue_target > 0 else 0

    # ── Deal metrics ─────────────────────────────────────
    deals_needed_total  = math.ceil(revenue_target / acv) if acv > 0 else 0
    deals_won           = len(won_period)
    deals_prorated      = deals_needed_total * elapsed_pct / 100
    deals_remaining     = max(deals_needed_total - deals_won, 0)
    weekly_deals_needed = round(deals_remaining / weeks_remaining, 1) if weeks_remaining > 0 else 0

    # ── Open pipeline ────────────────────────────────────
    open_count        = len(open_opps)
    weighted_pipeline = sum((o.amount or 0) * _stage_prob(o.stage) for o in open_opps)
    pipeline_covers   = round(weighted_pipeline / revenue_remaining * 100, 1) if revenue_remaining > 0 else 100.0

    # ── Remaining activity needed ────────────────────────
    mtgs_remaining  = math.ceil(deals_remaining / (win_rate * opp_to_meeting)) \
                      if win_rate > 0 and opp_to_meeting > 0 else 0
    accts_remaining = math.ceil(mtgs_remaining / response_rate) if response_rate > 0 else 0
    weekly_accts    = round(accts_remaining / weeks_remaining, 1) if weeks_remaining > 0 else 0

    # ── On-track (actual >= 85% of prorated) ────────────
    on_track_revenue = revenue_won >= revenue_prorated * 0.85 if revenue_prorated > 0 else True
    on_track_deals   = deals_won   >= deals_prorated   * 0.85 if deals_prorated   > 0 else True

    # ── Achievement % ────────────────────────────────────
    achieved_pct = round(revenue_won / revenue_target * 100, 1) if revenue_target > 0 else 0
    pace_pct     = round(revenue_won / revenue_prorated * 100, 1) if revenue_prorated > 0 else 0

    # ── Alert strings ────────────────────────────────────
    alerts = []
    if revenue_target > 0:
        if revenue_remaining > 0 and weeks_remaining > 0:
            wkly = revenue_remaining / weeks_remaining
            alerts.append(
                f"Du mangler {revenue_remaining/1000:.0f}k kr de næste "
                f"{weeks_remaining:.0f} uger ({wkly/1000:.0f}k/uge)"
            )
        if not on_track_deals and deals_prorated > 0:
            behind = round((1 - deals_won / deals_prorated) * 100, 0)
            alerts.append(
                f"Deal-tempo er {behind:.0f}% bagud — du har lukket "
                f"{deals_won} af {deals_prorated:.0f} deals forventet til nu"
            )
        if pipeline_covers < 100 and revenue_remaining > 0:
            alerts.append(
                f"Vægtet pipeline dækker kun {pipeline_covers:.0f}% af det resterende salgsmål"
            )

    return {
        "period":           period,
        "period_start":     p_start.isoformat(),
        "period_end":       p_end.isoformat(),
        "elapsed_pct":      elapsed_pct,
        "weeks_remaining":  round(weeks_remaining, 1),
        "revenue": {
            "target":          round(revenue_target),
            "won":             round(revenue_won),
            "remaining":       round(revenue_remaining),
            "prorated_target": round(revenue_prorated),
            "achieved_pct":    achieved_pct,
            "pace_pct":        pace_pct,
            "on_track":        on_track_revenue,
        },
        "deals": {
            "needed_total":   deals_needed_total,
            "won":            deals_won,
            "remaining":      deals_remaining,
            "prorated_needed": round(deals_prorated, 1),
            "weekly_needed":  weekly_deals_needed,
            "on_track":       on_track_deals,
        },
        "pipeline": {
            "open_count":     open_count,
            "weighted_value": round(weighted_pipeline),
            "covers_gap_pct": pipeline_covers,
        },
        "active_accounts": len(active_leads),
        "activity_remaining": {
            "meetings_needed":  mtgs_remaining,
            "accounts_needed":  accts_remaining,
            "weekly_accounts":  weekly_accts,
        },
        "alerts":        alerts,
        "generated_at":  now.isoformat(),
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/daily-report
# ─────────────────────────────────────────────────────────

@router.get("/daily-report")
async def get_daily_report(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Weekly scorekort comparing CRM activity to required weekly pace."""
    from uuid import UUID
    cid = UUID(customer_id)
    now = datetime.now(timezone.utc)

    # Week boundaries (Monday 00:00 UTC)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
    )

    # ── Load goals ───────────────────────────────────────
    cfg_result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = cfg_result.scalar_one_or_none()
    goals = (cfg.goals or {}) if cfg else {}

    revenue_target  = float(goals.get("revenue_target", 0) or 0)
    acv             = float(goals.get("acv", 0) or 0)
    win_rate        = float(goals.get("win_rate_pct", 25) or 25) / 100
    opp_to_meeting  = float(goals.get("opp_to_meeting_rate_pct", 30) or 30) / 100
    response_rate   = float(goals.get("outreach_response_rate_pct", 10) or 10) / 100
    period          = goals.get("period", "annual")
    weeks           = 13 if period == "quarterly" else 52

    # Weekly targets
    deals_total     = math.ceil(revenue_target / acv) if acv > 0 else 0
    opps_total      = math.ceil(deals_total / win_rate) if win_rate > 0 else 0
    mtgs_total      = math.ceil(opps_total / opp_to_meeting) if opp_to_meeting > 0 else 0
    accts_total     = math.ceil(mtgs_total / response_rate) if response_rate > 0 else 0
    weekly_deals    = round(deals_total / weeks, 1) if weeks else 0
    weekly_mtgs     = round(mtgs_total / weeks, 1) if weeks else 0
    weekly_accts    = round(accts_total / weeks, 1) if weeks else 0
    weekly_revenue  = round(revenue_target / weeks) if weeks else 0

    # ── Load CRM data ────────────────────────────────────
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )
    all_opps = opps_result.scalars().all()

    leads_result = await db.execute(select(Lead).where(Lead.customer_id == cid))
    all_leads = leads_result.scalars().all()

    def _n(dt):
        """Strip tz for naive DB comparisons."""
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

    ws_naive = _n(week_start)
    now_naive = _n(now)

    open_opps = [o for o in all_opps if _is_open(o.stage)]

    # 1. Revenue won this week
    won_week = [
        o for o in all_opps
        if _is_closed_won(o.stage)
        and o.close_date is not None
        and _n(o.close_date) >= ws_naive
    ]
    revenue_won_week = sum(int(o.amount or 0) for o in won_week)

    # 2. Deals with activity this week (proxy: moved forward)
    active_deals_week = [
        o for o in open_opps
        if o.last_activity_date is not None
        and _n(o.last_activity_date) >= ws_naive
    ]

    # 3. Weighted pipeline
    weighted_pipeline = sum((o.amount or 0) * _stage_prob(o.stage) for o in open_opps)

    # 4. Meetings currently scheduled (in a meeting stage)
    meeting_stage_keys = {
        "appointmentscheduled", "qualifiedtobuy", "presentationscheduled",
        "qualification", "appointment scheduled", "qualified to buy",
    }
    meetings_active = [
        o for o in open_opps
        if (o.stage or "").lower().replace(" ", "").replace("_", "") in
           {s.replace(" ", "").replace("_", "") for s in meeting_stage_keys}
    ]
    # New meeting activity this week
    meetings_week = [
        o for o in meetings_active
        if o.last_activity_date is not None
        and _n(o.last_activity_date) >= ws_naive
    ]

    # 5. Active accounts (leads with activity this week)
    active_leads_week = [
        l for l in all_leads
        if l.last_activity is not None and _n(l.last_activity) >= ws_naive
    ]

    # 6. New accounts engaged this week (new leads created)
    new_leads_week = [
        l for l in all_leads
        if l.created_at is not None and _n(l.created_at) >= ws_naive
    ]

    # 7. Deals moved toward closed won this week (closed + stage advancement proxy)
    closed_won_week = len(won_week)

    stalled_count = sum(1 for o in all_opps if o.is_stalled)

    def _fmtK(n):
        if n >= 1_000_000:
            return f"{n/1_000_000:.1f}M"
        if n >= 1000:
            return f"{round(n/1000)}k"
        return str(round(n))

    def _item(label, emoji, actual, target, suffix, note, is_currency=False):
        pct = round(actual / target * 100, 0) if target > 0 else 0
        if pct >= 100:
            status = "strong"
        elif pct >= 60:
            status = "ok"
        elif pct >= 30:
            status = "low"
        else:
            status = "critical"
        return {
            "label":       label,
            "emoji":       emoji,
            "actual":      actual,
            "target":      target,
            "pct":         pct,
            "suffix":      suffix,
            "status":      status,
            "note":        note,
            "is_currency": is_currency,
        }

    scorecard = [
        _item("Omsætning vundet",        "💰", revenue_won_week,      weekly_revenue,
              "kr", f"Mål: {_fmtK(weekly_revenue)}kr/uge", True),
        _item("Deals lukket",            "🏆", closed_won_week,        max(int(weekly_deals), 1),
              "deals", f"Mål: {weekly_deals} deals/uge"),
        _item("Deals rykket fremad",     "➡️",  len(active_deals_week), max(int(weekly_deals * 3), 1),
              "deals", "Deals med aktivitet denne uge"),
        _item("Pipeline (vægtet)",       "📈", round(weighted_pipeline / 1000),
              max(round(revenue_target / 1000), 1), "k kr",
              f"Mål: {_fmtK(revenue_target)}kr total"),
        _item("Møder afholdt / booket",  "📅", len(meetings_week),     max(int(weekly_mtgs), 1),
              "møder", f"Mål: {weekly_mtgs} møder/uge"),
        _item("Aktive accounts",         "🏢", len(active_leads_week), max(int(weekly_accts), 1),
              "accounts", f"Mål: {weekly_accts} accounts/uge"),
        _item("Nye virksomheder",        "🆕", len(new_leads_week),    max(int(weekly_accts * 0.3), 1),
              "nye", "Nye leads skabt denne uge"),
    ]

    items_on_track = sum(1 for s in scorecard if s["status"] in ("strong", "ok"))
    overall_pct = round(items_on_track / len(scorecard) * 100, 0) if scorecard else 0

    return {
        "week_start":        week_start.isoformat(),
        "scorecard":         scorecard,
        "overall_pct":       overall_pct,
        "items_on_track":    items_on_track,
        "total_items":       len(scorecard),
        "stalled_deals":     stalled_count,
        "weighted_pipeline": round(weighted_pipeline),
        "open_deals":        len(open_opps),
        "generated_at":      now.isoformat(),
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/forecast
# ─────────────────────────────────────────────────────────

async def _compute_forecast(db: AsyncSession, cid) -> dict:
    """Shared forecast computation used by GET /forecast and POST /forecast/snapshot."""
    from collections import defaultdict
    now = datetime.now(timezone.utc)

    cfg_result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = cfg_result.scalar_one_or_none()
    goals = (cfg.goals or {}) if cfg else {}
    revenue_target = float(goals.get("revenue_target", 0) or 0)

    opps_result = await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )
    all_opps = opps_result.scalars().all()
    open_opps = [o for o in all_opps if _is_open(o.stage)]

    def _n(dt):
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

    # Closed-won YTD
    year_start_naive = _n(datetime(now.year, 1, 1, tzinfo=timezone.utc))
    won_ytd = [
        o for o in all_opps
        if _is_closed_won(o.stage)
        and o.close_date is not None
        and _n(o.close_date) >= year_start_naive
    ]
    revenue_won_ytd = sum(int(o.amount or 0) for o in won_ytd)

    # Group open opps by close_date month
    monthly: dict = defaultdict(lambda: {
        "base": 0.0, "conservative": 0.0, "optimistic": 0.0, "count": 0, "top_opps": []
    })
    no_date = {"base": 0.0, "conservative": 0.0, "optimistic": 0.0, "count": 0}

    for opp in open_opps:
        prob    = _stage_prob(opp.stage)
        amount  = int(opp.amount or 0)
        base    = amount * prob
        cons    = amount * prob * 0.60
        opt     = amount * min(prob * 1.35, 1.0)

        if opp.close_date:
            cd = _n(opp.close_date)
            key = f"{cd.year}-{cd.month:02d}"
            monthly[key]["base"]         += base
            monthly[key]["conservative"] += cons
            monthly[key]["optimistic"]   += opt
            monthly[key]["count"]        += 1
            if len(monthly[key]["top_opps"]) < 3:
                monthly[key]["top_opps"].append({
                    "account": opp.account_name,
                    "amount":  amount,
                    "stage":   opp.stage,
                    "prob":    round(prob * 100),
                })
        else:
            no_date["base"]         += base
            no_date["conservative"] += cons
            no_date["optimistic"]   += opt
            no_date["count"]        += 1

    # Build 12-month list
    months = []
    for i in range(12):
        raw_month = now.month + i
        y = now.year + (raw_month - 1) // 12
        m = ((raw_month - 1) % 12) + 1
        key   = f"{y}-{m:02d}"
        label = datetime(y, m, 1).strftime("%b %Y")
        d     = monthly.get(key, {"base": 0, "conservative": 0, "optimistic": 0, "count": 0, "top_opps": []})
        months.append({
            "key":          key,
            "month":        key,   # alias used by snapshot history
            "label":        label,
            "base":         round(d["base"]),
            "conservative": round(d["conservative"]),
            "optimistic":   round(d["optimistic"]),
            "count":        d["count"],
            "top_opps":     d.get("top_opps", []),
        })

    total_base = sum(m["base"] for m in months) + revenue_won_ytd
    total_cons = sum(m["conservative"] for m in months) + revenue_won_ytd
    total_opt  = sum(m["optimistic"] for m in months) + revenue_won_ytd

    return {
        "months": months,
        "totals": {
            "base":           round(total_base),
            "conservative":   round(total_cons),
            "optimistic":     round(total_opt),
            "revenue_target": round(revenue_target),
            "base_pct":       round(total_base / revenue_target * 100, 1) if revenue_target > 0 else 0,
            "won_ytd":        round(revenue_won_ytd),
        },
        "no_close_date": no_date,
        "generated_at":  datetime.now(timezone.utc).isoformat(),
    }


@router.get("/forecast")
async def get_forecast(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Pipeline forecast: monthly breakdown + 3 scenarios (base / conservative / optimistic)."""
    from uuid import UUID
    cid = UUID(customer_id)
    return await _compute_forecast(db, cid)


# ─────────────────────────────────────────────────────────
# POST /api/gtm/forecast/snapshot
# ─────────────────────────────────────────────────────────

@router.post("/forecast/snapshot")
async def save_forecast_snapshot(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Save a snapshot of today's forecast for later accuracy tracking."""
    from uuid import UUID
    cid = UUID(customer_id)
    data = await _compute_forecast(db, cid)

    # Grab current revenue target for context
    cfg_row = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == cid))
    rev_target = (cfg_row.goals or {}).get("revenue_target") if cfg_row else None

    snap = ForecastSnapshot(
        customer_id=cid,
        snapshot_date=date.today(),
        revenue_target=float(rev_target) if rev_target else None,
        months_data=data["months"],
    )
    db.add(snap)
    await db.commit()
    return {
        "id":           str(snap.id),
        "snapshot_date": str(snap.snapshot_date),
        "month_count":  len(data["months"]),
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/forecast/history
# ─────────────────────────────────────────────────────────

@router.get("/forecast/history")
async def get_forecast_history(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all forecast snapshots enriched with actuals + accuracy stats."""
    from uuid import UUID
    cid = UUID(customer_id)

    snaps = (await db.execute(
        select(ForecastSnapshot)
        .where(ForecastSnapshot.customer_id == cid)
        .order_by(ForecastSnapshot.snapshot_date.desc())
    )).scalars().all()

    # Fetch all opps once — compute actuals by closed month
    all_opps = (await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )).scalars().all()

    actuals: dict[str, float] = {}
    for o in all_opps:
        if _is_closed_won(o.stage) and o.close_date and o.amount:
            cd = o.close_date.replace(tzinfo=None) if getattr(o.close_date, "tzinfo", None) else o.close_date
            key = f"{cd.year}-{cd.month:02d}"
            actuals[key] = actuals.get(key, 0.0) + float(o.amount or 0)

    now = datetime.now()
    result = []
    all_errors: list[float] = []

    for snap in snaps:
        enriched = []
        for m in (snap.months_data or []):
            month_key = m.get("month") or m.get("key", "")
            try:
                yr, mo = int(month_key[:4]), int(month_key[5:7])
                is_complete = (yr < now.year) or (yr == now.year and mo < now.month)
            except Exception:
                is_complete = False

            actual = actuals.get(month_key) if is_complete else None
            base   = float(m.get("base", 0) or 0)
            err    = round((base - actual) / actual * 100, 1) if (actual and actual > 0) else None
            if err is not None:
                all_errors.append(err)

            enriched.append({
                **m,
                "actual":      round(actual) if actual is not None else None,
                "error_pct":   err,
                "is_complete": is_complete,
            })

        result.append({
            "id":            str(snap.id),
            "snapshot_date": str(snap.snapshot_date),
            "revenue_target": float(snap.revenue_target) if snap.revenue_target else None,
            "months_data":   enriched,
        })

    # Summary accuracy stats
    n = len(all_errors)
    mae   = round(sum(abs(e) for e in all_errors) / n, 1) if n else None
    bias  = round(sum(all_errors) / n, 1) if n else None
    direction = "over" if (bias or 0) > 5 else "under" if (bias or 0) < -5 else "accurate"

    return {
        "snapshots": result,
        "summary": {
            "mae_pct":        mae,
            "bias_pct":       bias,
            "bias_direction": direction,
            "n_months":       n,
        },
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/learnings
# ─────────────────────────────────────────────────────────

@router.get("/learnings")
async def get_learnings(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Win/loss pattern analysis — returns learning cards derived from CRM data."""
    from uuid import UUID
    cid = UUID(customer_id)
    now = datetime.now(timezone.utc)

    opps_result = await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )
    all_opps = opps_result.scalars().all()

    won_opps  = [o for o in all_opps if _is_closed_won(o.stage)]
    lost_opps = [o for o in all_opps if _is_closed_lost(o.stage)]
    open_opps = [o for o in all_opps if _is_open(o.stage)]
    stalled   = [o for o in open_opps if o.is_stalled]

    date_str = now.strftime("%d. %b")
    learnings = []

    # ── 1. Win rate ──────────────────────────────────────
    total_closed = len(won_opps) + len(lost_opps)
    if total_closed >= 2:
        wr = round(len(won_opps) / total_closed * 100, 1)
        above_avg = wr >= 25
        learnings.append({
            "id":     "win_rate",
            "impact": "high" if above_avg else "medium",
            "title":  f"Win rate: {wr}% ({len(won_opps)} af {total_closed} deals)",
            "body":   (
                f"Du vinder {wr}% af dine deals — "
                + ("over branchen gennemsnittet (25%). Solid kvalificeringsproces." if above_avg
                   else "under branchen gennemsnittet (25%). Analyser tab-årsager.")
            ),
            "date":   date_str,
            "action": "Gennemgå de seneste 3 tabte deals og find det fælles fravær.",
        })

    # ── 2. Deal-størrelse: vundet vs. åbne ───────────────
    won_amounts  = [int(o.amount or 0) for o in won_opps if o.amount]
    open_amounts = [int(o.amount or 0) for o in open_opps if o.amount]
    if won_amounts and open_amounts:
        avg_won  = sum(won_amounts) / len(won_amounts)
        avg_open = sum(open_amounts) / len(open_amounts)
        diff_pct = round((avg_won - avg_open) / max(avg_open, 1) * 100, 0)
        sign = "+" if diff_pct >= 0 else ""
        learnings.append({
            "id":     "deal_size",
            "impact": "medium",
            "title":  f"Vundne deals er {sign}{diff_pct}% {'større' if diff_pct >= 0 else 'mindre'} end pipeline",
            "body":   (
                f"Gns. lukket: {avg_won/1000:.0f}k kr  ·  Gns. åben pipeline: {avg_open/1000:.0f}k kr. "
                + ("Du vinder de større deals — fokusér på dem." if diff_pct > 10
                   else "Pipeline matcher vundne deals — ICP er konsistent.")
            ),
            "date":   date_str,
            "action": f"Prioritér åbne deals over {avg_won/1000:.0f}k kr i næste pipeline-review.",
        })

    # ── 3. Stage med flest tab ────────────────────────────
    if lost_opps:
        lost_by_stage: dict = {}
        for o in lost_opps:
            s = o.stage or "Ukendt"
            lost_by_stage[s] = lost_by_stage.get(s, 0) + 1
        top_lost_stage = max(lost_by_stage, key=lambda k: lost_by_stage[k])
        top_lost_n     = lost_by_stage[top_lost_stage]
        learnings.append({
            "id":     "lost_stage",
            "impact": "high",
            "title":  f"Flest tab i '{top_lost_stage}' ({top_lost_n} deals)",
            "body":   (
                f"{top_lost_n} af {len(lost_opps)} tabte deals faldt fra i stage '{top_lost_stage}'. "
                f"Dette er dit primære lækage-punkt."
            ),
            "date":   date_str,
            "action": f"Hvad blokkerer deals i '{top_lost_stage}'? Tilbud, teknisk validering eller champion?",
        })

    # ── 4. Rep-performance variance ──────────────────────
    rep_stats: dict = {}
    for o in all_opps:
        rep = o.owner_name or "Unassigned"
        if rep not in rep_stats:
            rep_stats[rep] = {"won": 0, "total": 0}
        rep_stats[rep]["total"] += 1
        if _is_closed_won(o.stage):
            rep_stats[rep]["won"] += 1

    rep_rates = {
        rep: round(s["won"] / s["total"] * 100, 0)
        for rep, s in rep_stats.items()
        if s["total"] >= 2
    }
    if len(rep_rates) >= 2:
        top    = max(rep_rates, key=rep_rates.get)
        bottom = min(rep_rates, key=rep_rates.get)
        gap    = rep_rates[top] - rep_rates[bottom]
        if gap >= 10:
            learnings.append({
                "id":     "rep_variance",
                "impact": "high" if gap >= 25 else "medium",
                "title":  f"{top}: {rep_rates[top]:.0f}%  vs  {bottom}: {rep_rates[bottom]:.0f}% win rate",
                "body":   (
                    f"{gap:.0f}% forskel i win rate. {top} har den bedste tilgang. "
                    f"Peer coaching kan løfte teamets samlede performance."
                ),
                "date":   date_str,
                "action": f"Book shadowing: {bottom} følger {top} på næste møde eller demo.",
            })

    # ── 5. Stagnerende pipeline-risiko ───────────────────
    if stalled:
        stalled_val = sum(int(o.amount or 0) for o in stalled)
        learnings.append({
            "id":     "stalled_risk",
            "impact": "high" if stalled_val > 300_000 else "medium",
            "title":  f"{len(stalled)} stagnerende deals — {stalled_val/1000:.0f}k kr i risiko",
            "body":   (
                f"Disse deals har ingen aktivitet i 14+ dage. "
                f"Stagnerende deals taber historisk set inden for 30 dage."
            ),
            "date":   date_str,
            "action": "Se Tasks for specifikke ryk-handlinger på disse deals.",
        })

    # ── 6. Signal-korrelation (hvis ConversionData) ──────
    conv_result = await db.execute(
        select(ConversionData).where(
            ConversionData.customer_id == cid,
            ConversionData.outcome == "deal_closed",
        )
    )
    conversions = conv_result.scalars().all()
    if conversions:
        won_lead_ids = [c.lead_id for c in conversions]
        sig_rows = await db.execute(
            select(Signal.type, sql_func.count(Signal.id).label("cnt"))
            .where(Signal.lead_id.in_(won_lead_ids))
            .group_by(Signal.type)
            .order_by(sql_func.count(Signal.id).desc())
            .limit(3)
        )
        top_sigs = list(sig_rows)
        if top_sigs:
            sig_str = "  ·  ".join(f"{r.type} ({r.cnt}x)" for r in top_sigs)
            learnings.append({
                "id":     "win_signals",
                "impact": "high",
                "title":  f"Vindersignal: {top_sigs[0].type} korrelerer stærkest med lukkede deals",
                "body":   f"Signaler i vundne deals: {sig_str}. Disse er dine stærkeste intent-indikatorer.",
                "date":   date_str,
                "action": "Prioritér accounts med disse signaler i din daglige outreach.",
            })

    return {
        "learnings": learnings,
        "summary": {
            "won": len(won_opps), "lost": len(lost_opps),
            "open": len(open_opps), "stalled": len(stalled),
        },
        "generated_at": now.isoformat(),
    }


# ─────────────────────────────────────────────────────────
# GET /api/gtm/management-tasks
# ─────────────────────────────────────────────────────────

@router.get("/management-tasks")
async def get_management_tasks(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generated management action items derived from CRM data patterns."""
    from uuid import UUID
    cid = UUID(customer_id)
    now = datetime.now(timezone.utc)

    def _n(dt):
        if dt is None: return None
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

    now_naive = _n(now)

    opps_result = await db.execute(
        select(SalesforceOpportunity).where(SalesforceOpportunity.customer_id == cid)
    )
    all_opps = opps_result.scalars().all()
    open_opps = [o for o in all_opps if _is_open(o.stage)]

    leads_result = await db.execute(select(Lead).where(Lead.customer_id == cid))
    all_leads = leads_result.scalars().all()

    tasks = []
    _id = 0

    def mk(type_, priority, headline, deal, rep, action, data=None):
        nonlocal _id
        _id += 1
        return {
            "id":       _id,
            "type":     type_,
            "priority": priority,
            "headline": headline,
            "deal":     deal,
            "rep":      rep,
            "action":   action,
            "data":     data or {},
            "status":   "pending",
        }

    # ── 1. Stalled deals → ryk rep ───────────────────────
    stalled = sorted([o for o in open_opps if o.is_stalled], key=lambda o: -(o.amount or 0))
    for opp in stalled[:6]:
        if opp.last_activity_date:
            days = (now_naive - _n(opp.last_activity_date)).days
        else:
            days = 30
        amt = int(opp.amount or 0)
        tasks.append(mk(
            "stalled_deal",
            "urgent" if amt > 300_000 or days > 21 else "high",
            f"Ryk {opp.owner_name or 'sælger'} for '{opp.account_name}' — {days} dage uden aktivitet",
            opp.account_name or "Ukendt",
            opp.owner_name or "Unassigned",
            f"Kontakt {opp.owner_name or 'sælger'} og få status. Deal er {amt/1000:.0f}k kr i {opp.stage or 'ukendt stage'}.",
            {"amount": amt, "stage": opp.stage, "days_stalled": days},
        ))

    # ── 2. Closing soon, ingen nylig aktivitet → send tilbud ─
    two_weeks = _n(now + timedelta(days=14))
    closing_soon = [
        o for o in open_opps
        if o.close_date is not None
        and _n(o.close_date) is not None
        and _n(o.close_date) <= two_weeks
        and (o.last_activity_date is None
             or (now_naive - _n(o.last_activity_date)).days > 7)
    ]
    for opp in closing_soon[:4]:
        days_left = (_n(opp.close_date) - now_naive).days if opp.close_date else 0
        tasks.append(mk(
            "closing_soon",
            "urgent",
            f"Send tilbud til '{opp.account_name}' — lukker om {days_left} dage",
            opp.account_name or "Ukendt",
            opp.owner_name or "Unassigned",
            f"Close dato er om {days_left} dage uden nylig aktivitet. Send tilbud eller bekræft status med {opp.owner_name or 'sælger'}.",
            {"amount": int(opp.amount or 0), "days_left": days_left},
        ))

    # ── 3. Møde/tilbudsstage uden opfølgning → udfyld næste trin ─
    active_stage_no_followup = [
        o for o in open_opps
        if any(kw in (o.stage or "").lower()
               for kw in ["appointment", "scheduled", "proposal", "negotiation", "presentation"])
        and (o.last_activity_date is None
             or (now_naive - _n(o.last_activity_date)).days > 10)
    ]
    if active_stage_no_followup:
        names = [o.account_name for o in active_stage_no_followup[:5] if o.account_name]
        tasks.append(mk(
            "missing_followup",
            "high",
            f"Udfyld næste trin på {len(active_stage_no_followup)} deals i møde/tilbudsstage",
            ", ".join(names[:3]) + ("…" if len(names) > 3 else ""),
            "Team",
            f"Disse {len(active_stage_no_followup)} deals er i aktiv stage men mangler opfølgning. Opdatér CRM med næste møde-dato eller action-item.",
            {"deals": [o.account_name for o in active_stage_no_followup[:6]]},
        ))

    # ── 4. Rep-coaching: win rate under 15% ──────────────
    rep_stats: dict = {}
    for o in all_opps:
        rep = o.owner_name or "Unassigned"
        if rep not in rep_stats:
            rep_stats[rep] = {"won": 0, "total": 0, "open_val": 0}
        rep_stats[rep]["total"] += 1
        if _is_closed_won(o.stage):
            rep_stats[rep]["won"] += 1
        elif _is_open(o.stage):
            rep_stats[rep]["open_val"] += int(o.amount or 0)

    for rep, s in rep_stats.items():
        if s["total"] >= 3 and (s["won"] / s["total"]) < 0.15:
            wr = round(s["won"] / s["total"] * 100, 0)
            tasks.append(mk(
                "rep_coaching",
                "medium",
                f"Coaching: {rep} — win rate {wr:.0f}% under mål",
                f"{s['total']} deals, {s['open_val']/1000:.0f}k kr åben pipeline",
                rep,
                f"{rep} vinder {wr:.0f}% af deals. Book coaching-session og analyser tab-mønstre.",
                {"win_rate": wr, "total_deals": s["total"], "won": s["won"]},
            ))

    # ── 5. SDR aktiverer for mange / for få ──────────────
    # Find reps with very low or very high outreach but low meeting conversion
    rep_leads: dict = {}
    for l in all_leads:
        rep = l.owner_name or "Unassigned"
        if rep not in rep_leads:
            rep_leads[rep] = {"total": 0, "active": 0}
        rep_leads[rep]["total"] += 1
        # Active = activity in last 30 days
        if l.last_activity and _n(l.last_activity) >= _n(now - timedelta(days=30)):
            rep_leads[rep]["active"] += 1

    for rep, s in rep_leads.items():
        if s["total"] >= 10:
            act_rate = s["active"] / s["total"]
            if act_rate < 0.10:
                tasks.append(mk(
                    "low_activation",
                    "medium",
                    f"Aktiver flere accounts: {rep} — kun {round(act_rate*100)}% aktiv rate",
                    f"{s['total']} accounts i pipeline",
                    rep,
                    f"{rep} har kun aktiveret {s['active']} af {s['total']} accounts de seneste 30 dage. Sæt mål om +{max(int(s['total']*0.2 - s['active']), 5)} nye kontakter.",
                    {"active_rate": round(act_rate * 100, 1), "active": s["active"], "total": s["total"]},
                ))

    # ── Sort by priority ─────────────────────────────────
    prio_order = {"urgent": 0, "high": 1, "medium": 2}
    tasks.sort(key=lambda t: prio_order.get(t["priority"], 9))

    return {
        "tasks": tasks,
        "counts": {
            "urgent": sum(1 for t in tasks if t["priority"] == "urgent"),
            "high":   sum(1 for t in tasks if t["priority"] == "high"),
            "medium": sum(1 for t in tasks if t["priority"] == "medium"),
            "total":  len(tasks),
        },
        "generated_at": now.isoformat(),
    }


# ─────────────────────────────────────────────────────────
# POST /api/gtm/agent/analyze
# ─────────────────────────────────────────────────────────

@router.post("/agent/analyze")
async def agent_analyze(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    AI Agent: analyze full pipeline snapshot and return actionable insights.
    Uses Anthropic Claude — requires ANTHROPIC_API_KEY env var.
    """
    from uuid import UUID
    from app.core.config import settings
    from app.core.ai import build_pipeline_context

    cid = UUID(customer_id)
    now = datetime.now(timezone.utc)

    if not settings.ANTHROPIC_API_KEY:
        return {
            "thinking": [],
            "insights": "ANTHROPIC_API_KEY er ikke konfigureret. Tilføj den i Railway environment variables.",
            "tasks": [],
            "generated_at": now.isoformat(),
        }

    # Build pipeline context (same as chat)
    context = await build_pipeline_context(db, str(cid))

    # Load GTM goals for additional context
    cfg_result = await db.execute(select(GTMConfig).where(GTMConfig.customer_id == cid))
    cfg = cfg_result.scalar_one_or_none()
    goals = (cfg.goals or {}) if cfg else {}
    revenue_target = float(goals.get("revenue_target", 0) or 0)

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    model = settings.ANTHROPIC_MODEL or "claude-3-5-haiku-20241022"

    import json
    system = f"""\
Du er en AI sales intelligence agent. Din opgave: analysér pipeline-data og returner præcise, handlingsrettede indsigter på dansk.

I dag: {now.strftime('%A %d. %B %Y')}
Omsætningsmål: {revenue_target/1000:.0f}k kr

Returnér ALTID valid JSON med disse felter:
{{
  "thinking": ["step 1...", "step 2...", "step 3..."],
  "insights": "1-2 sætninger om den vigtigste observation",
  "tasks": [
    {{"priority": "urgent|high|medium", "deal": "deal-navn", "action": "konkret handling"}}
  ]
}}

Maks 3 tasks. Vær konkret — brug rigtige deal-navne og beløb fra data.
"""

    import json as _json
    try:
        response = await client.messages.create(
            model=model,
            system=system,
            messages=[{
                "role": "user",
                "content": f"Analysér denne pipeline:\n{_json.dumps(context, indent=2, default=str)[:8000]}"
            }],
            max_tokens=1000,
        )
        raw = response.content[0].text.strip()

        # Extract JSON (sometimes wrapped in ```json ... ```)
        if "```" in raw:
            import re
            m = re.search(r"```(?:json)?\s*([\s\S]+?)```", raw)
            raw = m.group(1).strip() if m else raw

        parsed = _json.loads(raw)
        return {
            "thinking":     parsed.get("thinking", []),
            "insights":     parsed.get("insights", ""),
            "tasks":        parsed.get("tasks", []),
            "generated_at": now.isoformat(),
        }
    except Exception as e:
        return {
            "thinking":     [f"Analyserer {context['pipeline_summary']['total_open_deals']} åbne deals..."],
            "insights":     f"Analyse mislykkedes: {str(e)[:200]}",
            "tasks":        [],
            "generated_at": now.isoformat(),
        }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/gtm/activities  — CRM activity summary (P1.6)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/activities")
async def get_activity_summary(
    days: int = 30,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a summary of CRM activities (calls, emails, meetings, tasks, notes)
    synced from HubSpot engagements and Salesforce Task/Event objects.

    Query params:
        days (int, default 30): look-back window in days.

    Response:
        {
          "total": int,
          "breakdown": {"call": int, "email": int, ...},
          "recent": [{ id, source, activity_type, occurred_at, owner_name,
                       contact_name, company_name, subject, deal_id }, ...]
        }
    """
    return await crud.get_activity_summary(db, customer_id, days=days)
