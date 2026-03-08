# DATABASE TARGET STATE
**Signal Intelligence — GTM Operating System**
Version: 1.0 | Date: 2026-03-08

---

## 0. DESIGN PRINCIPLES

1. **`org_id` everywhere.** Every table that holds business data has `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`. No exceptions.
2. **Canonical separation.** Raw source data is in `crm_raw_objects`. Normalized records are in canonical tables (accounts, contacts, opportunities, activities). Derived data (scores, alerts, recommendations) is in separate tables.
3. **Idempotent upserts.** Every sync table has a `(org_id, source, source_id)` UNIQUE constraint. Upsert on this triple.
4. **Append-only snapshots.** `kpi_snapshots`, `forecast_snapshots`, `weekly_reports` are never updated in-place — new rows only.
5. **Encrypted credentials.** `credentials` columns use `TEXT` (Fernet-encrypted string), never plain JSON.
6. **Raw payload retention.** `crm_raw_objects.raw_payload` retained for 90 days (configurable). Enables debugging and re-processing.
7. **Critical indexes.** Listed explicitly per table. Do not skip.

---

## 1. ORGANIZATIONS & USERS

```sql
-- Multi-tenant root
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,  -- URL-friendly, e.g. "acme-corp"
    plan            TEXT NOT NULL DEFAULT 'starter',  -- starter / pro / enterprise
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (multiple per organization)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    password_hash   TEXT,                  -- NULL if SSO only
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'member',  -- owner / admin / member / viewer
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, email)
);

-- JWT refresh tokens (persisted for revocation)
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,         -- SHA-256 of the token
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log (append-only, never updated)
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    org_id          UUID NOT NULL,
    user_id         UUID,
    action          TEXT NOT NULL,         -- "opportunity.updated", "config.saved", etc.
    entity_type     TEXT,
    entity_id       UUID,
    before_state    JSONB,
    after_state     JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

---

## 2. INTEGRATIONS & SYNC

```sql
-- One row per connected source per org
CREATE TABLE integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,         -- "salesforce" | "hubspot" | "clay" | "snitcher"
    status          TEXT NOT NULL DEFAULT 'disconnected',  -- connected / error / disconnected
    credentials     TEXT,                  -- Fernet-encrypted JSON blob (API key, OAuth tokens, etc.)
    config          JSONB,                 -- Source-specific config (table_ids for Clay, etc.)
    display_name    TEXT,                  -- e.g. "Salesforce Production"
    connected_at    TIMESTAMPTZ,
    last_sync_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, source)
);

-- Per-object-type sync cursor (enables incremental sync)
CREATE TABLE integration_sync_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    object_type     TEXT NOT NULL,         -- "opportunity" | "account" | "contact" | "activity"
    cursor          TEXT,                  -- ISO timestamp or page token or SF query locator
    last_synced_at  TIMESTAMPTZ,
    UNIQUE (integration_id, object_type)
);

-- Per-sync audit record (written on EVERY sync attempt, success or failure)
CREATE TABLE sync_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL,
    source          TEXT NOT NULL,         -- denormalized for query efficiency
    object_type     TEXT NOT NULL,
    status          TEXT NOT NULL,         -- success / partial / failed
    records_fetched INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed  INTEGER DEFAULT 0,
    error_summary   TEXT,
    errors          JSONB,                 -- [{source_id, error_message}, ...]
    duration_ms     INTEGER,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_sync_logs_integration ON sync_logs(integration_id, started_at DESC);
CREATE INDEX idx_sync_logs_org ON sync_logs(org_id, started_at DESC);
```

---

## 3. RAW SOURCE OBJECTS

```sql
-- Raw payload retention (all source records before normalization)
-- Enables re-processing, debugging, and schema changes without re-syncing
CREATE TABLE crm_raw_objects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    source          TEXT NOT NULL,         -- "salesforce" | "hubspot" | "clay"
    source_id       TEXT NOT NULL,         -- Source system's own ID
    object_type     TEXT NOT NULL,         -- "opportunity" | "account" | "contact"
    raw_payload     JSONB NOT NULL,        -- Full source API response
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 days',
    UNIQUE (org_id, source, source_id, object_type)
);

