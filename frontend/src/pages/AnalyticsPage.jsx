/**
 * AnalyticsPage
 * Revenue forecast, funnel, CRM health, top accounts, attribution.
 */
import { useState, useEffect } from 'react';
import {
  RefreshCw, Target, BarChart2, TrendingUp, ShieldCheck, Award,
  Users, CheckCircle, AlertCircle, Sparkles, Zap,
} from 'lucide-react';
import useDataStore from '../store/dataStore';

const CHART_PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#16a34a', '#ea580c', '#0284c7',
];

function getPriorityColor(priority) {
  switch (priority) {
    case 'hot':  return 'bg-red-100 text-red-700 border-red-200';
    case 'warm': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'cold': return 'bg-blue-100 text-blue-700 border-blue-200';
    default:     return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function AnalyticsPage() {
  const [analyticsView, setAnalyticsView] = useState('forecast');

  const {
    analyticsData, analyticsLoading, analyticsError,
    attributionData, attributionLoading,
    fetchAnalytics, fetchAttribution,
  } = useDataStore();

  useEffect(() => {
    fetchAnalytics();
    fetchAttribution();
  }, [fetchAnalytics, fetchAttribution]);

  const ad     = analyticsData;
  const fcast  = ad?.forecast;
  const funnel = ad?.funnel;
  const health = ad?.health;
  const accts  = ad?.accounts;

  const SEVERITY_COLORS = {
    urgent: 'bg-red-100 text-red-700 border-red-300',
    high:   'bg-orange-100 text-orange-700 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  };
  const HEALTH_GRADE_COLOR = {
    A: 'text-green-600', B: 'text-blue-600',
    C: 'text-yellow-600', D: 'text-orange-600', F: 'text-red-600',
  };

  const viewButtons = [
    { id: 'forecast',    label: 'Revenue Forecast', icon: Target },
    { id: 'attribution', label: 'Attribution',      icon: BarChart2 },
    { id: 'funnel',      label: 'Funnel',           icon: TrendingUp },
    { id: 'health',      label: 'CRM Health',       icon: ShieldCheck },
    { id: 'accounts',    label: 'Top Accounts',     icon: Award },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-nav */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {viewButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAnalyticsView(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                analyticsView === id
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={analyticsLoading}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {analyticsLoading && !ad && (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-3" />
          <span>Loading analytics...</span>
        </div>
      )}

      {!analyticsLoading && !ad && analyticsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Kunne ikke hente analytics data</p>
            <p className="text-sm text-red-600 mt-1 font-mono">{analyticsError}</p>
            <p className="text-xs text-red-500 mt-2">Railway deployer muligvis stadig — vent 1-2 min og klik Refresh</p>
          </div>
        </div>
      )}

      {!analyticsLoading && !ad && !analyticsError && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white rounded-lg border border-gray-200">
          <BarChart2 className="w-12 h-12 mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No analytics data available</p>
          <p className="text-sm mt-1">Connect HubSpot or Salesforce to see revenue analytics</p>
        </div>
      )}

      {/* ── REVENUE FORECAST ── */}
      {analyticsView === 'forecast' && fcast && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Weighted Forecast', value: fcast.weighted_forecast_display, sub: 'amount × stage probability', color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Commit Forecast',   value: fcast.commit_forecast_display,   sub: 'stages ≥70% probability',   color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Best Case',         value: fcast.best_case_display,         sub: '100% of open pipeline',     color: 'text-green-600',  bg: 'bg-green-50' },
              { label: 'Already Won',       value: fcast.closed_won_display,        sub: `${fcast.open_deal_count} open deals`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(({ label, value, sub, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl border border-gray-200 p-5`}>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By Month */}
            {fcast.by_month && fcast.by_month.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Weighted Forecast by Close Month</p>
                <div className="space-y-2.5">
                  {fcast.by_month.map((m) => {
                    const max = Math.max(...fcast.by_month.map(x => x.weighted_value));
                    const pct = max > 0 ? Math.round((m.weighted_value / max) * 100) : 0;
                    return (
                      <div key={m.month}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-gray-700">{m.month === 'No Date' ? '— No close date' : m.month}</span>
                          <span className="text-xs font-semibold text-gray-900">{m.display}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By Owner */}
            {fcast.by_owner && fcast.by_owner.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Weighted Pipeline by Owner</p>
                <div className="space-y-2.5">
                  {fcast.by_owner.map((o, i) => {
                    const max = fcast.by_owner[0]?.weighted_value || 1;
                    const pct = Math.round((o.weighted_value / max) * 100);
                    return (
                      <div key={o.owner}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-gray-700 flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-indigo-400" />
                            {o.owner}
                          </span>
                          <span className="text-xs font-semibold text-gray-900">{o.display}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* By Stage table */}
          {fcast.by_stage && fcast.by_stage.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Forecast by Stage</p>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Stage', 'Deals', 'Probability', 'Weighted Value'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fcast.by_stage.map((s) => (
                    <tr key={s.stage} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{s.label}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{s.count}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${(s.probability * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-9 text-right">
                            {(s.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-purple-700">{s.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── FUNNEL ── */}
      {analyticsView === 'funnel' && funnel && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Open Deals</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{funnel.total_deals}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Pipeline Value</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{funnel.total_value_display}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline Funnel by Stage</p>
            </div>
            <div className="divide-y divide-gray-50">
              {funnel.stages.map((s, i) => {
                const maxCount = Math.max(...funnel.stages.map(x => x.count), 1);
                const barPct = Math.round((s.count / maxCount) * 100);
                return (
                  <div key={s.stage_key} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="font-bold text-gray-900">{s.count} deal{s.count !== 1 ? 's' : ''}</span>
                            <span className="text-purple-700 font-semibold">{s.total_value_display}</span>
                            <span className="text-blue-600 font-semibold">{(s.probability * 100).toFixed(0)}% prob</span>
                            {s.avg_velocity_days != null && (
                              <span className={`font-semibold ${s.avg_velocity_days > 14 ? 'text-red-500' : 'text-green-600'}`}>
                                ~{s.avg_velocity_days}d avg
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barPct}%`, backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                          />
                        </div>
                      </div>
                      {s.conversion_to_next_pct != null && (
                        <div className="flex-shrink-0 text-right w-20">
                          <p className="text-xs text-gray-400">→ next</p>
                          <p className={`text-sm font-bold ${s.conversion_to_next_pct >= 50 ? 'text-green-600' : s.conversion_to_next_pct >= 25 ? 'text-orange-500' : 'text-red-500'}`}>
                            {s.conversion_to_next_pct}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CRM HEALTH ── */}
      {analyticsView === 'health' && health && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={health.score >= 75 ? '#10b981' : health.score >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="12"
                    strokeDasharray={`${(health.score / 100) * 264} 264`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${HEALTH_GRADE_COLOR[health.grade] || 'text-gray-700'}`}>{health.grade}</span>
                  <span className="text-xs text-gray-400">{health.score}/100</span>
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{health.summary}</p>
                <p className="text-sm text-gray-500 mt-1">{health.total_deals} deals analysed · {health.clean_deals ?? '—'} clean</p>
                {health.issues.length === 0 && (
                  <p className="mt-3 flex items-center gap-2 text-green-700 font-medium">
                    <CheckCircle className="w-4 h-4" /> Your CRM data is in great shape!
                  </p>
                )}
              </div>
            </div>
          </div>

          {health.issues.length > 0 && (
            <div className="space-y-3">
              {health.issues.map((issue) => (
                <div key={issue.type} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.medium}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-gray-900">{issue.label}</h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-gray-900">{issue.count}</p>
                      <p className="text-xs text-gray-400">{issue.pct}% of deals</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{issue.advice}</p>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full ${issue.severity === 'urgent' || issue.severity === 'high' ? 'bg-red-400' : 'bg-yellow-400'}`}
                      style={{ width: `${issue.pct}%` }}
                    />
                  </div>
                  {issue.deals && issue.deals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.deals.map((d, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">{d}</span>
                      ))}
                      {issue.count > issue.deals.length && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded">+{issue.count - issue.deals.length} more</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TOP ACCOUNTS ── */}
      {analyticsView === 'accounts' && accts && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{accts.total} accounts ranked by priority score · {accts.generated_at}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['#', 'Company', 'Priority Score', 'Owner', 'Deal', 'Urgency Signals', 'Next Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {accts.accounts.map((acc, i) => (
                    <tr key={i} className={`hover:bg-gray-50 transition-colors ${acc.alert_count > 0 ? 'bg-orange-50/30' : ''}`}>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-gray-900 text-sm">{acc.company}</p>
                        {acc.contact && (
                          <p className="text-xs text-gray-400">{acc.contact}{acc.contact_title ? ` · ${acc.contact_title}` : ''}</p>
                        )}
                        {acc.industry && <p className="text-xs text-gray-300">{acc.industry}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${acc.priority_score >= 70 ? 'bg-red-500' : acc.priority_score >= 40 ? 'bg-orange-400' : 'bg-blue-400'}`}
                              style={{ width: `${acc.priority_score}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${acc.priority_score >= 70 ? 'text-red-600' : acc.priority_score >= 40 ? 'text-orange-600' : 'text-gray-700'}`}>
                            {acc.priority_score}
                          </span>
                        </div>
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(acc.priority)}`}>
                          {(acc.priority || 'cold').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {acc.owner ? (
                          <span className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
                            <Users className="w-3 h-3" />{acc.owner}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {acc.has_open_deal ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700">{acc.deal_stage}</p>
                            {acc.deal_amount_display && (
                              <p className="text-xs text-green-700 font-semibold">{acc.deal_amount_display}</p>
                            )}
                            {acc.deal_close_date && (
                              <p className="text-xs text-gray-400">→ {acc.deal_close_date}</p>
                            )}
                          </div>
                        ) : <span className="text-xs text-gray-300">No deal</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px]">
                        {acc.urgency_signals && acc.urgency_signals.length > 0 ? (
                          <div className="space-y-1">
                            {acc.urgency_signals.slice(0, 2).map((sig, si) => (
                              <span key={si} className="block text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 truncate">
                                ⚡ {sig}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-[180px]">
                        {acc.next_action ? (
                          <p className="text-xs text-gray-500 truncate" title={acc.next_action}>{acc.next_action}</p>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {accts.accounts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Award className="w-10 h-10 mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500">No accounts found</p>
                  <p className="text-sm mt-1">Sync leads from HubSpot or Clay to see prioritised accounts</p>
                </div>
              )}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {accts.accounts.length} accounts · sorted by priority score (lead score × stage probability × recency)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ATTRIBUTION VIEW ── */}
      {analyticsView === 'attribution' && (() => {
        const attr = attributionData;
        if (attributionLoading) return (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading attribution…
          </div>
        );
        if (!attr) return (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <BarChart2 className="w-10 h-10 mb-3 opacity-40" />
            <p>No attribution data yet — connect HubSpot or Salesforce.</p>
          </div>
        );
        const { summary, stage_breakdown, signal_attribution, owner_performance, forecast_narrative } = attr;
        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Closed Won',       value: summary.closed_won_display,        sub: `${summary.closed_won_count} deals`,  color: 'text-green-600' },
                { label: 'Weighted Pipeline',value: summary.weighted_pipeline_display,  sub: `${summary.active_count} active deals`, color: 'text-blue-600' },
                { label: 'Win Rate',         value: `${summary.win_rate}%`,            sub: `${summary.closed_lost_count} lost`,  color: summary.win_rate >= 30 ? 'text-green-600' : 'text-orange-600' },
                { label: 'Active Pipeline',  value: summary.active_value ? `€${(summary.active_value/1000).toFixed(0)}k` : '€0', sub: 'total value', color: 'text-indigo-600' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs font-medium text-gray-700 mt-1">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stage attribution */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Pipeline by Stage
                </h3>
                <div className="space-y-3">
                  {stage_breakdown.map(s => {
                    const max = Math.max(...stage_breakdown.map(x => x.value || 0));
                    const pct = max > 0 ? Math.round((s.value / max) * 100) : 0;
                    return (
                      <div key={s.stage}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium truncate mr-2">{s.stage}</span>
                          <span className="text-gray-500 flex-shrink-0">{s.count} deals · {s.value_display}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owner performance */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Owner Performance
                </h3>
                <div className="space-y-3">
                  {owner_performance.slice(0, 6).map(o => (
                    <div key={o.owner} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800 truncate mr-3">{o.owner}</span>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                        <span className="text-green-600 font-semibold">{o.win_rate}% WR</span>
                        <span>{o.total_deals} deals</span>
                        <span className="text-blue-600 font-semibold">{o.pipeline_display}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Signal attribution */}
            {signal_attribution.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Signal Attribution
                </h3>
                <div className="flex flex-wrap gap-3">
                  {signal_attribution.map(s => (
                    <div key={s.type} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-gray-800">{s.type}</span>
                      <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Forecast narrative */}
            {forecast_narrative && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-5">
                <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI Attribution Forecast
                </h3>
                <div className="text-sm text-purple-800 space-y-2">
                  {forecast_narrative.split('\n').filter(Boolean).map((line, i) => {
                    if (line.startsWith('##')) return <p key={i} className="font-semibold text-purple-900 mt-3">{line.replace(/^##\s*/, '')}</p>;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
