"""
Unit tests for Fernet credential encryption (app/core/encryption.py).

These tests patch the module-level ``_fernet`` instance to control key material
without touching environment variables or settings.
"""

import pytest
from cryptography.fernet import Fernet

from app.core import encryption as enc_module
from app.core.encryption import decrypt_credentials, encrypt_credentials


# ── Helpers ───────────────────────────────────────────────────────────────────


def _fresh_fernet():
    """Return a new Fernet instance with a random key (not cached)."""
    return Fernet(Fernet.generate_key())


# ── Round-trip ────────────────────────────────────────────────────────────────


def test_encrypt_then_decrypt_returns_original(monkeypatch):
    """Encrypting then decrypting should return the exact original dict."""
    monkeypatch.setattr(enc_module, "_fernet", _fresh_fernet())

    original = {"api_key": "sk-secret-123", "webhook_secret": "wh_abc"}
    encrypted = encrypt_credentials(original)
    decrypted = decrypt_credentials(encrypted)

    assert decrypted == original


def test_encrypted_value_is_not_plaintext(monkeypatch):
    """The stored value must not contain the original API key in plaintext."""
    monkeypatch.setattr(enc_module, "_fernet", _fresh_fernet())

    creds = {"api_key": "very-secret-value"}
    encrypted = encrypt_credentials(creds)

    assert "very-secret-value" not in str(encrypted)


def test_encrypted_dict_has_single_encrypted_key(monkeypatch):
    """``encrypt_credentials`` returns ``{'encrypted': '<token>'}``."""
    monkeypatch.setattr(enc_module, "_fernet", _fresh_fernet())

    encrypted = encrypt_credentials({"api_key": "abc"})

    assert set(encrypted.keys()) == {"encrypted"}
    assert isinstance(encrypted["encrypted"], str)


# ── Non-determinism ───────────────────────────────────────────────────────────


def test_encrypt_produces_different_ciphertext_each_call(monkeypatch):
    """Fernet uses a random IV — same plaintext → different ciphertext each time."""
    f = _fresh_fernet()
    monkeypatch.setattr(enc_module, "_fernet", f)

    creds = {"api_key": "same-value"}
    enc1 = encrypt_credentials(creds)
    enc2 = encrypt_credentials(creds)

    assert enc1["encrypted"] != enc2["encrypted"]


# ── Legacy plain credentials ──────────────────────────────────────────────────


def test_decrypt_legacy_plain_credentials_returned_as_is():
    """
    Rows without the 'encrypted' key (pre-encryption) are returned unchanged
    with a warning — backward-compat path.
    """
    plain = {"api_key": "not-yet-encrypted", "token": "bearer-xyz"}
    result = decrypt_credentials(plain)
    assert result == plain


def test_decrypt_empty_dict_returns_empty():
    """An empty dict has no 'encrypted' key → returned as-is (empty dict)."""
    assert decrypt_credentials({}) == {}


# ── Wrong key ─────────────────────────────────────────────────────────────────


def test_decrypt_with_wrong_key_raises(monkeypatch):
    """
    If the encryption key changes between encrypt and decrypt calls,
    ``decrypt_credentials`` should raise ``ValueError``.
    """
    key_a = _fresh_fernet()
    key_b = _fresh_fernet()

    # Encrypt with key A
    monkeypatch.setattr(enc_module, "_fernet", key_a)
    encrypted = encrypt_credentials({"api_key": "secret"})

    # Try to decrypt with key B → should fail
    monkeypatch.setattr(enc_module, "_fernet", key_b)
    with pytest.raises(ValueError, match="decrypt"):
        decrypt_credentials(encrypted)


# ── Nested / complex values ───────────────────────────────────────────────────


def test_encrypt_nested_dict(monkeypatch):
    """Should handle nested dicts, lists, booleans, nulls."""
    monkeypatch.setattr(enc_module, "_fernet", _fresh_fernet())

    original = {
        "api_key": "key-123",
        "settings": {"enabled": True, "retries": 3},
        "tags": ["a", "b"],
        "note": None,
    }
    encrypted = encrypt_credentials(original)
    decrypted = decrypt_credentials(encrypted)

    assert decrypted == original