CREATE INDEX idx_raw_objects_lookup ON crm_raw_objects(org_id, source, object_type, synced_at DESC);
CREATE INDEX idx_raw_objects_expire ON crm_raw_objects(expires_at);  -- For cleanup job
```

---

## 4. CANONICAL GTM OBJECTS

```sql
-- ─────────────────────────────────────────────
-- ACCOUNTS (canonical company record)
-- ─────────────────────────────────────────────
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    name            TEXT NOT NULL,
    domain          TEXT,                  -- Normalized (no www., lowercase)

    -- Firmographics
    industry        TEXT,
    employee_count  INTEGER,
    annual_revenue  BIGINT,               -- In local currency
    headquarters    TEXT,                 -- City, Country
    technologies    TEXT[],               -- Tech stack from enrichment

    -- Source tracking (primary source)
    primary_source  TEXT,                 -- "salesforce" | "hubspot" | "clay"
    primary_source_id TEXT,

    -- ICP scoring
    icp_score       INTEGER,              -- 0-100, computed from GTMConfig.icp
    icp_tier        TEXT,                 -- A / B / C / D (A = best fit)

    -- Status
    is_customer     BOOLEAN DEFAULT false,
    lifecycle_stage TEXT,                 -- prospect / lead / opportunity / customer / churned

    last_activity_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (org_id, domain) WHERE domain IS NOT NULL
);

-- Source-to-canonical mapping (many sources → one account)
CREATE TABLE account_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL,
    source          TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    UNIQUE (org_id, source, source_id)
);

CREATE INDEX idx_accounts_org ON accounts(org_id);
CREATE INDEX idx_accounts_domain ON accounts(org_id, domain);
CREATE INDEX idx_accounts_icp ON accounts(org_id, icp_tier, icp_score DESC);
CREATE INDEX idx_accounts_industry ON accounts(org_id, industry);

-- ─────────────────────────────────────────────
-- CONTACTS (canonical person record)
-- ─────────────────────────────────────────────
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,

    -- Identity
    email           TEXT,
    full_name       TEXT,
    first_name      TEXT,
    last_name       TEXT,

    -- Role
    title           TEXT,
    department      TEXT,
    seniority       TEXT,                 -- c_level / vp / director / manager / ic

    -- Persona match
    persona_match   TEXT[],              -- Matched persona IDs from GTMConfig

    -- Source tracking
    primary_source  TEXT,
    primary_source_id TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (org_id, email) WHERE email IS NOT NULL
);

CREATE TABLE contact_sources (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL,
    source      TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    UNIQUE (org_id, source, source_id)
);

CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_org ON contacts(org_id);

-- ─────────────────────────────────────────────
-- OPPORTUNITIES (canonical deal record)
-- ─────────────────────────────────────────────
CREATE TABLE opportunities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,

    -- Identity
    name            TEXT,
    source          TEXT NOT NULL,         -- "salesforce" | "hubspot"
    source_id       TEXT NOT NULL,

    -- Deal data
    amount          NUMERIC(15, 2),
    currency        TEXT DEFAULT 'DKK',
    stage           TEXT,
    stage_normalized TEXT,                 -- Canonical: prospecting/qualification/proposal/negotiation/closed_won/closed_lost
    probability     NUMERIC(5, 2),         -- 0.00 - 1.00 (from stage or manual override)
    close_date      DATE,
    owner_name      TEXT,
    owner_source_id TEXT,                  -- Rep ID in source system

    -- Activity health
    last_activity_at TIMESTAMPTZ,
    days_since_activity INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (now() - last_activity_at))
    ) STORED,
    is_stalled      BOOLEAN GENERATED ALWAYS AS (
        last_activity_at < now() - INTERVAL '14 days'
        AND stage_normalized NOT IN ('closed_won', 'closed_lost')
    ) STORED,

    -- Risk flags
    health_score    INTEGER,               -- 0-100, computed by ScoringEngine
    risk_flags      TEXT[],                -- ["no_activity_14d", "no_close_date", "missing_amount"]

    raw_payload     JSONB,                 -- Source record snapshot

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (org_id, source, source_id)
);

CREATE INDEX idx_opps_org ON opportunities(org_id);
CREATE INDEX idx_opps_account ON opportunities(account_id);
CREATE INDEX idx_opps_stage ON opportunities(org_id, stage_normalized);
CREATE INDEX idx_opps_owner ON opportunities(org_id, owner_name);
CREATE INDEX idx_opps_close_date ON opportunities(org_id, close_date);
CREATE INDEX idx_opps_stalled ON opportunities(org_id, is_stalled) WHERE is_stalled = true;

