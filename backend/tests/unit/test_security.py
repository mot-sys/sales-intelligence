"""
Unit tests for JWT token creation/validation and bcrypt password utilities.
"""

import time
from datetime import timedelta

import pytest
from jose import JWTError

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


# ── Password hashing ─────────────────────────────────────────────────────────


def test_password_hash_is_not_plaintext():
    pw = "correct-horse-battery-staple"
    h = get_password_hash(pw)
    assert h != pw
    assert len(h) > 20


def test_password_verify_correct():
    pw = "SecurePassword!99"
    h = get_password_hash(pw)
    assert verify_password(pw, h)


def test_password_verify_wrong():
    h = get_password_hash("real-password")
    assert not verify_password("wrong-password", h)


def test_password_hash_is_unique():
    """bcrypt uses a random salt — same password hashes to different values."""
    pw = "same-password"
    assert get_password_hash(pw) != get_password_hash(pw)


# ── Access token ──────────────────────────────────────────────────────────────


def test_access_token_contains_sub():
    token = create_access_token({"sub": "cust-abc"})
    payload = decode_token(token)
    assert payload["sub"] == "cust-abc"


def test_access_token_type_is_access():
    token = create_access_token({"sub": "cust-abc"})
    payload = decode_token(token)
    assert payload["type"] == "access"


def test_access_token_with_cid():
    """New multi-user token format includes 'cid' (customer id) and 'role'."""
    token = create_access_token({"sub": "user-123", "cid": "cust-456", "role": "owner"})
    payload = decode_token(token)
    assert payload["cid"] == "cust-456"
    assert payload["role"] == "owner"


def test_access_token_expires(monkeypatch):
    """Token with a 1-second expiry should be invalid after 2 seconds."""
    token = create_access_token({"sub": "cust-abc"}, expires_delta=timedelta(seconds=1))
    time.sleep(2)
    with pytest.raises(JWTError):
        decode_token(token)


# ── Refresh token ─────────────────────────────────────────────────────────────


def test_refresh_token_type_is_refresh():
    token = create_refresh_token({"sub": "cust-abc"})
    payload = decode_token(token)
    assert payload["type"] == "refresh"


def test_refresh_token_contains_sub():
    token = create_refresh_token({"sub": "cust-xyz"})
    payload = decode_token(token)
    assert payload["sub"] == "cust-xyz"


def test_access_and_refresh_tokens_are_different():
    data = {"sub": "cust-123"}
    access = create_access_token(data)
    refresh = create_refresh_token(data)
    assert access != refresh


# ── Token validation ──────────────────────────────────────────────────────────


def test_decode_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_token("not.a.real.token")


def test_decode_tampered_token_raises():
    token = create_access_token({"sub": "cust-abc"})
    tampered = token[:-5] + "XXXXX"  # corrupt the signature
    with pytest.raises(JWTError):
        decode_token(tampered)


def test_decode_empty_string_raises():
    with pytest.raises(JWTError):
        decode_token("")
