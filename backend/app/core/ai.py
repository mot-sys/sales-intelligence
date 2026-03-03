"""
AI Service
Builds structured pipeline context from live DB data and handles LLM chat queries.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# CONTEXT BUILDER
# ─────────────────────────────────────────────

async def build_pipeline_context(db: AsyncSession, customer_id: str) -> Dict:
    """
    Fetch and structure all relevant pipeline data for a customer into a single
    context dict.  This dict is passed verbatim to the LLM as grounding data.

    Sources:
      - SalesforceOpportunity  (includes HubSpot deals with hs_ prefix)
      - Alert                  (pending alerts only)
      - Lead                   (top-scored leads + their signals)
    """
    from app.db.models import Alert, Lead, SalesforceOpportunity, Signal

    # ── Open deals ──────────────────────────────────────────────────────────
    opps_result = await db.execute(
        select(SalesforceOpportunity)
        .where(SalesforceOpportunity.customer_id == customer_id)
        .order_by(SalesforceOpportunity.last_activity_date.asc().nullsfirst())
        .limit(50)
    )
    opps = opps_result.scalars().all()

    open_deals: List[Dict] = []
    total_value = 0
    stages: Dict[str, int] = {}
    stalled_count = 0

    for opp in opps:
        amount = opp.amount or 0
        total_value += amount
        stage = opp.stage or "Unknown"
        stages[stage] = stages.get(stage, 0) + 1

        days_inactive: Optional[int] = None
        if opp.last_activity_date:
            days_inactive = (datetime.utcnow() - opp.last_activity_date).days

        is_stalled = opp.is_stalled or (
            days_inactive is not None and days_inactive >= settings.ALERT_STALE_DEAL_DAYS
        )
        if is_stalled:
            stalled_count += 1

        open_deals.append({
            "name": opp.account_name,
            "amount": amount,
            "amount_display": f"€{amount:,}" if amount else "unknown",
            "stage": stage,
            "close_date": opp.close_date.strftime("%Y-%m-%d") if opp.close_date else None,
            "owner": opp.owner_name,
            "days_since_last_activity": days_inactive,
            "is_stalled": is_stalled,
            "crm": "hubspot" if (opp.sf_opportunity_id or "").startswith("hs_") else "salesforce",
        })

    # ── Pending alerts ───────────────────────────────────────────────────────
    alerts_result = await db.execute(
        select(Alert)
        .where(and_(Alert.customer_id == customer_id, Alert.status == "pending"))
        .order_by(Alert.created_at.desc())
        .limit(30)
    )
    pending_alerts = alerts_result.scalars().all()

    alerts_list = [
        {
            "type": a.type,
            "priority": a.priority,
            "headline": a.headline,
            "source": a.source,
            "recommendation": a.recommendation,
            "context": a.context_json,
            "age_hours": round(
                (datetime.utcnow() - a.created_at).total_seconds() / 3600, 1
            ) if a.created_at else None,
        }
        for a in pending_alerts
    ]

    # ── Top leads + their recent signals ────────────────────────────────────
    leads_result = await db.execute(
        select(Lead)
        .where(Lead.customer_id == customer_id)
        .order_by(Lead.score.desc().nullslast())
        .limit(25)
    )
    leads = leads_result.scalars().all()

    leads_list = []
    for lead in leads:
        # Fetch signals for this lead
        sigs_result = await db.execute(
            select(Signal)
            .where(Signal.lead_id == lead.id)
            .order_by(Signal.detected_at.desc())
            .limit(5)
        )
        sigs = sigs_result.scalars().all()

        leads_list.append({
            "company": lead.company_name,
            "domain": lead.company_domain,
            "score": lead.score,
            "priority": lead.priority,
            "industry": lead.industry,
            "employee_count": lead.employee_count,
            "contact": f"{lead.contact_name or ''} — {lead.contact_title or ''}".strip(" —"),
            "owner": lead.owner_name,
            "source": lead.source,
            "signals": [
                {
                    "type": s.type,
                    "title": s.title,
                    "detected_days_ago": (
                        (datetime.utcnow() - s.detected_at).days
                        if s.detected_at else None
                    ),
                }
                for s in sigs
            ],
        })

    return {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "pipeline_summary": {
            "total_open_deals": len(open_deals),
            "total_pipeline_value": total_value,
            "total_pipeline_display": f"€{total_value:,}",
            "deals_by_stage": stages,
            "stalled_deals": stalled_count,
            "pending_alerts": len(alerts_list),
            "urgent_or_high_alerts": sum(
                1 for a in alerts_list if a["priority"] in ("urgent", "high")
            ),
            "top_lead_score": leads_list[0]["score"] if leads_list else None,
        },
        "open_deals": open_deals,
        "pending_alerts": alerts_list,
        "top_leads": leads_list,
    }


# ─────────────────────────────────────────────
# LLM CHAT
# ─────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert B2B sales intelligence assistant embedded in a revenue signal platform.
You have real-time access to the user's CRM pipeline, scored leads, and active alerts.
You also have tools to take real actions in HubSpot on behalf of the user.

Today: {today}

=== LIVE PIPELINE DATA ===
{context_json}
=========================

Rules:
- Be concise, direct, and actionable. Skip filler sentences.
- Always reference real deal names, companies, and numbers from the data above.
- Prioritise urgent/high-priority items unless asked otherwise.
- Use bullet points when listing 3 or more items.
- Answer in the same language the user writes in (English or Danish).
- Never make up data that isn't in the context above.
- When creating tasks: use the create_hubspot_task tool to actually create them — never just describe what you would do.
- After using a tool, confirm the result to the user clearly (e.g. "✅ Task created: ...").
- If a tool returns an error, explain it clearly in the user's language.

Chart guidelines (IMPORTANT):
- ALWAYS use render_chart when showing multiple numbers, distributions, comparisons, or rankings.
- For pipeline overviews: render a bar chart of deals by stage AND a horizontal_bar of value by stage.
- For lead analysis: render a bar or horizontal_bar of top lead scores.
- For deal lists: render a horizontal_bar with deal name vs. amount.
- Call render_chart BEFORE writing the text summary — charts appear above your text.
- You may call render_chart multiple times per response (e.g. one for count, one for value).
"""

