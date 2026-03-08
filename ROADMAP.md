# ROADMAP
**Signal Intelligence — GTM Operating System**
Version: 1.0 | Date: 2026-03-08

---

## PRIORITY FRAMEWORK

- **P0** — Must exist before the product is credible for a paying customer. Blocking.
- **P1** — Core differentiators. What makes this a GTM OS and not just a dashboard.
- **P2** — Valuable extensions. Ship when P0 + P1 are solid and users are asking.
- **Cut** — Should not exist in the product. Remove or stub.
- **Legacy** — Technically works but not a priority surface. Move to dropdown.

---

## P0 — FOUNDATIONS (must have before any real customer)

### P0.1 Fix authentication in all API routes
**Current:** Every route uses `get_current_customer_id_dev` (returns hardcoded UUID if no token).
**Target:** All routes use `get_current_customer_id`. Fail with 401 if no valid JWT.
**Files:** `api/leads.py`, `api/connections.py`, `api/alerts.py`, `api/analysis.py`, `api/chat.py`, `api/gtm.py`, `api/reports.py`, `api/cmt.py`, `api/workflows.py`
**Effort:** 2 hours

### P0.2 Encrypt integration credentials
**Current:** `Integration.credentials` is plain JSON with API keys, OAuth tokens, passwords.
**Target:** Fernet symmetric encryption. Key from env var. Decrypt on read, encrypt on write.
**Effort:** 4 hours

### P0.3 Alembic migration history
**Current:** Schema managed by SQLAlchemy `create_all()`. No migration history.
**Target:** Alembic configured, initial migration auto-generated from current models, applied.
**Effort:** 3 hours

### P0.4 Write IntegrationSyncLog on every sync
**Current:** Table exists, zero rows ever written.
**Target:** Every sync attempt (success or failure) writes a `SyncLog` row with records_fetched, records_created, records_updated, records_failed, duration_ms, errors.
**Effort:** 3 hours

### P0.5 Incremental sync (cursor-based)
**Current:** Every sync fetches full dataset (Clay: all rows, HubSpot: all deals, SF: all opps).
**Target:** `integration_sync_states` table. Each sync loads cursor → fetches only records changed since cursor → saves new cursor.
**Impact:** Without this, a 5k-deal Salesforce org will timeout every sync within weeks.
**Effort:** 1 day per connector (Clay, HubSpot, Salesforce)

### P0.6 Fix CORS and SECRET_KEY defaults
**Current:** `CORS_ORIGINS = ["*"]`, `SECRET_KEY = "your-secret-key-change-in-production"`.
**Target:** CORS restricted to `FRONTEND_URL` env var. SECRET_KEY validated at startup — fail fast if it's the placeholder.
**Effort:** 1 hour

### P0.7 Plan vs actual as a real backend system
**Current:** GTM progress computed inline from raw opp data. No history.
**Target:**
1. `kpi_snapshots` table (weekly, Mondays)
2. `GET /intelligence/plan-vs-actual` compares current state vs prorated target vs last week's snapshot
3. Celery beat task: every Monday 06:00, snapshot all metrics for all orgs
**Effort:** 1 day

### P0.8 Weekly report persistence
**Current:** `GET /reports/weekly` is a stub. `WeeklyReport` model exists with zero rows.
**Target:**
1. Celery task every Monday 07:00: compute metrics → call Claude → persist to `weekly_reports`
2. `GET /reports/weekly` returns the latest persisted report (no on-demand generation)
3. Report list endpoint: returns last 12 weeks
**Effort:** 1 day

### P0.9 Remove all mock data fallbacks from frontend
**Current:** `MOCK_ALERTS`, `MOCK_LEADS`, `MOCK_STATS` used as fallback when API fails. Users see fake data.
**Target:** Remove all mocks. Show proper empty state and error messages when API fails.
**Effort:** 3 hours

### P0.10 Remove dev-only code paths from production build
**Current:** Dev auth bypass, debug endpoints (`/connections/hubspot/owners-debug`), verbose error traces.
**Target:** All dev bypasses behind `ENVIRONMENT=development` guard. Production never exposes traces.
**Effort:** 2 hours

---

## P1 — DIFFERENTIATORS (what makes this a GTM OS)

### P1.1 Canonical account model
**Why:** Cannot answer "how many ICP accounts do we have in CRM?" without a unified Account object.
**What:** Migrate `Lead` + `SalesforceAccount` → canonical `accounts` table with `account_sources` junction. Domain-based dedup.
**Effort:** 2 days

### P1.2 ICP account scoring on every account
**Why:** Core to GTM OS — "are we talking to the right companies?"
**What:** On every sync, compute `icp_score` (0-100) for every Account based on GTMConfig.icp criteria. Write to `account_scores`. Surface as `icp_tier` (A/B/C/D).
**Effort:** 1 day

