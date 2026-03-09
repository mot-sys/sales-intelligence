"""
Salesforce Integration
Syncs opportunities and accounts from Salesforce using simple-salesforce.
Uses asyncio.to_thread since simple-salesforce is synchronous.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from app.integrations.base import BaseIntegration


class SalesforceIntegration(BaseIntegration):
    """
    Salesforce integration using simple-salesforce.

    Credentials expected:
        username, password, security_token, domain (default: "login")
    """

    def __init__(self, credentials: Dict[str, str], config: Optional[Dict] = None):
        super().__init__(credentials, config)
        self._sf = None  # simple-salesforce Salesforce instance

    def _get_sf(self):
        """Lazily create simple-salesforce connection (synchronous)."""
        if self._sf is None:
            from simple_salesforce import Salesforce
            self._sf = Salesforce(
                username=self.credentials.get("username"),
                password=self.credentials.get("password"),
                security_token=self.credentials.get("security_token", ""),
                domain=self.credentials.get("domain", "login"),
            )
        return self._sf

    async def test_connection(self) -> bool:
        """Ping Salesforce by running a trivial SOQL query."""
        try:
            def _test():
                sf = self._get_sf()
                sf.query("SELECT Id FROM User LIMIT 1")
                return True
            return await asyncio.to_thread(_test)
        except Exception:
            return False

    async def sync_data(self) -> List[Dict]:
        """Sync opportunities and accounts; return as list of lead-compatible dicts."""
        opps = await self.sync_opportunities()
        accs = await self.sync_accounts()
        return opps + accs

    async def sync_opportunities(self) -> List[Dict]:
        """
        Fetch all open Salesforce opportunities and return them as dicts
        suitable for upserting into SalesforceOpportunity model.
        """
        def _query():
            sf = self._get_sf()
            result = sf.query_all(
                "SELECT Id, Name, Amount, StageName, CloseDate, LastActivityDate, "
                "Owner.Name, Account.Name, Account.Website "
                "FROM Opportunity WHERE IsClosed = false"
            )
            return result.get("records", [])

        records = await asyncio.to_thread(_query)
        return [self._map_opportunity(r) for r in records]

    async def sync_accounts(self) -> List[Dict]:
        """Fetch Salesforce accounts and return account dicts."""
        def _query():
            sf = self._get_sf()
            result = sf.query_all(
                "SELECT Id, Name, Website, Industry, NumberOfEmployees FROM Account LIMIT 2000"
            )
            return result.get("records", [])

        records = await asyncio.to_thread(_query)
        return [self._map_account(r) for r in records]

    async def sync_activities(self, days_back: int = 90) -> List[Dict]:
        """
        Fetch Salesforce Task and Event records for the last `days_back` days
        and return normalised activity dicts ready for upsert into crm_activities.

        Each result maps to:
          external_id, activity_type, occurred_at, owner_name, contact_name,
          company_name, subject, body, deal_id

        Args:
            days_back: How many calendar days to look back for activities.
                       Defaults to 90. Use a smaller window for incremental syncs.
        """
        tasks  = await self._fetch_tasks(days_back)
        events = await self._fetch_events(days_back)
        return tasks + events

    async def _fetch_tasks(self, days_back: int) -> List[Dict]:
        """Fetch Salesforce Task objects via SOQL."""
        soql = (
            "SELECT Id, Subject, ActivityDate, Type, Status, "
            "Owner.Name, WhoId, What.Name, Description "
            f"FROM Task WHERE ActivityDate >= LAST_N_DAYS:{days_back} "
            "ORDER BY ActivityDate DESC LIMIT 2000"
        )
        try:
            def _query():
                sf = self._get_sf()
                result = sf.query_all(soql)
                return result.get("records", [])
            records = await asyncio.to_thread(_query)
        except Exception:
            return []

        activities = []
        for r in records:
            activities.append({
                "external_id":   r.get("Id", ""),
                "activity_type": self._map_sf_task_type(r.get("Type") or r.get("Status")),
                "occurred_at":   self._parse_sf_date(r.get("ActivityDate")),
                "owner_name":    (r.get("Owner") or {}).get("Name"),
                "contact_name":  None,          # WhoId lookup would need extra query
                "company_name":  (r.get("What") or {}).get("Name"),
                "subject":       r.get("Subject"),
                "body":          r.get("Description"),
                "deal_id":       None,           # enriched via company_name match post-sync
            })
        return activities

    async def _fetch_events(self, days_back: int) -> List[Dict]:
        """Fetch Salesforce Event objects via SOQL."""
        soql = (
            "SELECT Id, Subject, ActivityDateTime, Type, "
            "Owner.Name, WhoId, What.Name, Description "
            f"FROM Event WHERE ActivityDateTime >= LAST_N_DAYS:{days_back} "
            "ORDER BY ActivityDateTime DESC LIMIT 2000"
        )
        try:
            def _query():
                sf = self._get_sf()
                result = sf.query_all(soql)
                return result.get("records", [])
            records = await asyncio.to_thread(_query)
        except Exception:
            return []

        activities = []
        for r in records:
            activities.append({
                "external_id":   r.get("Id", ""),
                "activity_type": self._map_sf_event_type(r.get("Type")),
                "occurred_at":   self._parse_sf_datetime(r.get("ActivityDateTime")),
                "owner_name":    (r.get("Owner") or {}).get("Name"),
                "contact_name":  None,
                "company_name":  (r.get("What") or {}).get("Name"),
                "subject":       r.get("Subject"),
                "body":          r.get("Description"),
                "deal_id":       None,
            })
        return activities

    # ── Salesforce activity type helpers ──────────────────────────────────

    @staticmethod
    def _map_sf_task_type(sf_type: Optional[str]) -> str:
        """Map a Salesforce Task Type/Status value to our activity_type enum."""
        t = (sf_type or "").lower()
        if "call" in t:      return "call"
        if "email" in t:     return "email"
        if "meeting" in t:   return "meeting"
        return "task"

    @staticmethod
    def _map_sf_event_type(sf_type: Optional[str]) -> str:
        """Map a Salesforce Event Type to our activity_type enum."""
        t = (sf_type or "").lower()
        if "call" in t:      return "call"
        if "email" in t:     return "email"
        return "meeting"  # default for calendar events

    @staticmethod
    def _parse_sf_date(date_str: Optional[str]) -> Optional[datetime]:
        """Parse a Salesforce date string (YYYY-MM-DD)."""
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str)
        except Exception:
            return None

    @staticmethod
    def _parse_sf_datetime(dt_str: Optional[str]) -> Optional[datetime]:
        """Parse a Salesforce datetime string (ISO 8601)."""
        if not dt_str:
            return None
        try:
            return datetime.fromisoformat(dt_str.replace("Z", ""))
        except Exception:
            return None

    async def detect_stalled_deals(self, days: int = 7) -> List[Dict]:
        """
        Return open opportunities with LastActivityDate older than `days` days
        (or null), as dicts with stall metadata.
        """
        cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")

        def _query():
            sf = self._get_sf()
            soql = (
                f"SELECT Id, Name, Amount, StageName, CloseDate, LastActivityDate, Owner.Name "
                f"FROM Opportunity WHERE IsClosed = false "
                f"AND (LastActivityDate < {cutoff} OR LastActivityDate = null)"
            )
            result = sf.query_all(soql)
            return result.get("records", [])

        records = await asyncio.to_thread(_query)

        stalled = []
        for r in records:
            opp = self._map_opportunity(r)
            last_act = opp.get("last_activity_date")
            if last_act:
                if isinstance(last_act, str):
                    last_act = datetime.fromisoformat(last_act.replace("Z", "+00:00")).replace(tzinfo=None)
                days_stalled = (datetime.utcnow() - last_act).days
            else:
                days_stalled = days
            opp["days_stalled"] = days_stalled
            stalled.append(opp)
        return stalled

    async def push_data(self, data: Dict) -> bool:
        """Push a lead update back to Salesforce (not needed for MVP)."""
        return False

    def _map_opportunity(self, record: Dict) -> Dict:
        """Map a Salesforce opportunity record to our internal dict."""
        close_date = record.get("CloseDate")
        last_activity = record.get("LastActivityDate")

        return {
            "sf_opportunity_id": record.get("Id", ""),
            "account_name": (record.get("Account") or {}).get("Name") or record.get("Name", ""),
            "amount": int(record["Amount"]) if record.get("Amount") else None,
            "stage": record.get("StageName"),
            "close_date": datetime.fromisoformat(close_date) if close_date else None,
            "last_activity_date": datetime.fromisoformat(last_activity.replace("Z", "")) if last_activity else None,
            "owner_name": (record.get("Owner") or {}).get("Name"),
            "raw_data": record,
        }

    def _map_account(self, record: Dict) -> Dict:
        """Map a Salesforce account record to our internal dict."""
        website = record.get("Website") or ""
        domain = website.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]

        return {
            "sf_account_id": record.get("Id", ""),
            "name": record.get("Name"),
            "domain": domain or None,
            "industry": record.get("Industry"),
            "employee_count": record.get("NumberOfEmployees"),
            "raw_data": record,
        }