# ─────────────────────────────────────────────
# HUBSPOT TOOL DEFINITIONS
# ─────────────────────────────────────────────

HUBSPOT_TOOLS = [
    {
        "name": "create_hubspot_task",
        "description": (
            "Create a real task in HubSpot assigned to a specific person. "
            "Use this whenever the user asks you to create a task, to-do, follow-up, or reminder. "
            "The task will actually appear in HubSpot for the assignee."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {
                    "type": "string",
                    "description": "Task title, e.g. 'Follow up on Scandifinanceaps deal'",
                },
                "body": {
                    "type": "string",
                    "description": "Detailed task description — what needs to be done and why.",
                },
                "owner_email": {
                    "type": "string",
                    "description": (
                        "Email of the HubSpot user to assign the task to. "
                        "Use the exact email shown in the pipeline data (e.g. 'ida.henriksen22@gmail.com')."
                    ),
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format. Use today's date if not specified.",
                },
            },
            "required": ["subject", "body", "owner_email"],
        },
    },
]

# ─────────────────────────────────────────────
# CHART / VISUALIZATION TOOL
# Always available — no integration needed
# ─────────────────────────────────────────────

CHART_TOOL = {
    "name": "render_chart",
    "description": (
        "Render a visual chart or graph in the chat interface. "
        "Use this to visualize pipeline data, deal distributions, value by stage, "
        "lead scores, or any comparison that would be clearer as a chart. "
        "ALWAYS use this when the user asks for analysis, overview, or comparison of multiple values. "
        "You can call this multiple times in one response to show several charts."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "chart_type": {
                "type": "string",
                "enum": ["bar", "horizontal_bar", "pie"],
                "description": (
                    "Chart type. "
                    "'bar' = vertical bars (good for stage counts, scores). "
                    "'horizontal_bar' = horizontal bars (good for deal names with long labels). "
                    "'pie' = pie/donut (good for distribution percentages)."
                ),
            },
            "title": {
                "type": "string",
                "description": "Short chart title shown above the chart, e.g. 'Pipeline Value by Stage'.",
            },
            "data": {
                "type": "array",
                "items": {"type": "object"},
                "description": (
                    "Array of data points. Each item must have: "
                    "'name' (string label) and 'value' (number). "
                    "Example: [{\"name\": \"Closed Won\", \"value\": 540000}, ...]"
                ),
            },
            "value_prefix": {
                "type": "string",
                "description": "Prefix before values in tooltips, e.g. '€' for euro amounts. Optional.",
            },
            "value_suffix": {
                "type": "string",
                "description": "Suffix after values in tooltips, e.g. '%' for percentages. Optional.",
            },
            "color": {
                "type": "string",
                "description": "Bar color hex code, e.g. '#7c3aed'. Optional — uses default palette if omitted.",
            },
        },
        "required": ["chart_type", "title", "data"],
    },
}

SUGGESTED_QUESTIONS = [
    "Hvad skal jeg fokusere på denne uge?",
    "Hvilke deals er mest i fare for at gå tabt?",
    "Hvilke leads bør jeg kontakte i dag?",
    "Giv mig et overblik over min pipeline",
    "Hvilke deals ser ud til at vinde?",
    "Hvor stor er min samlede pipeline?",
]


