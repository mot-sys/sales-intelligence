"""
AI Settings API
Lets users configure the AI model and inject custom skills / context.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings

from app.core.security import get_current_customer_id
from app.db import crud
from app.db.session import get_db

router = APIRouter()

# ── Available models users can switch between ──────────────────────────────
AVAILABLE_MODELS = [
    {
        "id": "claude-3-5-sonnet-20241022",
        "label": "Claude 3.5 Sonnet",
        "description": "Best balance of speed and intelligence. Recommended.",
        "tier": "recommended",
    },
    {
        "id": "claude-3-opus-20240229",
        "label": "Claude 3 Opus",
        "description": "Most capable model. Slower and costs more per query.",
        "tier": "powerful",
    },
    {
        "id": "claude-3-5-haiku-20241022",
        "label": "Claude 3.5 Haiku",
        "description": "Fastest responses. Good for quick pipeline questions.",
        "tier": "fast",
    },
]

DEFAULT_MODEL = "claude-3-5-sonnet-20241022"


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class AISettingsResponse(BaseModel):
    model: str
    skills: List[str]
    company_context: Optional[str]
    available_models: List[dict]


class AISettingsSaveRequest(BaseModel):
    model: str = Field(default=DEFAULT_MODEL)
    skills: List[str] = Field(default_factory=list)
    company_context: Optional[str] = Field(default=None, max_length=2000)


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/ai", response_model=AISettingsResponse)
async def get_ai_settings(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Return current AI configuration for this customer."""
    row = await crud.get_ai_settings(db, customer_id)
    return AISettingsResponse(
        model=row.model or DEFAULT_MODEL if row else DEFAULT_MODEL,
        skills=row.skills or [] if row else [],
        company_context=row.company_context if row else None,
        available_models=AVAILABLE_MODELS,
    )


@router.put("/ai", response_model=AISettingsResponse)
async def save_ai_settings(
    body: AISettingsSaveRequest,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Save AI configuration (model + skills + company context)."""
    # Validate model id
    valid_ids = {m["id"] for m in AVAILABLE_MODELS}
    model = body.model if body.model in valid_ids else DEFAULT_MODEL

    # Cap skills list to 20 items, each max 300 chars
    skills = [s.strip()[:300] for s in (body.skills or []) if s.strip()][:20]

    row = await crud.upsert_ai_settings(
        db,
        customer_id=customer_id,
        model=model,
        skills=skills,
        company_context=(body.company_context or "").strip() or None,
    )
    return AISettingsResponse(
        model=row.model or DEFAULT_MODEL,
        skills=row.skills or [],
        company_context=row.company_context,
        available_models=AVAILABLE_MODELS,
    )


# ─────────────────────────────────────────────
# P2.5  Notification status (read-only; secrets stay server-side)
# ─────────────────────────────────────────────

@router.get("/notifications")
async def get_notification_status(
    customer_id: str = Depends(get_current_customer_id),
):
    """
    Return which notification channels are active for this deployment.
    Secrets are never exposed — only boolean configured flags.
    """
    return {
        "slack": {
            "configured": bool(app_settings.SLACK_WEBHOOK_URL),
            "min_priority": app_settings.SLACK_ALERT_MIN_PRIORITY,
        },
        "email": {
            "configured": bool(app_settings.RESEND_API_KEY),
            "auto_send": app_settings.EMAIL_REPORT_ENABLED,
            "from_email": app_settings.FROM_EMAIL if app_settings.RESEND_API_KEY else None,
        },
    }
