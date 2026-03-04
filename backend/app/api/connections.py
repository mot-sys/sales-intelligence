"""
Connections API Routes
Manage integrations with external services (Clay, Salesforce, Snitcher, Outreach).
"""

import logging
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Integration
from app.core.security import get_current_customer_id_dev as get_current_customer_id
from app.integrations.clay import ClayIntegration
from app.db import crud

logger = logging.getLogger(__name__)

router = APIRouter()


def _integration_to_dict(integration: Integration) -> dict:
    """Serialise an Integration ORM object (omitting raw credentials)."""
    return {
        "id": str(integration.id),
        "service": integration.service,
        "status": integration.status,
        "last_sync": integration.last_sync.isoformat() if integration.last_sync else None,
        "sync_frequency": integration.sync_frequency,
        "config": integration.config or {},
        "created_at": integration.created_at.isoformat() if integration.created_at else None,
    }


# ─────────────────────────────────────────────
# GET /connections/
# ─────────────────────────────────────────────

@router.get("")
@router.get("/")
async def list_connections(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """List all integrations and their current status."""
    result = await db.execute(
        select(Integration).where(Integration.customer_id == customer_id)
    )
    integrations = result.scalars().all()
    return {"integrations": [_integration_to_dict(i) for i in integrations]}


# ─────────────────────────────────────────────
# POST /connections/clay
# ─────────────────────────────────────────────

@router.post("/clay")
async def connect_clay(
    api_key: str,
    table_ids: Optional[str] = None,  # comma-separated list of Clay table IDs
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Connect a Clay account via API key.

    - Tests the connection before saving.
    - Stores encrypted credentials in the integrations table.
    - Optional: restrict sync to specific table IDs.
    """
    # Test connection first
    async with ClayIntegration(credentials={"api_key": api_key}) as clay:
        ok = await clay.test_connection()
        if not ok:
            raise HTTPException(
                status_code=400,
                detail="Could not connect to Clay – please verify the API key.",
            )

    config = {}
    if table_ids:
        config["table_ids"] = [t.strip() for t in table_ids.split(",") if t.strip()]

    # Upsert integration record (one per service per customer)
    existing = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "clay",
        )
    )

    if existing:
        existing.credentials = {"api_key": api_key}
        existing.status = "connected"
        existing.config = config
        integration = existing
    else:
        integration = Integration(
            customer_id=customer_id,
            service="clay",
            status="connected",
            credentials={"api_key": api_key},
            config=config,
        )
        db.add(integration)

    await db.flush()
    await db.refresh(integration)

    logger.info("Clay connected for customer %s", customer_id)

    return {
        "message": "Clay connected successfully",
        "integration_id": str(integration.id),
        "service": "clay",
        "status": "connected",
    }


# ─────────────────────────────────────────────
# POST /connections/salesforce  (stub – Week 3)
# ─────────────────────────────────────────────

@router.post("/salesforce")
async def connect_salesforce(
    username: str,
    password: str,
    security_token: str = "",
    domain: str = "login",
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Connect Salesforce via username + password + security token.
    Tests the connection before saving credentials.
    """
    from app.integrations.salesforce import SalesforceIntegration

    credentials = {
        "username": username,
        "password": password,
        "security_token": security_token,
        "domain": domain,
    }

    sf = SalesforceIntegration(credentials)
    ok = await sf.test_connection()
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Could not connect to Salesforce — check username, password, and security token.",
        )

    existing = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "salesforce",
        )
    )
    if existing:
        existing.credentials = credentials
        existing.status = "connected"
        integration = existing
    else:
        integration = Integration(
            customer_id=customer_id,
            service="salesforce",
            status="connected",
            credentials=credentials,
        )
        db.add(integration)

    await db.flush()
    await db.refresh(integration)
    await db.commit()

    logger.info("Salesforce connected for customer %s", customer_id)
    return {
        "message": "Salesforce connected successfully",
        "integration_id": str(integration.id),
        "service": "salesforce",
        "status": "connected",
    }


