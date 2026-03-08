# TARGET ARCHITECTURE
**Signal Intelligence — GTM Operating System**
Version: 1.0 | Date: 2026-03-08

---

## 1. PRODUCT INFORMATION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│  GTM Setup  │  Intelligence  │  Pipeline  │  Signals  │  Reports  │  Legacy ▾
└─────────────────────────────────────────────────────────────┘
```

### 1.1 GTM Setup
The configuration layer. Input your strategy — the system uses it for all analysis.

| Sub-section | Content |
|-------------|---------|
| Strategy | Company description, value proposition |
| Offerings | Products/services with pricing |
| Competitors | Competitor list with positioning notes |
| ICP | Industry, employee range, geography, tech stack, annual revenue range |
| Buyer Personas | Titles, departments, pain points, objections |
| TAM | Total addressable market estimate, segmentation |
| Goals | Annual/quarterly revenue, ACV, win rate, meeting conversion rate |
| Integrations | Connect CRM, enrichment, intent, email tools |

### 1.2 Intelligence
The analysis engine. Combines GTM strategy with actuals to produce decisions.

| Sub-section | Content |
|-------------|---------|
| Executive Overview | 4 KPIs (TAM coverage, ICP activation, pipeline coverage, activity pace) |
| Plan vs Actual | Revenue/deals/activities vs prorated target, gap-to-close |
| Forecast | 3-scenario pipeline forecast with accuracy tracking |
| Learnings | Win/loss patterns from CRM data |
| Management Tasks | Auto-generated actions: stalled deals, rep coaching, activation gaps |
| AI Agent | Structured Claude analysis with reasoning steps |

### 1.3 Pipeline
The CRM layer. Navigate accounts, opportunities, contacts.

| Sub-section | Content |
|-------------|---------|
| Accounts | Canonical account list with ICP match score, pipeline value, signals |
| Opportunities | Deal list with health score, stage, owner, risk flags |
| Contacts | Contact list with persona match, engagement level |

### 1.4 Signals
The intent and alert layer. What is happening right now.

| Sub-section | Content |
|-------------|---------|
| Alerts | Stalled deals, score jumps, intent spikes, pipeline risks |
| Buyer Journey | Chronological timeline per account (deals + signals + activities) |
| Website Intent | Snitcher-sourced page visits and intent signals |

### 1.5 Reports
Persisted, scheduled deliverables.

| Sub-section | Content |
|-------------|---------|
| Weekly Leadership | Auto-generated Monday report: what happened, gaps, this week's priorities |
| Board Summary | Board-level KPI snapshot (monthly) |
| Change Log | Week-over-week metric deltas |

---

## 2. BACKEND ARCHITECTURE

### 2.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer (FastAPI)                   │
│  /gtm  /intelligence  /pipeline  /signals  /reports  /sync  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Service Layer                           │
│  MetricsEngine  │  RecommendationsEngine  │  ReportEngine   │
│  ScoringEngine  │  ForecastEngine         │  AlertEngine    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Canonical Data Layer                      │
│  Account  Contact  Opportunity  Activity  Signal  Touchpoint │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Integration / Sync Layer                   │
│  ConnectorFramework  │  SyncStateStore  │  RawObjectStore   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Database (PostgreSQL)                    │
│  Raw tables  │  Canonical tables  │  Derived/snapshot tables │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Connector Framework

**Design principle:** Each connector is an adapter that translates source-specific API responses into canonical GTM objects. The framework handles auth, retry, rate-limiting, and audit logging.

```python
class BaseConnector(ABC):
    source_type: str  # "salesforce" | "hubspot" | "clay" | "snitcher"

    # Every connector must implement:
    async def test_connection(self) -> ConnectionResult
    async def fetch_since(self, object_type: str, since: datetime) -> AsyncIterator[RawObject]

    # Framework handles:
    # - exponential backoff + retry
    # - rate limit detection + sleep
    # - writing to crm_raw_objects
    # - updating integration_sync_states cursor
    # - writing IntegrationSyncLog record
```

**Sync pipeline per connector run:**
```
1. Load sync_state (last cursor/timestamp per object_type)
2. Call connector.fetch_since(object_type, cursor)
3. For each raw object:
   a. Upsert into crm_raw_objects (source, source_id, object_type, payload)
   b. Normalize into canonical table (account/contact/opportunity/activity)
   c. Apply identity resolution (domain-based dedup for accounts)
