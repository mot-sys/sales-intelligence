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
    # Owners
    # ─────────────────────────────────────────────

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

        # Resolve owner ID → full name using pre-fetched owner map
        owner_id = props.get("hubspot_owner_id")
        owner_name = (owner_map or {}).get(str(owner_id)) if owner_id else None

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
