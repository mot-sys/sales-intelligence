# LEGACY CLEANUP PLAN
**Signal Intelligence — GTM Operating System**
Version: 1.0 | Date: 2026-03-08

---

## PHILOSOPHY

The goal is not to delete everything — it is to stop presenting low-value surfaces as primary product. Legacy means "it works, but it's not what we're selling." Users can find it if they need it. It doesn't clutter the nav.

**Three tiers:**
- **Remove** — Delete from codebase. No value, or actively harmful.
- **Legacy** — Move to `Legacy ▾` dropdown in nav. Keep code, deprioritize completely.
- **Merge** — Fold into a primary surface (no separate tab needed).

---

## TIER 1: REMOVE FROM CODEBASE

These should be deleted in the next sprint, not moved — they create confusion or risk.

### 1.1 `api/outbound.py` — Delete

**Why remove:** Every endpoint is a stub with a TODO comment. The feature does not exist.

```python
# Current state — every endpoint
@router.get("/queue")
async def get_outbound_queue(...):
    # TODO: Query leads with score >= min_score
    return {"queue": [], "total": 0, "message": "Coming soon - outbound queue"}
```

If a user or developer reads the code, they see a feature that doesn't exist. If a customer finds the endpoint, they get empty data. There is no upside to keeping this.

**Action:** `git rm backend/app/api/outbound.py`. Remove the router from `main.py`. Remove the outbound tab from the frontend nav.

**Replace with:** P1.5 (Recommendations as persisted objects) covers the intent of this feature, done properly.

---

### 1.2 Mock data constants in `frontend/src/App.jsx` — Delete

**Why remove:** When the API fails, users see fabricated alerts and leads. This masks real problems and erodes trust.

```javascript
// Current — remove all of these
const MOCK_ALERTS = [...];
const MOCK_STATS = {...};
const MOCK_LEADS = [...];
```

**Action:** Delete these constants. Replace all usage with proper empty states:

```jsx
// Instead of falling back to MOCK_ALERTS
if (!alerts.length && !alertsLoading) {
  return <EmptyState message="Ingen alerts — connect din CRM for at komme i gang" />;
}
```

---

### 1.3 `get_current_customer_id_dev` usage — Delete from all routes

**Why remove:** This is a production security bypass disguised as a development convenience.

```python
# Current — in every API file
from app.core.security import get_current_customer_id_dev as get_current_customer_id
```

**Action:** Replace all imports with:
```python
from app.core.security import get_current_customer_id
```

Keep `get_current_customer_id_dev` defined in `security.py` with a `ENVIRONMENT=development` guard — but never import it in route files.

---

### 1.4 `GET /connections/hubspot/owners-debug` — Delete

**Why remove:** A debug endpoint that dumps raw API responses. Should never have been a registered route.

**Action:** Delete from `api/connections.py`. If debugging is needed, use logging.

---

### 1.5 `components/ui/globe-demo.jsx` — Delete

**Why remove:** An interactive 3D globe that is not used anywhere in the product. Pure UI demo.

**Action:** `git rm frontend/src/components/ui/globe-demo.jsx`.

---

### 1.6 Hardcoded `SUGGESTED_QUESTIONS` in `api/chat.py` — Replace

**Why remove:** Nine static question strings that don't reflect actual pipeline state. A user with no open deals sees "Why are our Q3 deals stalling?" — which is irrelevant.

**Action:** Replace `GET /chat/suggested` with a dynamic endpoint that generates 4-5 questions from current pipeline context:
```python
# Generate contextually relevant questions
context = await build_pipeline_context(db, org_id)
questions = generate_relevant_questions(context)  # Rule-based, not LLM
```

---

## TIER 2: MOVE TO LEGACY DROPDOWN

These features work. Keep the code. Move them out of primary nav into `Legacy ▾`.

### 2.1 CMT Dashboard (Notion)

**Current:** Primary tab "CMT" → `api/cmt.py` → reads `NotionInitiative` records synced from Notion.

**Why legacy:** This is a niche feature built for one specific Notion setup. It requires:
1. A Notion integration configured
2. Specific database structure in Notion
3. Manual sync clicks

It's not a core GTM OS feature. A `C-level management team` dashboard driven by Notion is not something most customers will have or want.

**Action:**
- Remove `CMT` from primary tab list
- Add to `Legacy ▾` dropdown
- Keep all code: `api/cmt.py`, `NotionInitiative` model, Notion integration

---

### 2.2 Workflows Builder

**Current:** Primary+ tab → `api/workflows.py` → CRUD for `Workflow` records with condition/action JSON.

**Why legacy:** The visual IFTTT builder is complex to use and has low adoption potential at this stage. 80% of automation value comes from 5 built-in rules (stalled deals, score jumps, etc.) which should be hardcoded in the Recommendations engine, not user-configurable.

The infrastructure (Workflow + WorkflowRun models, condition evaluation) is worth keeping — but it's not a primary surface.

**Action:**
- Remove `Workflows` from primary/secondary nav
- Add to `Legacy ▾` dropdown
- Keep all code intact for P2 revival

---

### 2.3 Old Analytics Tab

**Current:** `activeTab === 'analytics'` → 4 sub-views (forecast, funnel, health, accounts).

**Why legacy:** The Intelligence tab now covers forecast, plan vs actual, and accounts. The Analytics tab is redundant. `GET /analysis/funnel` and `GET /analysis/health` are still useful but should be embedded in Intelligence sub-tabs, not a standalone tab.

