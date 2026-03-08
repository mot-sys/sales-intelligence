# PRODUCT AUDIT
**Signal Intelligence — GTM Operating System**
Audit date: 2026-03-08 | Auditor: CPO + Staff Engineer perspective

---

## 1. WHAT THIS PRODUCT IS TODAY

A collection of loosely connected dashboards built around:
- Lead scoring from Clay sync
- Salesforce/HubSpot deal data
- Revenue analytics (funnel, health, forecast)
- AI chat advisor
- Alert generation
- A GTM config form

It is **not yet** a GTM Operating System. It has the raw ingredients but no unified engine converting data → decisions → actions.

---

## 2. WHAT IS SOLID

### Backend data layer
- All analytics endpoints query real data. No fake numbers.
- Multi-tenant scoping via `customer_id` on every query — correct pattern.
- `SalesforceOpportunity` and `SalesforceAccount` models are properly separated from `Lead`.
- `IntegrationSyncLog` table is designed correctly (per-sync audit record with records_synced, errors, duration_ms).
- `Alert` model is well-designed: type, priority, status, recommendation, contextual JSON.
- Async-first throughout: FastAPI, SQLAlchemy async, httpx, asyncpg.

### Integration framework
- `BaseIntegration` abstraction is the right pattern — retry, backoff, context manager.
- Clay integration is fully implemented and idempotent (upsert by `external_id + source`).
- HubSpot sync actually runs: deals + companies + leads, with stage mapping.

### Lead scoring engine (`ml/scorer.py`)
- Structured 4-component model (firmographics, signals, intent, historical) with clear weights.
- Recency multipliers on signals are correct product thinking.
- Priority mapping (hot/warm/cold) + recommendation string is good output format.

### Revenue analytics (`api/analysis.py`)
- `GET /analysis/funnel` — real stage grouping, weighted conversion rates.
- `GET /analysis/health` — CRM data quality scoring with penalty system. Useful for ops.
- `GET /analysis/forecast` — weighted pipeline with by_month, by_owner, by_stage breakdown.
- `GET /analysis/journey` — chronological timeline of deal events + signals. Correct UX.

---

## 3. WHAT IS FRAGILE

### 3.1 Auth bypass in production (CRITICAL)
Every API route imports `get_current_customer_id_dev` which returns a hardcoded UUID if no token is present. This is the *only* auth in the product right now. If deployed without swapping this dependency, **any unauthenticated user can access all data**.

Files: `api/leads.py`, `api/connections.py`, `api/alerts.py`, `api/analysis.py`, `api/chat.py`, `api/gtm.py`, `api/reports.py`, `api/cmt.py`, `api/workflows.py`

### 3.2 Unencrypted credentials
`Integration.credentials` is a JSON column stored plaintext in PostgreSQL. Clay API keys, Salesforce passwords, HubSpot tokens are all readable if the database is compromised. There is a TODO comment acknowledging this. It has not been fixed.

### 3.3 No Alembic migrations
Schema is managed via SQLAlchemy `create_all()` at startup. This is an MVP shortcut that becomes a liability the moment you have a real database with real data. There is no migration history, no rollback capability, no change tracking.

### 3.4 HubSpot creates duplicate records
`POST /connections/hubspot/sync` writes to both `salesforce_opportunities` (correct) AND `leads` (wrong). The lead record from HubSpot is not the same object as a deal. This creates confusion: the same company appears in both tables with different data, and updates to one don't reflect in the other.

### 3.5 IntegrationSyncLog is never written
The table exists and is well-designed. Zero rows will ever appear in it because no code calls `db.add(IntegrationSyncLog(...))` after a sync. The sync audit trail is completely missing despite the infrastructure being there.

### 3.6 Celery tasks are not wired
`utils/tasks.py` has stubs. `celery_app.py` is configured. The docker-compose runs celery-worker and celery-beat. But no background tasks actually execute. Sync, scoring, alert generation, and report generation are all synchronous today — blocking the request thread.

### 3.7 Analysis endpoints do expensive queries on every request
`/analysis/funnel`, `/analysis/forecast`, `/analysis/accounts` each run full table scans with aggregations on every HTTP request. No caching. On a 10k-deal database this will be visibly slow.

### 3.8 Plan vs actual is frontend math, not a backend engine
The GTM progress calculation in `GET /api/gtm/progress` exists but computes everything inline from raw opportunity data. There is no `kpi_snapshots` table, no historical comparison, no "what changed this week vs last week."

---

## 4. WHAT IS MISSING

### 4.1 Canonical account object
The product has `Lead` (from Clay) and `SalesforceOpportunity` + `SalesforceAccount` (from CRM). These are three separate tables with no relationship between them. There is no unified `Account` concept: one record representing "Acme Corp" across all sources. This is the single biggest data model gap.

**Impact:** Cannot answer "how many ICP accounts do we have in CRM?" or "which accounts have both intent signals AND open deals?" without ad-hoc JOINs that don't exist anywhere.

### 4.2 Activity data
No model for calls, emails, meetings, or tasks. `SalesforceOpportunity.last_activity_date` is a single timestamp — not structured activity data. Cannot answer "how many meetings did we hold this week?" from the database.

### 4.3 Incremental sync
Every sync pulls the full dataset. Clay sync fetches all rows. HubSpot/Salesforce sync fetches all deals. No cursor tracking, no `updated_since` filtering. On a real CRM with 5k+ deals this will hit rate limits and timeout.

