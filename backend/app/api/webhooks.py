"""
Webhook Endpoints
Receives real-time events from Salesforce CDC, Snitcher, and Outreach.io.
"""

from typing import Dict, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db import crud
from app.core.config import settings
from app.integrations.snitcher import validate_snitcher_signature, extract_visit_data, is_intent_spike
from app.core.alerts import create_intent_spike_alert

router = APIRouter()

# ─────────────────────────────────────────────
# SNITCHER WEBHOOKS
# ─────────────────────────────────────────────

@router.post("/snitcher")
async def snitcher_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_snitcher_signature: Optional[str] = Header(None),
    x_customer_id: Optional[str] = Header(None),
):
    """
    Receive Snitcher visitor events.
    Validates HMAC signature, detects intent spikes, and creates alerts.

    Snitcher should be configured to send:
      Header X-Customer-Id: <your customer UUID>
      Header X-Snitcher-Signature: sha256=<hmac>
    """
    body = await request.body()

    if x_snitcher_signature and not validate_snitcher_signature(body, x_snitcher_signature):
        raise HTTPException(status_code=401, detail="Invalid Snitcher signature")

    if not x_customer_id:
        raise HTTPException(status_code=400, detail="X-Customer-Id header required")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    visit_data = extract_visit_data(payload)

    # Store as a signal regardless of intent spike status
    if visit_data["company_domain"]:
        # Try to match to an existing lead by domain
        from sqlalchemy import select
        from app.db.models import Lead
        lead_result = await db.execute(
            select(Lead).where(
                Lead.customer_id == x_customer_id,
                Lead.company_domain == visit_data["company_domain"],
            ).limit(1)
        )
        lead = lead_result.scalar_one_or_none()
        lead_id = str(lead.id) if lead else None

        # Record signal
        await crud.create_signal(db, {
            "lead_id": lead_id,
            "customer_id": x_customer_id,
            "type": "intent",
            "title": f"Website visit: {visit_data['pages_count']} pages",
            "description": f"Company {visit_data['company_name']} visited your website",
            "score_impact": 10 if visit_data["pricing_visited"] else 5,
            "source": "snitcher",
            "metadata": visit_data,
        })

        # Fire alert if this is an intent spike
        if is_intent_spike(visit_data):
            await create_intent_spike_alert(
                db=db,
                customer_id=x_customer_id,
                company_name=visit_data["company_name"],
                company_domain=visit_data["company_domain"],
                pages_visited=visit_data["pages_count"],
                pages=visit_data["pages"],
                lead_id=lead_id,
            )

    await db.commit()
    return {"status": "ok"}


# ─────────────────────────────────────────────
# SALESFORCE CDC WEBHOOKS
# ─────────────────────────────────────────────

@router.post("/salesforce")
async def salesforce_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_customer_id: Optional[str] = Header(None),
    x_sf_verify_token: Optional[str] = Header(None),
):
    """
    Receive Salesforce Change Data Capture (CDC) events.
    Validates verify token and upserts changed opportunity records.
    """
    if settings.SF_CDC_VERIFY_TOKEN and x_sf_verify_token != settings.SF_CDC_VERIFY_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid Salesforce verify token")

    if not x_customer_id:
        raise HTTPException(status_code=400, detail="X-Customer-Id header required")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Salesforce CDC payload: { "event": { "replayId": ... }, "data": { "payload": { ... } } }
    sf_data = payload.get("data", {}).get("payload", payload)
    record_type = sf_data.get("ChangeEventHeader", {}).get("entityName", "")
    sf_id = sf_data.get("Id") or sf_data.get("ChangeEventHeader", {}).get("recordIds", [None])[0]

    if record_type == "Opportunity" and sf_id:
        opp_data = {
            "account_name": sf_data.get("Name"),
            "amount": int(sf_data["Amount"]) if sf_data.get("Amount") else None,
            "stage": sf_data.get("StageName"),
            "raw_data": sf_data,
        }
        await crud.upsert_sf_opportunity(db, x_customer_id, sf_id, opp_data)

    elif record_type == "Account" and sf_id:
        website = sf_data.get("Website") or ""
        domain = website.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
        acc_data = {
            "name": sf_data.get("Name"),
            "domain": domain or None,
            "industry": sf_data.get("Industry"),
            "employee_count": sf_data.get("NumberOfEmployees"),
            "raw_data": sf_data,
        }
        await crud.upsert_sf_account(db, x_customer_id, sf_id, acc_data)

    await db.commit()
    return {"status": "ok", "record_type": record_type}