@router.post("/salesforce/sync")
async def sync_salesforce(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Trigger a full Salesforce sync: fetch opportunities + accounts,
    upsert them to the DB, and run stall detection.
    """
    from app.integrations.salesforce import SalesforceIntegration
    from datetime import datetime
    from sqlalchemy import update as sa_update

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "salesforce",
            Integration.status == "connected",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Salesforce not connected")

    sf = SalesforceIntegration(integration.credentials)
    opps = await sf.sync_opportunities()
    accs = await sf.sync_accounts()

    opps_upserted = 0
    for opp in opps:
        sf_id = opp.pop("sf_opportunity_id")
        await crud.upsert_sf_opportunity(db, customer_id, sf_id, opp)
        opps_upserted += 1

    accs_upserted = 0
    for acc in accs:
        sf_id = acc.pop("sf_account_id")
        await crud.upsert_sf_account(db, customer_id, sf_id, acc)
        accs_upserted += 1

    await db.execute(
        sa_update(Integration)
        .where(Integration.id == integration.id)
        .values(last_sync=datetime.utcnow())
    )
    await db.commit()

    return {
        "message": "Salesforce sync complete",
        "opportunities_synced": opps_upserted,
        "accounts_synced": accs_upserted,
    }


# ─────────────────────────────────────────────
# POST /connections/snitcher  (stub – Week 3)
# ─────────────────────────────────────────────

@router.post("/snitcher")
async def connect_snitcher(
    api_key: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Connect Snitcher via API key. (Full implementation in Week 3)"""
    # TODO: Test Snitcher connection in Week 3
    existing = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "snitcher",
        )
    )
    if existing:
        existing.credentials = {"api_key": api_key}
        existing.status = "connected"
        integration = existing
    else:
        integration = Integration(
            customer_id=customer_id,
            service="snitcher",
            status="connected",
            credentials={"api_key": api_key},
        )
        db.add(integration)

    await db.flush()
    await db.refresh(integration)

    return {
        "message": "Snitcher connected successfully",
        "integration_id": str(integration.id),
        "service": "snitcher",
        "status": "connected",
    }


# ─────────────────────────────────────────────
# GET /connections/hubspot/owners-debug
# ─────────────────────────────────────────────

@router.get("/hubspot/owners-debug")
async def debug_hubspot_owners(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Debug endpoint: returns raw /crm/v3/owners response from HubSpot.
    Use this to check if crm.objects.owners.read scope is configured.
    """
    from app.integrations.hubspot import HubSpotIntegration, HUBSPOT_BASE
    import httpx

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "hubspot",
            Integration.status == "connected",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="HubSpot not connected")

    hs = HubSpotIntegration(credentials=integration.credentials)
    owner_map = await hs._fetch_owners()

    # Also fetch the raw response for debugging
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{HUBSPOT_BASE}/crm/v3/owners",
                headers=hs._headers,
                params={"limit": 100},
            )
        return {
            "status_code": r.status_code,
            "owner_map": owner_map,
            "owner_count": len(owner_map),
            "raw_preview": r.json() if r.status_code == 200 else r.text[:300],
        }
    except Exception as exc:
        return {"error": str(exc), "owner_map": owner_map}


# ─────────────────────────────────────────────
# POST /connections/outreach  — save creds + return OAuth URL
# ─────────────────────────────────────────────

@router.post("/outreach")
async def connect_outreach(
    client_id: str,
    client_secret: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Step 1 of Outreach OAuth 2.0.
    Saves the app credentials and returns the Outreach authorization URL
    that the user must visit to grant access.
    """
    from app.integrations.outreach import OutreachIntegration
    from app.core.config import settings

    redirect_uri = settings.OUTREACH_REDIRECT_URI

    # Save credentials (pending auth — no tokens yet)
    existing = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "outreach",
        )
    )
    if existing:
        existing.credentials = {"client_id": client_id, "client_secret": client_secret}
        existing.status = "pending"
    else:
        existing = Integration(
            customer_id=customer_id,
            service="outreach",
            status="pending",
            credentials={"client_id": client_id, "client_secret": client_secret},
        )
        db.add(existing)

    await db.flush()
    await db.commit()

    auth_url = OutreachIntegration.build_authorization_url(client_id, redirect_uri)
    logger.info("Outreach OAuth initiated for customer %s", customer_id)

    return {
        "message": "Outreach OAuth initiated — redirect user to auth_url",
        "auth_url": auth_url,
        "service": "outreach",
        "status": "pending",
    }


# ─────────────────────────────────────────────
# GET /connections/outreach/callback — OAuth callback
# ─────────────────────────────────────────────

