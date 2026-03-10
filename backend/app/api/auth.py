"""
Authentication API Routes
Registration, login, JWT token management, and invite acceptance (P2.1).
"""

import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.session import get_db
from app.db.models import Customer, User
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_customer_id,
    get_current_user,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────────────────────────
# POST /auth/register
# ─────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    email: str,
    password: str,
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new customer account.

    Hashes the password with bcrypt and stores the customer record.
    Returns a JWT access token so the user is immediately logged in.
    """
    # Check for duplicate email
    existing = await db.scalar(select(Customer).where(Customer.email == email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )

    hashed = get_password_hash(password)
    customer = Customer(name=name, email=email, password_hash=hashed)
    db.add(customer)
    await db.flush()
    await db.refresh(customer)

    # P2.1 — also create the owner User record
    owner = User(
        customer_id=customer.id,
        email=email,
        name=name,
        password_hash=hashed,
        role="owner",
        is_active=True,
    )
    db.add(owner)
    await db.flush()
    await db.refresh(owner)

    # New token format: sub=user_id, cid=customer_id, role=role
    token_data = {"sub": str(owner.id), "cid": str(customer.id), "role": "owner"}
    access_token  = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    logger.info("New customer registered: %s (user %s)", email, owner.id)

    return {
        "message": "Registration successful",
        "customer_id": str(customer.id),
        "user_id": str(owner.id),
        "email": customer.email,
        "role": "owner",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


# ─────────────────────────────────────────────
# POST /auth/login
# ─────────────────────────────────────────────

@router.post("/login")
async def login(
    email: str,
    password: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Login with email + password.

    Returns:
    - access_token (15 min expiry)
    - refresh_token (7 day expiry)
    """
    # P2.1: Try User table first (new format), fall back to Customer (legacy)
    user = await db.scalar(
        select(User).where(User.email == email, User.is_active == True)  # noqa: E712
    )

    if user and user.password_hash and verify_password(password, user.password_hash):
        # New path: user record found
        customer = await db.scalar(select(Customer).where(Customer.id == user.customer_id))
        if not customer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        token_data    = {"sub": str(user.id), "cid": str(customer.id), "role": user.role}
        access_token  = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        logger.info("User logged in: %s (org %s)", email, customer.id)
        return {
            "access_token":  access_token,
            "refresh_token": refresh_token,
            "token_type":    "bearer",
            "customer_id":   str(customer.id),
            "user_id":       str(user.id),
            "name":          user.name or customer.name,
            "email":         user.email,
            "role":          user.role,
            "plan":          customer.plan,
        }

    # Legacy path: authenticate against Customer table (no User row yet)
    customer = await db.scalar(select(Customer).where(Customer.email == email))
    if not customer or not customer.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not verify_password(password, customer.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Backfill: create the missing owner User row so next login uses the new path
    try:
        owner_user = User(
            customer_id=customer.id,
            email=customer.email,
            name=customer.name,
            password_hash=customer.password_hash,
            role="owner",
            is_active=True,
        )
        db.add(owner_user)
        await db.flush()
        await db.refresh(owner_user)
        token_data = {"sub": str(owner_user.id), "cid": str(customer.id), "role": "owner"}
    except Exception:
        # Already exists (race / unique constraint) — fall back to legacy token
        await db.rollback()
        token_data = {"sub": str(customer.id)}

    access_token  = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    logger.info("Customer logged in (legacy): %s", email)
    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "customer_id":   str(customer.id),
        "name":          customer.name,
        "email":         customer.email,
        "plan":          customer.plan,
    }


# ─────────────────────────────────────────────
# POST /auth/refresh
# ─────────────────────────────────────────────

@router.post("/refresh")
async def refresh_token_endpoint(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access token.
    Preserves the cid + role claims from the original token.
    """
    from app.core.security import decode_token, verify_refresh_token
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    sub = payload.get("sub")
    cid = payload.get("cid")
    role = payload.get("role", "member")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")
    token_data = {"sub": sub}
    if cid:
        token_data["cid"] = cid
        token_data["role"] = role
    access_token = create_access_token(token_data)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ─────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────

@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the currently authenticated user's profile.
    """
    customer_id = current_user["customer_id"]
    user_id     = current_user.get("user_id")

    customer = await db.scalar(select(Customer).where(Customer.id == customer_id))
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Try to return User-level info if a user_id is in the token
    if user_id and user_id != customer_id:
        user = await db.scalar(select(User).where(User.id == user_id))
        if user:
            return {
                "id":          str(user.id),
                "customer_id": str(customer.id),
                "email":       user.email,
                "name":        user.name or customer.name,
                "role":        user.role,
                "plan":        customer.plan,
                "created_at":  user.created_at.isoformat() if user.created_at else None,
            }

    # Legacy / owner fallback
    return {
        "id":          str(customer.id),
        "customer_id": str(customer.id),
        "email":       customer.email,
        "name":        customer.name,
        "role":        "owner",
        "plan":        customer.plan,
        "created_at":  customer.created_at.isoformat() if customer.created_at else None,
    }


# ─────────────────────────────────────────────
# P2.1  POST /auth/accept-invite
# ─────────────────────────────────────────────

@router.post("/accept-invite")
async def accept_invite(
    token: str,
    name: str,
    password: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete an invitation by setting a name + password.

    - Looks up the User by invite_token
    - Validates the invite has not expired (24-hour window)
    - Hashes the password, activates the user
    - Returns access + refresh tokens so the user is immediately logged in
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )

    user = await db.scalar(select(User).where(User.invite_token == token))
    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    if user.invite_expires and user.invite_expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Invite link has expired")

    user.name          = name
    user.password_hash = get_password_hash(password)
    user.is_active     = True
    user.invite_token  = None
    user.invite_expires = None
    await db.commit()

    customer = await db.scalar(select(Customer).where(Customer.id == user.customer_id))
    token_data    = {"sub": str(user.id), "cid": str(user.customer_id), "role": user.role}
    access_token  = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    logger.info("User %s accepted invite for org %s", user.email, user.customer_id)

    return {
        "message":       "Invite accepted — you are now logged in",
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "customer_id":   str(user.customer_id),
        "user_id":       str(user.id),
        "email":         user.email,
        "role":          user.role,
        "plan":          customer.plan if customer else "starter",
    }
