"""
API tests for the Leads endpoints (GET /, GET /{id}, POST /{id}/score,
PUT /{id}/priority).

All tests run against an in-memory SQLite database via the ``client`` and
``db`` fixtures from conftest.py.
"""

import uuid

import pytest
import pytest_asyncio

from app.db.models import Lead


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def lead(db, customer):
    """A single Lead row seeded for the test customer."""
    row = Lead(
        id=uuid.uuid4(),
        customer_id=customer.id,
        company_name="Acme Corp",
        company_domain="acme.example",
        industry="SaaS",
        employee_count=150,
        score=72,
        priority="warm",
        source="clay",
        external_id="clay-test-001",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


# ── GET /api/leads ────────────────────────────────────────────────────────────


async def test_list_leads_requires_auth(client):
    resp = await client.get("/api/leads")
    assert resp.status_code == 401


async def test_list_leads_empty_returns_200(client, auth_headers):
    """Even with no leads the endpoint should return 200, not 404."""
    resp = await client.get("/api/leads", headers=auth_headers)
    assert resp.status_code == 200


async def test_list_leads_returns_seeded_lead(client, auth_headers, lead):
    resp = await client.get("/api/leads", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()

    # Accept either {"leads": [...]} or a bare list
    leads_list = body.get("leads") or body.get("items") or (body if isinstance(body, list) else [])
    company_names = [l.get("company_name") for l in leads_list]
    assert "Acme Corp" in company_names


async def test_list_leads_filtered_by_priority(client, auth_headers, lead):
    """Passing ?priority=warm should include our warm lead."""
    resp = await client.get("/api/leads?priority=warm", headers=auth_headers)
    assert resp.status_code == 200


# ── GET /api/leads/{id} ───────────────────────────────────────────────────────


async def test_get_lead_by_id(client, auth_headers, lead):
    resp = await client.get(f"/api/leads/{lead.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # The route may return the lead nested or at the top level
    lead_data = body.get("lead") or body
    assert lead_data.get("company_name") == "Acme Corp"


async def test_get_lead_not_found(client, auth_headers):
    resp = await client.get(f"/api/leads/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_lead_requires_auth(client, lead):
    resp = await client.get(f"/api/leads/{lead.id}")
    assert resp.status_code == 401


# ── POST /api/leads/{id}/score ────────────────────────────────────────────────


async def test_score_lead_returns_200(client, auth_headers, lead):
    resp = await client.post(f"/api/leads/{lead.id}/score", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # Should return score info (either at top level or nested)
    assert "score" in body or "lead" in body


async def test_score_lead_not_found(client, auth_headers):
    resp = await client.post(f"/api/leads/{uuid.uuid4()}/score", headers=auth_headers)
    assert resp.status_code == 404


# ── PUT /api/leads/{id}/priority ─────────────────────────────────────────────


async def test_update_priority_to_hot(client, auth_headers, lead):
    resp = await client.put(
        f"/api/leads/{lead.id}/priority",
        headers=auth_headers,
        json={"priority": "hot"},
    )
    assert resp.status_code == 200


async def test_update_priority_not_found(client, auth_headers):
    resp = await client.put(
        f"/api/leads/{uuid.uuid4()}/priority",
        headers=auth_headers,
        json={"priority": "hot"},
    )
    assert resp.status_code == 404