@router.get("/outreach/callback")
async def outreach_callback(
    code: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Step 2 of Outreach OAuth 2.0.
    Outreach redirects here with ?code=... after the user authorises.
    Exchanges the code for tokens and marks the integration as connected.
    Redirects back to the frontend with ?outreach_connected=1.
    """
    from app.integrations.outreach import OutreachIntegration
    from app.core.config import settings
    from fastapi.responses import RedirectResponse

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "outreach",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Outreach not found — connect first")

    creds = integration.credentials or {}
    try:
        tokens = await OutreachIntegration.exchange_code(
            code=code,
            client_id=creds["client_id"],
            client_secret=creds["client_secret"],
            redirect_uri=settings.OUTREACH_REDIRECT_URI,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {exc}")

    integration.credentials = {**creds, **tokens}
    integration.status = "connected"
    await db.commit()

    logger.info("Outreach connected for customer %s", customer_id)
    frontend_url = settings.OUTREACH_REDIRECT_URI.split("/api/")[0]
    return RedirectResponse(url=f"{frontend_url}/?outreach_connected=1")


# ─────────────────────────────────────────────
# GET /connections/outreach/test
# ─────────────────────────────────────────────

@router.get("/outreach/test")
async def test_outreach(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Quick token validity check — fetches a single user record from Outreach."""
    from app.integrations.outreach import OutreachIntegration
    import httpx

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "outreach",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Outreach not connected")

    ot = OutreachIntegration(credentials=integration.credentials)
    try:
        headers = await ot._auth_headers()
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.outreach.io/api/v2/users?page[size]=1",
                headers=headers,
            )
        return {
            "status_code": r.status_code,
            "ok": r.status_code == 200,
            "body_preview": r.text[:300],
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ─────────────────────────────────────────────
# POST /connections/outreach/sync
# ─────────────────────────────────────────────

@router.post("/outreach/sync")
async def sync_outreach(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Sync prospects, accounts, sequences and sequence states from Outreach.
    Updates the integration's last_sync timestamp.
    """
    from app.integrations.outreach import OutreachIntegration
    from datetime import datetime
    from sqlalchemy import update as sa_update

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "outreach",
            Integration.status == "connected",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Outreach not connected")

    ot = OutreachIntegration(credentials=integration.credentials)

    try:
        import asyncio as _asyncio
        import traceback as _tb
        prospects, accounts, sequences, seq_states = await _asyncio.gather(
            ot.sync_prospects(),
            ot.sync_accounts(),
            ot.sync_sequences(),
            ot.sync_sequence_states(),
            return_exceptions=False,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Outreach API error: {exc}\n{_tb.format_exc()}")

    # If token was refreshed, persist the new credentials
    updated_creds = {
        **integration.credentials,
        "access_token": ot._access_token,
        "refresh_token": ot._refresh_token,
        "expires_at": ot._expires_at_str,
    }
    await db.execute(
        sa_update(Integration)
        .where(Integration.id == integration.id)
        .values(
            last_sync=datetime.utcnow(),
            credentials=updated_creds,
        )
    )
    await db.commit()

    logger.info(
        "Outreach sync for customer %s: %d prospects, %d accounts, %d sequences, %d states",
        customer_id, len(prospects), len(accounts), len(sequences), len(seq_states),
    )
    return {
        "message": "Outreach sync complete",
        "prospects_synced": len(prospects),
        "accounts_synced": len(accounts),
        "sequences_synced": len(sequences),
        "sequence_states_synced": len(seq_states),
    }


# ─────────────────────────────────────────────
# POST /connections/hubspot
# ─────────────────────────────────────────────

@router.post("/hubspot")
async def connect_hubspot(
    access_token: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Connect HubSpot via Private App access token.
    Tests the connection before saving credentials.
    """
    from app.integrations.hubspot import HubSpotIntegration

    hs = HubSpotIntegration(credentials={"access_token": access_token})
    ok = await hs.test_connection()
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Could not connect to HubSpot — please verify the access token.",
        )

    existing = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "hubspot",
        )
    )
    if existing:
        existing.credentials = {"access_token": access_token}
        existing.status = "connected"
        integration = existing
    else:
        integration = Integration(
            customer_id=customer_id,
            service="hubspot",
            status="connected",
            credentials={"access_token": access_token},
        )
        db.add(integration)

    await db.flush()
    await db.refresh(integration)
    await db.commit()

    logger.info("HubSpot connected for customer %s", customer_id)
    return {
        "message": "HubSpot connected successfully",
        "integration_id": str(integration.id),
        "service": "hubspot",
        "status": "connected",
    }


