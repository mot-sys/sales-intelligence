"""
Board Summary API  (P2.4)

Endpoints:
  GET /api/board/summary        — JSON monthly board summary
  GET /api/board/summary.pdf    — PDF export of the same summary

The board summary covers the current calendar month and includes:
  - Pipeline vs revenue target (% of target achieved / in pipeline)
  - Win rate (closed-won / (won + lost) in period)
  - TAM coverage (ICP A+B accounts in CRM)
  - Key wins  (closed-won deals this month)
  - Key losses (closed-lost deals this month)
  - Forecast next 3 months (base scenario)
  - Rep leaderboard (won revenue by owner this month)
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_customer_id
from app.db.models import Account, Customer, GTMConfig, SalesforceOpportunity
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _naive(dt) -> Optional[datetime]:
    if dt is None:
        return None
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def _is_closed_won(stage: Optional[str]) -> bool:
    if not stage:
        return False
    s = stage.lower()
    return "closed won" in s or "closedwon" in s


def _is_closed_lost(stage: Optional[str]) -> bool:
    if not stage:
        return False
    s = stage.lower()
    return "closed lost" in s or "closedlost" in s


def _fmt_currency(value: float, currency: str = "") -> str:
    """Format a number as e.g. 1.2M, 500K."""
    if value >= 1_000_000:
        return f"{currency}{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{currency}{value / 1_000:.0f}K"
    return f"{currency}{value:,.0f}"


# ─────────────────────────────────────────────
# CORE COMPUTATION
# ─────────────────────────────────────────────

async def _compute_board_summary(db: AsyncSession, customer_id: str) -> Dict:
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    month_end   = datetime(
        now.year + (1 if now.month == 12 else 0),
        1 if now.month == 12 else now.month + 1,
        1,
    )

    # GTM config
    gtm = await db.scalar(select(GTMConfig).where(GTMConfig.customer_id == customer_id))
    goals    = (gtm.goals or {}) if gtm else {}
    rev_target = float(goals.get("revenue_target") or 0)
    win_rate_tgt = float(goals.get("win_rate_pct") or 30)

    # All opportunities
    opps_result = await db.execute(
        select(SalesforceOpportunity).where(
            SalesforceOpportunity.customer_id == customer_id,
        )
    )
    all_opps = opps_result.scalars().all()

    # ── This-month wins / losses ───────────────────────────────────────────
    wins_this_month   = []
    losses_this_month = []
    won_revenue_by_rep: Dict[str, float] = {}

    for o in all_opps:
        cd = _naive(o.close_date)
        if cd is None:
            continue
        if month_start <= cd < month_end:
            if _is_closed_won(o.stage):
                wins_this_month.append(o)
                rep = o.owner_name or "Unassigned"
                won_revenue_by_rep[rep] = won_revenue_by_rep.get(rep, 0) + float(o.amount or 0)
            elif _is_closed_lost(o.stage):
                losses_this_month.append(o)

    # ── YTD / all-time win rate ────────────────────────────────────────────
    ytd_start = datetime(now.year, 1, 1)
    ytd_won  = sum(1 for o in all_opps if _is_closed_won(o.stage)  and _naive(o.close_date) and _naive(o.close_date) >= ytd_start)
    ytd_lost = sum(1 for o in all_opps if _is_closed_lost(o.stage) and _naive(o.close_date) and _naive(o.close_date) >= ytd_start)
    ytd_total = ytd_won + ytd_lost
    win_rate = round(ytd_won / ytd_total * 100, 1) if ytd_total > 0 else 0.0

    # ── Open pipeline ──────────────────────────────────────────────────────
    open_opps = [o for o in all_opps if not _is_closed_won(o.stage) and not _is_closed_lost(o.stage)]
    pipeline_value = sum(float(o.amount or 0) for o in open_opps)

    # YTD revenue (closed won)
    ytd_revenue = sum(float(o.amount or 0) for o in all_opps
                      if _is_closed_won(o.stage) and _naive(o.close_date) and _naive(o.close_date) >= ytd_start)

    # ── TAM coverage ──────────────────────────────────────────────────────
    icp_in_crm = await db.scalar(
        select(func.count(Account.id)).where(
            Account.customer_id == customer_id,
            Account.icp_tier.in_(("A", "B")),
            Account.in_crm == True,  # noqa: E712
        )
    ) or 0
    total_icp = await db.scalar(
        select(func.count(Account.id)).where(
            Account.customer_id == customer_id,
            Account.icp_tier.in_(("A", "B")),
        )
    ) or 0
    icp_cfg   = (gtm.icp or {}) if gtm else {}
    tam_total = icp_cfg.get("tam_total") or 0
    tam_coverage = round(icp_in_crm / tam_total * 100, 1) if tam_total else None

    # ── Forecast next 3 months (simple weighted pipeline) ─────────────────
    forecast_months = []
    for offset in range(1, 4):
        mo = now.month + offset
        yr = now.year + (mo - 1) // 12
        mo = ((mo - 1) % 12) + 1
        mo_start = datetime(yr, mo, 1)
        mo_end   = datetime(yr + (1 if mo == 12 else 0), 1 if mo == 12 else mo + 1, 1)
        closing = [o for o in open_opps if _naive(o.close_date)
                   and mo_start <= _naive(o.close_date) < mo_end]
        base_val = sum(float(o.amount or 0) * 0.6 for o in closing)
        forecast_months.append({
            "month":      f"{yr}-{mo:02d}",
            "label":      f"{mo:02d}/{yr}",
            "base":       round(base_val),
            "deal_count": len(closing),
        })

    # ── Rep leaderboard ────────────────────────────────────────────────────
    leaderboard = sorted(
        [{"rep": k, "won_revenue": round(v)} for k, v in won_revenue_by_rep.items()],
        key=lambda x: x["won_revenue"],
        reverse=True,
    )[:10]

    return {
        "period": {
            "month":     now.strftime("%B %Y"),
            "month_key": f"{now.year}-{now.month:02d}",
            "generated_at": now.isoformat(),
        },
        "kpis": {
            "ytd_revenue":        round(ytd_revenue),
            "revenue_target":     round(rev_target),
            "target_pct":         round(ytd_revenue / rev_target * 100, 1) if rev_target else None,
            "pipeline_value":     round(pipeline_value),
            "pipeline_coverage":  round(pipeline_value / rev_target, 2) if rev_target else None,
            "win_rate_pct":       win_rate,
            "win_rate_target":    win_rate_tgt,
            "wins_this_month":    len(wins_this_month),
            "losses_this_month":  len(losses_this_month),
            "icp_accounts_in_crm": icp_in_crm,
            "total_icp_accounts":  total_icp,
            "tam_coverage_pct":   tam_coverage,
            "tam_total":          tam_total,
        },
        "wins": [
            {
                "account": o.account_name,
                "amount":  o.amount,
                "owner":   o.owner_name,
                "stage":   o.stage,
            }
            for o in sorted(wins_this_month, key=lambda x: float(x.amount or 0), reverse=True)[:10]
        ],
        "losses": [
            {
                "account": o.account_name,
                "amount":  o.amount,
                "owner":   o.owner_name,
            }
            for o in sorted(losses_this_month, key=lambda x: float(x.amount or 0), reverse=True)[:10]
        ],
        "forecast": forecast_months,
        "leaderboard": leaderboard,
    }


# ─────────────────────────────────────────────
# JSON ENDPOINT
# ─────────────────────────────────────────────

@router.get("/summary")
async def get_board_summary(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Monthly board-level summary as JSON."""
    return await _compute_board_summary(db, customer_id)


