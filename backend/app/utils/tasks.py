"""
Celery Tasks
Scheduled background jobs for continuous monitoring and alerting.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List

from app.utils.celery_app import celery_app
from app.core.config import settings


def _run(coro):
    """Run an async coroutine from a synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.utils.tasks.check_stalled_deals", bind=True, max_retries=3)
def check_stalled_deals(self):
    """
    Every 15 min: scan all Salesforce-connected customers for stalled opportunities
    and create alerts for deals with no activity > ALERT_STALE_DEAL_DAYS.
    """
    return _run(_check_stalled_deals_async())


async def _check_stalled_deals_async():
    from app.db.session import AsyncSessionLocal
    from app.db import crud
    from app.core.alerts import create_stalled_deal_alert

    alerts_created = 0

    async with AsyncSessionLocal() as db:
        customers = await crud.get_customers_with_integration(db, "salesforce")

        for customer in customers:
            customer_id = str(customer.id)
            stale_opps = await crud.get_stale_opportunities(
                db, customer_id, days=settings.ALERT_STALE_DEAL_DAYS
            )

            for opp in stale_opps:
                days_stalled = 0
                if opp.last_activity_date:
                    days_stalled = (datetime.utcnow() - opp.last_activity_date).days
                else:
                    days_stalled = settings.ALERT_STALE_DEAL_DAYS

                alert = await create_stalled_deal_alert(
                    db=db,
                    customer_id=customer_id,
                    opportunity_name=opp.account_name or "Unknown Opportunity",
                    days_stalled=days_stalled,
                    amount=opp.amount,
                    sf_opportunity_id=opp.sf_opportunity_id,
                    close_date=opp.close_date.strftime("%Y-%m-%d") if opp.close_date else None,
                    owner_name=opp.owner_name,
                )
                if alert:
                    alerts_created += 1
                    # Mark opportunity as stalled in DB
                    opp.is_stalled = True
                    await db.flush()

        await db.commit()

    return {"alerts_created": alerts_created}


@celery_app.task(name="app.utils.tasks.check_intent_spikes", bind=True, max_retries=3)
def check_intent_spikes(self):
    """
    Every hour: aggregate Snitcher signals from the last hour and fire intent spike
    alerts for companies that crossed the page-visit threshold.
    """
    return _run(_check_intent_spikes_async())


async def _check_intent_spikes_async():
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import select, func
    from app.db.models import Signal, Lead
    from app.core.alerts import create_intent_spike_alert

    alerts_created = 0
    cutoff = datetime.utcnow() - timedelta(hours=1)

    async with AsyncSessionLocal() as db:
        # Find Snitcher signals from the last hour, grouped by customer + lead
        result = await db.execute(
            select(Signal.customer_id, Signal.lead_id, func.count(Signal.id).label("signal_count"))
            .where(
                Signal.source == "snitcher",
                Signal.detected_at >= cutoff,
            )
            .group_by(Signal.customer_id, Signal.lead_id)
            .having(func.count(Signal.id) >= settings.ALERT_INTENT_SPIKE_PAGES)
        )
        rows = result.all()

        for row in rows:
            if not row.lead_id:
                continue

            lead_result = await db.execute(select(Lead).where(Lead.id == row.lead_id))
            lead = lead_result.scalar_one_or_none()
            if not lead:
                continue

            # Gather pages from signals metadata
            sig_result = await db.execute(
                select(Signal).where(
                    Signal.lead_id == row.lead_id,
                    Signal.source == "snitcher",
                    Signal.detected_at >= cutoff,
                )
            )
            signals = sig_result.scalars().all()
            pages = [s.extra_data.get("page", "") for s in signals if s.extra_data]

            alert = await create_intent_spike_alert(
                db=db,
                customer_id=str(row.customer_id),
                company_name=lead.company_name,
                company_domain=lead.company_domain or "",
                pages_visited=row.signal_count,
                pages=pages,
                lead_id=str(row.lead_id),
            )
            if alert:
                alerts_created += 1

        await db.commit()

    return {"alerts_created": alerts_created}


