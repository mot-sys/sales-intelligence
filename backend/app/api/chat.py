"""
AI Chat API
Natural-language interface for querying the user's live pipeline data.
"""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai import build_pipeline_context, chat_with_pipeline, SUGGESTED_QUESTIONS, build_suggested_questions
from app.core.config import settings
from app.db.session import get_db
from app.core.security import get_current_customer_id

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    history: Optional[List[ChatMessage]] = None  # prior turns for multi-turn conversation


class ChatResponse(BaseModel):
    answer: str
    ai_configured: bool
    pipeline_summary: Optional[Dict] = None  # always returned for UI display
    charts: Optional[List[Dict]] = None       # chart specs rendered by AI (render_chart tool)


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/suggested")
async def get_suggested_questions(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """Return pipeline-aware suggested questions for the chat UI."""
    questions = await build_suggested_questions(db, customer_id)
    return {
        "questions": questions,
        "ai_configured": bool(settings.ANTHROPIC_API_KEY),
    }


@router.get("/context")
async def get_pipeline_context(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the raw structured context that gets sent to the AI.
    Useful for debugging and for displaying live stats in the UI.
    """
    return await build_pipeline_context(db, customer_id)


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Ask a natural-language question about your pipeline.

    The AI has access to:
    - All open deals (Salesforce + HubSpot) with stage, amount, activity date
    - Pending alerts (stalled deals, intent spikes, score jumps) with recommendations
    - Top-scored leads with their signals
    - HubSpot tools: create tasks (if HubSpot is connected)

    Multi-turn: pass prior messages in `history` to maintain conversation context.

    Examples:
    - "Hvad skal jeg fokusere på denne uge?"
    - "Opret en task til Ida om at følge op på Scandifinanceaps"
    - "Which deals are most at risk of going cold?"
    - "Giv mig et overblik over min pipeline"
    """
    # Build context regardless of AI config (we always return the summary)
    context = await build_pipeline_context(db, customer_id)

    ai_configured = bool(settings.ANTHROPIC_API_KEY)

    if not ai_configured:
        return ChatResponse(
            answer=(
                "AI chat er ikke aktiveret. Tilføj `ANTHROPIC_API_KEY` til Railway Variables for at aktivere.\n\n"
                "Du kan stadig se din pipeline nedenfor."
            ),
            ai_configured=False,
            pipeline_summary=context["pipeline_summary"],
        )

    # ── Look up HubSpot integration for tool use ──────────────────────────
    hs_integration = None
    try:
        from sqlalchemy import select as sa_select
        from app.db.models import Integration
        from app.integrations.hubspot import HubSpotIntegration

        hs_row = await db.scalar(
            sa_select(Integration).where(
                Integration.customer_id == customer_id,
                Integration.service == "hubspot",
                Integration.status == "connected",
            )
        )
        if hs_row:
            hs_integration = HubSpotIntegration(credentials=hs_row.credentials)
    except Exception as exc:
        logger.warning("Could not load HubSpot integration for chat tools: %s", exc)

    history_dicts = (
        [{"role": m.role, "content": m.content} for m in body.history]
        if body.history else None
    )

    # ── Load customer AI settings (model override + skills) ───────────────
    ai_settings_dict = None
    try:
        from app.db import crud as db_crud
        ai_row = await db_crud.get_ai_settings(db, customer_id)
        if ai_row:
            ai_settings_dict = {
                "model": ai_row.model,
                "skills": ai_row.skills or [],
                "company_context": ai_row.company_context,
            }
    except Exception as exc:
        logger.warning("Could not load AI settings: %s", exc)

    try:
        result = await chat_with_pipeline(
            body.question, context, history_dicts,
            hs_integration=hs_integration,
            ai_settings=ai_settings_dict,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Chat LLM error: %s", e)
        raise HTTPException(
            status_code=502,
            detail=f"AI error: {type(e).__name__}: {e}",
        )

    # Log any AI actions (tool calls) to the database
    if result.get("tool_calls"):
        try:
            from app.db import crud as db_crud
            for tc in result["tool_calls"]:
                await db_crud.log_ai_action(
                    db,
                    customer_id=customer_id,
                    action_type=tc["name"],
                    inputs=tc.get("input"),
                    status="success",
                    integration="hubspot" if "hubspot" in tc["name"] else None,
                )
        except Exception as log_exc:
            logger.warning("Failed to log AI actions: %s", log_exc)

    return ChatResponse(
        answer=result["answer"],
        ai_configured=True,
        pipeline_summary=context["pipeline_summary"],
        charts=result.get("charts") or None,
    )
