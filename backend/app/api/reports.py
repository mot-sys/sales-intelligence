"""
Weekly Report API
Generates and retrieves AI-written weekly sales reports.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_customer_id
from app.db import crud as db_crud
from app.db.models import (
    Alert, SalesforceOpportunity, OutboundAction, Integration
)
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class WeeklyReportResponse(BaseModel):
    week_start: Optional[str]
    generated_at: Optional[str]
    section_what_happened: Optional[str]
    section_this_week: Optional[str]
    section_management: Optional[str]
    model_used: Optional[str]
    data_snapshot: Optional[Dict]
    ai_configured: bool


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _this_monday() -> datetime:
    """Return midnight UTC of the current Monday."""
    today = datetime.utcnow().date()
    monday = today - timedelta(days=today.weekday())
    return datetime(monday.year, monday.month, monday.day, 0, 0, 0)


async def _gather_week_data(db: AsyncSession, customer_id: str) -> Dict:
    """Collect all data for the weekly report snapshot."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    # ── 1. Pipeline: deals active last 7 days ─────────────────────────────
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
        )
    )
    all_opps = opps_result.scalars().all()

    total_pipeline = len(all_opps)
    total_value = sum(float(o.amount or 0) for o in all_opps)
    recently_active = [
        o for o in all_opps
        if o.last_activity_date and (
            o.last_activity_date if isinstance(o.last_activity_date, datetime)
            else datetime(o.last_activity_date.year, o.last_activity_date.month, o.last_activity_date.day)
        ) >= week_ago
    ]
    stalled = [o for o in all_opps if getattr(o, "is_stalled", False)]

    # Stage distribution
    from collections import Counter
    stage_counts = Counter(o.stage or "Unknown" for o in all_opps)

    pipeline_summary = {
        "total_deals": total_pipeline,
        "total_value_dkk": round(total_value),
        "recently_active_deals": len(recently_active),
        "stalled_deals": len(stalled),
        "stage_distribution": dict(stage_counts),
        "recently_active_details": [
            {
                "name": o.account_name,
                "stage": o.stage,
                "amount": float(o.amount or 0),
                "owner": o.owner_name,
                "last_activity": str(o.last_activity_date),
            }
            for o in recently_active[:10]
        ],
    }

    # ── 2. Alerts last 7 days ─────────────────────────────────────────────
    alerts_result = await db.execute(
        select(Alert).where(
            Alert.customer_id == customer_id,
            Alert.created_at >= week_ago,
        ).order_by(Alert.priority.desc())
    )
    alerts = alerts_result.scalars().all()

    alert_summary = {
        "total": len(alerts),
        "by_type": dict(Counter(a.type for a in alerts)),
        "actioned": sum(1 for a in alerts if a.status == "actioned"),
        "pending": sum(1 for a in alerts if a.status == "pending"),
        "top_alerts": [
            {
                "type": a.type,
                "headline": a.headline,
                "priority": a.priority,
                "status": a.status,
                "recommendation": a.recommendation,
            }
            for a in alerts[:8]
        ],
    }

    # ── 3. Outbound actions last 7 days ───────────────────────────────────
    try:
        outbound_result = await db.execute(
            select(OutboundAction).where(
                OutboundAction.customer_id == customer_id,
                OutboundAction.created_at >= week_ago,
            )
        )
        outbound = outbound_result.scalars().all()

        outbound_summary = {
            "total": len(outbound),
            "by_type": dict(Counter(a.action_type for a in outbound)),
            "by_status": dict(Counter(a.status for a in outbound)),
        }
    except Exception:
        outbound_summary = {"total": 0}

    # ── 4. HubSpot tasks (SDR/AE workload) ───────────────────────────────
    tasks_summary: Dict = {"available": False, "by_owner": {}, "total": 0}
    try:
        hs_row = await db.scalar(
            select(Integration).where(
                Integration.customer_id == customer_id,
                Integration.service == "hubspot",
                Integration.status == "connected",
            )
        )
        if hs_row:
            from app.integrations.hubspot import HubSpotIntegration
            hs = HubSpotIntegration(credentials=hs_row.credentials)
            tasks = await hs.get_open_tasks(limit=200)
            by_owner: Dict[str, List] = {}
            for t in tasks:
                owner = t["owner_name"] or "Unassigned"
                by_owner.setdefault(owner, []).append(t)
            tasks_summary = {
                "available": True,
                "total": len(tasks),
                "by_owner": {
                    owner: {
                        "count": len(ts),
                        "overdue": sum(
                            1 for t in ts
                            if t["due_date"] and t["due_date"] < now.strftime("%Y-%m-%d")
                        ),
                        "tasks": [t["subject"] for t in ts[:5]],
                    }
                    for owner, ts in sorted(by_owner.items(), key=lambda x: -len(x[1]))
                },
            }
    except Exception as exc:
        logger.warning("Could not load HubSpot tasks for weekly report: %s", exc)

    # ── 5. Engaging accounts (recent alerts about company intent) ─────────
    intent_alerts = [
        a for a in alerts
        if a.type in ("intent_spike", "score_jump", "website_visit")
    ]
    engaging_accounts = [
        {
            "headline": a.headline,
            "type": a.type,
            "recommendation": a.recommendation,
        }
        for a in intent_alerts[:6]
    ]

    return {
        "week_start": _this_monday().strftime("%Y-%m-%d"),
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pipeline": pipeline_summary,
        "alerts": alert_summary,
        "outbound": outbound_summary,
        "tasks": tasks_summary,
        "engaging_accounts": engaging_accounts,
    }