@celery_app.task(name="app.utils.tasks.run_scoring_cycle", bind=True, max_retries=3)
def run_scoring_cycle(self):
    """
    Every 2 hours: re-score leads that have been updated since the last cycle
    and create score_jump alerts for significant score changes (>= 20 points).
    """
    return _run(_run_scoring_cycle_async())


async def _run_scoring_cycle_async():
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import select
    from app.db.models import Lead, Signal
    from app.db import crud
    from app.ml.scorer import LeadScorer
    from app.core.alerts import create_alert

    scorer = LeadScorer()
    rescored = 0
    alerts_created = 0
    cutoff = datetime.utcnow() - timedelta(hours=2)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Lead).where(Lead.updated_at >= cutoff)
        )
        leads = result.scalars().all()

        for lead in leads:
            sig_result = await db.execute(
                select(Signal).where(Signal.lead_id == lead.id)
            )
            signals = sig_result.scalars().all()
            signals_data = [
                {"type": s.type, "score_impact": s.score_impact, "source": s.source}
                for s in signals
            ]

            lead_dict = {
                "company_name": lead.company_name,
                "industry": lead.industry,
                "employee_count": lead.employee_count,
                "revenue": lead.revenue,
            }
            result_score = scorer.score_lead(lead_dict, signals_data)
            new_score = result_score["score"]
            old_score = lead.score

            if abs(new_score - old_score) >= 20:
                await create_alert(
                    db=db,
                    customer_id=str(lead.customer_id),
                    alert_type="score_jump",
                    priority="high" if new_score >= 70 else "medium",
                    source="scoring",
                    headline=f"{lead.company_name} score jumped from {old_score} → {new_score}",
                    context_json={"old_score": old_score, "new_score": new_score, "delta": new_score - old_score},
                    lead_id=str(lead.id),
                )
                alerts_created += 1

            await crud.update_lead_score(
                db, str(lead.id), new_score, result_score["priority"], result_score.get("recommendation", "")
            )
            rescored += 1

        await db.commit()

    return {"rescored": rescored, "alerts_created": alerts_created}


@celery_app.task(name="app.utils.tasks.send_daily_digest", bind=True, max_retries=3)
def send_daily_digest(self):
    """
    Daily at 8 AM: aggregate yesterday's pending alerts and create a single
    daily_digest alert per customer summarising what needs attention.
    """
    return _run(_send_daily_digest_async())


async def _send_daily_digest_async():
    from app.db.session import AsyncSessionLocal
    from app.db import crud
    from app.core.alerts import create_alert

    digests_created = 0
    yesterday = datetime.utcnow() - timedelta(days=1)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select, func
        from app.db.models import Alert, Customer

        # Get customers with pending alerts from yesterday
        result = await db.execute(
            select(Alert.customer_id, func.count(Alert.id).label("count"))
            .where(Alert.created_at >= yesterday, Alert.status == "pending")
            .group_by(Alert.customer_id)
        )
        rows = result.all()

        for row in rows:
            count = row.count
            alert = await create_alert(
                db=db,
                customer_id=str(row.customer_id),
                alert_type="daily_digest",
                priority="medium",
                source="scoring",
                headline=f"Daily digest: {count} alerts need your attention",
                context_json={"pending_count": count, "date": yesterday.strftime("%Y-%m-%d")},
            )
            if alert:
                digests_created += 1

        await db.commit()

    return {"digests_created": digests_created}


# ─────────────────────────────────────────────────────────
# WEEKLY KPI SNAPSHOT (Monday 06:00 UTC)
# ─────────────────────────────────────────────────────────

@celery_app.task(name="app.utils.tasks.snapshot_weekly_kpis", bind=True, max_retries=3)
def snapshot_weekly_kpis(self):
    """
    Every Monday at 06:00 UTC: compute current pipeline KPIs for every customer
    and persist a KpiSnapshot row. Used for plan-vs-actual and week-over-week diffs.
    """
    return _run(_snapshot_weekly_kpis_async())


