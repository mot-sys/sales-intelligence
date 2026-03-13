"""
Embedding utilities for pgvector semantic search.
Uses OpenAI text-embedding-3-small (1536 dims).

All functions are non-blocking and gracefully handle missing API key or errors
so the rest of the application continues to work when embeddings are unavailable.
"""

import logging

logger = logging.getLogger(__name__)

_MODEL = "text-embedding-3-small"


async def embed_text(text: str) -> list[float]:
    """
    Return a 1536-dim embedding for *text* using OpenAI text-embedding-3-small.
    Returns an empty list on error (missing key, network issue, etc.).
    """
    from app.core.config import settings
    if not settings.OPENAI_API_KEY:
        return []
    if not text or not text.strip():
        return []
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        resp = await client.embeddings.create(
            model=_MODEL,
            input=text[:8000],  # stay well within token limit
        )
        return resp.data[0].embedding
    except Exception as exc:
        logger.warning("embed_text failed: %s", exc)
        return []


def compose_lead_text(lead) -> str:
    """Build a plain-text representation of a Lead for embedding."""
    parts = [
        lead.company_name or "",
        lead.industry or "",
        lead.location or "",
        lead.recommendation or "",
        lead.priority or "",
        f"{lead.employee_count} employees" if lead.employee_count else "",
        lead.contact_title or "",
    ]
    return " ".join(p for p in parts if p).strip()


def compose_opportunity_text(opp) -> str:
    """Build a plain-text representation of a SalesforceOpportunity for embedding."""
    parts = [
        opp.account_name or "",
        opp.stage or "",
        opp.owner_name or "",
        f"€{opp.amount:,}" if opp.amount else "",
    ]
    return " ".join(p for p in parts if p).strip()


def compose_account_text(account) -> str:
    """Build a plain-text representation of an Account for embedding."""
    techs = " ".join(account.technologies or [])
    parts = [
        account.name or "",
        account.domain or "",
        account.industry or "",
        account.location or "",
        techs,
        account.icp_tier or "",
    ]
    return " ".join(p for p in parts if p).strip()
