"""
Clay Integration
Fetches enriched company/person data from Clay tables.

Clay API reference: https://docs.clay.com
Authentication: Bearer token via CLAY_API_KEY
"""

from typing import Dict, List, Optional
import logging

from app.integrations.base import BaseIntegration

logger = logging.getLogger(__name__)


class ClayIntegration(BaseIntegration):
    """
    Integration with Clay.com for enriched lead data.

    Clay organises data into "tables". Each table contains rows with
    enriched company and contact fields that we map to our Lead model.

    Credentials expected:
        {"api_key": "<clay_api_key>"}

    Config (optional):
        {"table_ids": ["<id1>", "<id2>"]}  # restrict to specific tables
    """

    BASE_URL = "https://api.clay.com/v1"

    # ─────────────────────────────────────────
    # Required BaseIntegration methods
    # ─────────────────────────────────────────

    async def test_connection(self) -> bool:
        """Ping the Clay API to verify credentials are valid."""
        try:
            await self._make_request(
                "GET",
                f"{self.BASE_URL}/sources/tables",
                headers=self._get_headers(),
            )
            return True
        except Exception as exc:
            logger.warning("Clay connection test failed: %s", exc)
            return False

    async def sync_data(self) -> List[Dict]:
        """
        Fetch all rows from all (or configured) Clay tables and return
        them mapped to our Lead model format.
        """
        leads: List[Dict] = []

        table_ids = self.config.get("table_ids")
        if table_ids:
            tables = [{"id": tid} for tid in table_ids]
        else:
            tables = await self._list_tables()

        for table in tables:
            table_id = table.get("id")
            if not table_id:
                continue
            try:
                rows = await self._get_table_rows(table_id)
                for row in rows:
                    lead = self._map_to_lead(row, table_id)
                    if lead:
                        leads.append(lead)
            except Exception as exc:
                logger.error("Failed to sync Clay table %s: %s", table_id, exc)

        logger.info("Clay sync complete: %d leads fetched", len(leads))
        return leads

    async def push_data(self, data: Dict) -> bool:
        """
        Clay is primarily a data-enrichment source; pushing is not supported
        in the MVP. Returns False with a warning.
        """
        logger.warning("ClayIntegration.push_data is not implemented.")
        return False

    # ─────────────────────────────────────────
    # Clay-specific helpers
    # ─────────────────────────────────────────

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.credentials['api_key']}",
            "Content-Type": "application/json",
        }

    async def _list_tables(self) -> List[Dict]:
        """Retrieve all tables for the authenticated Clay workspace."""
        response = await self._make_request(
            "GET",
            f"{self.BASE_URL}/sources/tables",
            headers=self._get_headers(),
        )
        # Clay returns {"data": [...]} or a plain list depending on version
        if isinstance(response, dict):
            return response.get("data", response.get("tables", []))
        return response or []

    async def _get_table_rows(
        self,
        table_id: str,
        page_size: int = 100,
    ) -> List[Dict]:
        """
        Fetch all rows for a given table, handling pagination.
        Clay uses cursor-based pagination via `next_cursor`.
        """
        all_rows: List[Dict] = []
        cursor: Optional[str] = None

        while True:
            params: Dict = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor

            response = await self._make_request(
                "GET",
                f"{self.BASE_URL}/sources/tables/{table_id}/rows",
                headers=self._get_headers(),
                params=params,
            )

            # Normalise response shape
            if isinstance(response, dict):
                rows = response.get("data", response.get("rows", []))
                cursor = response.get("next_cursor")
            else:
                rows = response or []
                cursor = None

            all_rows.extend(rows)

            if not cursor or not rows:
                break

        return all_rows

    def _map_to_lead(self, row: Dict, table_id: str) -> Optional[Dict]:
        """
        Map a Clay row to our Lead model dict.

        Clay rows vary by table configuration but common field names are
        normalised here. Returns None if the row lacks a company name.
        """
        # Clay stores enriched fields under various keys; we try common ones
        company_name = (
            row.get("company_name")
            or row.get("company")
            or row.get("organization_name")
            or row.get("name")
        )

        if not company_name:
            return None

        # Employee count normalisation
        employee_count = self._to_int(
            row.get("employee_count")
            or row.get("employees")
            or row.get("headcount")
        )

        # Revenue normalisation (Clay may return strings like "$5M")
        revenue_raw = row.get("annual_revenue") or row.get("revenue")
        revenue = self._parse_revenue(revenue_raw)

        # Unique row identifier in Clay
        external_id = str(
            row.get("id") or row.get("row_id") or f"{table_id}:{company_name}"
        )

        return {
            "company_name": company_name,
            "company_domain": row.get("company_domain") or row.get("domain") or row.get("website"),
            "industry": row.get("industry") or row.get("sector"),
            "employee_count": employee_count,
            "revenue": revenue,
            "location": row.get("location") or row.get("headquarters") or row.get("city"),
            "contact_name": row.get("contact_name") or row.get("first_name", "") + " " + row.get("last_name", ""),
            "contact_email": row.get("email") or row.get("contact_email"),
            "contact_title": row.get("title") or row.get("job_title") or row.get("contact_title"),
            "contact_linkedin": row.get("linkedin_url") or row.get("linkedin"),
            "source": "clay",
            "external_id": external_id,
            # Score / priority will be set by the scoring engine after creation
            "score": 0,
        }

    # ─────────────────────────────────────────
    # Type-conversion utilities
    # ─────────────────────────────────────────

    @staticmethod
    def _to_int(value) -> Optional[int]:
        """Safely convert a value to int."""
        if value is None:
            return None
        try:
            return int(str(value).replace(",", "").strip())
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_revenue(value) -> Optional[int]:
        """
        Convert revenue strings like '$5M', '5000000', '5,000,000' to int.
        Returns None if unparseable.
        """
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)

        text = str(value).upper().replace(",", "").replace("$", "").strip()
        multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}

        for suffix, mult in multipliers.items():
            if text.endswith(suffix):
                try:
                    return int(float(text[:-1]) * mult)
                except ValueError:
                    return None
        try:
            return int(float(text))
        except ValueError:
            return None
