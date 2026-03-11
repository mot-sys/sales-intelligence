"""
API tests for POST /api/auth/register, /login, /refresh, GET /me.

Note: the register and login endpoints accept *query parameters* (not JSON body)
because they declare `email: str, password: str` without Body() annotations.
"""

import pytest


# ── POST /api/auth/register ───────────────────────────────────────────────────


async def test_register_new_account(client):
    """A fresh email/password combo should register successfully (HTTP 201)."""
    resp = await client.post(
        "/api/auth/register",
        params={
            "email": "newuser@example.com",
            "password": "SecurePass!42",
            "name": "New User",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["email"] == "newuser@example.com"
    assert body["role"] == "owner"


async def test_register_duplicate_email(client):
    """Registering the same email twice should return 409 Conflict."""
    params = {
        "email": "dup@example.com",
        "password": "Pass!1234",
        "name": "Dup User",
    }
    resp1 = await client.post("/api/auth/register", params=params)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/auth/register", params=params)
    assert resp2.status_code == 409


async def test_register_short_password_rejected(client):
    """Passwords shorter than 8 characters should be rejected (422)."""
    resp = await client.post(
        "/api/auth/register",
        params={"email": "short@example.com", "password": "abc", "name": "Short"},
    )
    assert resp.status_code == 422


# ── POST /api/auth/login ──────────────────────────────────────────────────────


async def test_login_valid_credentials(client, customer, customer_user):
    """Correct email + password should return tokens."""
    resp = await client.post(
        "/api/auth/login",
        params={"email": "org@test.example", "password": "TestPass!1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["email"] == "org@test.example"


async def test_login_wrong_password(client, customer, customer_user):
    """Incorrect password should return 401."""
    resp = await client.post(
        "/api/auth/login",
        params={"email": "org@test.example", "password": "WrongPass!99"},
    )
    assert resp.status_code == 401


async def test_login_unknown_email(client):
    """An email that doesn't exist should return 401 (not 404 — avoid enumeration)."""
    resp = await client.post(
        "/api/auth/login",
        params={"email": "nobody@example.com", "password": "anything"},
    )
    assert resp.status_code == 401


# ── GET /api/auth/me ──────────────────────────────────────────────────────────


async def test_me_returns_authenticated_customer(client, customer, auth_headers):
    """Authenticated request should return the customer's details."""
    resp = await client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "org@test.example"


async def test_me_without_token_is_401(client):
    """Unauthenticated request should return 401."""
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_with_invalid_token_is_401(client):
    """A malformed token should return 401."""
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not.a.valid.token"},
    )
    assert resp.status_code == 401


# ── POST /api/auth/refresh ────────────────────────────────────────────────────


async def test_refresh_returns_new_access_token(client, customer, customer_user):
    """A valid refresh token should produce a new access token."""
    login = await client.post(
        "/api/auth/login",
        params={"email": "org@test.example", "password": "TestPass!1"},
    )
    refresh_token = login.json()["refresh_token"]

    resp = await client.post(
        "/api/auth/refresh",
        params={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_refresh_with_access_token_fails(client, auth_headers):
    """Using an access token where a refresh token is expected should fail."""
    access_token = auth_headers["Authorization"].split(" ")[1]
    resp = await client.post(
        "/api/auth/refresh",
        params={"refresh_token": access_token},
    )
    assert resp.status_code == 401
