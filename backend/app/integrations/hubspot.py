"""
HubSpot Integration
Syncs deals and companies from HubSpot CRM using the REST API v3.
Uses a Private App access token (Bearer auth).
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.integrations.base import BaseIntegration

HUBSPOT_BASE = "https://api.hubapi.com"


class HubSpotIntegration(BaseIntegration):
    """
    HubSpot integration using the CRM REST API v3.

    Credentials expected:
        access_token  — Private App access token from HubSpot
    """

    def __init__(self, credentials: Dict[str, str], config: Optional[Dict] = None):
        super().__init__(credentials, config)
        self._token = credentials.get("access_token", "")
        self._headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    # ─────────────────────────────────────────────
    # Owners & Tasks
    # ─────────────────────────────────────────────

    async def get_open_tasks(self, limit: int = 200) -> List[Dict]:
        """
        Fetch open (not completed) HubSpot tasks and return a summary
        grouped by owner — useful for the weekly report.

        Returns a list of dicts with keys:
          task_id, subject, body, owner_id, owner_name, due_date, status
        """
        try:
            owner_map = await self._fetch_owners()
            records = await self._paginate(
                f"{HUBSPOT_BASE}/crm/v3/objects/tasks",
                params={
                    "properties": ",".join([
                        "hs_task_subject", "hs_task_body", "hs_task_status",
                        "hs_timestamp", "hubspot_owner_id", "hs_task_priority",
                    ]),
                    "limit": min(limit, 100),
                    "filterGroups": None,
                },
            )
            tasks = []
            for r in records:
                props = r.get("properties", {})
                status = (props.get("hs_task_status") or "").upper()
                if status in ("COMPLETED", "DEFERRED"):
                    continue
                owner_id = str(props.get("hubspot_owner_id") or "")
                ts_ms = props.get("hs_timestamp")
                due_date = None
                if ts_ms:
                    try:
                        due_date = datetime.utcfromtimestamp(int(ts_ms) / 1000).strftime("%Y-%m-%d")
                    except Exception:
                        pass
                tasks.append({
                    "task_id": r.get("id"),
                    "subject": props.get("hs_task_subject") or "(no subject)",
                    "body": props.get("hs_task_body") or "",
                    "owner_id": owner_id,
                    "owner_name": owner_map.get(owner_id, owner_id or "Unassigned"),
                    "due_date": due_date,
                    "status": status or "NOT_STARTED",
                    "priority": props.get("hs_task_priority") or "MEDIUM",
                })
            return tasks
        except Exception:
            return []

    async def create_task(
        self,
        subject: str,
        body: str,
        owner_email: Optional[str] = None,
        due_date: Optional[str] = None,
    ) -> Dict:
        """
        Create a HubSpot task via the CRM Tasks API.

        Requires crm.objects.tasks.write scope on the Private App.

        Args:
            subject:     Task title shown in HubSpot.
            body:        Detailed description of the task.
            owner_email: Email of the HubSpot user to assign the task to.
            due_date:    ISO date string YYYY-MM-DD. Defaults to today if omitted.

        Returns:
            The created task object dict from HubSpot (includes id, properties).
        """
        from datetime import timezone

        # Resolve owner email → HubSpot owner ID
        owner_id: Optional[str] = None
        if owner_email:
            owner_id = await self._fetch_owner_id_by_email(owner_email)

        # HubSpot hs_timestamp = milliseconds UTC (required field)
        if due_date:
            try:
                dt = datetime.fromisoformat(due_date).replace(
                    hour=9, minute=0, second=0, microsecond=0,
                    tzinfo=timezone.utc,
                )
            except ValueError:
                dt = datetime.now(tz=timezone.utc)
        else:
            dt = datetime.now(tz=timezone.utc)

        props: Dict = {
            "hs_task_subject": subject,
            "hs_task_body": body,
            "hs_task_type": "TODO",
            "hs_task_priority": "HIGH",
            "hs_timestamp": str(int(dt.timestamp() * 1000)),
        }
        if owner_id:
            props["hubspot_owner_id"] = owner_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{HUBSPOT_BASE}/crm/v3/objects/tasks",
                headers=self._headers,
                json={"properties": props},
            )

        if r.status_code == 403:
            return {
                "error": "scope_missing",
                "message": (
                    "HubSpot Private App mangler 'crm.objects.tasks.write' scope. "
                    "Tilføj det i HubSpot → Settings → Integrations → Private Apps → Scopes."
                ),
            }
        r.raise_for_status()
        data = r.json()
        return {
            "task_id": data.get("id"),
            "subject": subject,
            "owner_email": owner_email,
            "due_date": due_date or dt.strftime("%Y-%m-%d"),
            "hubspot_url": f"https://app.hubspot.com/tasks/{data.get('id')}",
        }

    async def _fetch_owner_id_by_email(self, email: str) -> Optional[str]:
        """Look up a HubSpot owner ID by email address."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{HUBSPOT_BASE}/crm/v3/owners",
                    headers=self._headers,
                    params={"limit": 100},
                )
            if r.status_code != 200:
                return None
            for owner in r.json().get("results", []):
                if owner.get("email", "").lower() == email.lower():
                    return str(owner["id"])
            return None
        except Exception:
            return None

    async def _fetch_owners(self) -> Dict[str, str]:
        """
        Fetch all HubSpot owners and return {owner_id_str: full_name} lookup.
        Falls back gracefully if the /owners endpoint is not accessible.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{HUBSPOT_BASE}/crm/v3/owners",
                    headers=self._headers,
                    params={"limit": 100},
                )
                if r.status_code != 200:
                    return {}
                data = r.json()
            return {
                str(o["id"]): (
                    f"{o.get('firstName', '')} {o.get('lastName', '')}".strip()
                    or o.get("email", "")
                    or str(o["id"])
                )
                for o in data.get("results", [])
            }
        except Exception:
            return {}

    # ─────────────────────────────────────────────
    # BaseIntegration interface
    # ─────────────────────────────────────────────

    async def test_connection(self) -> bool:
        """Verify the access token is valid.

        Uses /crm/v3/objects/contacts?limit=1 — this endpoint is accessible
        with any basic Private App token. We accept any non-401 response as
        proof that the token is authentic; a 403 just means a scope is missing
        but the token itself is valid.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{HUBSPOT_BASE}/crm/v3/objects/contacts",
                    headers=self._headers,
                    params={"limit": 1},
                )
                # 401 = bad/expired token; anything else = token accepted by HubSpot
                return r.status_code != 401
        except Exception:
            return False

    async def sync_data(self) -> List[Dict]:
        """Sync deals + companies; return combined list."""
        deals = await self.sync_deals()
        companies = await self.sync_companies()
        return deals + companies

    async def push_data(self, data: Dict) -> bool:
        """Push not needed for current MVP."""
        return False

    # ─────────────────────────────────────────────
    # Deals
    # ─────────────────────────────────────────────

    async def sync_deals(self) -> List[Dict]:
        """
        Fetch all open HubSpot deals and return as dicts
        suitable for upserting into the SalesforceOpportunity table
        (IDs prefixed with 'hs_' to distinguish from SF records).
        Resolves owner IDs to full names via /crm/v3/owners.
        """
        # Fetch owner map in parallel with deals for speed
        owner_map, records = await asyncio.gather(
            self._fetch_owners(),
            self._paginate(
                f"{HUBSPOT_BASE}/crm/v3/objects/deals",
                params={
                    "properties": ",".join([
                        "dealname", "amount", "closedate", "dealstage",
                        "hubspot_owner_id", "hs_lastmodifieddate", "notes_last_updated",
                    ]),
                    "limit": 100,
                },
            ),
        )
        return [self._map_deal(r, owner_map) for r in records]

    async def detect_stalled_deals(self, days: int = 7) -> List[Dict]:
        """Return deals with no activity in the last `days` days."""
        all_deals = await self.sync_deals()
        cutoff = datetime.utcnow() - timedelta(days=days)
        stalled = []
        for d in all_deals:
            last_act = d.get("last_activity_date")
            if last_act is None or last_act < cutoff:
                delta = (datetime.utcnow() - last_act).days if last_act else days
                d["days_stalled"] = delta
                stalled.append(d)
        return stalled

    # ─────────────────────────────────────────────
    # Companies
    # ─────────────────────────────────────────────

    async def sync_companies(self) -> List[Dict]:
        """Fetch HubSpot companies and return account dicts."""
        properties = ["name", "domain", "industry", "numberofemployees"]
        records = await self._paginate(
            f"{HUBSPOT_BASE}/crm/v3/objects/companies",
            params={"properties": ",".join(properties), "limit": 100},
        )
        return [self._map_company(r) for r in records]

    # ─────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────

    async def _paginate(self, url: str, params: Dict) -> List[Dict]:
        """Follow HubSpot cursor pagination and return all results."""
        results = []
        after = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                p = {**params}
                if after:
                    p["after"] = after
                r = await client.get(url, headers=self._headers, params=p)
                r.raise_for_status()
                data = r.json()
                results.extend(data.get("results", []))
                paging = data.get("paging", {})
                after = paging.get("next", {}).get("after")
                if not after:
                    break
        return results

    def _map_deal(self, record: Dict, owner_map: Optional[Dict[str, str]] = None) -> Dict:
        """Map a HubSpot deal record to our internal opportunity dict."""
        props = record.get("properties", {})
        deal_id = record.get("id", "")

        close_raw = props.get("closedate")
        close_date = datetime.fromisoformat(close_raw.replace("Z", "")) if close_raw else None

        last_mod_raw = props.get("hs_lastmodifieddate") or props.get("notes_last_updated")
        last_activity = datetime.fromisoformat(last_mod_raw.replace("Z", "")) if last_mod_raw else None

        amount_raw = props.get("amount")
        try:
            amount = int(float(amount_raw)) if amount_raw else None
        except (ValueError, TypeError):
            amount = None

        # Resolve owner ID → full name using pre-fetched owner map.
        # Falls back to the raw ID string if the owners endpoint wasn't accessible
        # (requires crm.objects.owners.read scope on the HubSpot Private App).
        owner_id = props.get("hubspot_owner_id")
        if owner_id:
            resolved = (owner_map or {}).get(str(owner_id))
            owner_name = resolved if resolved else f"User {owner_id}"
        else:
            owner_name = None

        return {
            "sf_opportunity_id": f"hs_{deal_id}",  # prefix to avoid SF ID collision
            "account_name": props.get("dealname", "Unknown Deal"),
            "amount": amount,
            "stage": props.get("dealstage"),
            "close_date": close_date,
            "owner_name": owner_name,
            "last_activity_date": last_activity,
            "is_stalled": False,
            "raw_data": record,
        }

    def _map_company(self, record: Dict) -> Dict:
        """Map a HubSpot company record to our internal account dict."""
        props = record.get("properties", {})
        company_id = record.get("id", "")

        emp_raw = props.get("numberofemployees")
        try:
            employee_count = int(emp_raw) if emp_raw else None
        except (ValueError, TypeError):
            employee_count = None

        domain = (props.get("domain") or "").strip() or None

        return {
            "sf_account_id": f"hs_{company_id}",
            "name": props.get("name"),
            "domain": domain,
            "industry": props.get("industry"),
            "employee_count": employee_count,
            "raw_data": record,
        }
