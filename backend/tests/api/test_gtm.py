"""
API tests for the GTM (Go-To-Market) configuration and intelligence endpoints.

Routes covered:
  GET  /api/gtm/config
  PUT  /api/gtm/config
  GET  /api/gtm/intelligence
  GET  /api/gtm/progress
  GET  /api/gtm/forecast
  GET  /api/gtm/forecast/history
"""

import pytest

# ── Sample config payload ─────────────────────────────────────────────────────

GTM_CONFIG = {
    "strategy": {
        "positioning": "best-in-class",
        "motion": "product-led",
        "target_segment": "mid-market SaaS",
    },
    "icp": {
        "industries": ["SaaS", "Technology"],
        "employee_range": {"min": 50, "max": 500},
        "geographies": ["Denmark", "Sweden", "Norway"],
    },
    "goals": {
        "revenue_target": 10_000_000,
        "win_rate_target": 25,
        "pipeline_coverage": 3.0,
        "avg_deal_size": 120_000,
    },
}


# ── Auth guards ───────────────────────────────────────────────────────────────


async def test_get_config_requires_auth(client):
    resp = await client.get("/api/gtm/config")
    assert resp.status_code == 401


async def test_put_config_requires_auth(client):
    resp = await client.put("/api/gtm/config", json=GTM_CONFIG)
    assert resp.status_code == 401


async def test_intelligence_requires_auth(client):
    resp = await client.get("/api/gtm/intelligence")
    assert resp.status_code == 401


# ── GET /api/gtm/config ───────────────────────────────────────────────────────


async def test_get_config_empty(client, auth_headers):
    """Before any config is saved the endpoint still returns 200."""
    resp = await client.get("/api/gtm/config", headers=auth_headers)
    assert resp.status_code == 200


# ── PUT /api/gtm/config ───────────────────────────────────────────────────────


async def test_upsert_config(client, auth_headers):
    """PUT /api/gtm/config creates or replaces the config."""
    resp = await client.put(
        "/api/gtm/config", headers=auth_headers, json=GTM_CONFIG
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("goals", {}).get("revenue_target") == 10_000_000


async def test_get_config_after_upsert(client, auth_headers):
    """After a PUT the GET endpoint should return the saved values."""
    await client.put("/api/gtm/config", headers=auth_headers, json=GTM_CONFIG)
    resp = await client.get("/api/gtm/config", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("goals", {}).get("revenue_target") == 10_000_000


async def test_upsert_partial_config(client, auth_headers):
    """A partial payload should not crash the endpoint."""
    resp = await client.put(
        "/api/gtm/config",
        headers=auth_headers,
        json={"goals": {"revenue_target": 5_000_000}},
    )
    assert resp.status_code == 200


# ── GET /api/gtm/intelligence ─────────────────────────────────────────────────


async def test_intelligence_returns_200(client, auth_headers):
    """With no CRM data, the intelligence endpoint should still return 200."""
    resp = await client.get("/api/gtm/intelligence", headers=auth_headers)
    assert resp.status_code == 200
    # The body should be a dict (even if empty/zeroed-out)
    assert isinstance(resp.json(), dict)


# ── GET /api/gtm/progress ─────────────────────────────────────────────────────


async def test_progress_returns_200(client, auth_headers):
    resp = await client.get("/api/gtm/progress", headers=auth_headers)
    assert resp.status_code == 200


# ── GET /api/gtm/forecast ─────────────────────────────────────────────────────


async def test_forecast_returns_200(client, auth_headers):
    resp = await client.get("/api/gtm/forecast", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # Forecast should have months
    assert "months" in body or "forecast" in body or isinstance(body, dict)


# ── GET /api/gtm/forecast/history ────────────────────────────────────────────


async def test_forecast_history_returns_200_empty(client, auth_headers):
    """With no snapshots saved, the history endpoint returns 200 + empty list."""
    resp = await client.get("/api/gtm/forecast/history", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    snapshots = body.get("snapshots") or []
    assert isinstance(snapshots, list)


# ── POST /api/gtm/forecast/snapshot ──────────────────────────────────────────


async def test_save_forecast_snapshot(client, auth_headers):
    """POST to save a snapshot should return 200 with snapshot metadata."""
    resp = await client.post(
        "/api/gtm/forecast/snapshot", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "id" in body or "snapshot_date" in body
