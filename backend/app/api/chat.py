"""
AI Chat API
Natural-language interface for querying the user's live pipeline data.
"""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai import build_pipeline_context, chat_with_pipeline, SUGGESTED_QUESTIONS
from app.core.config import settings
from app.db.session import get_db
from app.core.security import get_current_customer_id_dev as get_current_customer_id

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


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/suggested")
async def get_suggested_questions():
    """Return suggested questions for the chat UI."""
    return {
        "questions": SUGGESTED_QUESTIONS,
        "ai_configured": bool(settings.OPENAI_API_KEY),
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

    Multi-turn: pass prior messages in `history` to maintain conversation context.

    Examples:
    - "Hvad skal jeg fokusere på denne uge?"
    - "Which deals are most at risk of going cold?"
    - "Giv mig et overblik over min pipeline"
    - "Which leads should I call today?"
    """
    # Build context regardless of AI config (we always return the summary)
    context = await build_pipeline_context(db, customer_id)

    ai_configured = bool(settings.OPENAI_API_KEY)

    if not ai_configured:
        return ChatResponse(
            answer=(
                "AI chat er ikke aktiveret. Tilføj `OPENAI_API_KEY` til din `.env` fil for at aktivere.\n\n"
                "Du kan stadig se din pipeline nedenfor."
            ),
            ai_configured=False,
            pipeline_summary=context["pipeline_summary"],
        )

    history_dicts = (
        [{"role": m.role, "content": m.content} for m in body.history]
        if body.history else None
    )

    try:
        answer = await chat_with_pipeline(body.question, context, history_dicts)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Chat LLM error: %s", e)
        raise HTTPException(
            status_code=502,
            detail="AI service returned an error — please try again",
        )

    return ChatResponse(
        answer=answer,
        ai_configured=True,
        pipeline_summary=context["pipeline_summary"],
    )
