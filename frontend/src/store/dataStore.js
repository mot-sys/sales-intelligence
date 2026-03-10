/**
 * Data store — Zustand
 *
 * Centralises all server-state that App.jsx previously kept in local useState.
 * UI-only state (active tabs, modals, form inputs) stays in App.jsx / page components.
 *
 * Sections:
 *   alerts        — alert list + stats
 *   leads         — lead list
 *   connections   — integrations + sync
 *   chat          — messages, context, AI settings
 *   pipeline      — pipeline data (deals + leads snapshot)
 *   analytics     — forecast, funnel, health, accounts
 *   weeklyReport  — weekly report
 *   cmt           — CMT dashboard overview + departments
 *   workflows     — workflow list
 *   journey       — buyer journey accounts + detail
 *   attribution   — attribution data
 *   gtm           — GTM config + progress
 *   intelligence  — intelligence overview
 *   dailyReport   — daily scorekort
 *   forecast      — monthly forecast + snapshot history
 *   learnings     — win/loss learnings
 *   mgmtTasks     — management action list
 *   agent         — GTM AI agent run result
 */

import { create } from 'zustand';
import { get, post, put, del } from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Initial state shape (makes resets easy)
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL = {
  // ── Alerts ──────────────────────────────────────────────────────────────
  alerts: [],
  alertStats: { pending: 0, snoozed: 0, dismissed: 0, actioned: 0, urgent_high_pending: 0 },
  alertsLoading: false,
  alertsError: null,
  actioningId: null,

  // ── Leads ────────────────────────────────────────────────────────────────
  leads: [],
  leadsLoading: false,

  // ── Connections ──────────────────────────────────────────────────────────
  connections: [],
  connectionsLoading: false,
  syncingId: null,
  syncResult: {},          // { [integrationId]: { ok: bool, msg: string } | null }

  // ── Chat ─────────────────────────────────────────────────────────────────
  chatMessages: [],
  chatContext: null,
  suggestedQuestions: [],
  aiSettings: null,
  chatLoading: false,

  // ── Pipeline ─────────────────────────────────────────────────────────────
  pipelineData: null,
  pipelineLoading: false,

  // ── Analytics ────────────────────────────────────────────────────────────
  analyticsData: null,        // { forecast, funnel, health, accounts }
  analyticsLoading: false,
  analyticsError: null,

  // ── Weekly Report ─────────────────────────────────────────────────────────
  weeklyReport: null,
  weeklyReportLoading: false,
  weeklyReportGenerating: false,
  weeklyReportError: null,

  // ── CMT ──────────────────────────────────────────────────────────────────
  cmtOverview: null,
  cmtDepartments: [],
  cmtLoading: false,
  cmtError: null,
  cmtSyncing: false,
  cmtSyncMsg: null,

  // ── Workflows ─────────────────────────────────────────────────────────────
  workflows: [],
  workflowsLoading: false,

  // ── Buyer Journey ─────────────────────────────────────────────────────────
  journeyAccounts: [],
  journeyData: null,
  journeyLoading: false,

  // ── Attribution ───────────────────────────────────────────────────────────
  attributionData: null,
  attributionLoading: false,

  // ── GTM Config + Progress ─────────────────────────────────────────────────
  gtmConfig: null,
  progressData: null,
  progressLoading: false,

  // ── Intelligence ──────────────────────────────────────────────────────────
  intelligenceData: null,
  intelligenceLoading: false,

  // ── Daily Report ──────────────────────────────────────────────────────────
  dailyReport: null,
  dailyReportLoading: false,

  // ── Forecast ─────────────────────────────────────────────────────────────
  forecast: null,
  forecastLoading: false,
  forecastHistory: null,
  forecastHistoryLoading: false,
  snapshotSaving: false,

  // ── Learnings ────────────────────────────────────────────────────────────
  learnings: null,
  learningsLoading: false,

  // ── Management Tasks ──────────────────────────────────────────────────────
  mgmtTasks: null,
  mgmtTasksLoading: false,

  // ── CRM Activity Summary (P1.6) ────────────────────────────────────────────
  activitySummary: null,
  activitySummaryLoading: false,

  // ── Persisted Recommendations ──────────────────────────────────────────────
  recommendations: null,
  recommendationsLoading: false,

  // ── AI Agent ─────────────────────────────────────────────────────────────
  agentData: null,
  agentLoading: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

const useDataStore = create((set, getStore) => ({
  ...INITIAL,

  // ══════════════════════════════════════════════════════════════════════════
  // ALERTS
  // ══════════════════════════════════════════════════════════════════════════

  /** Fetch alerts list + stats. Pass `status` to filter (default: 'pending'). */
  fetchAlerts: async (status = 'pending') => {
    set({ alertsLoading: true, alertsError: null });
    try {
      const [alertsData, statsData] = await Promise.all([
        get(`/alerts/?status=${status}&limit=50`),
        get('/alerts/stats'),
      ]);
      set({
        alerts:     alertsData.alerts || [],
        alertStats: statsData,
      });
    } catch (e) {
      set({
        alerts:     [],
        alertStats: INITIAL.alertStats,
        alertsError: e?.message || 'Failed to load alerts',
      });
    } finally {
      set({ alertsLoading: false });
    }
  },

  /** Perform an action on a single alert (dismiss, snooze, action). */
  handleAlertAction: async (alertId, actionType, payload = null) => {
    set({ actioningId: alertId });
    try {
      await post(`/alerts/${alertId}/action`, { action_type: actionType, payload });
      // Refresh using the current filter status from caller's scope — re-fetch all
      await getStore().fetchAlerts();
    } catch (e) {
      set({ alertsError: `Action failed: ${e?.message}` });
    } finally {
      set({ actioningId: null });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEADS
  // ══════════════════════════════════════════════════════════════════════════

  fetchLeads: async (limit = 50) => {
    set({ leadsLoading: true });
    try {
      const data = await get(`/leads?limit=${limit}`);
      set({ leads: data.leads || data.items || [] });
    } catch {
      set({ leads: [] });
    } finally {
      set({ leadsLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONNECTIONS
  // ══════════════════════════════════════════════════════════════════════════

  fetchConnections: async () => {
    set({ connectionsLoading: true });
    try {
      const data = await get('/connections');
      set({ connections: data.integrations || [] });
    } catch {
      set({ connections: [] });
    } finally {
      set({ connectionsLoading: false });
    }
  },

  /** Trigger sync for a service (clay, salesforce, hubspot, …). */
  handleSync: async (service, integrationId) => {
    set(s => ({ syncingId: integrationId, syncResult: { ...s.syncResult, [integrationId]: null } }));
    try {
      const data = await post(`/connections/${service}/sync`);
      set(s => ({
        syncResult: { ...s.syncResult, [integrationId]: { ok: true, msg: data.message || 'Sync complete' } },
      }));
      await getStore().fetchConnections();
    } catch (e) {
      set(s => ({
        syncResult: { ...s.syncResult, [integrationId]: { ok: false, msg: e?.message } },
      }));
    } finally {
      set({ syncingId: null });
    }
  },

  /** Disconnect / delete an integration by its integrationId. */
  handleDisconnect: async (integrationId) => {
    try {
      await del(`/connections/${integrationId}`);
      await getStore().fetchConnections();
    } catch (e) {
      throw e; // Let the UI handle the confirmation / error display
    }
  },

  /**
   * Connect a new integration.
   * Returns `{ auth_url }` for OAuth services — caller should open that URL.
   */
  handleConnect: async (service, formParams) => {
    const params = new URLSearchParams(formParams).toString();
    const data = await post(`/connections/${service}?${params}`);
    if (!data.auth_url) {
      await getStore().fetchConnections();
    }
    return data; // { auth_url? }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT + AI SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  fetchChatContext: async () => {
    try {
      const [ctxData, sugData, settingsData] = await Promise.all([
        get('/chat/context'),
        get('/chat/suggested'),
        get('/settings/ai'),
      ]);
      set({
        chatContext:        ctxData.pipeline_summary,
        suggestedQuestions: sugData.questions || [],
        aiSettings:         settingsData,
      });
    } catch {
      set({
        suggestedQuestions: [
          'Hvad skal jeg fokusere på denne uge?',
          'Hvilke deals er mest i fare?',
          'Hvilke leads bør jeg kontakte i dag?',
          'Giv mig et overblik over min pipeline',
        ],
      });
    }
  },

  sendChatMessage: async (question) => {
    if (!question.trim()) return;
    const userMsg = { role: 'user', content: question };
    const history = getStore().chatMessages.filter(m => m.role !== 'system');
    set(s => ({ chatMessages: [...s.chatMessages, userMsg], chatLoading: true }));
    try {
      const data = await post('/chat', { question, history });
      set(s => ({
        chatMessages: [...s.chatMessages, {
          role: 'assistant',
          content: data.answer,
          charts: data.charts?.length ? data.charts : null,
        }],
        ...(data.pipeline_summary ? { chatContext: data.pipeline_summary } : {}),
      }));
    } catch (e) {
      set(s => ({
        chatMessages: [...s.chatMessages, {
          role: 'assistant',
          content: `Fejl: ${e?.message}. Tjek at ANTHROPIC_API_KEY er sat i Railway Variables.`,
          isError: true,
        }],
      }));
    } finally {
      set({ chatLoading: false });
    }
  },

  saveAiSettings: async (updates) => {
    const current = getStore().aiSettings;
    if (!current) return;
    try {
      const saved = await put('/settings/ai', {
        model:           updates.model           ?? current.model,
        skills:          updates.skills          ?? current.skills,
        company_context: updates.company_context ?? current.company_context,
      });
      set({ aiSettings: saved });
      return saved;
    } catch (e) {
      console.error('Failed to save AI settings:', e);
      throw e;
    }
  },

  addSkill: async (skillText) => {
    const current = getStore().aiSettings;
    if (!skillText?.trim() || !current) return;
    const newSkills = [...(current.skills || []), skillText.trim()];
    await getStore().saveAiSettings({ skills: newSkills });
  },

  removeSkill: async (index) => {
    const current = getStore().aiSettings;
    if (!current) return;
    const newSkills = current.skills.filter((_, i) => i !== index);
    await getStore().saveAiSettings({ skills: newSkills });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PIPELINE DATA
  // ══════════════════════════════════════════════════════════════════════════

  fetchPipelineData: async () => {
    set({ pipelineLoading: true });
    try {
      const [ctx, leadsData] = await Promise.all([
        get('/chat/context'),
        get('/leads?limit=100'),
      ]);
      set({
        pipelineData: {
          summary:     ctx.pipeline_summary,
          deals:       ctx.open_deals || [],
          leads:       leadsData.leads || leadsData.items || [],
          generatedAt: ctx.generated_at,
        },
      });
    } catch {
      set({ pipelineData: null });
    } finally {
      set({ pipelineLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  fetchAnalytics: async () => {
    set({ analyticsLoading: true, analyticsError: null });
    try {
      const [forecast, funnel, health, accounts] = await Promise.all([
        get('/analysis/forecast'),
        get('/analysis/funnel'),
        get('/analysis/health'),
        get('/analysis/accounts?limit=30'),
      ]);
      set({ analyticsData: { forecast, funnel, health, accounts } });
    } catch (e) {
      console.error('Analytics fetch failed:', e);
      set({ analyticsError: e?.message || 'Unknown error', analyticsData: null });
    } finally {
      set({ analyticsLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WEEKLY REPORT
  // ══════════════════════════════════════════════════════════════════════════

  fetchWeeklyReport: async () => {
    set({ weeklyReportLoading: true, weeklyReportError: null });
    try {
      const data = await get('/reports/weekly');
      set({ weeklyReport: data });
    } catch (e) {
      set({ weeklyReportError: e?.message || 'Kunne ikke hente rapport' });
    } finally {
      set({ weeklyReportLoading: false });
    }
  },

  generateWeeklyReport: async () => {
    set({ weeklyReportGenerating: true, weeklyReportError: null });
    try {
      const data = await post('/reports/weekly/generate', {});
      set({ weeklyReport: data });
    } catch (e) {
      set({ weeklyReportError: e?.message || 'Rapport-generering fejlede' });
    } finally {
      set({ weeklyReportGenerating: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CMT
  // ══════════════════════════════════════════════════════════════════════════

  fetchCmt: async () => {
    set({ cmtLoading: true, cmtError: null });
    try {
      const [overview, depts] = await Promise.all([
        get('/cmt/overview'),
        get('/cmt/departments'),
      ]);
      set({ cmtOverview: overview, cmtDepartments: depts.departments || [] });
    } catch (e) {
      set({ cmtError: e?.message || 'Could not load CMT data' });
    } finally {
      set({ cmtLoading: false });
    }
  },

  handleCmtSync: async () => {
    set({ cmtSyncing: true, cmtSyncMsg: null });
    try {
      const data = await post('/connections/notion/sync');
      set({ cmtSyncMsg: `✓ Synced — ${data.created ?? 0} new, ${data.updated ?? 0} updated` });
      await getStore().fetchCmt();
    } catch (e) {
      set({ cmtSyncMsg: `✗ ${e?.message}` });
    } finally {
      set({ cmtSyncing: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WORKFLOWS
  // ══════════════════════════════════════════════════════════════════════════

  fetchWorkflows: async () => {
    set({ workflowsLoading: true });
    try {
      const data = await get('/workflows');
      set({ workflows: data.workflows || [] });
    } catch (e) {
      console.error('Workflows fetch failed:', e);
    } finally {
      set({ workflowsLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BUYER JOURNEY
  // ══════════════════════════════════════════════════════════════════════════

  fetchJourneyAccounts: async () => {
    set({ journeyLoading: true });
    try {
      const data = await get('/analysis/journey');
      set({ journeyAccounts: data.accounts || [] });
    } catch (e) {
      console.error('Journey accounts fetch failed:', e);
    } finally {
      set({ journeyLoading: false });
    }
  },

  fetchJourney: async (company) => {
    set({ journeyLoading: true, journeyData: null });
    try {
      const data = await get(`/analysis/journey?company=${encodeURIComponent(company)}`);
      set({ journeyData: data });
      return data;
    } catch (e) {
      console.error('Journey fetch failed:', e);
    } finally {
      set({ journeyLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ATTRIBUTION
  // ══════════════════════════════════════════════════════════════════════════

  fetchAttribution: async () => {
    set({ attributionLoading: true });
    try {
      const data = await get('/analysis/attribution');
      set({ attributionData: data });
    } catch (e) {
      console.error('Attribution fetch failed:', e);
    } finally {
      set({ attributionLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GTM CONFIG + PROGRESS
  // ══════════════════════════════════════════════════════════════════════════

  fetchGtmConfig: async () => {
    try {
      const data = await get('/gtm/config');
      set({ gtmConfig: data });
      return data; // caller may populate form state from this
    } catch {
      /* silent — use form defaults */
    }
  },

  saveGtmConfig: async (section, formData) => {
    const payload =
      section === 'strategy'
        ? {
            company_description: formData.company_description,
            value_proposition:   formData.value_proposition,
            competitors:         formData.competitors,
            offerings:           formData.offerings,
          }
        : section === 'icp'
        ? { icp: formData }
        : { goals: formData };

    const updated = await put('/gtm/config', payload);
    set({ gtmConfig: updated });
    return updated;
  },

  fetchGtmProgress: async () => {
    set({ progressLoading: true });
    try {
      const data = await get('/gtm/progress');
      set({ progressData: data });
    } catch {
      set({ progressData: null });
    } finally {
      set({ progressLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE
  // ══════════════════════════════════════════════════════════════════════════

  fetchIntelligence: async () => {
    set({ intelligenceLoading: true });
    try {
      const data = await get('/gtm/intelligence');
      set({ intelligenceData: data });
    } catch {
      set({ intelligenceData: null });
    } finally {
      set({ intelligenceLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DAILY REPORT
  // ══════════════════════════════════════════════════════════════════════════

  fetchDailyReport: async () => {
    set({ dailyReportLoading: true });
    try {
      const data = await get('/gtm/daily-report');
      set({ dailyReport: data });
    } catch {
      set({ dailyReport: null });
    } finally {
      set({ dailyReportLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FORECAST
  // ══════════════════════════════════════════════════════════════════════════

  fetchForecast: async () => {
    set({ forecastLoading: true });
    try {
      const data = await get('/gtm/forecast');
      set({ forecast: data });
    } catch {
      set({ forecast: null });
    } finally {
      set({ forecastLoading: false });
    }
  },

  fetchForecastHistory: async () => {
    set({ forecastHistoryLoading: true });
    try {
      const data = await get('/gtm/forecast/history');
      set({ forecastHistory: data });
    } catch {
      set({ forecastHistory: null });
    } finally {
      set({ forecastHistoryLoading: false });
    }
  },

  saveSnapshot: async () => {
    set({ snapshotSaving: true });
    try {
      await post('/gtm/forecast/snapshot', {});
      await getStore().fetchForecastHistory();
    } catch (e) {
      console.error('Snapshot save failed:', e);
    } finally {
      set({ snapshotSaving: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEARNINGS
  // ══════════════════════════════════════════════════════════════════════════

  fetchLearnings: async () => {
    set({ learningsLoading: true });
    try {
      const data = await get('/gtm/learnings');
      set({ learnings: data });
    } catch {
      set({ learnings: null });
    } finally {
      set({ learningsLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MANAGEMENT TASKS
  // ══════════════════════════════════════════════════════════════════════════

  fetchMgmtTasks: async () => {
    set({ mgmtTasksLoading: true });
    try {
      const data = await get('/gtm/management-tasks');
      set({ mgmtTasks: data });
    } catch {
      set({ mgmtTasks: null });
    } finally {
      set({ mgmtTasksLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PERSISTED RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════════════════════

  fetchRecommendations: async () => {
    set({ recommendationsLoading: true });
    try {
      const data = await get('/gtm/recommendations?status=pending&limit=20');
      set({ recommendations: data });
    } catch {
      set({ recommendations: null });
    } finally {
      set({ recommendationsLoading: false });
    }
  },

  dismissRecommendation: async (recId) => {
    try {
      await post(`/gtm/recommendations/${recId}/action?action=dismissed`, {});
      // Remove from local state immediately
      const current = useDataStore.getState().recommendations;
      if (current?.recommendations) {
        set({
          recommendations: {
            ...current,
            recommendations: current.recommendations.filter(r => r.id !== recId),
            total: current.total - 1,
          }
        });
      }
    } catch (e) {
      console.error('Failed to dismiss recommendation:', e);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CRM ACTIVITY SUMMARY  (P1.6)
  // ══════════════════════════════════════════════════════════════════════════

  fetchActivitySummary: async (days = 30) => {
    set({ activitySummaryLoading: true });
    try {
      const data = await get(`/gtm/activities?days=${days}`);
      set({ activitySummary: data });
    } catch {
      set({ activitySummary: null });
    } finally {
      set({ activitySummaryLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AI AGENT
  // ══════════════════════════════════════════════════════════════════════════

  runAgent: async () => {
    set({ agentLoading: true, agentData: null });
    try {
      const data = await post('/gtm/agent/analyze', {});
      set({ agentData: data });
    } catch (e) {
      set({ agentData: { thinking: [], insights: 'Agent fejlede: ' + e?.message, tasks: [] } });
    } finally {
      set({ agentLoading: false });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COMPOSITE FETCHERS  (trigger groups matching the active-tab useEffect)
  // ══════════════════════════════════════════════════════════════════════════

  /** Fetch everything needed for the Intelligence tab in one call. */
  fetchIntelligenceTab: async () => {
    const s = getStore();
    await Promise.allSettled([
      s.fetchIntelligence(),
      s.fetchDailyReport(),
      s.fetchForecast(),
      s.fetchForecastHistory(),
      s.fetchLearnings(),
      s.fetchMgmtTasks(),
      s.fetchActivitySummary(),
      s.fetchRecommendations(),
    ]);
  },

  /** Fetch everything needed for the Pipeline tab. */
  fetchPipelineTab: async () => {
    const s = getStore();
    await Promise.allSettled([
      s.fetchPipelineData(),
      s.fetchAnalytics(),
      s.fetchLeads(),
    ]);
  },

  /** Fetch everything needed for the Signals tab. */
  fetchSignalsTab: async (alertStatus = 'pending') => {
    const s = getStore();
    await Promise.allSettled([
      s.fetchAlerts(alertStatus),
      s.fetchJourneyAccounts(),
      s.fetchLeads(),
    ]);
  },

  /** Fetch everything needed for the GTM Setup tab. */
  fetchGtmSetupTab: async () => {
    const s = getStore();
    await Promise.allSettled([
      s.fetchGtmConfig(),
      s.fetchGtmProgress(),
    ]);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RESET
  // ══════════════════════════════════════════════════════════════════════════

  /** Reset all store state to initial values (call on logout). */
  reset: () => set(INITIAL),
}));

export default useDataStore;