async def _snapshot_weekly_kpis_async():
    from app.db.session import AsyncSessionLocal
    from app.db import crud
    from app.db.models import Customer, SalesforceOpportunity, Lead
    from sqlalchemy import select, func
    from datetime import date

    snapshots_written = 0

    async with AsyncSessionLocal() as db:
        customers = await db.execute(select(Customer))
        all_customers = customers.scalars().all()

        for customer in all_customers:
            cid = str(customer.id)

            # Pipeline metrics from SalesforceOpportunity
            opps_result = await db.execute(
                select(SalesforceOpportunity).where(
                    SalesforceOpportunity.customer_id == cid
                )
            )
            opps = opps_result.scalars().all()

            closed_won_stages = {"closedwon", "closed won", "closed_won"}
            closed_lost_stages = {"closedlost", "closed lost", "closed_lost"}

            open_deals, pipeline_value = 0, 0
            closed_won_count, closed_won_value = 0, 0
            stalled_deals = 0

            for opp in opps:
                stage_key = (opp.stage or "").lower().replace(" ", "")
                if stage_key in closed_won_stages:
                    closed_won_count += 1
                    closed_won_value += int(opp.amount or 0)
                elif stage_key not in closed_lost_stages:
                    open_deals += 1
                    pipeline_value += int(opp.amount or 0)
                    if opp.is_stalled:
                        stalled_deals += 1

            total_deals = closed_won_count + open_deals
            win_rate_pct = round(closed_won_count / total_deals * 100, 1) if total_deals else 0
            avg_deal_size = round(closed_won_value / closed_won_count) if closed_won_count else 0

            # Lead metrics
            leads_result = await db.execute(
                select(
                    func.count(Lead.id).label("total"),
                    func.sum((Lead.priority == "hot").cast(sa_Integer)).label("hot"),
                    func.sum((Lead.priority == "warm").cast(sa_Integer)).label("warm"),
                    func.sum((Lead.priority == "cold").cast(sa_Integer)).label("cold"),
                ).where(Lead.customer_id == cid)
            )
            lead_row = leads_result.one()

            metrics = {
                "pipeline_value": pipeline_value,
                "open_deals": open_deals,
                "closed_won_value": closed_won_value,
                "closed_won_count": closed_won_count,
                "avg_deal_size": avg_deal_size,
                "win_rate_pct": win_rate_pct,
                "stalled_deals": stalled_deals,
                "leads_total": lead_row.total or 0,
                "hot_leads": lead_row.hot or 0,
                "warm_leads": lead_row.warm or 0,
                "cold_leads": lead_row.cold or 0,
            }

            await crud.upsert_kpi_snapshot(db, cid, date.today(), metrics)
            snapshots_written += 1

        await db.commit()

    return {"snapshots_written": snapshots_written}


# ─────────────────────────────────────────────────────────
# WEEKLY REPORT GENERATION (Monday 07:00 UTC)
# ─────────────────────────────────────────────────────────

@celery_app.task(name="app.utils.tasks.generate_weekly_reports", bind=True, max_retries=3)
def generate_weekly_reports(self):
    """
    Every Monday at 07:00 UTC: generate AI weekly report for every customer
    and persist to WeeklyReport. Relies on KpiSnapshot from the 06:00 task.
    """
    return _run(_generate_weekly_reports_async())