**Action:**
- Remove standalone Analytics tab from primary nav
- Embed Funnel view in Pipeline → Opportunities
- Embed Health score in Intelligence → Executive Overview
- Move full Analytics tab to `Legacy ▾` (so power users can still reach it directly)

---

### 2.4 Standalone Lead Intel Tab

**Current:** `activeTab === 'leads'` → leads table with scoring.

**Why legacy:** The canonical account object (P1.1) subsumes this. Leads that score highly are Accounts in the pipeline. There's no reason for a separate "Lead Intel" surface once Pipeline → Accounts exists.

**Action:**
- Remove Lead Intel as a primary tab
- Add to `Legacy ▾` as "Lead Scoring" for backward compatibility
- Keep all code: `api/leads.py`, scoring engine

---

### 2.5 Standalone Signals Tab

**Current:** `activeTab === 'signals'` → separate from Alerts and Intelligence.

**Why legacy:** The Signals tab duplicates the Alerts feed and the buyer journey timeline. Both of those live in the Intelligence / Signals primary section. Having a third place for signals creates confusion.

**Action:**
- Remove standalone Signals tab
- Ensure Alerts and Buyer Journey tabs in the Signals primary section cover the content
- Add old Signals tab to `Legacy ▾`

---

## TIER 3: MERGE INTO PRIMARY SURFACES

These don't need separate tabs — they belong inside existing primary sections.

### 3.1 Pipeline data viewer

**Current:** `activeTab === 'data'` → pipeline deals/leads toggle.

**Target:** Merge into Pipeline → Opportunities (same data, better context).

### 3.2 Buyer Journey

**Current:** Buried in `activeTab === 'intelligence'` as a sub-tab.

**Target:** Surface in Signals primary tab as a first-class sub-section (already planned).

### 3.3 Attribution view

**Current:** `activeTab === 'analytics'` → attribution sub-view.

**Target:** Move to Intelligence → Learnings as "What channels are producing wins?"

---

## IMPLEMENTATION PLAN

### Sprint 1: Remove (safe deletions, no regressions)
- [ ] Delete `api/outbound.py` + remove from `main.py`
- [ ] Remove outbound tab from frontend nav
- [ ] Delete `MOCK_ALERTS`, `MOCK_LEADS`, `MOCK_STATS` from App.jsx
- [ ] Delete `/connections/hubspot/owners-debug` endpoint
- [ ] Delete `components/ui/globe-demo.jsx`
- [ ] Replace hardcoded `SUGGESTED_QUESTIONS` with dynamic endpoint

### Sprint 2: Auth cleanup (security)
- [ ] Replace all `get_current_customer_id_dev` imports in route files
- [ ] Guard `get_current_customer_id_dev` behind `ENVIRONMENT=development` check
- [ ] Add startup validation: fail if `SECRET_KEY` is the placeholder string

### Sprint 3: Nav cleanup (UX)
- [ ] Add `Legacy ▾` dropdown to frontend nav
- [ ] Move CMT, Workflows, old Analytics, Lead Intel, Signals into dropdown
- [ ] Remove these from primary tab list
- [ ] Merge Pipeline data viewer into Pipeline → Opportunities
- [ ] Merge Attribution into Intelligence → Learnings

### Sprint 4: Dead code cleanup
- [ ] Delete `TanStack React Query` from package.json (installed but not used)
- [ ] Delete `Zustand` from package.json (installed but not used — until P1.10)
- [ ] Delete `Axios` from package.json (installed but not used)
- [ ] Remove unused state variables from App.jsx (count: ~15 that reference removed features)
- [ ] Remove `outbound_actions` table from models.py (no code writes to it)
- [ ] Remove `scoring_history` table (superseded by `account_scores` in target schema)

---

## WHAT TO KEEP EXACTLY AS-IS

Don't touch these — they work and provide real value:

| File | Reason to keep |
|------|---------------|
| `api/auth.py` | Works correctly. Only change: add rate limiting. |
| `api/alerts.py` | Real data, good query patterns. Keep. |
| `api/analysis.py` | Best analytics code in the codebase. Keep all 6 endpoints. |
| `api/chat.py` | Keep. Needs streaming + session persistence (P2), but functional now. |
| `api/leads.py` | Keep until P1.1 canonical accounts replaces it. |
| `ml/scorer.py` | Keep. Make it data-driven (use GTMConfig.icp) in P1.2. |
| `integrations/base.py` | Keep. Good abstraction. |
| `integrations/clay.py` | Keep. Only thing that needs incremental sync added. |
| `integrations/hubspot.py` | Keep. Fix dedup issue (writing to both leads + opportunities tables). |
| `core/ai.py` | Keep. `build_pipeline_context()` is reused well across endpoints. |
| `core/alerts.py` | Keep. Alert generation logic is solid. |
| `db/crud.py` | Keep. Well-structured async data access. Add new functions, don't rewrite. |
| `db/session.py` | Keep exactly as-is. |

---

## RISK LOG

| Action | Risk | Mitigation |
|--------|------|------------|
| Remove `get_current_customer_id_dev` | Breaks all dev testing | Keep behind ENVIRONMENT guard; update dev setup docs |
| Remove mock data fallbacks | Frontend shows empty states where data was fake-populated | Ship proper empty state components first |
| Move CMT to Legacy | Notion users lose prominent access | Communicate change; CMT still accessible in dropdown |
| Delete outbound.py | Removes a nav item users may have bookmarked | Frontend nav cleanup handles this gracefully |
| Merge Analytics into Intelligence | Power users used to Analytics tab path | 30-day overlap: Analytics tab still accessible in Legacy while Intelligence matures |
