"""
Security & Authentication
JWT token creation/validation and password hashing.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT bearer scheme (reads Authorization: Bearer <token>)
bearer_scheme = HTTPBearer(auto_error=False)


# ─────────────────────────────────────────────
# PASSWORD UTILITIES
# ─────────────────────────────────────────────

def get_password_hash(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ─────────────────────────────────────────────
# TOKEN CREATION
# ─────────────────────────────────────────────

def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a short-lived JWT access token.

    Args:
        data: Payload to encode (must include 'sub' with customer id).
        expires_delta: Custom expiry; defaults to ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: Dict) -> str:
    """
    Create a long-lived JWT refresh token.

    Args:
        data: Payload to encode (must include 'sub' with customer id).
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ─────────────────────────────────────────────
# TOKEN VERIFICATION
# ─────────────────────────────────────────────

def decode_token(token: str) -> Dict:
    """
    Decode and validate a JWT token.

    Returns:
        Token payload dict.

    Raises:
        HTTPException 401 if token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise credentials_exception


def verify_access_token(token: str) -> str:
    """
    Verify an access token and return the customer_id (sub claim).

    Raises:
        HTTPException 401 if token is invalid, expired, or wrong type.
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    customer_id: Optional[str] = payload.get("sub")
    if customer_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )
    return customer_id


def verify_refresh_token(token: str) -> str:
    """
    Verify a refresh token and return the customer_id.

    Raises:
        HTTPException 401 if token is invalid, expired, or wrong type.
    """
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    customer_id: Optional[str] = payload.get("sub")
    if customer_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )
    return customer_id


# ─────────────────────────────────────────────
# FASTAPI DEPENDENCIES
# ─────────────────────────────────────────────

async def get_current_customer_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    """
    FastAPI dependency that extracts and validates the JWT from
    the Authorization header, returning the customer_id.

    Usage:
        @router.get("/leads")
        async def get_leads(customer_id: str = Depends(get_current_customer_id)):
            ...
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_access_token(credentials.credentials)


# Development-only bypass: returns a fixed customer_id so endpoints work
# without a real JWT. Switch to get_current_customer_id in production.
TEMP_CUSTOMER_ID = "00000000-0000-0000-0000-000000000001"


async def get_current_customer_id_dev(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    """
    Development-only bypass. Raises 403 in production.
    Should NOT be used in any route file — use get_current_customer_id instead.
    """
    from app.core.config import is_production
    if is_production():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev auth bypass is disabled in production",
        )
    if credentials is None:
        return TEMP_CUSTOMER_ID
    try:
        return verify_access_token(credentials.credentials)
    except HTTPException:
        return TEMP_CUSTOMER_ID
