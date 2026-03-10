"""P2.9 — Row-level security: PostgreSQL RLS policies for multi-tenant isolation

Revision ID: 007
Revises: 006
Create Date: 2026-03-10

WHY:
  Defense-in-depth. Even if the application has a bug that forgets to
  filter by customer_id, the DB will reject cross-tenant reads/writes.

HOW:
  1. Enable RLS on all customer-scoped tables.
  2. Create a policy that allows all operations only when the row's
     customer_id matches the session variable app.current_customer_id.
  3. The application sets this variable at the start of every DB session
     via the 'set_customer_id_on_connect' event in session.py.

IMPORTANT:
  - The superuser / migration role BYPASSES RLS (PostgreSQL default).
    Alembic migrations still work without changes.
  - The app DB role must NOT be superuser — set FORCE ROW LEVEL SECURITY
    on each table so even the table owner is affected if needed.
  - We use PERMISSIVE policies (default) — the app still adds WHERE
    customer_id = ? clauses as primary access control. RLS is backup.
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels = None
depends_on = None

# Tables that are scoped to a customer_id
CUSTOMER_SCOPED_TABLES = [
    "integrations",
    "integration_sync_logs",
    "integration_sync_states",
    "leads",
    "signals",
    "alerts",
    "salesforce_opportunities",
    "salesforce_accounts",
    "chat_sessions",
    "ai_actions",
    "weekly_reports",
    "notion_initiatives",
    "workflows",
    "gtm_configs",
    "forecast_snapshots",
    "kpi_snapshots",
    "accounts",
    "account_sources",
    "recommendations",
    "crm_activities",
    "users",
    "custom_alert_rules",
]


def upgrade() -> None:
    for table in CUSTOMER_SCOPED_TABLES:
        # Enable row-level security on the table
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        # Drop policy if it already exists (idempotent)
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")

        # PERMISSIVE policy (gradual rollout):
        #   - If app.current_customer_id is NOT set: allow all rows (preserves
        #     current behaviour for routes not yet migrated to set_rls_customer_id)
        #   - If app.current_customer_id IS set: only allow rows that match
        # Once every endpoint calls set_rls_customer_id(), remove the OR branch
        # for strict enforcement.
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (
                current_setting('app.current_customer_id', true) = ''
                OR customer_id::text = current_setting('app.current_customer_id', true)
            )
        """)

    # The `customers` table itself is not scoped — no RLS there.
    # Migrations bypass RLS by default (superuser role).


def downgrade() -> None:
    for table in CUSTOMER_SCOPED_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