def _build_report_prompt(data: Dict) -> str:
    """Build the user message sent to Claude for report generation."""
    import json
    return f"""Du er en erfaren B2B sales coach og analytiker. Du skal lave en ugentlig salgsrapport baseret på nedenstående data fra den seneste uge.

DATA FRA UGEN:
```json
{json.dumps(data, ensure_ascii=False, indent=2)}
```

Skriv en ugentlig salgsrapport med PRÆCIS disse tre sektioner (i markdown). Vær konkret, handlingsorienteret og brug rigtige tal fra data. Skriv på dansk.

## 📊 Hvad skete der denne uge
- Summarér pipeline aktivitet (deals bevæget, nye aktiviteter, stall'ede deals)
- Nævn konti der engagerede sig (intent signals, besøg)
- Cold outreach resultater
- SDR/AE opgave-status (hvem har mange/få to-dos)
- Brug bullets og specifikke navne/tal fra data

## 🎯 Hvad skal der ske denne uge
- 3-5 konkrete, prioriterede handlinger
- Navngiv specifikke deals, konti eller reps hvis relevant
- Lav actionable checkboxes med [ ]

## 🤝 Hvad kan sales management gøre for at hjælpe
- Identificer hvis nogen rep har for mange/få to-dos
- Peg på stall'ede deals der kræver eskalering
- Foreslå coaching eller ressource-omfordeling
- Kun hvis der er konkrete ting — ellers "Ingen kritiske indgreb nødvendige denne uge ✅"

Vær kortfattet men specifik. Undgå generiske råd. Brug data."""


async def _generate_report_sections(data: Dict, model: str) -> Dict[str, str]:
    """Call Claude to generate the three report sections from the gathered data."""
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = _build_report_prompt(data)

    response = await client.messages.create(
        model=model,
        max_tokens=3000,
        system=(
            "Du er en professionel B2B sales analytiker og coach. "
            "Du skriver klare, data-drevne rapporter på dansk. "
            "Vær specifik og brug tal. Undgå floskler."
        ),
        messages=[{"role": "user", "content": prompt}],
    )

    full_text = response.content[0].text if response.content else ""

    # Parse the three sections from the markdown output
    def _extract_section(text: str, header_fragment: str) -> str:
        import re
        # Match ## heading containing the fragment, capture until next ## or end
        pattern = rf"(?m)^## [^\n]*{re.escape(header_fragment)}[^\n]*\n([\s\S]*?)(?=^## |\Z)"
        m = re.search(pattern, text, re.MULTILINE)
        return m.group(1).strip() if m else ""

    return {
        "section_what_happened": _extract_section(full_text, "skete"),
        "section_this_week": _extract_section(full_text, "ske denne uge"),
        "section_management": _extract_section(full_text, "management"),
        "full_text": full_text,  # fallback
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("", response_model=WeeklyReportResponse)
@router.get("/", response_model=WeeklyReportResponse)
async def get_weekly_report(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest stored weekly report (does not regenerate)."""
    ai_configured = bool(settings.ANTHROPIC_API_KEY)
    report = await db_crud.get_latest_weekly_report(db, customer_id)
    if not report:
        return WeeklyReportResponse(
            week_start=None,
            generated_at=None,
            section_what_happened=None,
            section_this_week=None,
            section_management=None,
            model_used=None,
            data_snapshot=None,
            ai_configured=ai_configured,
        )
    return WeeklyReportResponse(
        week_start=report.week_start.strftime("%Y-%m-%d") if report.week_start else None,
        generated_at=report.generated_at.isoformat() if report.generated_at else None,
        section_what_happened=report.section_what_happened,
        section_this_week=report.section_this_week,
        section_management=report.section_management,
        model_used=report.model_used,
        data_snapshot=report.data_snapshot,
        ai_configured=ai_configured,
    )


@router.post("/generate", response_model=WeeklyReportResponse)
async def generate_weekly_report(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate (or regenerate) the weekly report for the current week.
    Collects live data from DB + HubSpot tasks, calls Claude, stores result.
    """
    ai_configured = bool(settings.ANTHROPIC_API_KEY)
    if not ai_configured:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY er ikke sat — AI rapport kan ikke genereres.",
        )

    # Load customer AI model preference
    model = settings.ANTHROPIC_MODEL or "claude-3-5-sonnet-20241022"
    try:
        ai_row = await db_crud.get_ai_settings(db, customer_id)
        if ai_row and ai_row.model:
            model = ai_row.model
    except Exception:
        pass

    try:
        data = await _gather_week_data(db, customer_id)
    except Exception as exc:
        logger.exception("Error gathering weekly report data: %s", exc)
        raise HTTPException(status_code=500, detail=f"Datafejl: {exc}")

    try:
        sections = await _generate_report_sections(data, model)
    except Exception as exc:
        logger.exception("Claude error generating weekly report: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI fejl: {type(exc).__name__}: {exc}")

    # Use the parsed sections; fall back to full_text in first section if parsing failed
    what_happened = sections["section_what_happened"] or sections.get("full_text", "")
    this_week = sections["section_this_week"]
    management = sections["section_management"]

    # If parsing failed (all empty), split the text roughly
    if not what_happened and sections.get("full_text"):
        what_happened = sections["full_text"]

    week_start = _this_monday()
    report = await db_crud.save_weekly_report(
        db,
        customer_id=customer_id,
        week_start=week_start,
        data_snapshot=data,
        section_what_happened=what_happened,
        section_this_week=this_week,
        section_management=management,
        model_used=model,
    )

    return WeeklyReportResponse(
        week_start=report.week_start.strftime("%Y-%m-%d") if report.week_start else None,
        generated_at=report.generated_at.isoformat() if report.generated_at else None,
        section_what_happened=report.section_what_happened,
        section_this_week=report.section_this_week,
        section_management=report.section_management,
        model_used=report.model_used,
        data_snapshot=report.data_snapshot,
        ai_configured=True,
    )