### 4.4 Weekly report persistence + scheduling
`GET /reports/weekly` returns a stub. `WeeklyReport` model exists and is well-designed. No code generates or persists a weekly report. The model has been sitting empty since it was created.

### 4.5 Plan vs actual as a real system
The questions "are we on track for the year?" and "what changed this week vs last week?" require:
1. A `kpi_snapshots` table (weekly snapshots of metrics)
2. A comparison engine (current vs snapshot vs target)
3. Scheduled snapshot creation (every Monday)

None of these exist. The GTM progress endpoint computes live but doesn't persist history.

### 4.6 Multi-user per organization
Every `customer` is a single user. There is no `Organization` → `User` → `Role` hierarchy. A sales director cannot invite a rep. A rep cannot have their own login seeing only their deals.

### 4.7 Identity resolution
If "Acme Corp" comes from Clay as `acme.com` and from Salesforce as `Acme Corporation`, these are two separate records with no link. No domain normalization, no fuzzy matching, no dedup logic. The product cannot produce a unified account view.

### 4.8 Website intent
Snitcher is configured as a connector but the implementation is a stub returning an empty list. No intent data is flowing in.

### 4.9 Recommendations as persisted objects
The scoring engine produces a `recommendation` string per lead. There are no persisted `Recommendation` objects: no status tracking, no assignment to a rep, no completion tracking. Recommendations are ephemeral strings.

---

## 5. WHAT SHOULD BE REMOVED OR MOVED TO LEGACY

### Move to Legacy (keep but deprioritize)

| Feature | Reason | Path |
|---------|--------|------|
| **CMT Dashboard** (Notion) | Niche feature (one specific Notion setup), not core GTM | Legacy dropdown |
| **Outbound Queue** | All stubs, no real implementation | Legacy dropdown, rebuild later |
| **Workflows builder** | IFTTT visual builder is overengineered for current stage | Legacy dropdown |
| **Lead Intel tab** | Redundant with Pipeline → Accounts | Merge into Pipeline |
| **Old Analytics tab** | Replaced by Intelligence tab | Legacy dropdown |
| **Signals tab** | Duplicate of Alerts/Buyer Journey in Intelligence | Merge into Signals section |

### Remove from codebase

| File/Feature | Reason |
|-------------|--------|
| `api/outbound.py` | 100% stubs. Creates false impression of features. |
| `MOCK_ALERTS`, `MOCK_LEADS`, `MOCK_STATS` in App.jsx | Dangerous: masks real failures with fake data |
| `get_current_customer_id_dev` usage | Must be replaced before any real deployment |
| `snitcher.py` stub implementation | Adds noise, no function |
| Hardcoded `SUGGESTED_QUESTIONS` in `api/chat.py` | Should be dynamic based on current pipeline state |

---

## 6. WHAT MUST BE REBUILT

### 6.1 Frontend architecture
A 5,315-line single React component with 50+ `useState` calls is not maintainable. The product cannot grow without splitting this into:
- Router (React Router)
- Page-level components per primary tab
- Shared component library (cards, tables, modals, forms)
- API client with token management, retry, and error handling
- State management (Zustand per domain slice)

### 6.2 Canonical data model
The current model conflates source-specific records with canonical entities. Must rebuild as:
- `accounts` — canonical company record (source-agnostic)
- `contacts` — canonical person record
- `opportunities` — canonical deal record
- `activities` — structured call/email/meeting records
- `crm_raw_objects` — source payload retention

This is not additive — it requires migrating existing `Lead`, `SalesforceOpportunity`, `SalesforceAccount` data.

### 6.3 Sync architecture
Needs `integration_sync_states` table tracking cursor/timestamp per connector. Every sync must:
1. Load cursor from `integration_sync_states`
2. Fetch only changed records since cursor
3. Write to `crm_raw_objects` (raw retention)
4. Normalize and upsert into canonical tables
5. Update cursor
6. Write `IntegrationSyncLog` record (always, even on failure)

### 6.4 Plan vs actual engine
Must be a proper backend subsystem:
- `kpi_snapshots` table (weekly snapshots every Monday)
- Comparison endpoint: current vs last snapshot vs prorated target
- Scheduled Celery task to generate snapshots
- "Change since last week" view: delta per metric

---

## 7. NAVIGATION VERDICT

**Current nav (11+ tabs):** Chaotic. Tabs overlap in purpose (Signals vs Alerts vs Intelligence). No clear information hierarchy.

**Target nav (5 primary sections):**
1. **GTM Setup** — strategy input, goals, ICP, integrations
2. **Intelligence** — exec overview, plan vs actual, AI insights
3. **Pipeline** — accounts, opportunities, contacts
4. **Signals** — alerts, buyer journey, intent
5. **Reports** — weekly, board, history

**Legacy dropdown:** CMT, Outbound, Workflows, old Analytics, old Lead Intel

---

## 8. THE FUNDAMENTAL PRODUCT GAP

The product answers "what is happening" (deal list, funnel view, scores). It does not yet answer "why is it happening", "are we on track", or "what should we do about it."

To become a GTM Operating System it must:
1. **Know the plan** — goals, ICP, target metrics per period
2. **Know the actuals** — structured pipeline, activities, conversion rates
3. **Compute the gap** — where are we vs where we should be
4. **Explain the gap** — which bottleneck (activation? meetings? closing?)
5. **Prescribe actions** — concrete recommendations for reps and managers

Steps 1-2 exist partially. Steps 3-5 are missing.