-- ─────────────────────────────────────────────
-- ACTIVITIES (calls, emails, meetings, tasks)
-- ─────────────────────────────────────────────
CREATE TABLE activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

    source          TEXT NOT NULL,
    source_id       TEXT NOT NULL,

    activity_type   TEXT NOT NULL,         -- call / email / meeting / task / note
    subject         TEXT,
    description     TEXT,
    outcome         TEXT,                  -- completed / no_answer / left_voicemail / etc.

    owner_name      TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (org_id, source, source_id)
);

CREATE INDEX idx_activities_org ON activities(org_id, occurred_at DESC);
CREATE INDEX idx_activities_opp ON activities(opportunity_id, occurred_at DESC);
CREATE INDEX idx_activities_account ON activities(account_id, occurred_at DESC);
CREATE INDEX idx_activities_type ON activities(org_id, activity_type, occurred_at DESC);

-- ─────────────────────────────────────────────
-- SIGNALS (buying signals, intent events)
-- ─────────────────────────────────────────────
CREATE TABLE signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

    signal_type     TEXT NOT NULL,         -- funding / hiring / tech_change / intent / page_visit / content
    title           TEXT NOT NULL,
    description     TEXT,
    strength        INTEGER,               -- 1-10
    source          TEXT NOT NULL,         -- "snitcher" | "clay" | "manual"
    source_id       TEXT,

    metadata        JSONB,                 -- Signal-specific data (page_url, job_title, funding_amount, etc.)

    detected_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (org_id, source, source_id) WHERE source_id IS NOT NULL
);