async def _generate_weekly_reports_async():
    from app.db.session import AsyncSessionLocal
    from app.db import crud
    from app.db.models import Customer, WeeklyReport
    from app.core.ai import build_pipeline_context
    from app.core.config import settings
    from sqlalchemy import select
    from datetime import date

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    except Exception:
        return {"error": "Anthropic client unavailable"}

    reports_generated = 0

    async with AsyncSessionLocal() as db:
        customers = await db.execute(select(Customer))
        all_customers = customers.scalars().all()

        # Get Monday of current week as week_start
        today = date.today()
        week_start_date = today - timedelta(days=today.weekday())
        week_start = datetime.combine(week_start_date, datetime.min.time())

        for customer in all_customers:
            cid = str(customer.id)
            try:
                # Get last 2 KPI snapshots for week-over-week diff
                snapshots = await crud.get_kpi_snapshots(db, cid, limit=2)
                current_metrics = snapshots[0].metrics if snapshots else {}
                prev_metrics = snapshots[1].metrics if len(snapshots) > 1 else {}

                # Build pipeline context for AI
                ctx = await build_pipeline_context(db, cid)

                delta_pipeline = (
                    current_metrics.get("pipeline_value", 0) -
                    prev_metrics.get("pipeline_value", 0)
                ) if prev_metrics else None

                prompt = f"""Du er en senior salgsanalytiker. Skriv en ugentlig salgsrapport på dansk for denne uge.

Pipeline: {current_metrics.get('pipeline_value', 'N/A')} kr
Åbne deals: {current_metrics.get('open_deals', 'N/A')}
Vundet denne periode: {current_metrics.get('closed_won_count', 'N/A')} deals ({current_metrics.get('closed_won_value', 'N/A')} kr)
Win rate: {current_metrics.get('win_rate_pct', 'N/A')}%
Stalled deals: {current_metrics.get('stalled_deals', 'N/A')}
Hot leads: {current_metrics.get('hot_leads', 'N/A')}
Pipeline ændring vs forrige uge: {f"+{delta_pipeline:,} kr" if delta_pipeline and delta_pipeline > 0 else (f"{delta_pipeline:,} kr" if delta_pipeline is not None else "N/A")}

Skriv tre sektioner:
1. HVad skete der: Faktuel opsummering af ugens resultater (3-4 bullets)
2. Denne uge: Top 3 prioriteter for den kommende uge (3 konkrete handlinger)
3. Management hjælp: Hvad kræver ledelsesindgreb lige nu? (max 2 punkter, vær konkret)

Svar kun med de tre sektioner, ingen introduktion."""

                resp = await client.messages.create(
                    model=settings.ANTHROPIC_MODEL,
                    max_tokens=800,
                    messages=[{"role": "user", "content": prompt}],
                )
                full_text = resp.content[0].text if resp.content else ""

                # Split into sections (heuristic split on blank lines or numbered headers)
                sections = [s.strip() for s in full_text.split("\n\n") if s.strip()]
                s_happened = sections[0] if len(sections) > 0 else full_text
                s_week = sections[1] if len(sections) > 1 else ""
                s_mgmt = sections[2] if len(sections) > 2 else ""

                report = WeeklyReport(
                    customer_id=cid,
                    week_start=week_start,
                    data_snapshot={"metrics": current_metrics, "prev_metrics": prev_metrics},
                    section_what_happened=s_happened,
                    section_this_week=s_week,
                    section_management=s_mgmt,
                    model_used=settings.ANTHROPIC_MODEL,
                )
                db.add(report)
                await db.flush()   # get report.id before commit
                reports_generated += 1

                # P2.10 — email the report if enabled and customer has an email address
                if settings.EMAIL_REPORT_ENABLED and settings.RESEND_API_KEY:
                    try:
                        from app.core.email import send_weekly_report_email
                        week_start_str = week_start_date.isoformat()
                        await send_weekly_report_email(
                            to_email=customer.email,
                            customer_name=customer.name or "din virksomhed",
                            week_start=week_start_str,
                            section_what_happened=s_happened,
                            section_this_week=s_week,
                            section_management=s_mgmt,
                        )
                    except Exception as mail_exc:
                        import logging as _log
                        _log.getLogger(__name__).warning(
                            "Email for customer %s failed: %s", cid, mail_exc
                        )

            except Exception as exc:
                # Don't fail the whole batch if one customer errors
                import logging
                logging.getLogger(__name__).exception(
                    "Weekly report failed for customer %s: %s", cid, exc
                )

        await db.commit()

    return {"reports_generated": reports_generated}


# SQLAlchemy Integer needed for cast in KPI snapshot
from sqlalchemy import Integer as sa_Integer