# ─────────────────────────────────────────────
# PDF ENDPOINT
# ─────────────────────────────────────────────

@router.get("/summary.pdf")
async def get_board_summary_pdf(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Export board summary as a PDF file."""
    # Load customer name
    customer = await db.scalar(select(Customer).where(Customer.id == customer_id))
    company_name = customer.name if customer else "Your Company"

    data = await _compute_board_summary(db, customer_id)
    pdf_bytes = _render_pdf(data, company_name)

    filename = f"board-summary-{data['period']['month_key']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────
# PDF RENDERER (fpdf2)
# ─────────────────────────────────────────────

def _render_pdf(data: Dict, company_name: str) -> bytes:
    """Render the board summary dict as a styled PDF using fpdf2."""
    from fpdf import FPDF

    kpis     = data["kpis"]
    period   = data["period"]
    wins     = data["wins"]
    losses   = data["losses"]
    forecast = data["forecast"]
    lb       = data["leaderboard"]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ── Header ────────────────────────────────────────────────────────────
    pdf.set_fill_color(30, 64, 175)   # blue-800
    pdf.rect(0, 0, 210, 28, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_y(7)
    pdf.cell(0, 10, f"{company_name}  —  Board Summary", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, period["month"], ln=True, align="C")

    pdf.set_text_color(30, 41, 59)   # slate-800
    pdf.ln(8)

    # ── KPI boxes (2 rows × 4) ────────────────────────────────────────────
    _pdf_section(pdf, "Key Performance Indicators")

    box_w = 43
    box_h = 20
    boxes = [
        ("YTD Revenue",      _fmt_currency(kpis["ytd_revenue"]),
         f"{kpis['target_pct']}% of target" if kpis["target_pct"] is not None else "—"),
        ("Pipeline",         _fmt_currency(kpis["pipeline_value"]),
         f"{kpis['pipeline_coverage']}× coverage" if kpis["pipeline_coverage"] else "—"),
        ("Win Rate",         f"{kpis['win_rate_pct']}%",
         f"target {kpis['win_rate_target']}%"),
        ("Wins this month",  str(kpis["wins_this_month"]),
         f"{kpis['losses_this_month']} losses"),
        ("ICP in CRM",       str(kpis["icp_accounts_in_crm"]),
         f"of {kpis['total_icp_accounts']} known"),
        ("TAM Coverage",
         f"{kpis['tam_coverage_pct']}%" if kpis["tam_coverage_pct"] is not None else "—",
         f"{kpis['tam_total']:,} total" if kpis["tam_total"] else "Set TAM in GTM Setup"),
        ("Revenue Target",   _fmt_currency(kpis["revenue_target"]), "Annual"),
        ("Open Deals",       str(kpis.get("open_deals", "")), ""),
    ]
    for i, (label, main, sub) in enumerate(boxes):
        col = i % 4
        if col == 0 and i > 0:
            pdf.ln(box_h + 2)
        x = 10 + col * (box_w + 2)
        y = pdf.get_y()
        pdf.set_fill_color(241, 245, 249)  # slate-100
        pdf.rect(x, y, box_w, box_h, "F")
        pdf.set_xy(x + 2, y + 2)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(100, 116, 139)  # slate-500
        pdf.cell(box_w - 4, 4, label)
        pdf.set_xy(x + 2, y + 6)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(box_w - 4, 7, main)
        pdf.set_xy(x + 2, y + 13)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(box_w - 4, 4, sub)
        if col < 3:
            pdf.set_xy(x + box_w + 2, y)
    pdf.ln(box_h + 4)

    # ── Forecast ──────────────────────────────────────────────────────────
    _pdf_section(pdf, "Forecast — Next 3 Months")
    _pdf_table(
        pdf,
        headers=["Month", "Base Forecast", "Deals Closing"],
        rows=[
            [m["label"], _fmt_currency(m["base"]), str(m["deal_count"])]
            for m in forecast
        ],
        col_widths=[50, 80, 50],
    )

    # ── Wins ──────────────────────────────────────────────────────────────
    if wins:
        _pdf_section(pdf, f"Key Wins — {period['month']}")
        _pdf_table(
            pdf,
            headers=["Account", "Amount", "Owner"],
            rows=[[w["account"] or "—", _fmt_currency(float(w["amount"] or 0)), w["owner"] or "—"] for w in wins],
            col_widths=[90, 50, 40],
        )

    # ── Losses ────────────────────────────────────────────────────────────
    if losses:
        _pdf_section(pdf, f"Losses — {period['month']}")
        _pdf_table(
            pdf,
            headers=["Account", "Amount", "Owner"],
            rows=[[l["account"] or "—", _fmt_currency(float(l["amount"] or 0)), l["owner"] or "—"] for l in losses],
            col_widths=[90, 50, 40],
        )

    # ── Leaderboard ───────────────────────────────────────────────────────
    if lb:
        _pdf_section(pdf, f"Rep Leaderboard — Won This Month")
        _pdf_table(
            pdf,
            headers=["Rep", "Won Revenue"],
            rows=[[r["rep"], _fmt_currency(r["won_revenue"])] for r in lb],
            col_widths=[100, 80],
        )

    # ── Footer ────────────────────────────────────────────────────────────
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, f"Generated by Signal Intelligence  ·  {period['generated_at'][:10]}", align="C")

    return bytes(pdf.output())


def _pdf_section(pdf, title: str):
    """Render a section heading."""
    pdf.set_fill_color(30, 64, 175)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 7, f"  {title}", ln=True, fill=True)
    pdf.set_text_color(30, 41, 59)
    pdf.ln(2)


def _pdf_table(pdf, headers: List[str], rows: List[List[str]], col_widths: List[int]):
    """Render a simple table with header row."""
    pdf.set_fill_color(226, 232, 240)  # slate-200
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(30, 41, 59)
    for h, w in zip(headers, col_widths):
        pdf.cell(w, 6, h, border=0, fill=True)
    pdf.ln()

    pdf.set_font("Helvetica", "", 8)
    for i, row in enumerate(rows):
        if i % 2 == 0:
            pdf.set_fill_color(248, 250, 252)  # slate-50
        else:
            pdf.set_fill_color(255, 255, 255)
        for cell, w in zip(row, col_widths):
            pdf.cell(w, 5, str(cell)[:40], border=0, fill=True)
        pdf.ln()
    pdf.ln(3)
