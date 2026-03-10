"""
Team Management API  (P2.1 — Multi-user per organisation)

Endpoints:
  GET    /api/team                   — list users in the org
  POST   /api/team/invite            — invite a new user by email
  PATCH  /api/team/{user_id}/role    — change a user's role
  DELETE /api/team/{user_id}         — remove a user from the org

Role hierarchy:
  owner  > admin  > member  > viewer

  Only owner/admin can invite.
  Only owner can change another admin's role or remove them.
  The owner cannot be removed or demoted.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.models import Customer, User
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

ROLE_ORDER = {"owner": 4, "admin": 3, "member": 2, "viewer": 1}
INVITE_TTL_HOURS = 48


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _serialize_user(u: User) -> dict:
    return {
        "id":         str(u.id),
        "email":      u.email,
        "name":       u.name,
        "role":       u.role,
        "is_active":  u.is_active,
        "is_pending": u.invite_token is not None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _require_role(actor_role: str, required: str):
    """Raise 403 if actor's role is below the required level."""
    if ROLE_ORDER.get(actor_role, 0) < ROLE_ORDER.get(required, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action requires the '{required}' role or above.",
        )


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    role:  str = Field(default="member", pattern="^(admin|member|viewer)$")
    name:  Optional[str] = None


class RoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|member|viewer)$")


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("")
@router.get("/")
async def list_team(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the organisation."""
    customer_id = current_user["customer_id"]
    result = await db.execute(
        select(User)
        .where(User.customer_id == customer_id)
        .order_by(User.created_at)
    )
    users = result.scalars().all()
    return {
        "users": [_serialize_user(u) for u in users],
        "total": len(users),
    }


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    body: InviteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a new user to the organisation.

    Creates a User row with is_active=False and a time-limited invite_token.
    The invite link is: <FRONTEND_URL>/accept-invite?token=<invite_token>

    The caller must have the 'admin' role or above.
    """
    _require_role(current_user["role"], "admin")

    customer_id = current_user["customer_id"]

    # Duplicate check (active or pending user with same email in this org)
    existing = await db.scalar(
        select(User).where(User.customer_id == customer_id, User.email == body.email)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists in your organisation.",
        )

    invite_token   = secrets.token_urlsafe(32)
    invite_expires = datetime.utcnow() + timedelta(hours=INVITE_TTL_HOURS)

    user = User(
        customer_id    = customer_id,
        email          = body.email,
        name           = body.name,
        role           = body.role,
        is_active      = False,
        invite_token   = invite_token,
        invite_expires = invite_expires,
    )
    db.add(user)
    await db.commit()

    logger.info(
        "User %s invited %s (role=%s) to org %s",
        current_user.get("user_id"), body.email, body.role, customer_id,
    )

    from app.core.config import settings
    frontend_url = (settings.FRONTEND_URL or "").rstrip("/")
    invite_url   = f"{frontend_url}/accept-invite?token={invite_token}" if frontend_url else None

    return {
        "message":     f"Invitation created for {body.email}",
        "user_id":     str(user.id),
        "email":       body.email,
        "role":        body.role,
        "invite_token": invite_token,      # caller can use this to send a custom email
        "invite_url":   invite_url,
        "expires_at":  invite_expires.isoformat(),
    }


@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    body: RoleUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change a user's role.

    - Only admin/owner can change roles.
    - You cannot change the owner's role.
    - Admin can only manage members/viewers; owner can manage everyone.
    """
    _require_role(current_user["role"], "admin")

    customer_id = current_user["customer_id"]
    target = await db.scalar(
        select(User).where(User.id == user_id, User.customer_id == customer_id)
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The owner's role cannot be changed.",
        )

    # Admins cannot promote/demote other admins — only owners can
    if target.role == "admin" and current_user["role"] != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can change an admin's role.",
        )

    target.role = body.role
    await db.commit()

    logger.info(
        "User %s changed role of %s → %s in org %s",
        current_user.get("user_id"), str(user_id), body.role, customer_id,
    )

    return {"id": str(target.id), "email": target.email, "role": target.role}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a user from the organisation.

    - Only admin/owner can remove users.
    - The owner cannot be removed.
    - A user cannot remove themselves.
    - Admins cannot remove other admins.
    """
    _require_role(current_user["role"], "admin")

    customer_id = current_user["customer_id"]
    target = await db.scalar(
        select(User).where(User.id == user_id, User.customer_id == customer_id)
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The owner cannot be removed from the organisation.",
        )

    if str(user_id) == current_user.get("user_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself.",
        )

    if target.role == "admin" and current_user["role"] != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can remove an admin.",
        )

    await db.delete(target)
    await db.commit()

    logger.info(
        "User %s removed user %s from org %s",
        current_user.get("user_id"), str(user_id), customer_id,
    )
