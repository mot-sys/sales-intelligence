"""
Unit tests for the email and Slack notification helpers.

Key properties tested:
- Both helpers are no-ops (return False) when the respective API key /
  webhook URL is not configured.
- The Slack helper respects the SLACK_ALERT_MIN_PRIORITY threshold.
- The email helper's Markdown-to-HTML converter handles common patterns.
"""

import pytest

from app.core.email import _md_to_html
from app.core.config import settings


# ── Email: no-op without RESEND_API_KEY ───────────────────────────────────────


async def test_send_weekly_report_email_noop_without_api_key(monkeypatch):
    """
    send_weekly_report_email silently returns False when RESEND_API_KEY is absent.
    No HTTP request is made.
    """
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)

    from app.core.email import send_weekly_report_email

    result = await send_weekly_report_email(
        to_email="user@example.com",
        customer_name="Acme Corp",
        week_start="2026-03-10",
        section_what_happened="## Uge\n- Vandt 1 deal",
        section_this_week="- Følg op på 3 leads",
        section_management="- Rep coaching needed",
    )
    assert result is False


# ── Slack: no-op without SLACK_WEBHOOK_URL ───────────────────────────────────


async def test_send_alert_notification_noop_without_webhook(monkeypatch):
    """send_alert_notification returns False when SLACK_WEBHOOK_URL is not set."""
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", None)

    from app.core.slack import send_alert_notification

    result = await send_alert_notification(
        headline="Stalled deal: Acme Corp",
        priority="high",
        alert_type="stalled_deal",
    )
    assert result is False


async def test_send_weekly_report_notification_noop_without_webhook(monkeypatch):
    """send_weekly_report_notification returns False when SLACK_WEBHOOK_URL is not set."""
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", None)

    from app.core.slack import send_weekly_report_notification

    result = await send_weekly_report_notification(
        customer_name="Acme Corp",
        week_start="2026-03-10",
    )
    assert result is False


# ── Slack: priority threshold ─────────────────────────────────────────────────


async def test_alert_notification_skipped_below_min_priority(monkeypatch):
    """
    When SLACK_ALERT_MIN_PRIORITY is 'high', a 'medium'-priority alert
    should be silently skipped (return False) even if a webhook URL is set.
    """
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/fake")
    monkeypatch.setattr(settings, "SLACK_ALERT_MIN_PRIORITY", "high")

    from app.core.slack import send_alert_notification

    # medium < high → should NOT post
    result = await send_alert_notification(
        headline="Minor issue",
        priority="medium",
        alert_type="stalled_deal",
    )
    assert result is False


async def test_alert_notification_skipped_low_priority(monkeypatch):
    """A 'low' priority alert is also below 'high' threshold."""
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/fake")
    monkeypatch.setattr(settings, "SLACK_ALERT_MIN_PRIORITY", "high")

    from app.core.slack import send_alert_notification

    result = await send_alert_notification(
        headline="Low priority nudge",
        priority="low",
        alert_type="intent_spike",
    )
    assert result is False


# ── Markdown-to-HTML converter ────────────────────────────────────────────────


def test_md_to_html_h2_heading():
    html = _md_to_html("# Top Heading")
    assert "<h2" in html
    assert "Top Heading" in html


def test_md_to_html_h3_heading():
    html = _md_to_html("## Section Heading")
    assert "<h3" in html
    assert "Section Heading" in html


def test_md_to_html_bullet_list():
    html = _md_to_html("- First item\n- Second item\n- Third item")
    assert "<ul" in html
    assert "<li>First item</li>" in html
    assert "<li>Second item</li>" in html


def test_md_to_html_bold():
    html = _md_to_html("This is **bold text** in a sentence.")
    assert "<strong>bold text</strong>" in html


def test_md_to_html_italic():
    html = _md_to_html("This is *italic* here.")
    assert "<em>italic</em>" in html


def test_md_to_html_inline_code():
    html = _md_to_html("Run `alembic upgrade head` to migrate.")
    assert "<code" in html
    assert "alembic upgrade head" in html


def test_md_to_html_empty_string():
    assert _md_to_html("") == ""


def test_md_to_html_checkbox_unchecked():
    html = _md_to_html("- [ ] Pending task")
    assert "☐" in html
    assert "Pending task" in html


def test_md_to_html_checkbox_checked():
    html = _md_to_html("- [x] Done task")
    assert "✅" in html
    assert "Done task" in html


def test_md_to_html_blank_lines_become_br():
    html = _md_to_html("Line one\n\nLine two")
    assert "<br>" in html
