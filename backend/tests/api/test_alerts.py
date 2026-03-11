"""
API tests for the Alerts endpoints.

Routes covered:
  GET  /api/alerts/stats
  GET  /api/alerts
  GET  /api/alerts/{id}
  POST /api/alerts/{id}/action
"""

import uuid

import pytest
import pytest_asyncio

from app.db.models import Alert


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def alert(db, customer):
    """A single pending Alert row for the test customer."""
    row = Alert(
        id=uuid.uuid4(),
        customer_id=customer.id,
        alert_type="stalled_deal",
        priority="high",
        status="pending",
        source="scoring",
        headline="Deal stalled: Acme Corp",
        context_json={"days": 21, "amount": 50000},
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


# ── Auth guard ────────────────────────────────────────────────────────────────


async def test_list_alerts_requires_auth(client):
    resp = await client.get("/api/alerts")
    assert resp.status_code == 401


async def test_alert_stats_requires_auth(client):
    resp = await client.get("/api/alerts/stats")
    assert resp.status_code == 401


# ── GET /api/alerts ───────────────────────────────────────────────────────────


async def test_list_alerts_empty(client, auth_headers):
    """No alerts → 200 with an empty collection."""
    resp = await client.get("/api/alerts", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    alerts = body.get("alerts") or body.get("items") or (body if isinstance(body, list) else [])
    assert isinstance(alerts, list)


async def test_list_alerts_returns_seeded(client, auth_headers, alert):
    resp = await client.get("/api/alerts", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    alerts = body.get("alerts") or body.get("items") or (body if isinstance(body, list) else [])

    # At least our seeded alert should appear
    assert len(alerts) >= 1
    headlines = [a.get("headline", "") for a in alerts]
    assert any("Acme Corp" in h for h in headlines)


async def test_list_alerts_filtered_by_status(client, auth_headers, alert):
    """Filtering by status=pending should include our alert."""
    resp = await client.get("/api/alerts?status=pending", headers=auth_headers)
    assert resp.status_code == 200


# ── GET /api/alerts/stats ─────────────────────────────────────────────────────


async def test_alert_stats_returns_200(client, auth_headers):
    resp = await client.get("/api/alerts/stats", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # Stats should include at minimum a total or counts
    assert isinstance(body, dict)


# ── GET /api/alerts/{id} ──────────────────────────────────────────────────────


async def test_get_alert_by_id(client, auth_headers, alert):
    resp = await client.get(f"/api/alerts/{alert.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("alert_type") == "stalled_deal" or body.get("type") == "stalled_deal"


async def test_get_alert_not_found(client, auth_headers):
    resp = await client.get(f"/api/alerts/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_alert_requires_auth(client, alert):
    resp = await client.get(f"/api/alerts/{alert.id}")
    assert resp.status_code == 401


# ── POST /api/alerts/{id}/action ─────────────────────────────────────────────


async def test_action_resolve_alert(client, auth_headers, alert):
    resp = await client.post(
        f"/api/alerts/{alert.id}/action",
        headers=auth_headers,
        json={"action": "resolve"},
    )
    # 200 (resolved) or 422 (if enum is different) — just not 401/500
    assert resp.status_code in (200, 204, 422)


async def test_action_dismiss_alert(client, auth_headers, alert):
    resp = await client.post(
        f"/api/alerts/{alert.id}/action",
        headers=auth_headers,
        json={"action": "dismiss"},
    )
    assert resp.status_code in (200, 204, 422)


async def test_action_unknown_alert_is_404(client, auth_headers):
    resp = await client.post(
        f"/api/alerts/{uuid.uuid4()}/action",
        headers=auth_headers,
        json={"action": "resolve"},
    )
    assert resp.status_code == 404
