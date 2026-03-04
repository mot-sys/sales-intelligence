"""
CMT Dashboard API
C-level Management Team dashboard: cross-department initiative progress from Notion.
"""

import logging
from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_customer_id_dev as get_current_customer_id
from app.db import crud as db_crud
from app.db.models import NotionInitiative, Integration
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _status_category(status: Optional[str]) -> str:
    """Normalise raw Notion status strings to one of: not_started | in_progress | done | blocked."""
    if not status:
        return "not_started"
    s = status.lower().strip()
    if s in ("done", "completed", "finished", "closed", "complete", "launched", "shipped"):
        return "done"
    if s in ("blocked", "on hold", "paused", "cancelled", "canceled", "rejected"):
        return "blocked"
    if s in ("not started", "todo", "to do", "backlog", "new", "open", "planned"):
        return "not_started"
    # Anything with "progress", "review", "doing", "active", "in flight", etc.
    return "in_progress"


def _is_overdue(item: NotionInitiative) -> bool:
    """Return True if item has a due_date in the past and is not done."""
    if not item.due_date:
        return False
    if _status_category(item.status) == "done":
        return False
    now = datetime.utcnow()
    due = item.due_date if isinstance(item.due_date, datetime) else datetime(
        item.due_date.year, item.due_date.month, item.due_date.day
    )
    return due < now


def _initiative_to_dict(item: NotionInitiative) -> Dict:
    return {
        "id": str(item.id),
        "notion_page_id": item.notion_page_id,
        "title": item.title or "Untitled",
        "department": item.department or item.database_name or "General",
        "owner": item.owner,
        "status": item.status,
        "status_category": _status_category(item.status),
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "progress": item.progress,
        "priority": item.priority,
        "description": item.description,
        "notion_url": item.notion_url,
        "is_overdue": _is_overdue(item),
        "synced_at": item.synced_at.isoformat() if item.synced_at else None,
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/overview")
async def get_cmt_overview(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    High-level CMT summary:
    - Total initiatives + breakdown by status category
    - Overdue count
    - Breakdown by department (name, total, done, in_progress, overdue, avg_progress)
    - Last sync timestamp
    """
    items = await db_crud.get_notion_initiatives(db, customer_id, limit=500)

    if not items:
        # Check if Notion is even connected
        notion_conn = await db.scalar(
            select(Integration).where(
                Integration.customer_id == customer_id,
                Integration.service == "notion",
            )
        )
        return {
            "total": 0,
            "by_status": {},
            "by_department": [],
            "overdue": 0,
            "avg_progress": None,
            "notion_connected": notion_conn is not None,
            "notion_status": notion_conn.status if notion_conn else "disconnected",
            "last_sync": notion_conn.last_sync.isoformat() if notion_conn and notion_conn.last_sync else None,
        }

    # Overall status breakdown
    by_status: Counter = Counter(_status_category(i.status) for i in items)
    overdue_items = [i for i in items if _is_overdue(i)]

    # Progress stats
    items_with_progress = [i for i in items if i.progress is not None]
    avg_progress = (
        round(sum(i.progress for i in items_with_progress) / len(items_with_progress))
        if items_with_progress else None
    )

    # Department breakdown
    by_dept: Dict[str, List[NotionInitiative]] = defaultdict(list)
    for i in items:
        dept = i.department or i.database_name or "General"
        by_dept[dept].append(i)

    dept_summaries = []
    for dept, dept_items in sorted(by_dept.items()):
        dept_progress_items = [x for x in dept_items if x.progress is not None]
        dept_avg = (
            round(sum(x.progress for x in dept_progress_items) / len(dept_progress_items))
            if dept_progress_items else None
        )
        dept_status = Counter(_status_category(x.status) for x in dept_items)
        dept_overdue = sum(1 for x in dept_items if _is_overdue(x))
        dept_summaries.append({
            "department": dept,
            "total": len(dept_items),
            "done": dept_status.get("done", 0),
            "in_progress": dept_status.get("in_progress", 0),
            "not_started": dept_status.get("not_started", 0),
            "blocked": dept_status.get("blocked", 0),
            "overdue": dept_overdue,
            "avg_progress": dept_avg,
        })

    # Last sync
    notion_conn = await db.scalar(
        select(Integration).where(
            Integration.customer_id == customer_id,
            Integration.service == "notion",
            Integration.status == "connected",
        )
    )

    return {
        "total": len(items),
        "by_status": dict(by_status),
        "by_department": dept_summaries,
        "overdue": len(overdue_items),
        "avg_progress": avg_progress,
        "notion_connected": notion_conn is not None,
        "notion_status": notion_conn.status if notion_conn else "disconnected",
        "last_sync": notion_conn.last_sync.isoformat() if notion_conn and notion_conn.last_sync else None,
    }


@router.get("/initiatives")
async def get_cmt_initiatives(
    department: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return paginated initiatives, optionally filtered by department or status.
    """
    items = await db_crud.get_notion_initiatives(
        db, customer_id,
        department=department,
        status=status,
        limit=limit,
    )
    return {
        "initiatives": [_initiative_to_dict(i) for i in items],
        "total": len(items),
    }


@router.get("/departments")
async def get_cmt_departments(
    customer_id: str = Depends(get_current_customer_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return all departments with their full initiative lists.
    Ideal for the department-cards view in the CMT dashboard.
    """
    items = await db_crud.get_notion_initiatives(db, customer_id, limit=500)

    by_dept: Dict[str, List[Dict]] = defaultdict(list)
    for i in items:
        dept = i.department or i.database_name or "General"
        by_dept[dept].append(_initiative_to_dict(i))

    # Sort each department's initiatives: overdue first, then by due_date
    departments = []
    for dept, dept_items in sorted(by_dept.items()):
        dept_items.sort(key=lambda x: (
            not x["is_overdue"],
            x["due_date"] or "9999",
        ))
        done_count = sum(1 for x in dept_items if x["status_category"] == "done")
        departments.append({
            "name": dept,
            "initiatives": dept_items,
            "total": len(dept_items),
            "done": done_count,
            "completion_pct": round(done_count / len(dept_items) * 100) if dept_items else 0,
        })

    return {"departments": departments, "total_departments": len(departments)}
