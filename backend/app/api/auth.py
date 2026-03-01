"""
Authentication API Routes
Registration, login, and JWT token management.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.session import get_db
from app.db.models import Customer
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_customer_id,
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

    access_token = create_access_token({"sub": str(customer.id)})
    refresh_token = create_refresh_token({"sub": str(customer.id)})

    logger.info("New customer registered: %s", email)

    return {
        "message": "Registration successful",
        "customer_id": str(customer.id),
        "email": customer.email,
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
    customer = await db.scalar(select(Customer).where(Customer.email == email))

    if not customer or not customer.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(password, customer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token({"sub": str(customer.id)})
    refresh_token = create_refresh_token({"sub": str(customer.id)})

    logger.info("Customer logged in: %s", email)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "customer_id": str(customer.id),
        "name": customer.name,
        "email": customer.email,
        "plan": customer.plan,
    }


# ─────────────────────────────────────────────
# POST /auth/refresh
# ─────────────────────────────────────────────

@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
):
    """
    Exchange a valid refresh token for a new access token.
    """
    customer_id = verify_refresh_token(refresh_token)
    access_token = create_access_token({"sub": customer_id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ─────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────

@router.get("/me")
async def get_me(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the currently authenticated customer's profile.
    """
    customer = await db.scalar(
        select(Customer).where(Customer.id == customer_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {
        "id": str(customer.id),
        "email": customer.email,
        "name": customer.name,
        "plan": customer.plan,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
    }