async def chat_with_pipeline(
    question: str,
    context: Dict,
    history: Optional[List[Dict]] = None,
    hs_integration=None,
) -> Dict:
    """
    Send a question + full pipeline context to Claude and return the answer + any charts.

    Supports tool use (function calling) for HubSpot actions and chart rendering.
    Runs an agentic loop: if Claude calls a tool, executes it and continues.

    Args:
        question:        The user's natural-language question.
        context:         Output of build_pipeline_context().
        history:         Optional prior messages [{role, content}, ...] for multi-turn.
        hs_integration:  Optional HubSpotIntegration instance for tool execution.

    Returns:
        Dict with keys:
            "answer"  — the AI's text response
            "charts"  — list of chart specs rendered by render_chart tool calls
            "tool_calls" — list of tool calls made (for logging)

    Raises:
        ValueError  if ANTHROPIC_API_KEY is not set.
        Exception   for Anthropic API errors (caller should handle).
    """
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    system_content = _SYSTEM_PROMPT.format(
        today=datetime.utcnow().strftime("%A, %B %d %Y"),
        context_json=json.dumps(context, indent=2, default=str),
    )

    # Build message list (Anthropic uses user/assistant roles only — system is separate)
    messages: List[Dict] = []
    if history:
        for m in history[-10:]:
            if m["role"] in ("user", "assistant"):
                messages.append({"role": m["role"], "content": m["content"]})

    messages.append({"role": "user", "content": question})

    # Always include chart tool; add HubSpot tools only if connected
    tools = [CHART_TOOL]
    if hs_integration:
        tools = tools + HUBSPOT_TOOLS

    # Collected across all rounds
    charts_collected: List[Dict] = []
    tool_calls_log: List[Dict] = []

    # ── Agentic loop — handles tool calls up to 5 rounds ──────────────────
    for _round in range(5):
        kwargs: Dict = dict(
            model=settings.ANTHROPIC_MODEL,
            system=system_content,
            messages=messages,
            max_tokens=1500,
            tools=tools,
        )

        response = await client.messages.create(**kwargs)

        # If Claude produced a final text response, we're done
        if response.stop_reason == "end_turn":
            text_blocks = [b for b in response.content if b.type == "text"]
            answer = text_blocks[0].text.strip() if text_blocks else ""
            return {
                "answer": answer,
                "charts": charts_collected,
                "tool_calls": tool_calls_log,
            }

        # If Claude wants to use a tool
        if response.stop_reason == "tool_use":
            # Add Claude's full response (with tool_use block) to message history
            assistant_content = []
            for block in response.content:
                if block.type == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })
            messages.append({"role": "assistant", "content": assistant_content})

            # Execute each tool call and collect results
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_calls_log.append({"name": block.name, "input": block.input})

                if block.name == "render_chart":
                    # Chart tool: just collect the spec and confirm to Claude
                    charts_collected.append(block.input)
                    logger.info("Chart rendered: %s (%d data points)",
                                block.input.get("title"), len(block.input.get("data", [])))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({"success": True, "message": "Chart rendered in UI"}),
                    })
                else:
                    tool_result = await _execute_tool(block.name, block.input, hs_integration)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(tool_result, default=str),
                    })
                    logger.info("Tool %s executed: %s", block.name, tool_result)

            # Add tool results back so Claude can continue
            messages.append({"role": "user", "content": tool_results})
            continue  # next round: Claude sees the tool results and gives final answer

        # Any other stop reason — return whatever text we have
        text_blocks = [b for b in response.content if b.type == "text"]
        answer = text_blocks[0].text.strip() if text_blocks else ""
        return {
            "answer": answer,
            "charts": charts_collected,
            "tool_calls": tool_calls_log,
        }

    # Fallback if we somehow exceed the loop limit
    return {
        "answer": "Der opstod et problem med at behandle din forespørgsel. Prøv igen.",
        "charts": charts_collected,
        "tool_calls": tool_calls_log,
    }


async def _execute_tool(name: str, inputs: Dict, hs_integration) -> Dict:
    """Dispatch a tool call to the appropriate backend function."""
    if name == "create_hubspot_task":
        if hs_integration is None:
            return {
                "error": "not_connected",
                "message": "HubSpot er ikke forbundet. Gå til Connections og tilslut HubSpot.",
            }
        try:
            return await hs_integration.create_task(
                subject=inputs.get("subject", ""),
                body=inputs.get("body", ""),
                owner_email=inputs.get("owner_email"),
                due_date=inputs.get("due_date"),
            )
        except Exception as exc:
            logger.exception("HubSpot create_task failed: %s", exc)
            return {"error": "api_error", "message": str(exc)}

    return {"error": "unknown_tool", "message": f"Unknown tool: {name}"}