4. Update sync_state cursor
5. Write IntegrationSyncLog (always — success, partial, or failure)
```

**Supported object types per connector:**

| Connector | Object Types |
|-----------|-------------|
| Salesforce | opportunity, account, contact, activity, task |
| HubSpot | deal, company, contact, engagement |
| Clay | company (→ account), contact |
| Snitcher | page_visit (→ signal) |

### 2.3 Identity Resolution

Problem: "Acme Corp" from Clay and "Acme Corporation" from Salesforce are the same company.

**Algorithm:**
1. Extract domain from source record (website field, email domain, SF domain field)
2. Normalize domain: strip `www.`, lowercase, remove protocol
3. Upsert canonical `Account` by `(org_id, domain)` unique constraint
4. Store `source_id` in `account_sources` junction table

```
clay row → domain: acme.com → Account(domain=acme.com) id=123
SF account → domain: acme.com → Account(domain=acme.com) id=123 (same)
```

**Fallback when no domain:** Match on normalized company name (Levenshtein < 0.85). If no match, create new account with `domain=NULL` and flag for manual review.

### 2.4 Metrics Engine

**Design principle:** Separate *computation* from *storage*. Metrics are either:
- **Live** (computed on request, < 200ms): current pipeline coverage, open deal count
- **Snapshotted** (computed on schedule, stored): plan vs actual, week-over-week deltas, forecast accuracy

**Live metrics** (computed in service layer from canonical tables, no caching for MVP):
```python
class MetricsEngine:
    async def pipeline_coverage(self, org_id, period) -> float
    async def icp_activation_rate(self, org_id) -> float
    async def bottleneck_analysis(self, org_id) -> BottleneckResult
    async def deal_velocity(self, org_id, stage) -> float  # avg days in stage
```

**Snapshotted metrics** (Celery task, every Monday 06:00):
```python
async def snapshot_weekly_kpis(org_id: UUID):
    metrics = await MetricsEngine.compute_all(org_id)
    await db.execute(insert(KpiSnapshot).values(
        org_id=org_id,
        snapshot_date=today(),
        period_type="weekly",
        metrics=metrics.dict()
    ))
```

**Comparison logic** (plan vs actual endpoint):
```
gap_analysis = {
    "revenue": {
        "target": prorated_target(annual_goal, elapsed_pct),
        "actual": won_ytd,
        "gap": prorated_target - won_ytd,
        "on_track": won_ytd >= prorated_target * 0.9
    },
    "vs_last_week": current_metrics - last_kpi_snapshot
}
```

### 2.5 Recommendations Engine

**Design principle:** Rule-based first, LLM-enhanced second. Rules run fast and are explainable. LLM adds reasoning and prioritization.

**Rule types:**
```python
RECOMMENDATION_RULES = [
    # Rep-level
    Rule(
        condition=lambda opp: opp.days_since_activity > 14 and opp.stage not in CLOSED_STAGES,
        action="re-engage",
        message=f"[AccountName] har ikke haft aktivitet i {days} dage. Ryk eller luk.",
        priority="urgent"
    ),
    Rule(
        condition=lambda opp: opp.close_date < today() + 14d and opp.last_activity > 7d,
        action="push-or-close",
        message=f"[AccountName] lukker om {days} dage med ingen aktivitet. Prioritér i dag.",
        priority="urgent"
    ),
    # Manager-level
    Rule(
        condition=lambda rep: rep.win_rate_30d < org.avg_win_rate * 0.6,
        action="coaching",
        message=f"{rep.name} vinder {rep.win_rate}% vs team {org.avg_win_rate}%. Book coaching-session.",
        priority="high"
    ),
]
```

**Output:** Persisted `Recommendation` objects (not ephemeral strings). Status: pending → actioned/dismissed.

### 2.6 Report Engine

**Weekly report flow:**
```
Every Monday 07:00 (Celery beat):
1. MetricsEngine.compute_all(org_id)
2. KpiEngine.compare_to_previous_week(org_id)
3. ForecastEngine.compute(org_id)
4. RecommendationEngine.top_10(org_id)
5. Claude(system=REPORT_PROMPT, context=above_data) → narrative sections
6. Persist to WeeklyReport table
7. Optional: POST to Slack webhook
```

**Report structure:**
```json
{
  "week_start": "2025-03-03",
  "metrics_snapshot": { "pipeline": 2400000, "won_ytd": 320000, ... },
  "vs_last_week": { "pipeline_delta": +150000, "new_deals": 3, ... },
  "vs_plan": { "revenue_gap": -80000, "on_track": false },
  "top_recommendations": [...],
  "narrative": {
    "what_happened": "...",
    "gaps": "...",
    "this_week": "..."
  }
}
```

### 2.7 Scoring Engine

Keep the existing `ml/scorer.py` structure but make it data-driven:

```python
class ScoringConfig:
    # Stored in GTMConfig, not hardcoded
    icp_industries: list[str]
    icp_employee_min: int
    icp_employee_max: int
    signal_weights: dict[str, float]  # Per signal type
    firmographic_weight: float = 0.20
    signal_weight: float = 0.40
    intent_weight: float = 0.30
    historical_weight: float = 0.10
