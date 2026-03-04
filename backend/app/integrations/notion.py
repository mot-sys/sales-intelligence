"""
Notion Integration
Syncs initiative/task databases from Notion workspaces.
Uses the Notion API v1 with an Internal Integration Token.

Setup:
  1. Go to https://www.notion.so/my-integrations
  2. Create a new Internal Integration → copy the token (starts with secret_...)
  3. Share each department database with the integration (Share → Invite → select integration)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from app.integrations.base import BaseIntegration

NOTION_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


class NotionIntegration(BaseIntegration):
    """
    Notion integration that reads database pages and maps them to initiatives.

    Credentials expected:
        api_key — Internal Integration Token (secret_...)
    """

    def __init__(self, credentials: Dict[str, str], config: Optional[Dict] = None):
        super().__init__(credentials, config)
        self._token = credentials.get("api_key", "")
        self._headers = {
            "Authorization": f"Bearer {self._token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    # ─────────────────────────────────────────────
    # BaseIntegration interface
    # ─────────────────────────────────────────────

    async def test_connection(self) -> bool:
        """Verify the integration token by calling /users/me."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{NOTION_BASE}/users/me",
                    headers=self._headers,
                )
                return r.status_code == 200
        except Exception:
            return False

    async def sync_data(self) -> List[Dict]:
        """Sync all accessible databases and return flattened page list."""
        return await self.sync_all()

    async def push_data(self, data: Dict) -> bool:
        return False

    # ─────────────────────────────────────────────
    # Public methods
    # ─────────────────────────────────────────────

    async def get_databases(self) -> List[Dict]:
        """
        Return all Notion databases the integration has access to.
        Each dict: {id, name, url, property_names}
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    f"{NOTION_BASE}/search",
                    headers=self._headers,
                    json={
                        "filter": {"property": "object", "value": "database"},
                        "page_size": 100,
                    },
                )
            if r.status_code != 200:
                return []
            results = r.json().get("results", [])
            databases = []
            for db in results:
                title_parts = db.get("title", [])
                name = "".join(t.get("plain_text", "") for t in title_parts) or "Untitled"
                prop_names = list(db.get("properties", {}).keys())
                databases.append({
                    "id": db["id"],
                    "name": name,
                    "url": db.get("url", ""),
                    "property_names": prop_names,
                })
            return databases
        except Exception:
            return []

    async def sync_all(self) -> List[Dict]:
        """
        Sync all accessible databases (or only those listed in config.database_ids).
        Returns flat list of mapped initiative dicts.
        """
        cfg = self._config or {}
        allowed_ids: List[str] = cfg.get("database_ids", [])

        databases = await self.get_databases()
        if allowed_ids:
            databases = [d for d in databases if d["id"] in allowed_ids]

        all_items: List[Dict] = []
        for db in databases:
            items = await self.sync_database(db["id"], db["name"])
            all_items.extend(items)
        return all_items

    async def sync_database(self, database_id: str, database_name: str = "") -> List[Dict]:
        """
        Query all pages in a Notion database and map them to initiative dicts.
        Handles pagination automatically.
        """
        pages = await self._query_database(database_id)
        return [self._map_page(p, database_name, database_id) for p in pages]

    # ─────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────

    async def _query_database(self, database_id: str) -> List[Dict]:
        """Paginate through all pages in a Notion database."""
        pages: List[Dict] = []
        start_cursor: Optional[str] = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                body: Dict = {"page_size": 100}
                if start_cursor:
                    body["start_cursor"] = start_cursor
                r = await client.post(
                    f"{NOTION_BASE}/databases/{database_id}/query",
                    headers=self._headers,
                    json=body,
                )
                if r.status_code != 200:
                    break
                data = r.json()
                pages.extend(data.get("results", []))
                if not data.get("has_more"):
                    break
                start_cursor = data.get("next_cursor")
        return pages

    def _map_page(self, page: Dict, database_name: str, database_id: str) -> Dict:
        """
        Map a Notion page to our standard initiative dict.
        Uses heuristic property-name matching to find title/owner/status/etc.
        All raw properties are also stored for transparency.
        """
        props: Dict[str, Any] = page.get("properties", {})
        page_id = page.get("id", "")
        url = page.get("url", "")

        # Extract all properties as readable values
        extracted: Dict[str, Any] = {}
        for prop_name, prop_value in props.items():
            extracted[prop_name] = self._extract_property(prop_value)

        # ── Heuristic field mapping ──────────────────────────────────────
        def _find(keys: List[str]) -> Optional[Any]:
            """Case-insensitive search for any of the given keys in extracted."""
            for k in extracted:
                if k.lower() in [x.lower() for x in keys]:
                    return extracted[k]
            return None

        # Title — first try "title" type property, then common names
        title = None
        for k, v in props.items():
            if v.get("type") == "title":
                title = self._extract_property(v)
                break
        if not title:
            title = _find(["name", "task", "initiative", "project", "item"])

        # Owner / Assignee
        owner = _find([
            "owner", "assignee", "assigned to", "assigned_to",
            "responsible", "person", "contact", "lead",
        ])

        # Status
        status = _find([
            "status", "state", "stage", "progress status", "phase", "result",
        ])

        # Due date
        due_raw = _find([
            "due", "due date", "deadline", "due_date", "end date",
            "target date", "finish date",
        ])
        due_date: Optional[datetime] = None
        if isinstance(due_raw, str):
            try:
                due_date = datetime.fromisoformat(due_raw.replace("Z", ""))
            except (ValueError, AttributeError):
                pass

        # Progress (numeric 0-100)
        progress_raw = _find([
            "progress", "completion", "% done", "percent", "done",
            "% complete", "completion %",
        ])
        progress: Optional[int] = None
        if isinstance(progress_raw, (int, float)):
            progress = min(100, max(0, int(progress_raw)))
        # If status looks like "Done"/"Completed", treat as 100%
        if progress is None and isinstance(status, str):
            if status.lower() in ("done", "completed", "finished", "closed", "complete"):
                progress = 100
            elif status.lower() in ("not started", "todo", "to do", "backlog"):
                progress = 0

        # Priority
        priority = _find(["priority", "importance", "urgency", "criticality"])

        # Department (explicit property OR use database name)
        department = _find([
            "department", "team", "squad", "group", "area", "domain", "tribe",
        ]) or database_name

        # Description
        description = _find([
            "description", "notes", "details", "summary", "overview",
            "context", "brief",
        ])
        if isinstance(description, list):
            description = " ".join(str(x) for x in description)

        return {
            "notion_page_id": page_id,
            "database_id": database_id,
            "database_name": database_name,
            "title": str(title) if title else "Untitled",
            "department": str(department) if department else database_name,
            "owner": str(owner) if owner else None,
            "status": str(status) if status else None,
            "due_date": due_date,
            "progress": progress,
            "priority": str(priority).lower() if priority else None,
            "description": str(description)[:500] if description else None,
            "notion_url": url,
            "raw_properties": extracted,
        }

    def _extract_property(self, prop: Dict) -> Any:
        """
        Extract a human-readable value from a Notion property object.
        Handles all common property types.
        """
        if not isinstance(prop, dict):
            return prop
        prop_type = prop.get("type", "")

        if prop_type == "title":
            parts = prop.get("title", [])
            return "".join(t.get("plain_text", "") for t in parts) or None

        if prop_type == "rich_text":
            parts = prop.get("rich_text", [])
            return "".join(t.get("plain_text", "") for t in parts) or None

        if prop_type == "number":
            return prop.get("number")

        if prop_type == "select":
            sel = prop.get("select")
            return sel.get("name") if sel else None

        if prop_type == "status":
            sel = prop.get("status")
            return sel.get("name") if sel else None

        if prop_type == "multi_select":
            items = prop.get("multi_select", [])
            return ", ".join(i.get("name", "") for i in items) or None

        if prop_type == "date":
            date_obj = prop.get("date")
            if date_obj:
                return date_obj.get("start")  # ISO string
            return None

        if prop_type == "people":
            people = prop.get("people", [])
            names = []
            for p in people:
                name = p.get("name") or p.get("id", "")
                if name:
                    names.append(name)
            return ", ".join(names) or None

        if prop_type == "checkbox":
            return prop.get("checkbox")

        if prop_type == "url":
            return prop.get("url")

        if prop_type == "email":
            return prop.get("email")

        if prop_type == "phone_number":
            return prop.get("phone_number")

        if prop_type == "formula":
            formula = prop.get("formula", {})
            ftype = formula.get("type", "")
            return formula.get(ftype)

        if prop_type == "relation":
            relations = prop.get("relation", [])
            return [r.get("id") for r in relations] or None

        if prop_type == "rollup":
            rollup = prop.get("rollup", {})
            rtype = rollup.get("type", "")
            if rtype == "number":
                return rollup.get("number")
            if rtype == "array":
                items = rollup.get("array", [])
                return [self._extract_property(i) for i in items] or None
            return None

        if prop_type == "created_time":
            return prop.get("created_time")

        if prop_type == "last_edited_time":
            return prop.get("last_edited_time")

        if prop_type == "created_by":
            person = prop.get("created_by", {})
            return person.get("name") or person.get("id")

        if prop_type == "last_edited_by":
            person = prop.get("last_edited_by", {})
            return person.get("name") or person.get("id")

        # Fallback: return raw value
        return prop.get(prop_type)
