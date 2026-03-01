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
            pages = [s.metadata.get("page", "") for s in signals if s.metadata]

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