@router.post("/hubspot/sync")
async def sync_hubspot(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Trigger a full HubSpot sync: fetch deals + companies,
    upsert them into the salesforce_opportunities / salesforce_accounts tables
    (IDs prefixed with 'hs_' to avoid collision with Salesforce IDs).
    Also upserts deals into the leads table so Lead Intel is populated.
    """
    from app.integrations.hubspot import HubSpotIntegration
    from datetime import datetime
    from sqlalchemy import update as sa_update

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "hubspot",
            Integration.status == "connected",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="HubSpot not connected")

    hs = HubSpotIntegration(credentials=integration.credentials)
    deals = await hs.sync_deals()
    companies = await hs.sync_companies()

    # Stage → score mapping for Lead Intel scoring
    _STAGE_SCORES: dict = {
        "appointmentscheduled": 40,
        "qualifiedtobuy": 55,
        "presentationscheduled": 65,
        "decisionmakerboughtin": 75,
        "contractsent": 85,
        "closedwon": 95,
        "closedlost": 5,
    }

    deals_upserted = 0
    leads_upserted = 0
    for deal in deals:
        sf_id = deal.pop("sf_opportunity_id")
        await crud.upsert_sf_opportunity(db, customer_id, sf_id, deal)
        deals_upserted += 1

        # Also add to Lead Intel (leads table) so the Lead Intel tab is populated
        stage = (deal.get("stage") or "").lower()
        score = _STAGE_SCORES.get(stage, 50)
        priority = "hot" if score >= 70 else ("warm" if score >= 45 else "cold")
        amount = deal.get("amount")
        amount_str = f"€{amount:,}" if amount else "N/A"
        close = deal.get("close_date")
        close_str = close.strftime("%Y-%m-%d") if close else "N/A"

        lead_data = {
            "company_name": deal.get("account_name") or "Unknown Deal",
            "owner_name": deal.get("owner_name"),
            "last_activity": deal.get("last_activity_date"),
            "score": score,
            "priority": priority,
            "recommendation": (
                f"HubSpot deal · Stage: {deal.get('stage') or 'unknown'} · "
                f"Amount: {amount_str} · Close: {close_str}"
            ),
        }
        await crud.upsert_lead(
            db, lead_data=lead_data, customer_id=customer_id,
            source="hubspot", external_id=sf_id,
        )
        leads_upserted += 1

    companies_upserted = 0
    for company in companies:
        sf_id = company.pop("sf_account_id")
        await crud.upsert_sf_account(db, customer_id, sf_id, company)
        companies_upserted += 1

    await db.execute(
        sa_update(Integration)
        .where(Integration.id == integration.id)
        .values(last_sync=datetime.utcnow())
    )
    await db.commit()

    logger.info(
        "HubSpot sync complete for customer %s: %d deals, %d companies, %d leads",
        customer_id,
        deals_upserted,
        companies_upserted,
        leads_upserted,
    )
    return {
        "message": "HubSpot sync complete",
        "deals_synced": deals_upserted,
        "companies_synced": companies_upserted,
        "leads_upserted": leads_upserted,
    }


# ─────────────────────────────────────────────
# POST /connections/{integration_id}/sync
# ─────────────────────────────────────────────

@router.post("/{integration_id}/sync")
async def trigger_sync(
    integration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Manually trigger a data sync for an integration.

    For Clay: fetches all rows and creates/updates leads with scores.
    For other services: returns a stub response (Week 3).
    """
    integration = await db.scalar(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.customer_id == customer_id,
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    if integration.service == "clay":
        return await _sync_clay(db, integration, customer_id)

    # Other services: Week 3
    return {
        "message": f"Sync triggered for {integration.service} (background job not yet implemented)",
        "integration_id": str(integration_id),
    }


async def _sync_clay(db: AsyncSession, integration: Integration, customer_id: str) -> dict:
    """
    Run a synchronous Clay sync: fetch rows, upsert leads, score each one.
    Returns a summary of created/updated leads.
    """
    from app.ml.scorer import score_lead as do_score

    async with ClayIntegration(
        credentials=integration.credentials,
        config=integration.config or {},
    ) as clay:
        rows = await clay.sync_data()

    created = 0
    updated = 0

    for lead_data in rows:
        external_id = lead_data.pop("external_id", None)

        # Check if lead already exists BEFORE upsert so we can count correctly
        already_exists = bool(
            external_id and await crud.get_lead_by_external_id(db, external_id, customer_id, "clay")
        )

        lead = await crud.upsert_lead(
            db,
            lead_data=lead_data,
            customer_id=customer_id,
            source="clay",
            external_id=external_id,
        )

        # Score immediately after upsert
        signals = await crud.get_signals_for_lead(db, str(lead.id))
        signal_dicts = [
            {"type": s.type, "title": s.title, "detected_at": s.detected_at}
            for s in signals
        ]
        result = do_score(
            {
                "company_name": lead.company_name,
                "industry": lead.industry,
                "employee_count": lead.employee_count,
            },
            signal_dicts,
        )
        await crud.update_lead_score(
            db,
            lead_id=str(lead.id),
            score=result["score"],
            priority=result["priority"],
            recommendation=result["recommendation"],
        )

        if already_exists:
            updated += 1
        else:
            created += 1

    # Update last_sync timestamp
    from datetime import datetime
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(Integration)
        .where(Integration.id == integration.id)
        .values(last_sync=datetime.utcnow(), status="connected")
    )

    logger.info(
        "Clay sync complete for customer %s: %d rows (%d created, %d updated)",
        customer_id,
        len(rows),
        created,
        updated,
    )

    return {
        "message": "Clay sync complete",
        "integration_id": str(integration.id),
        "leads_synced": len(rows),
        "created": created,
        "updated": updated,
    }


# ─────────────────────────────────────────────
# DELETE /connections/{integration_id}
# ─────────────────────────────────────────────

@router.delete("/{integration_id}")
async def disconnect_integration(
    integration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """Disconnect an integration (removes credentials and stops future syncing)."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.customer_id == customer_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    await db.execute(
        delete(Integration).where(Integration.id == integration_id)
    )

    logger.info(
        "Integration %s (%s) disconnected for customer %s",
        integration_id,
        integration.service,
        customer_id,
    )

    return {
        "message": "Integration disconnected",
        "integration_id": str(integration_id),
        "service": integration.service,
    }


# ─────────────────────────────────────────────────────────
# NOTION — connect + sync + databases
# ─────────────────────────────────────────────────────────

@router.post("/notion")
async def connect_notion(
    api_key: str,
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Connect Notion via an Internal Integration Token (secret_...).
    Verifies the token, then saves credentials.
    """
    from app.integrations.notion import NotionIntegration

    notion = NotionIntegration(credentials={"api_key": api_key})
    ok = await notion.test_connection()
    if not ok:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kunne ikke forbinde til Notion — tjek at token er korrekt "
                "og at integrationen har adgang til mindst ét workspace."
            ),
        )

    existing = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "notion",
        )
    )
    if existing:
        existing.credentials = {"api_key": api_key}
        existing.status = "connected"
        integration = existing
    else:
        integration = Integration(
            customer_id=customer_id,
            service="notion",
            status="connected",
            credentials={"api_key": api_key},
        )
        db.add(integration)

    await db.flush()
    await db.refresh(integration)
    await db.commit()

    logger.info("Notion connected for customer %s", customer_id)
    return {
        "message": "Notion connected successfully",
        "integration_id": str(integration.id),
        "service": "notion",
        "status": "connected",
    }