### P1.3 Opportunity health scoring
**Why:** Current scoring is on Leads. Deals need their own health score.
**What:** Per-opportunity health score: days_since_activity, close_date proximity, stage probability, activity count. Risk flags: no_activity_14d, no_close_date, missing_amount, stalled. Persist to `opportunity_scores`.
**Effort:** 1 day

### P1.4 Bottleneck analysis
**Why:** The most important question: "where is the problem in our funnel?"
**What:** `GET /intelligence/bottleneck` computes:
- ICP accounts in CRM vs TAM estimate → TAM coverage %
- Accounts with open deals / active accounts → activation rate
- Deal-to-meeting conversion
- Stage conversion rates (where are deals dying?)
- Activity pace (meetings this week vs weekly target)
Identifies which metric is furthest below target → names the bottleneck.
**Effort:** 1 day

### P1.5 Recommendations as persisted objects
**Why:** Today's recommendations are ephemeral strings. No tracking, no assignment, no completion.
**What:** `recommendations` table. Recs generated daily by rule engine (stalled deals, closing soon, rep coaching). Status lifecycle: pending → actioned/dismissed/expired. Reps see "your action items" not an alert feed.
**Effort:** 1 day

### P1.6 Activity data sync
**Why:** Cannot answer "how many meetings did we hold this week?" without structured activity data.
**What:** Add `activities` table. Sync calls/emails/meetings from HubSpot (engagements API) and Salesforce (Task/Event objects). Show in plan vs actual: "3 meetings held vs 5 target."
**Effort:** 2 days per connector

### P1.7 Change-since-last-week view
**Why:** "What changed this week?" is the first question in every Monday meeting.
**What:** `GET /reports/changelog` returns current KPI snapshot vs last week's snapshot with delta per metric. Delta includes: new deals created, deals moved forward, deals stalled, revenue won, meetings held.
**Effort:** 4 hours (depends on P0.7 being done)

### P1.8 Management tasks as computed output
**Why:** Leadership needs a concrete action list, not just charts.
**What:** `GET /intelligence/management-tasks` returns prioritized action list:
- Stalled deals by rep (rep needs to close or kill)
- Closing soon with no activity (push or accept loss)
- Reps below target win rate (coaching needed)
- ICP accounts with no active deal (activate)
- Coverage gap alerts (not enough pipeline to hit target)
(This already partially exists — needs to be refactored from gtm.py into a proper service)
**Effort:** 4 hours

### P1.9 Forecast accuracy loop
**Why:** The point of forecasting is to get better at it. Without accuracy tracking, forecasts are noise.
**What:** Already partially built (ForecastSnapshot table + endpoints). Complete the loop:
1. Auto-save a snapshot every Monday (same Celery task as P0.7)
2. Accuracy view: for each closed month, show forecast vs actual, compute MAE and bias
3. Trend: "your forecasts have improved from 28% error to 11% error over 6 months"
**Effort:** 4 hours (depends on P0.7)

### P1.10 Frontend split into components
**Why:** 5,315-line single App.jsx cannot be maintained or extended.
**What:** Split into page-level components. Add React Router. Add Axios API client with token refresh. Eliminate MOCK_* fallbacks. Zustand for auth state.
**Effort:** 3-4 days (parallel to backend P0 work)

---

## P2 — LATER / OPTIONAL

### P2.1 Multi-user per organization
**What:** Organizations → Users → Roles (owner/admin/member/viewer). Invite by email. Each user sees same data but has different action permissions.
**Effort:** 2-3 days (schema + auth + invite flow)

### P2.2 Webhook handlers for real-time sync
**What:** Salesforce CDC webhooks → incremental opp updates without polling. HubSpot webhooks → deal stage changes. Snitcher webhooks → intent signals.
**Effort:** 1 day per source (requires incoming webhook endpoint + validation + queue)

### P2.3 Snitcher website intent integration
**What:** Full Snitcher sync: company visits → signals. Intent scoring boost for accounts visiting pricing/demo pages.
**Effort:** 1 day (once Snitcher API access exists)

### P2.4 Board summary (monthly, PDF export)
**What:** Monthly board-level snapshot: pipeline vs target, win rate, TAM coverage, key wins/losses. Exportable as PDF.
**Effort:** 2 days

### P2.5 Slack notifications
**What:** Alert webhook to Slack channel. Weekly report summary in Slack. Configurable per alert type.
**Effort:** 1 day

### P2.6 AI chat with tool execution
**What:** AI advisor can actually create tasks in Salesforce/HubSpot, add to sequences, etc. Currently it can only suggest.
**Effort:** 2-3 days per tool

