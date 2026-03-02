"""
Outreach.io Integration
OAuth 2.0 client for the Outreach API v2.

Auth flow:
  1. Build authorization URL → redirect user to Outreach
  2. Outreach redirects back with ?code=...
  3. Exchange code for access_token + refresh_token
  4. Store tokens in integrations.credentials
  5. Auto-refresh when access_token expires

Syncs: prospects, accounts, sequences, sequence states, opportunities.
Pushes: enroll prospect into a sequence.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from urllib.parse import urlencode

import httpx

from app.integrations.base import BaseIntegration

OUTREACH_BASE = "https://api.outreach.io/api/v2"
OUTREACH_AUTH_URL = "https://api.outreach.io/oauth/authorize"
OUTREACH_TOKEN_URL = "https://api.outreach.io/oauth/token"

# Minimum scopes needed for our use case
REQUIRED_SCOPES = [
    "accounts.read",
    "prospects.read",
    "sequences.read",
    "sequenceStates.read",
    "opportunities.read",
    "tasks.read",
]


class OutreachIntegration(BaseIntegration):
    """
    Outreach.io integration using OAuth 2.0.

    Credentials expected (stored in integrations.credentials JSONB):
        client_id      — OAuth Application ID
        client_secret  — OAuth Application Secret
        access_token   — Current access token (set after OAuth callback)
        refresh_token  — Refresh token (set after OAuth callback)
        expires_at     — ISO timestamp when access_token expires
    """

    def __init__(self, credentials: Dict[str, str], config: Optional[Dict] = None):
        super().__init__(credentials, config)
        self._client_id = credentials.get("client_id", "")
        self._client_secret = credentials.get("client_secret", "")
        self._access_token = credentials.get("access_token", "")
        self._refresh_token = credentials.get("refresh_token", "")
        self._expires_at_str = credentials.get("expires_at")

    # ─────────────────────────────────────────────
    # OAuth helpers
    # ─────────────────────────────────────────────

    @staticmethod
    def build_authorization_url(client_id: str, redirect_uri: str) -> str:
        """Return the URL the user must visit to authorise the app."""
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(REQUIRED_SCOPES),
        }
        return f"{OUTREACH_AUTH_URL}?{urlencode(params)}"

    @staticmethod
    async def exchange_code(
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ) -> Dict[str, str]:
        """
        Exchange an authorisation code for access + refresh tokens.
        Returns a dict with access_token, refresh_token, expires_at.
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                OUTREACH_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            data = r.json()

        expires_in = int(data.get("expires_in", 7200))
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", ""),
            "expires_at": expires_at,
        }

    async def _refresh_access_token(self) -> Dict[str, str]:
        """Use refresh_token to get a new access_token. Returns updated credential fields."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                OUTREACH_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            data = r.json()

        expires_in = int(data.get("expires_in", 7200))
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        self._access_token = data["access_token"]
        if data.get("refresh_token"):
            self._refresh_token = data["refresh_token"]
        self._expires_at_str = expires_at
        return {
            "access_token": self._access_token,
            "refresh_token": self._refresh_token,
            "expires_at": expires_at,
        }

    def _is_token_expired(self) -> bool:
        if not self._expires_at_str:
            return True
        try:
            expires_at = datetime.fromisoformat(self._expires_at_str)
            return datetime.utcnow() >= expires_at - timedelta(minutes=5)
        except ValueError:
            return True

    async def _auth_headers(self) -> Dict[str, str]:
        """Return Bearer auth headers, refreshing token if needed."""
        if self._is_token_expired() and self._refresh_token:
            await self._refresh_access_token()
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/vnd.api+json",
        }

    # ─────────────────────────────────────────────
    # BaseIntegration interface
    # ─────────────────────────────────────────────

    async def test_connection(self) -> bool:
        """Verify the access token is valid by fetching the current user."""
        try:
            headers = await self._auth_headers()
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{OUTREACH_BASE}/users?page[size]=1", headers=headers)
                return r.status_code == 200
        except Exception:
            return False

    async def sync_data(self) -> List[Dict]:
        """Sync all relevant data; returns combined list for caller to route."""
        prospects, accounts, seq_states = await asyncio.gather(
            self.sync_prospects(),
            self.sync_accounts(),
            self.sync_sequence_states(),
        )
        return prospects + accounts + seq_states

    async def push_data(self, data: Dict) -> bool:
        """Enroll a prospect in a sequence."""
        prospect_id = data.get("prospect_id")
        sequence_id = data.get("sequence_id")
        mailbox_id = data.get("mailbox_id")
        if not (prospect_id and sequence_id):
            return False
        return await self.enroll_prospect(prospect_id, sequence_id, mailbox_id)

    # ─────────────────────────────────────────────
    # Sync methods
    # ─────────────────────────────────────────────

    async def sync_prospects(self) -> List[Dict]:
        """Fetch all prospects and return as normalised dicts."""
        records = await self._paginate(f"{OUTREACH_BASE}/prospects")
        return [self._map_prospect(r) for r in records]

    async def sync_accounts(self) -> List[Dict]:
        """Fetch all Outreach accounts and return as normalised dicts."""
        records = await self._paginate(f"{OUTREACH_BASE}/accounts")
        return [self._map_account(r) for r in records]

    async def sync_sequences(self) -> List[Dict]:
        """Fetch all sequences and return as normalised dicts."""
        records = await self._paginate(f"{OUTREACH_BASE}/sequences")
        return [self._map_sequence(r) for r in records]

    async def sync_sequence_states(self) -> List[Dict]:
        """Fetch sequence states (prospect ↔ sequence enrollment)."""
        records = await self._paginate(f"{OUTREACH_BASE}/sequenceStates")
        return [self._map_sequence_state(r) for r in records]

    async def sync_opportunities(self) -> List[Dict]:
        """Fetch Outreach opportunities."""
        records = await self._paginate(f"{OUTREACH_BASE}/opportunities")
        return [self._map_opportunity(r) for r in records]

    async def sync_tasks(self) -> List[Dict]:
        """Fetch pending tasks."""
        records = await self._paginate(
            f"{OUTREACH_BASE}/tasks",
            params={"filter[state]": "incomplete"},
        )
        return [self._map_task(r) for r in records]

    # ─────────────────────────────────────────────
    # Push methods
    # ─────────────────────────────────────────────

    async def enroll_prospect(
        self,
        prospect_id: int,
        sequence_id: int,
        mailbox_id: Optional[int] = None,
    ) -> bool:
        """
        Enrol a prospect in an Outreach sequence.
        Requires sequenceStates.write scope.
        """
        try:
            headers = await self._auth_headers()
            payload: Dict = {
                "data": {
                    "type": "sequenceState",
                    "relationships": {
                        "prospect": {"data": {"type": "prospect", "id": prospect_id}},
                        "sequence": {"data": {"type": "sequence", "id": sequence_id}},
                    },
                }
            }
            if mailbox_id:
                payload["data"]["relationships"]["mailbox"] = {
                    "data": {"type": "mailbox", "id": mailbox_id}
                }
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    f"{OUTREACH_BASE}/sequenceStates",
                    json=payload,
                    headers=headers,
                )
                return r.status_code in (200, 201)
        except Exception:
            return False

    # ─────────────────────────────────────────────
    # Pagination
    # ─────────────────────────────────────────────

    async def _paginate(
        self, url: str, params: Optional[Dict] = None, page_size: int = 100,
        max_pages: int = 5,
    ) -> List[Dict]:
        """Follow Outreach JSON:API cursor pagination, return up to max_pages pages."""
        results = []
        next_url: Optional[str] = url
        base_params = {"page[size]": page_size, **(params or {})}
        headers = await self._auth_headers()
        pages_fetched = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            first = True
            while next_url and pages_fetched < max_pages:
                r = await client.get(
                    next_url,
                    headers=headers,
                    params=base_params if first else None,
                )
                if r.status_code == 401:
                    raise ValueError(f"Outreach token invalid or expired (401) — re-connect Outreach")
                if r.status_code == 403:
                    raise ValueError(f"Outreach scope missing for {next_url} (403)")
                r.raise_for_status()
                data = r.json()
                results.extend(data.get("data", []))
                next_url = data.get("links", {}).get("next")
                first = False
                pages_fetched += 1
        return results

    # ─────────────────────────────────────────────
    # Mappers
    # ─────────────────────────────────────────────

    def _attr(self, record: Dict) -> Dict:
        return record.get("attributes", {})

    def _rel_id(self, record: Dict, rel: str) -> Optional[int]:
        try:
            return record["relationships"][rel]["data"]["id"]
        except (KeyError, TypeError):
            return None

    def _map_prospect(self, record: Dict) -> Dict:
        a = self._attr(record)
        return {
            "_type": "prospect",
            "outreach_id": record.get("id"),
            "first_name": a.get("firstName"),
            "last_name": a.get("lastName"),
            "email": (a.get("emails") or [{}])[0].get("email"),
            "title": a.get("title"),
            "company": a.get("company"),
            "phone": (a.get("phones") or [{}])[0].get("phone"),
            "stage": a.get("stage"),
            "score": a.get("score"),
            "opted_out": a.get("optedOut", False),
            "bounced": a.get("emailBounced", False),
            "created_at": a.get("createdAt"),
            "updated_at": a.get("updatedAt"),
            "account_id": self._rel_id(record, "account"),
            "owner_id": self._rel_id(record, "owner"),
            "raw": record,
        }

    def _map_account(self, record: Dict) -> Dict:
        a = self._attr(record)
        return {
            "_type": "account",
            "outreach_id": record.get("id"),
            "name": a.get("name"),
            "domain": a.get("domain"),
            "website": a.get("websiteUrl"),
            "industry": a.get("industry"),
            "employee_count": a.get("employees"),
            "annual_revenue": a.get("annualRevenue"),
            "created_at": a.get("createdAt"),
            "updated_at": a.get("updatedAt"),
            "raw": record,
        }

    def _map_sequence(self, record: Dict) -> Dict:
        a = self._attr(record)
        return {
            "_type": "sequence",
            "outreach_id": record.get("id"),
            "name": a.get("name"),
            "enabled": a.get("enabled", False),
            "num_steps": a.get("sequenceStepCount", 0),
            "prospect_count": a.get("activeProspectCount", 0),
            "finished_count": a.get("finishedProspectCount", 0),
            "reply_count": a.get("replyCount", 0),
            "created_at": a.get("createdAt"),
            "raw": record,
        }

    def _map_sequence_state(self, record: Dict) -> Dict:
        a = self._attr(record)
        return {
            "_type": "sequence_state",
            "outreach_id": record.get("id"),
            "state": a.get("state"),
            "prospect_id": self._rel_id(record, "prospect"),
            "sequence_id": self._rel_id(record, "sequence"),
            "created_at": a.get("createdAt"),
            "updated_at": a.get("updatedAt"),
            "raw": record,
        }

    def _map_opportunity(self, record: Dict) -> Dict:
        a = self._attr(record)
        return {
            "_type": "opportunity",
            "outreach_id": record.get("id"),
            "name": a.get("name"),
            "amount": a.get("amount"),
            "probability": a.get("probability"),
            "close_date": a.get("closeDate"),
            "stage": a.get("stageName"),
            "account_id": self._rel_id(record, "account"),
            "prospect_id": self._rel_id(record, "prospect"),
            "raw": record,
        }

    def _map_task(self, record: Dict) -> Dict:
        a = self._attr(record)
        return {
            "_type": "task",
            "outreach_id": record.get("id"),
            "subject": a.get("subject"),
            "note": a.get("note"),
            "due_at": a.get("dueAt"),
            "state": a.get("state"),
            "task_type": a.get("taskType"),
            "prospect_id": self._rel_id(record, "prospect"),
            "raw": record,
        }
