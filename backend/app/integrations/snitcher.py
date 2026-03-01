"""
Snitcher Integration
Processes incoming Snitcher webhook events for website visitor identification
and intent spike detection.
"""

import hashlib
import hmac
from typing import Dict, List, Optional

from app.core.config import settings


def validate_snitcher_signature(body: bytes, signature_header: str) -> bool:
    """
    Validate Snitcher HMAC-SHA256 webhook signature.
    Returns True if signature is valid (or if no secret is configured).
    """
    if not settings.SNITCHER_WEBHOOK_SECRET:
        return True  # Skip validation in dev if secret not set

    expected = hmac.new(
        settings.SNITCHER_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    # Signature header may be "sha256=<hex>" format
    incoming = signature_header.lstrip("sha256=")
    return hmac.compare_digest(expected, incoming)


def extract_visit_data(payload: Dict) -> Dict:
    """
    Parse a Snitcher visitor event payload into a normalized visit dict.

    Expected Snitcher webhook shape:
    {
      "company": { "name": "...", "domain": "...", "industry": "...", "employees": 50 },
      "session": { "pages": [{"url": "...", "title": "..."}], "duration": 120 },
      "timestamp": "2024-01-01T12:00:00Z"
    }
    """
    company = payload.get("company") or {}
    session = payload.get("session") or {}
    pages_raw = session.get("pages") or []

    pages = [p.get("url", "") for p in pages_raw if isinstance(p, dict)]
    page_titles = [p.get("title", "") for p in pages_raw if isinstance(p, dict)]

    pricing_visited = any(
        "pricing" in (p.get("url", "") + p.get("title", "")).lower()
        for p in pages_raw if isinstance(p, dict)
    )

    return {
        "company_name": company.get("name", "Unknown Company"),
        "company_domain": company.get("domain", ""),
        "industry": company.get("industry"),
        "employee_count": company.get("employees"),
        "pages": pages,
        "page_titles": page_titles,
        "pages_count": len(pages),
        "pricing_visited": pricing_visited,
        "session_duration": session.get("duration", 0),
        "timestamp": payload.get("timestamp"),
    }


def is_intent_spike(visit_data: Dict) -> bool:
    """
    Return True if a visit qualifies as an intent spike:
    - Visited pricing page, OR
    - Visited >= ALERT_INTENT_SPIKE_PAGES pages in one session
    """
    if visit_data.get("pricing_visited"):
        return True
    return visit_data.get("pages_count", 0) >= settings.ALERT_INTENT_SPIKE_PAGES