### P2.7 ML training on ConversionData
**What:** Use `conversion_data` table to train a model on signal → outcome. Replace hardcoded signal weights with learned weights.
**Effort:** 1-2 weeks (requires 500+ labelled outcomes)

### P2.8 Custom alert rules (visual builder)
**What:** Let users create their own triggers: "alert me when any deal over 100k goes 21 days without activity."
**Effort:** 2 days

### P2.9 Row-level security in PostgreSQL
**What:** Backup enforcement of multi-tenancy via PostgreSQL RLS policies. Defense in depth.
**Effort:** 1 day

### P2.10 Email delivery of weekly report
**What:** Weekly report emailed to org owner every Monday 08:00 (Resend or SendGrid).
**Effort:** 4 hours

---

## WHAT SHOULD BE CUT

| Feature | Current state | Decision | Reason |
|---------|--------------|----------|--------|
| `api/outbound.py` | 100% stubs | **Remove** | Zero implementation. Misleading. Rebuild properly as P1.5 (recommendations). |
| `MOCK_ALERTS`, `MOCK_LEADS`, `MOCK_STATS` | Frontend fallback | **Remove** | Dangerous. Users see fake data when API is broken. |
| `get_current_customer_id_dev` | Used everywhere | **Remove** | Must be gone before any real deployment. |
| `snitcher.py` stub | Returns empty list | **Remove from active connectors** | Leave as stub but don't show in UI until built. |
| `/connections/hubspot/owners-debug` | Debug endpoint | **Remove** | Internal only, should never have been a real route. |
| Hardcoded `SUGGESTED_QUESTIONS` | Chat tab | **Replace** | Should be dynamic based on current pipeline state, not hardcoded strings. |

---

## WHAT SHOULD STAY BUT MOVE TO LEGACY

| Feature | Current state | Decision |
|---------|--------------|----------|
| CMT Dashboard (Notion) | Works | Move to Legacy dropdown — useful niche feature, not core |
| Workflows builder | Works | Move to Legacy — overengineered for current stage |
| Old Analytics tab | Partially redundant with Intelligence | Move to Legacy |
| Lead Intel tab | Redundant with Pipeline → Accounts | Move to Legacy |
| Outbound tab | After removing outbound.py stubs | Remove entirely |

---

## WHAT IS OVERBUILT

| Feature | Issue |
|---------|-------|
| Workflow builder (IFTTT) | Visual condition/action builder is complex infrastructure for a feature no customer has requested. 80% of value comes from 5 hardcoded rules. |
| 4-component lead scoring with historical bucket | Historical weight is always 0. The model is sophisticated but there's no training data to make it better. Simplify until you have data. |
| Clay integration full table sync | Clay fetches ALL rows every sync. For a 100k-row Clay database this is expensive. Ship incremental before promoting Clay as a primary connector. |
| Globe visualization component | 3D spinning globe (`components/ui/globe-demo.jsx`) used nowhere visible. Pure UI demo, not product. |

---

## WHAT IS MISSING BUT ESSENTIAL

| Missing | Why essential |
|---------|--------------|
| Activity data (calls/emails/meetings) | Cannot measure rep productivity without it. "Meetings held this week" is one of the 7 core KPIs. |
| Canonical account object | Every important analytics question requires a unified account view. Currently impossible across 3 tables. |
| `kpi_snapshots` weekly history | Cannot show change-since-last-week, trend charts, or week-over-week acceleration. |
| Alembic migrations | Cannot safely evolve the schema in production with real data. |
| Report scheduling | The weekly report must be automatic. A report that needs to be manually triggered is not a report — it's a dashboard. |
| Persisted recommendations | Ephemeral recommendation strings are not actionable. Need to track completion. |

---

## IMPLEMENTATION ORDER (RECOMMENDED)

```
Week 1:  P0.1 (auth), P0.6 (CORS/secrets), P0.3 (Alembic), P0.9 (remove mocks)
Week 2:  P0.2 (encrypt creds), P0.4 (sync logs), P0.5 (incremental sync)
Week 3:  P0.7 (plan vs actual), P0.8 (weekly reports), P0.10 (dev cleanup)
Week 4:  P1.1 (canonical accounts), P1.2 (ICP scoring)
Week 5:  P1.3 (opp health), P1.4 (bottleneck analysis), P1.5 (recommendations)
Week 6:  P1.6 (activity sync), P1.7 (change log), P1.8 (management tasks)
Week 7:  P1.9 (forecast accuracy), P1.10 (frontend split)
Week 8:  Testing, hardening, first paying customer
```

P2 items are for the roadmap backlog — ship when the P0+P1 foundation is solid.