CREATE INDEX idx_signals_account ON signals(account_id, detected_at DESC);
CREATE INDEX idx_signals_type ON signals(org_id, signal_type, detected_at DESC);
CREATE INDEX idx_signals_recent ON signals(org_id, detected_at DESC);
```

---

## 5. GTM CONFIGURATION

```sql
-- ─────────────────────────────────────────────
-- GTM CONFIG (strategy, ICP, goals — one row per org)
-- ─────────────────────────────────────────────
CREATE TABLE gtm_config (
    org_id          UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

    -- Strategy
    company_description     TEXT,
    value_proposition       TEXT,
    competitors             JSONB,   -- [{name, weakness, how_we_win}]
    offerings               JSONB,   -- [{name, description, price_range}]

    -- ICP
    icp                     JSONB,
    -- {
    --   industries: [str],
    --   employee_min: int,
    --   employee_max: int,
    --   geographies: [str],
    --   technologies: [str],
    --   revenue_min: int,
    --   revenue_max: int,
    --   tam_total: int,
    --   tam_notes: str
    -- }

    -- Buyer personas
    personas                JSONB,   -- [{id, title, department, seniority, pain_points, objections}]

    -- Goals
    goals                   JSONB,
    -- {
    --   period: "annual" | "quarterly",
    --   revenue_target: int,
    --   acv: int,
    --   win_rate_pct: float,
    --   opp_to_meeting_rate_pct: float,
    --   outreach_response_rate_pct: float,
    --   current_arr: int,
    --   input_mode: "absolute" | "percent",
    --   growth_pct: float
    -- }

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ACCOUNT SEGMENTS (ICP tiers, custom lists)
-- ─────────────────────────────────────────────
CREATE TABLE segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    criteria        JSONB NOT NULL,        -- Filter spec: {industries, employee_range, icp_tier_min, etc.}
    account_count   INTEGER DEFAULT 0,    -- Cached count (updated on sync)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 6. DERIVED / SCORED DATA

```sql
-- ─────────────────────────────────────────────
-- ACCOUNT SCORES (computed, refreshed on sync)
-- ─────────────────────────────────────────────
CREATE TABLE account_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    priority        TEXT NOT NULL,         -- hot / warm / cold
    components      JSONB NOT NULL,        -- {firmographic: 15, signals: 30, intent: 25, historical: 5}
    recommendation  TEXT,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id)
);

CREATE INDEX idx_account_scores_org ON account_scores(org_id, score DESC);

-- ─────────────────────────────────────────────
-- ALERTS (events requiring attention)
-- ─────────────────────────────────────────────
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Classification
    alert_type      TEXT NOT NULL,         -- stalled_deal / intent_spike / score_jump / closing_soon / icp_account_activated
    priority        TEXT NOT NULL,         -- urgent / high / medium / low
    source          TEXT,                  -- Which engine generated this

    -- Context
    entity_type     TEXT,                  -- "opportunity" | "account" | "contact"
    entity_id       UUID,
    headline        TEXT NOT NULL,
    context         JSONB,                 -- Supporting data for rendering
    recommendation  TEXT,

    -- Lifecycle
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending / snoozed / actioned / dismissed
    snoozed_until   TIMESTAMPTZ,
    actioned_at     TIMESTAMPTZ,
    dismissed_at    TIMESTAMPTZ,
    actioned_by     UUID REFERENCES users(id),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Dedup key: don't create same alert twice for same entity in same week
    dedup_key       TEXT UNIQUE            -- e.g. "stalled_deal:opp_id:2025-W10"
);

CREATE INDEX idx_alerts_org_status ON alerts(org_id, status, priority);
CREATE INDEX idx_alerts_entity ON alerts(entity_type, entity_id);
CREATE INDEX idx_alerts_created ON alerts(org_id, created_at DESC);

-- ─────────────────────────────────────────────
-- RECOMMENDATIONS (persisted, trackable)
-- ─────────────────────────────────────────────
CREATE TABLE recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Target
    entity_type     TEXT NOT NULL,         -- "opportunity" | "account" | "rep"
    entity_id       UUID,
    assigned_to     UUID REFERENCES users(id),

    -- Content
    action          TEXT NOT NULL,         -- "re-engage" | "push-or-close" | "coaching" | "activate"
    headline        TEXT NOT NULL,
    reason          TEXT NOT NULL,
    context         JSONB,

    -- Priority & lifecycle
    priority        TEXT NOT NULL,         -- urgent / high / medium / low
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending / actioned / dismissed / expired
    actioned_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,

    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_org ON recommendations(org_id, status, priority);
CREATE INDEX idx_recommendations_entity ON recommendations(entity_type, entity_id);

-- ─────────────────────────────────────────────
-- WORKFLOWS (rule-based automations)
-- ─────────────────────────────────────────────
CREATE TABLE workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'active',  -- active / paused
    trigger_type    TEXT NOT NULL,         -- daily / on_sync / on_score_change / on_alert
    conditions      JSONB NOT NULL,        -- [{field, operator, value}]
    actions         JSONB NOT NULL,        -- [{type, params}] e.g. create_alert, create_recommendation
    last_run_at     TIMESTAMPTZ,
    run_count       INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL,
    status          TEXT NOT NULL,         -- success / failed / partial
    triggered_by    TEXT,                  -- "celery_beat" | "manual" | "sync_event"
    records_processed INTEGER DEFAULT 0,
    actions_taken   INTEGER DEFAULT 0,
    error           TEXT,
    result          JSONB,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id, started_at DESC);
```

---

## 7. SNAPSHOTS & REPORTS (append-only)

```sql
-- ─────────────────────────────────────────────
-- KPI SNAPSHOTS (weekly, Monday morning)
-- ─────────────────────────────────────────────
CREATE TABLE kpi_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    period_type     TEXT NOT NULL DEFAULT 'weekly',   -- weekly / monthly / quarterly
    metrics         JSONB NOT NULL,
    -- {
    --   pipeline_total: int,          -- sum of open opportunity amounts
    --   pipeline_weighted: int,       -- weighted by stage probability
    --   won_ytd: int,                 -- closed won revenue YTD
    --   won_qtd: int,
    --   deals_open: int,
    --   deals_won_ytd: int,
    --   accounts_activated: int,      -- accounts with activity in last 30d
    --   meetings_this_week: int,
    --   new_opportunities_this_week: int,
    --   icp_coverage_pct: float,      -- % of ICP accounts with open deals
    --   avg_deal_velocity_days: float
    -- }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, snapshot_date, period_type)
);

CREATE INDEX idx_kpi_snapshots_org ON kpi_snapshots(org_id, snapshot_date DESC);

-- ─────────────────────────────────────────────
-- FORECAST SNAPSHOTS (manual user save)
-- ─────────────────────────────────────────────
CREATE TABLE forecast_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    revenue_target  NUMERIC(15, 2),       -- Context: target at time of snapshot
    months_data     JSONB NOT NULL,
    -- [{month, label, conservative, base, optimistic, count}]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_snapshots_org ON forecast_snapshots(org_id, snapshot_date DESC);

-- ─────────────────────────────────────────────
-- WEEKLY REPORTS (generated Monday, stored forever)
-- ─────────────────────────────────────────────
CREATE TABLE weekly_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    week_start      DATE NOT NULL,        -- Monday of the week
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_used      TEXT,                 -- "claude-sonnet-4-6"

    -- Input snapshot (what the model saw)
    metrics_snapshot JSONB,
    vs_last_week    JSONB,               -- Delta vs prior KPI snapshot
    vs_plan         JSONB,               -- Gap to prorated target

    -- Output narrative
    section_what_happened  TEXT,
    section_gaps           TEXT,
    section_this_week      TEXT,
    section_management     TEXT,

    -- Top recommendations at time of generation
    top_recommendations    JSONB,        -- [{action, headline, priority}]

    UNIQUE (org_id, week_start)
);

CREATE INDEX idx_weekly_reports_org ON weekly_reports(org_id, week_start DESC);

-- ─────────────────────────────────────────────
-- AI ACTIONS (audit log of AI-initiated operations)
-- ─────────────────────────────────────────────
CREATE TABLE ai_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    action_type     TEXT NOT NULL,         -- "create_recommendation" | "generate_report" | "analyze_pipeline"
    model_used      TEXT,
    input_context   JSONB,                 -- What was passed to the model
    output          JSONB,                 -- What the model returned
    tokens_used     INTEGER,
    duration_ms     INTEGER,
    status          TEXT NOT NULL,         -- success / failed
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_actions_org ON ai_actions(org_id, created_at DESC);
```

---

## 8. MIGRATION STRATEGY

### Current → Target migration path

| Current table | Action | Target table |
|--------------|--------|-------------|
| `customers` | Rename + add org hierarchy | `organizations` |
| `integrations` | Add encrypted credentials | `integrations` (updated) |
| `integration_sync_logs` | Already correct structure | `sync_logs` |
| `leads` | Migrate to canonical accounts + contacts | `accounts`, `contacts` |
| `salesforce_opportunities` | Migrate to canonical | `opportunities` |
| `salesforce_accounts` | Merge with leads data | `accounts` |
| `signals` | Keep + add account_id FK | `signals` (updated) |
| `alerts` | Minor column renames | `alerts` (updated) |
| `scoring_history` | Superseded by `account_scores` | Drop |
| `outbound_actions` | No consumers → drop | — |
| `conversion_data` | Keep for ML training future | Keep as-is |
| `chat_sessions` / `chat_messages` | Keep | Keep |
| `ai_actions` | Keep + add org_id | `ai_actions` (updated) |
| `weekly_reports` | Keep + add new columns | `weekly_reports` (updated) |
| `workflows` | Keep | Keep |
| `notion_initiatives` | Legacy | Keep in legacy |
| `gtm_config` | Expand + move to `gtm_config` | `gtm_config` (updated) |
| `forecast_snapshots` | Keep | Keep |

### Phase order for migrations (Alembic)
1. `001_create_organizations_users` — org/user/roles (rename customers)
2. `002_create_canonical_schema` — accounts, contacts, opportunities, activities, signals
3. `003_create_sync_infrastructure` — sync_states, sync_logs, raw_objects
4. `004_create_derived_tables` — account_scores, recommendations, alerts (updated)
5. `005_create_snapshot_tables` — kpi_snapshots (weekly_reports + forecast_snapshots already exist)
6. `006_migrate_existing_data` — backfill accounts from leads + salesforce_accounts
7. `007_drop_legacy_tables` — leads, salesforce_opportunities, salesforce_accounts (after verification)

### DO NOT migrate in one shot
Run 001-005 first. Keep old tables intact. Run 006 to backfill. Verify counts match. Then 007.

---

## 9. INDEXES CHECKLIST

Critical indexes that must exist before any production query load:

```sql
-- High-traffic read paths
CREATE INDEX idx_opportunities_org_stage ON opportunities(org_id, stage_normalized, close_date);
CREATE INDEX idx_accounts_icp_tier ON accounts(org_id, icp_tier, icp_score DESC);
CREATE INDEX idx_signals_account_recent ON signals(account_id, detected_at DESC);
CREATE INDEX idx_alerts_pending ON alerts(org_id, status, priority) WHERE status = 'pending';
CREATE INDEX idx_activities_type_week ON activities(org_id, activity_type, occurred_at)
    WHERE occurred_at > now() - INTERVAL '7 days';

-- Analytics aggregations
CREATE INDEX idx_opportunities_close_month ON opportunities(org_id, date_trunc('month', close_date));
CREATE INDEX idx_opportunities_won ON opportunities(org_id, close_date)
    WHERE stage_normalized = 'closed_won';

-- Sync idempotency
CREATE INDEX idx_account_sources_lookup ON account_sources(org_id, source, source_id);
CREATE INDEX idx_crm_raw_cleanup ON crm_raw_objects(expires_at) WHERE expires_at < now();
```