```

Score is computed from `ScoringConfig` loaded from the org's `GTMConfig`. This means:
- Score changes when ICP definition changes (requires re-scoring all accounts)
- Score is deterministic given the same config and signals

### 2.8 Workflow Engine

Simplified from current "IFTTT builder":

```python
BUILT_IN_WORKFLOWS = [
    "stalled_deal_alert":    trigger=daily,  condition=days_no_activity>14
    "closing_soon_alert":    trigger=daily,  condition=close_date<14d AND no_activity>7d
    "new_icp_account":       trigger=on_sync, condition=icp_match_score>80 AND no_open_deal
    "score_jump_alert":      trigger=on_score, condition=score_delta>20
]
```

Custom workflows (P1): simple condition → action builder (not visual). Store in `Workflow` table as JSON.

### 2.9 Security Architecture

| Layer | Target State |
|-------|-------------|
| **Authentication** | JWT (access 15min, refresh 7d). `get_current_customer_id` used in ALL routes (no dev bypass). |
| **Authorization** | `org_id` scoped at DB query level. All queries include `WHERE org_id = $1`. |
| **Credentials** | `Integration.credentials` encrypted at rest using Fernet (symmetric). Key stored in env var, not DB. |
| **CORS** | Explicit allowlist: `[FRONTEND_URL]`. No wildcard. |
| **Rate limiting** | SlowAPI middleware: 100 req/min per IP. Auth endpoints: 10 req/min. |
| **Audit logging** | All write operations log to `audit_log` table: who, what, when, before/after. |
| **Secrets** | `SECRET_KEY` from env var only. No defaults in code. Fail-fast if missing. |

### 2.10 Application Code vs Derived Tables vs Snapshots

| Type | Storage | When |
|------|---------|------|
| Live CRM data | Canonical tables (accounts, opportunities) | Updated on every sync |
| Raw source payloads | `crm_raw_objects` | Retained for 90 days, then archived |
| Computed scores | `account_scores`, `opportunity_scores` | Recomputed on sync + on config change |
| KPI snapshots | `kpi_snapshots` | Weekly Celery task |
| Forecast snapshots | `forecast_snapshots` | Manual (user clicks "Gem Snapshot") |
| Weekly reports | `weekly_reports` | Monday Celery task |
| Recommendations | `recommendations` | Daily Celery task; tracked to completion |
| Alerts | `alerts` | Created by AlertEngine; lifecycle: pending → actioned/dismissed |

**Rule:** If a metric takes > 100ms to compute and is needed on page load → snapshot it. If it's needed in real-time and is cheap → compute live.

---

## 3. FRONTEND ARCHITECTURE

### 3.1 Component Structure (Target)

```
src/
├── main.jsx
├── router.jsx              # React Router setup
├── api/
│   ├── client.js           # Axios instance with interceptors + token refresh
│   ├── gtm.js              # GTM Setup API calls
│   ├── intelligence.js     # Intelligence API calls
│   ├── pipeline.js         # Pipeline API calls
│   ├── signals.js          # Signals API calls
│   └── reports.js          # Reports API calls
├── store/
│   ├── auth.js             # Zustand: user, token, refresh
│   ├── pipeline.js         # Zustand: accounts, opportunities
│   └── intelligence.js     # Zustand: metrics, forecast, learnings
├── pages/
│   ├── GtmSetup/
│   │   ├── index.jsx
│   │   ├── StrategyForm.jsx
│   │   ├── IcpForm.jsx
│   │   ├── GoalsForm.jsx
│   │   └── Integrations.jsx
│   ├── Intelligence/
│   │   ├── index.jsx
│   │   ├── ExecutiveOverview.jsx
│   │   ├── PlanVsActual.jsx
│   │   ├── Forecast.jsx
│   │   ├── Learnings.jsx
│   │   ├── ManagementTasks.jsx
│   │   └── AiAgent.jsx
│   ├── Pipeline/
│   │   ├── index.jsx
│   │   ├── AccountsTable.jsx
│   │   ├── OpportunitiesTable.jsx
│   │   └── ContactsTable.jsx
│   ├── Signals/
│   │   ├── index.jsx
│   │   ├── AlertsFeed.jsx
│   │   ├── BuyerJourney.jsx
│   │   └── WebsiteIntent.jsx
│   └── Reports/
│       ├── index.jsx
│       ├── WeeklyReport.jsx
│       └── ChangeLog.jsx
└── components/
    ├── KpiCard.jsx
    ├── ProgressBar.jsx
    ├── DataTable.jsx
    ├── StatusBadge.jsx
    └── ...
```

### 3.2 API Client (Target)

```javascript
// api/client.js
import axios from 'axios';
import { useAuthStore } from '../store/auth';

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Auto-attach token
client.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
client.interceptors.response.use(null, async error => {
  if (error.response?.status === 401) {
    const newToken = await useAuthStore.getState().refresh();
    error.config.headers.Authorization = `Bearer ${newToken}`;
    return client.request(error.config);
  }
  throw error;
});
```

No more hardcoded MOCK_* fallback data. Errors surface to the user with proper error states.
