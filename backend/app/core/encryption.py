"""
Credential Encryption
Fernet symmetric encryption for integration API keys and tokens stored in the DB.

In production: set CREDENTIAL_ENCRYPTION_KEY env var (Fernet key).
  Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

In development: auto-generates a key on first use (not persisted — credentials
  must be re-entered after a restart, which is acceptable in dev).
"""

import json
import logging
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level cached Fernet instance
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Get (or lazily create) the Fernet instance."""
    global _fernet
    if _fernet is not None:
        return _fernet

    key = settings.CREDENTIAL_ENCRYPTION_KEY
    if key:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    else:
        # Development fallback: generate a throwaway key.
        # Credentials won't survive a restart — acceptable in dev.
        new_key = Fernet.generate_key()
        logger.warning(
            "CREDENTIAL_ENCRYPTION_KEY not set — using a temporary in-memory key. "
            "Credentials will not survive a server restart. "
            "Set CREDENTIAL_ENCRYPTION_KEY in production."
        )
        _fernet = Fernet(new_key)

    return _fernet


def encrypt_credentials(credentials: dict[str, Any]) -> dict[str, str]:
    """
    Encrypt a credentials dict to a single-field dict suitable for DB storage.

    Returns {"encrypted": "<fernet_token_b64>"}.
    """
    plaintext = json.dumps(credentials).encode()
    token = _get_fernet().encrypt(plaintext)
    return {"encrypted": token.decode()}


def decrypt_credentials(stored: dict[str, Any]) -> dict[str, Any]:
    """
    Decrypt a stored credentials dict back to the original plaintext dict.

    Handles two cases:
    - New format: {"encrypted": "<fernet_token>"} → decrypt
    - Legacy/plain format (no "encrypted" key) → return as-is with a warning

    This backward-compat fallback allows old un-encrypted rows to still work.
    """
    if "encrypted" not in stored:
        # Plain credentials (e.g. seeded in dev, or pre-encryption records)
        logger.warning(
            "Decrypting credentials that are not encrypted — "
            "these should be re-saved after the encryption migration."
        )
        return stored

    try:
        token = stored["encrypted"].encode()
        plaintext = _get_fernet().decrypt(token)
        return json.loads(plaintext)
    except InvalidToken as exc:
        raise ValueError(
            "Failed to decrypt integration credentials — "
            "the encryption key may have changed. "
            "Re-connect the integration to re-encrypt with the current key."
        ) from exc
