/**
 * IntelligencePage
 * Primary tab: Intelligence — Overblik, Daglig Rapport, Forecast,
 * Learnings, Management Tasks, AI Agent
 *
 * Reads all server state from useDataStore; manages only local UI state.
 */
import { useState, useEffect } from 'react';
import {
  AlertCircle, Brain, Camera, ChevronDown, History,
  RefreshCw, Target, TrendingUp, Users, Zap,
} from 'lucide-react';
import useDataStore from '../store/dataStore';

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtKr(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return String(n);
}
const formatCurrency = (n) => n != null ? `${fmtKr(n)} kr` : '—';

// ─── Page ──────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [subTab,           setSubTab]           = useState('overblik');
  const [showHistory,      setShowHistory]      = useState(false);
  const [dismissedTaskIds, setDismissedTaskIds] = useState(new Set());

  // ── Server state ────────────────────────────────────────────────────────
  const {
    intelligenceData,  intelligenceLoading,
    dailyReport,       dailyReportLoading,
    forecast,          forecastLoading,
    forecastHistory,   forecastHistoryLoading,
    snapshotSaving,
    learnings,         learningsLoading,
    mgmtTasks,         mgmtTasksLoading,
    agentData,         agentLoading,
    // actions
    fetchIntelligenceTab,
    fetchIntelligence, fetchDailyReport, fetchForecast,
    fetchForecastHistory, saveSnapshot,
    fetchLearnings, fetchMgmtTasks,
    runAgent,
  } = useDataStore();

  // Fetch on mount
  useEffect(() => { fetchIntelligenceTab(); }, [fetchIntelligenceTab]);

  const handleRefresh = () => {
    fetchIntelligence();
    fetchDailyReport();
    fetchForecast();
    fetchForecastHistory();
    fetchLearnings();
    fetchMgmtTasks();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Intelligence</h2>
          <p className="text-sm text-gray-500 mt-0.5">Board-level GTM indsigter, daglig rapport og CRM-mønstre</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={intelligenceLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${intelligenceLoading ? 'animate-spin' : ''}`} /> Opdater
        </button>
      </div>

      {/* Sub-tab pills */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'overblik',  label: '🎯 Overblik' },
          { id: 'daglig',    label: '📅 Daglig Rapport' },
          { id: 'forecast',  label: '📈 Forecast' },
          { id: 'learnings', label: '💡 Learnings' },
          { id: 'tasks',     label: '✅ Tasks', badge: mgmtTasks?.counts?.urgent },
          { id: 'agent',     label: '🤖 AI Agent' },
        ].map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              subTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {badge > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          OVERBLIK
         ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'overblik' && <OverblikSubTab
        data={intelligenceData}
        loading={intelligenceLoading}
      />}

      {/* ═══════════════════════════════════════════════════════════════════
          DAGLIG RAPPORT
         ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'daglig' && <DagligSubTab
        report={dailyReport}
        loading={dailyReportLoading}
      />}

      {/* ═══════════════════════════════════════════════════════════════════
          FORECAST
         ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'forecast' && <ForecastSubTab
        forecast={forecast}
        forecastLoading={forecastLoading}
        forecastHistory={forecastHistory}
        forecastHistoryLoading={forecastHistoryLoading}
        snapshotSaving={snapshotSaving}
        saveSnapshot={saveSnapshot}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
      />}

      {/* ═══════════════════════════════════════════════════════════════════
          LEARNINGS
         ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'learnings' && <LearningsSubTab
        learnings={learnings}
        loading={learningsLoading}
      />}

      {/* ═══════════════════════════════════════════════════════════════════
          MANAGEMENT TASKS
         ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'tasks' && <TasksSubTab
        mgmtTasks={mgmtTasks}
        loading={mgmtTasksLoading}
        dismissedTaskIds={dismissedTaskIds}
        setDismissedTaskIds={setDismissedTaskIds}
        onRefresh={fetchMgmtTasks}
      />}

      {/* ═══════════════════════════════════════════════════════════════════
          AI AGENT
         ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'agent' && <AgentSubTab
        agentData={agentData}
        loading={agentLoading}
        onRun={runAgent}
      />}
    </div>
  );
}

// ─── Sub-tab: Overblik ─────────────────────────────────────────────────────

function OverblikSubTab({ data, loading }) {
  if (loading && !data) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Beregner indsigter...
    </div>
  );
  if (!data) return null;

  const tam         = data.tam_coverage       || {};
  const act         = data.account_activation || {};
  const icp         = data.icp_match          || {};
  const pipe        = data.pipeline_coverage  || {};
  const wl          = data.win_loss           || {};
  const actReq      = data.activity_requirements || {};
  const patterns    = data.win_patterns       || [];
  const boardAlerts = data.board_alerts       || [];

  const statusColor = (s) => ({
    strong:   'text-green-700 bg-green-50 border-green-200',
    ok:       'text-blue-700 bg-blue-50 border-blue-200',
    low:      'text-amber-700 bg-amber-50 border-amber-200',
    critical: 'text-red-700 bg-red-50 border-red-200',
  }[s] || 'text-gray-700 bg-gray-50 border-gray-200');

  const statusLabel = { strong: '✓ Stærk', ok: '✓ OK', low: '⚠ Lav', critical: '✗ Kritisk' };

  const kpiCards = [
    {
      label: 'TAM Dækning', icon: Target,
      value: `${tam.pct || 0}%`,
      sub: `${tam.crm_icp_accounts || 0} af ${tam.tam_total || 0} ICP-virksomheder i CRM`,
      status: tam.status,
      detail: tam.gap > 0 ? `Mangler ${tam.gap} virksomheder` : 'Komplet dækning',
    },
    {
      label: 'Account Aktivering', icon: Zap,
      value: `${act.pct || 0}%`,
      sub: `${act.activated || 0} af ${act.target || 0} accounts aktiveret`,
      status: act.status,
      detail: act.gap > 0 ? `${act.gap} accounts mangler aktivering` : 'Mål nået',
    },
    {
      label: 'ICP Match Rate', icon: Users,
      value: `${icp.pct || 0}%`,
      sub: `${icp.icp_deals || 0} af ${icp.total_deals || 0} åbne deals er ICP`,
      status: icp.pct >= 70 ? 'ok' : icp.pct >= 40 ? 'low' : 'critical',
      detail: `${icp.non_icp_deals || 0} non-ICP deals`,
    },
    {
      label: 'Pipeline Dækning', icon: TrendingUp,
      value: `${pipe.pct || 0}%`,
      sub: `${(pipe.weighted_pipeline / 1000 || 0).toFixed(0)}k af ${(pipe.revenue_target / 1000 || 0).toFixed(0)}k mål`,
      status: pipe.status,
      detail: pipe.gap > 0 ? `Mangler ${(pipe.gap / 1000).toFixed(0)}k` : 'Over mål',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Board alerts */}
      {boardAlerts.length > 0 && (
        <div className="space-y-2">
          {boardAlerts.map((msg, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{msg}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, sub, status, icon: Icon, detail }) => (
          <div key={label} className={`p-5 rounded-lg border-2 ${statusColor(status)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 opacity-70" />
                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColor(status)}`}>
                {statusLabel[status] || status}
              </span>
            </div>
            <div className="text-3xl font-bold mb-1">{value}</div>
            <p className="text-xs opacity-70 mb-1">{sub}</p>
            <p className="text-xs font-medium opacity-80">{detail}</p>
          </div>
        ))}
      </div>

      {/* Activity requirements + Win/Loss */}
      <div className="grid grid-cols-2 gap-6">
        {actReq.deals_needed > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Aktivitetskrav
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Deals der skal lukkes', value: actReq.deals_needed,       weekly: actReq.weekly_opps,     color: 'bg-blue-500' },
                { label: 'Opportunities',          value: actReq.opps_needed,        weekly: actReq.weekly_opps,     color: 'bg-purple-500' },
                { label: 'Møder',                  value: actReq.meetings_needed,    weekly: actReq.weekly_meetings, color: 'bg-orange-500' },
                { label: 'Accounts kontaktet',     value: actReq.accounts_to_contact,weekly: actReq.weekly_accounts, color: 'bg-green-500' },
              ].map(({ label, value, weekly, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-sm text-gray-600">{label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{value?.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 ml-1">({weekly}/uge)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Win / Loss</h3>
            <div className="flex items-center gap-6">
              <div className="text-center"><div className="text-2xl font-bold text-green-600">{wl.won || 0}</div><div className="text-xs text-gray-500">Vundne</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-red-500">{wl.lost || 0}</div><div className="text-xs text-gray-500">Tabte</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-blue-600">{wl.win_rate_actual || 0}%</div><div className="text-xs text-gray-500">Win rate</div></div>
            </div>
          </div>
          {patterns.length > 0 && (
            <div className="bg-white p-5 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Win Signal Mønstre</h3>
              <div className="space-y-2">
                {patterns.map(p => (
                  <div key={p.signal_type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 capitalize">{p.signal_type}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${p.correlation_pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{p.correlation_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rep activation table */}
      {(act.by_rep || []).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Sælger Aktivering</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Sælger</th>
                <th className="px-6 py-3 text-right">Aktive</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Pipeline</th>
                <th className="px-6 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {act.by_rep.map(rep => (
                <tr key={rep.name} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{rep.name}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-700">{rep.activated}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-500">{rep.total_deals}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-700">{(rep.pipeline_value / 1000).toFixed(0)}k</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${rep.pct >= 75 ? 'bg-green-500' : rep.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${rep.pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-10 text-right">{rep.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!actReq.deals_needed && patterns.length === 0 && boardAlerts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Gå til <strong>GTM Setup → Målsætninger</strong> og udfyld dine mål for at se aktivitetsanalysen</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Daglig Rapport ────────────────────────────────────────────────

function DagligSubTab({ report: dr, loading }) {
  if (loading && !dr) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Henter ugerapport...
    </div>
  );

  const statusCls   = { strong: 'bg-green-50 border-green-300 text-green-800', ok: 'bg-blue-50 border-blue-300 text-blue-800', low: 'bg-amber-50 border-amber-300 text-amber-800', critical: 'bg-red-50 border-red-300 text-red-800' };
  const statusBadge = { strong: '✓ Stærk', ok: '✓ OK', low: '⚠ Lav', critical: '✗ Kritisk' };
  const barColor    = { strong: 'bg-green-500', ok: 'bg-blue-500', low: 'bg-amber-400', critical: 'bg-red-500' };

  return (
    <div className="space-y-6">
      {dr && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Ugerapport Scorekort</h3>
              <p className="text-sm text-gray-500">Denne uge vs. ugentligt aktivitetsmål</p>
            </div>
            <div className={`text-center px-6 py-3 rounded-xl border-2 ${
              dr.overall_pct >= 80 ? 'bg-green-50 border-green-400'
              : dr.overall_pct >= 50 ? 'bg-amber-50 border-amber-400'
              : 'bg-red-50 border-red-300'
            }`}>
              <div className={`text-4xl font-black ${
                dr.overall_pct >= 80 ? 'text-green-600'
                : dr.overall_pct >= 50 ? 'text-amber-600'
                : 'text-red-500'
              }`}>{dr.overall_pct}%</div>
              <div className="text-xs text-gray-500">{dr.items_on_track}/{dr.total_items} på sporet</div>
            </div>
          </div>

          <div className="space-y-3">
            {(dr.scorecard || []).map(item => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="w-6 text-center text-base">{item.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{item.actual} {item.suffix} / {item.target} {item.suffix}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCls[item.status] || statusCls.ok}`}>
                        {statusBadge[item.status]}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor[item.status] || 'bg-blue-500'}`}
                      style={{ width: `${Math.min(item.pct, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dr && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Åbne deals',          value: dr.open_deals,                                          color: 'text-blue-600' },
            { label: 'Stagnerende deals',    value: dr.stalled_deals,                                       color: dr.stalled_deals > 0 ? 'text-red-600' : 'text-green-600' },
            { label: 'Pipeline (vægtet)',    value: `${Math.round((dr.weighted_pipeline || 0) / 1000)}k kr`,color: 'text-purple-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!dr && !loading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Udfyld dine mål i GTM Setup for at se ugerapport</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Forecast ─────────────────────────────────────────────────────

function ForecastSubTab({
  forecast: fc, forecastLoading,
  forecastHistory: fh, forecastHistoryLoading,
  snapshotSaving, saveSnapshot,
  showHistory, setShowHistory,
}) {
  if (forecastLoading && !fc) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Beregner forecast...
    </div>
  );
  if (!fc) return null;

  const maxVal = Math.max(...fc.months.map(m => m.optimistic), 1);

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-end">
        <button
          onClick={saveSnapshot}
          disabled={snapshotSaving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          <Camera className="w-4 h-4" />
          {snapshotSaving ? 'Gemmer...' : 'Gem Snapshot'}
        </button>
      </div>

      {/* Scenario summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Konservativ', value: fc.totals.conservative, color: 'text-red-600',   bg: 'bg-red-50 border-red-200',   hint: '60% af stage-sandsynlighed' },
          { label: 'Base',        value: fc.totals.base,         color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200', hint: 'Stage-vægtet pipeline' },
          { label: 'Optimistisk', value: fc.totals.optimistic,   color: 'text-green-600', bg: 'bg-green-50 border-green-200',hint: '135% af stage-sandsynlighed' },
        ].map(({ label, value, color, bg, hint }) => {
          const pct = fc.totals.revenue_target > 0 ? Math.round(value / fc.totals.revenue_target * 100) : 0;
          const barBg = bg.split(' ')[0].replace('50', '200');
          const barFill = color.replace('text-', 'bg-').replace('600', '500');
          return (
            <div key={label} className={`p-5 rounded-xl border-2 ${bg}`}>
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{fmtKr(value)} kr</div>
              <div className="text-xs text-gray-400 mt-1">{pct}% af mål ({fmtKr(fc.totals.revenue_target)}kr)</div>
              <div className={`mt-2 h-1.5 ${barBg} rounded-full overflow-hidden`}>
                <div className={`h-full ${barFill} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{hint}</p>
            </div>
          );
        })}
      </div>

      {/* Won YTD callout */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Allerede vundet (inkluderet i alle scenarier)</p>
          <p className="text-xs text-gray-400">Closed Won YTD</p>
        </div>
        <div className="text-xl font-bold text-green-600">{fmtKr(fc.totals.won_ytd)} kr</div>
      </div>

      {/* Monthly bar chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Månedlig Pipeline Fordeling (åbne deals × stage-sandsynlighed)
        </h3>
        <div className="space-y-2">
          {fc.months.filter(m => m.count > 0 || m.base > 0).slice(0, 8).map(m => {
            const basePct = Math.round(m.base      / maxVal * 100);
            const optPct  = Math.round(m.optimistic / maxVal * 100);
            return (
              <div key={m.key} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-500 text-right">{m.label}</div>
                <div className="flex-1 relative h-7">
                  <div className="absolute inset-0 bg-green-100 rounded-full" style={{ width: `${optPct}%` }} />
                  <div className="absolute inset-0 bg-blue-400 rounded-full" style={{ width: `${basePct}%` }} />
                  {m.count > 0 && (
                    <div className="absolute right-0 inset-y-0 flex items-center pr-1">
                      <span className="text-xs text-gray-600 font-medium pl-2">{fmtKr(m.base)} kr ({m.count} deals)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm inline-block" /> Base</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded-sm inline-block" /> Optimistisk</span>
        </div>
        {fc.no_close_date?.count > 0 && (
          <p className="text-xs text-amber-600 mt-3">
            ⚠ {fc.no_close_date.count} deals mangler close dato — ikke inkluderet i månedlig fordeling
          </p>
        )}
      </div>

      {/* Forecast History collapsible */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <span className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            Forecast Historik &amp; Nøjagtighed
            {(fh?.summary?.n_months || 0) > 0 && (
              <span className="text-xs text-gray-400">({fh.summary.n_months} afsluttede måneder)</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {fh?.summary?.mae_pct != null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                fh.summary.mae_pct < 10 ? 'bg-green-100 text-green-700'
                : fh.summary.mae_pct < 25 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
              }`}>Ø {fh.summary.mae_pct}% afvigelse</span>
            )}
            {fh?.summary?.bias_pct != null && fh.summary.bias_direction !== 'accurate' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                {fh.summary.bias_direction === 'over' ? '↑ Over' : '↓ Under'}-forecast {fh.summary.bias_pct > 0 ? '+' : ''}{fh.summary.bias_pct}%
              </span>
            )}
            {fh?.summary?.bias_direction === 'accurate' && (fh?.summary?.n_months || 0) > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">✓ Kalibreret</span>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showHistory && (
          <div className="divide-y divide-gray-100">
            {forecastHistoryLoading && (
              <div className="py-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Henter historik...
              </div>
            )}
            {!forecastHistoryLoading && !fh?.snapshots?.length && (
              <div className="py-10 text-center text-gray-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Ingen snapshots gemt endnu</p>
                <p className="text-xs mt-1">Klik "Gem Snapshot" for at starte tracking af forecast-nøjagtighed</p>
              </div>
            )}
            {(fh?.snapshots || []).map(snap => (
              <div key={snap.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600">Snapshot: {snap.snapshot_date}</span>
                  {snap.revenue_target && (
                    <span className="text-xs text-gray-400">Mål på tidspunktet: {formatCurrency(snap.revenue_target)}</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left py-1.5 pr-4 font-medium">Måned</th>
                        <th className="text-right pr-4 font-medium">Forecast (base)</th>
                        <th className="text-right pr-4 font-medium">Faktisk</th>
                        <th className="text-right pr-4 font-medium">Afvigelse</th>
                        <th className="text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.months_data.map(m => {
                        const errAbs = m.error_pct != null ? Math.abs(m.error_pct) : null;
                        const color = !m.is_complete ? 'text-gray-400' : errAbs == null ? 'text-gray-400' : errAbs < 10 ? 'text-green-600' : errAbs < 25 ? 'text-amber-600' : 'text-red-600';
                        const icon  = !m.is_complete ? '⏳' : m.error_pct == null ? '—' : errAbs < 10 ? '✓' : errAbs < 25 ? '⚠' : '✗';
                        return (
                          <tr key={m.month || m.key} className="border-b border-gray-50 last:border-0">
                            <td className="py-1.5 pr-4 text-gray-700">{m.label}</td>
                            <td className="text-right pr-4 text-gray-700">{formatCurrency(m.base)}</td>
                            <td className="text-right pr-4 text-gray-700">{m.actual != null ? formatCurrency(m.actual) : '—'}</td>
                            <td className={`text-right pr-4 font-medium ${color}`}>
                              {m.error_pct != null ? `${m.error_pct > 0 ? '+' : ''}${m.error_pct}%` : '—'}
                            </td>
                            <td className={`text-right font-medium ${color}`}>{icon}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-tab: Learnings ────────────────────────────────────────────────────

function LearningsSubTab({ learnings, loading }) {
  if (loading && !learnings) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Analyserer mønstre...
    </div>
  );
  if (!learnings) return null;

  const impactBg = {
    high:   'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low:    'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Vundne deals',  value: learnings.summary?.won    || 0, color: 'text-green-600' },
          { label: 'Tabte deals',   value: learnings.summary?.lost   || 0, color: 'text-red-500' },
          { label: 'Åbne deals',    value: learnings.summary?.open   || 0, color: 'text-blue-600' },
          { label: 'Stagnerende',   value: learnings.summary?.stalled || 0, color: (learnings.summary?.stalled || 0) > 0 ? 'text-amber-600' : 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white p-4 rounded-lg border border-gray-200 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Learning cards */}
      {(learnings.learnings || []).length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Ikke nok CRM data endnu til at generere learnings</p>
          <p className="text-xs mt-1">Sync mindst 3+ deals (vundne og tabte) for at se mønstre</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(learnings.learnings || []).map(l => (
            <div key={l.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${impactBg[l.impact] || impactBg.low}`}>
                  {l.impact === 'high' ? 'High Impact' : l.impact === 'medium' ? 'Medium Impact' : 'Low Impact'}
                </span>
                <span className="text-xs text-gray-400">{l.date}</span>
              </div>
              <h4 className="text-sm font-bold text-gray-900 mb-1 leading-snug">{l.title}</h4>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{l.body}</p>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-blue-600 font-medium">→ {l.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Management Tasks ─────────────────────────────────────────────

function TasksSubTab({ mgmtTasks, loading, dismissedTaskIds, setDismissedTaskIds, onRefresh }) {
  if (loading && !mgmtTasks) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Genererer tasks...
    </div>
  );

  const tasks  = (mgmtTasks?.tasks  || []).filter(t => !dismissedTaskIds.has(t.id));
  const counts = mgmtTasks?.counts  || {};

  const prioCls   = { urgent: 'bg-red-50 border-red-300',   high: 'bg-amber-50 border-amber-300',   medium: 'bg-blue-50 border-blue-200' };
  const prioBadge = { urgent: 'bg-red-500 text-white',       high: 'bg-amber-500 text-white',         medium: 'bg-blue-500 text-white' };
  const prioLabel = { urgent: '🔴 Urgent',                   high: '🟡 High',                         medium: '🔵 Medium' };

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {counts.total > 0 && (
        <div className="flex items-center gap-3">
          {[['urgent', counts.urgent], ['high', counts.high], ['medium', counts.medium]]
            .filter(([, n]) => n > 0)
            .map(([p, n]) => (
              <span key={p} className={`text-xs px-3 py-1 rounded-full font-semibold ${prioBadge[p]}`}>
                {n} {prioLabel[p]}
              </span>
            ))
          }
          <button onClick={onRefresh} className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Genindlæs
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">✅</p>
          <p className="text-sm font-medium">Ingen management tasks</p>
          <p className="text-xs mt-1">Alt ser godt ud — ingen stagnerende deals eller kritiske handlingspunkter</p>
        </div>
      ) : tasks.map(t => (
        <div key={t.id} className={`p-4 rounded-xl border-2 ${prioCls[t.priority] || prioCls.medium}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${prioBadge[t.priority]}`}>{prioLabel[t.priority]}</span>
                <span className="text-xs text-gray-500">{t.rep}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{t.headline}</p>
              <p className="text-xs text-gray-500 mb-2">📁 {t.deal}</p>
              <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-200">{t.action}</p>
            </div>
            <button
              onClick={() => setDismissedTaskIds(prev => new Set([...prev, t.id]))}
              className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-1 text-lg leading-none"
            >✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-tab: AI Agent ─────────────────────────────────────────────────────

function AgentSubTab({ agentData, loading, onRun }) {
  const prioCls2 = {
    urgent: 'border-l-red-500 bg-red-50',
    high:   'border-l-amber-500 bg-amber-50',
    medium: 'border-l-blue-500 bg-blue-50',
  };

  return (
    <div className="space-y-4">
      {/* Trigger card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">🤖 AI Agent Analyse</h3>
            <p className="text-xs text-gray-500 mt-0.5">Analysér hele din pipeline med AI og få prioriterede handlinger</p>
          </div>
          <button
            onClick={onRun}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 text-sm font-medium"
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyserer...</>
              : <><Brain className="w-4 h-4" /> Kør Agent</>
            }
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Agenten gennemgår alle åbne deals, signaler og leads — og returnerer de 3 vigtigste handlinger du bør tage nu.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-2">
          <p className="text-sm font-medium text-purple-800 flex items-center gap-2">
            <Brain className="w-4 h-4 animate-pulse" /> Agent Thinking...
          </p>
          {['Indlæser pipeline snapshot...', 'Analyserer deal health signaler...', 'Finder mønstre i vundne og tabte deals...', 'Genererer handlingsanbefalinger...'].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-purple-600 pl-6">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              {step}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {agentData && !loading && (
        <>
          {agentData.thinking?.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                <Brain className="w-3.5 h-3.5" /> Agent Reasoning
              </p>
              <div className="space-y-1.5">
                {agentData.thinking.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-purple-600">
                    <span className="text-purple-400 font-bold">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentData.insights && (
            <div className="bg-white p-5 rounded-xl border-2 border-purple-200">
              <p className="text-xs font-semibold text-purple-700 mb-1">🎯 Vigtigste Indsigt</p>
              <p className="text-sm text-gray-800">{agentData.insights}</p>
            </div>
          )}

          {agentData.tasks?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Prioriterede Handlinger</h4>
              {agentData.tasks.map((t, i) => (
                <div key={i} className={`p-4 rounded-lg border border-gray-200 border-l-4 ${prioCls2[t.priority || 'high'] || prioCls2.high}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg font-black text-gray-300">{i + 1}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{t.deal}</p>
                      <p className="text-sm font-medium text-gray-900">{t.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!agentData && !loading && (
        <div className="text-center py-8 text-gray-400">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Klik "Kør Agent" for at starte AI-analysen</p>
        </div>
      )}
    </div>
  );
}