@router.get("/notion/databases")
async def list_notion_databases(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    List all Notion databases the integration has access to.
    Use this to see which databases will be synced.
    """
    from app.integrations.notion import NotionIntegration

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "notion",
            Integration.status == "connected",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Notion not connected")

    notion = NotionIntegration(
        credentials=integration.credentials,
        config=integration.config or {},
    )
    databases = await notion.get_databases()
    return {"databases": databases, "total": len(databases)}


@router.post("/notion/sync")
async def sync_notion(
    db: AsyncSession = Depends(get_db),
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Sync all Notion databases and upsert pages as NotionInitiatives.
    Each database represents a department; each page is an initiative.
    """
    from app.integrations.notion import NotionIntegration
    from sqlalchemy import update as sa_update
    from datetime import datetime

    integration = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "notion",
            Integration.status == "connected",
        )
    )
    if not integration:
        raise HTTPException(status_code=404, detail="Notion not connected")

    notion = NotionIntegration(
        credentials=integration.credentials,
        config=integration.config or {},
    )

    try:
        items = await notion.sync_all()
    except Exception as exc:
        logger.exception("Notion sync failed for customer %s: %s", customer_id, exc)
        raise HTTPException(status_code=502, detail=f"Notion sync fejlede: {exc}")

    from app.db.models import NotionInitiative as _NI
    created = 0
    updated = 0
    for item in items:
        page_id = item.get("notion_page_id")
        was_existing = bool(
            page_id and await db.scalar(
                select(_NI).where(
                    _NI.customer_id == customer_id,
                    _NI.notion_page_id == page_id,
                )
            )
        )
        await crud.upsert_notion_initiative(db, customer_id, item)
        if was_existing:
            updated += 1
        else:
            created += 1

    await db.execute(
        sa_update(Integration)
        .where(Integration.id == integration.id)
        .values(last_sync=datetime.utcnow())
    )
    await db.commit()

    logger.info(
        "Notion sync complete for customer %s: %d items (%d created, %d updated)",
        customer_id, len(items), created, updated,
    )
    return {
        "message": "Notion sync complete",
        "initiatives_synced": len(items),
        "created": created,
        "updated": updated,
    }
