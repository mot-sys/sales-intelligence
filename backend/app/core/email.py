"""
Email Service
Sends weekly reports and alert digests via Resend.

Usage:
    from app.core.email import send_weekly_report_email

    await send_weekly_report_email(
        to_email="user@company.com",
        customer_name="Acme Corp",
        report=report_orm_object,
    )

Required environment variables:
    RESEND_API_KEY     — API key from resend.com
    FROM_EMAIL         — Verified sender address (default: rapport@signal-intelligence.app)
    EMAIL_REPORT_ENABLED — Set to True to enable automatic sending (default: False)
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Markdown → HTML (lightweight, no extra dependency)
# ─────────────────────────────────────────────────────────────────────────────

def _md_to_html(text: str) -> str:
    """
    Convert a small subset of Markdown to HTML.
    Handles: ## headings, **bold**, `code`, bullet lists (- / *), checkboxes ([ ] / [x]).
    """
    if not text:
        return ""

    lines = text.split("\n")
    out = []
    in_list = False

    for line in lines:
        stripped = line.strip()

        # Close open list before processing non-list lines
        def _maybe_close_list():
            nonlocal in_list
            if in_list:
                out.append("</ul>")
                in_list = False

        # Checkboxes (must come before bullet detection)
        if re.match(r"^- \[[ xX]\]", stripped) or re.match(r"^\* \[[ xX]\]", stripped):
            if not in_list:
                out.append('<ul style="list-style:none;padding-left:0;">')
                in_list = True
            checked = "x" in stripped[3].lower() if len(stripped) > 3 else False
            label = re.sub(r"^[-*] \[[ xX]\]\s*", "", stripped)
            label = _inline_md(label)
            box = "✅" if checked else "☐"
            out.append(f'<li style="margin-bottom:4px;">{box} {label}</li>')
            continue

        # Bullet list items
        if re.match(r"^[-*] ", stripped):
            if not in_list:
                out.append('<ul style="margin-top:4px;margin-bottom:4px;padding-left:20px;">')
                in_list = True
            content = _inline_md(stripped[2:])
            out.append(f"<li>{content}</li>")
            continue

        _maybe_close_list()

        # ## heading
        if stripped.startswith("## "):
            out.append(f'<h3 style="color:#1e293b;font-size:15px;margin:18px 0 6px;">{_inline_md(stripped[3:])}</h3>')
            continue

        # # heading
        if stripped.startswith("# "):
            out.append(f'<h2 style="color:#1e293b;font-size:17px;margin:20px 0 8px;">{_inline_md(stripped[2:])}</h2>')
            continue

        # Empty line → paragraph break
        if not stripped:
            out.append("<br>")
            continue

        out.append(f'<p style="margin:4px 0;">{_inline_md(stripped)}</p>')

    if in_list:
        out.append("</ul>")

    return "\n".join(out)


def _inline_md(text: str) -> str:
    """Convert inline Markdown (bold, italic, code) to HTML."""
    # **bold**
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # *italic*
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    # `code`
    text = re.sub(r"`(.+?)`", r'<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;">\1</code>', text)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# HTML email template
# ─────────────────────────────────────────────────────────────────────────────

def _build_report_html(
    customer_name: str,
    week_start: str,
    section_what_happened: str,
    section_this_week: str,
    section_management: str,
) -> str:
    """Return a fully self-contained HTML email for the weekly report."""

    what_html   = _md_to_html(section_what_happened or "")
    week_html   = _md_to_html(section_this_week or "")
    mgmt_html   = _md_to_html(section_management or "")

    def _section(emoji: str, title: str, body: str) -> str:
        return f"""
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:16px;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#1e293b;">{emoji} {title}</h2>
          <div style="font-size:14px;color:#374151;line-height:1.6;">{body}</div>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ugentlig Salgsrapport</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#1e40af;color:#ffffff;
                  padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:.5px;">
        ⚡ SIGNAL INTELLIGENCE
      </div>
      <h1 style="margin:16px 0 4px;font-size:22px;color:#0f172a;font-weight:700;">
        Ugentlig Salgsrapport
      </h1>
      <p style="margin:0;font-size:13px;color:#64748b;">
        {customer_name} &nbsp;·&nbsp; Uge startende {week_start}
      </p>
    </div>

    <!-- Sections -->
    {_section("📊", "Hvad skete der denne uge", what_html)}
    {_section("🎯", "Hvad skal der ske denne uge", week_html)}
    {_section("🤝", "Hvad kan sales management gøre", mgmt_html)}

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;font-size:12px;color:#94a3b8;">
      <p>Genereret automatisk af <strong>Signal Intelligence</strong></p>
      <p>Du modtager denne rapport fordi du er registreret som bruger.</p>
    </div>

  </div>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def send_weekly_report_email(
    to_email: str,
    customer_name: str,
    week_start: str,
    section_what_happened: Optional[str],
    section_this_week: Optional[str],
    section_management: Optional[str],
) -> bool:
    """
    Send the weekly report to `to_email` via Resend.

    Returns True on success, False on failure (logs the error but does not raise).
    No-ops silently if RESEND_API_KEY is not set.
    """
    from app.core.config import settings

    if not settings.RESEND_API_KEY:
        logger.debug("send_weekly_report_email: RESEND_API_KEY not set — skipping")
        return False

    try:
        import resend  # type: ignore
        resend.api_key = settings.RESEND_API_KEY

        html = _build_report_html(
            customer_name=customer_name,
            week_start=week_start,
            section_what_happened=section_what_happened or "",
            section_this_week=section_this_week or "",
            section_management=section_management or "",
        )

        params: resend.Emails.SendParams = {
            "from": f"Signal Intelligence <{settings.FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"📊 Ugentlig Salgsrapport — uge startende {week_start}",
            "html": html,
        }
        response = resend.Emails.send(params)
        logger.info(
            "Weekly report email sent to %s (id=%s)",
            to_email,
            getattr(response, "id", "?"),
        )
        return True

    except Exception as exc:
        logger.error("Failed to send weekly report email to %s: %s", to_email, exc)
        return False
