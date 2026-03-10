"""
Slack Notification Service

Posts alert and weekly-report notifications to a Slack Incoming Webhook.
All public functions are no-ops (and return False) when SLACK_WEBHOOK_URL
is not configured — zero breaking changes.

Usage:
    Set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... in .env
    Optionally filter which alert priorities fire via SLACK_ALERT_MIN_PRIORITY.

Webhook docs: https://api.slack.com/messaging/webhooks
"""

import logging
from typing import Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Priority metadata ─────────────────────────────────────────────────────────

_PRIORITY_ORDER = {"urgent": 4, "high": 3, "medium": 2, "low": 1}

_PRIORITY_COLOR = {
    "urgent": "#E53E3E",   # red
    "high":   "#ED8936",   # orange
    "medium": "#ECC94B",   # yellow
    "low":    "#68D391",   # green
}

_PRIORITY_EMOJI = {
    "urgent": "🚨",
    "high":   "⚠️",
    "medium": "📌",
    "low":    "ℹ️",
}

_TYPE_EMOJI = {
    "stalled_deal": "🥶",
    "intent_spike": "🔥",
    "score_jump":   "⬆️",
    "daily_digest": "📋",
}


# ── Low-level HTTP helper ─────────────────────────────────────────────────────

async def _post(payload: dict) -> bool:
    """POST payload to SLACK_WEBHOOK_URL. Returns True on success, False on any error."""
    url = settings.SLACK_WEBHOOK_URL
    if not url:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                logger.warning("Slack webhook returned %s: %s", r.status_code, r.text[:200])
                return False
        return True
    except Exception as exc:
        logger.warning("Slack notification failed: %s", exc)
        return False


# ── Public notification helpers ───────────────────────────────────────────────

async def send_alert_notification(
    headline: str,
    priority: str,
    alert_type: str,
    context: Optional[Dict] = None,
    recommendation: Optional[str] = None,
) -> bool:
    """
    Post a rich Slack message when a new alert is created.

    Only fires for alerts at or above SLACK_ALERT_MIN_PRIORITY (default: high).
    Returns True on success, False if skipped or on error.
    """
    if not settings.SLACK_WEBHOOK_URL:
        return False

    # Respect minimum priority threshold (env-configurable, default "high")
    min_priority = getattr(settings, "SLACK_ALERT_MIN_PRIORITY", "high")
    if _PRIORITY_ORDER.get(priority, 0) < _PRIORITY_ORDER.get(min_priority, 3):
        return False

    color    = _PRIORITY_COLOR.get(priority, "#718096")
    p_emoji  = _PRIORITY_EMOJI.get(priority, "📌")
    t_emoji  = _TYPE_EMOJI.get(alert_type, "📊")
    ctx      = context or {}
    detail   = ctx.get("detail") or ctx.get("company_domain") or ""

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{p_emoji} {t_emoji}  *{headline}*",
            },
        },
    ]

    if detail:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": detail},
        })

    if recommendation:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"💡 *Anbefaling:* {recommendation}",
            },
        })

    blocks.append({"type": "divider"})

    payload = {
        "attachments": [
            {
                "color": color,
                "blocks": blocks,
                "fallback": f"[{priority.upper()}] {headline}",
            }
        ]
    }

    return await _post(payload)


async def send_weekly_report_notification(
    customer_name: str,
    week_start: str,
    section_what_happened: Optional[str] = None,
) -> bool:
    """
    Post a brief Slack digest when a weekly report is generated.
    Shows the first 3 bullet points from section_what_happened as a preview.
    """
    if not settings.SLACK_WEBHOOK_URL:
        return False

    # Build a short preview (first 3 non-empty lines)
    preview_lines: list[str] = []
    if section_what_happened:
        for line in section_what_happened.split("\n"):
            stripped = line.strip().lstrip("-• ").strip()
            if stripped and not stripped.startswith("#"):
                preview_lines.append(f"• {stripped}")
            if len(preview_lines) >= 3:
                break

    blocks: list[dict] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"📊 Ugentlig Salgsrapport — {week_start}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"Rapport klar for *{customer_name or 'din virksomhed'}*.",
            },
        },
    ]

    if preview_lines:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "\n".join(preview_lines),
            },
        })

    blocks.append({"type": "divider"})

    return await _post({"blocks": blocks})
