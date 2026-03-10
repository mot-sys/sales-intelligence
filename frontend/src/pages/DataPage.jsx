/**
 * DataPage — Pipeline Data (deals + leads tables)
 * Store state: pipelineData, pipelineLoading, fetchPipelineData
 * Local state: pipelineSearch, pipelineView
 */
import { useState, useEffect } from 'react';
import { RefreshCw, Database, Users, AlertCircle, CheckCircle } from 'lucide-react';
import useDataStore from '../store/dataStore';

const STAGE_COLORS = {
  closedwon:                 'bg-green-100 text-green-800 border-green-200',
  contractsent:              'bg-blue-100 text-blue-800 border-blue-200',
  decisionmakerboughtin:     'bg-purple-100 text-purple-800 border-purple-200',
  presentationscheduled:     'bg-indigo-100 text-indigo-800 border-indigo-200',
  qualifiedtobuy:            'bg-cyan-100 text-cyan-800 border-cyan-200',
  appointmentscheduled:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  closedlost:                'bg-red-100 text-red-800 border-red-200',
};

const stageLabel = s =>
  s ? s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

function getScoreColor(score) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-orange-500';
  return 'text-gray-500';
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'hot':  return 'bg-red-100 text-red-700 border-red-200';
    case 'warm': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'cold': return 'bg-blue-100 text-blue-700 border-blue-200';
    default:     return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function DataPage() {
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineView,   setPipelineView]   = useState('deals'); // 'deals' | 'leads'

  const { pipelineData, pipelineLoading, fetchPipelineData } = useDataStore();

  useEffect(() => { fetchPipelineData(); }, [fetchPipelineData]);

  const summary = pipelineData?.summary;

  const deals = (pipelineData?.deals || []).filter(d => {
    if (!pipelineSearch) return true;
    const q = pipelineSearch.toLowerCase();
    return (d.name  || '').toLowerCase().includes(q)
        || (d.stage || '').toLowerCase().includes(q)
        || (d.owner || '').toLowerCase().includes(q);
  });

  const leads = (pipelineData?.leads || []).filter(d => {
    if (!pipelineSearch) return true;
    const q = pipelineSearch.toLowerCase();
    return (d.company_name || '').toLowerCase().includes(q)
        || (d.owner_name   || '').toLowerCase().includes(q)
        || (d.priority     || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Open Deals',     value: summary.total_open_deals,       color: 'text-blue-600' },
            { label: 'Pipeline Value', value: summary.total_pipeline_display,  color: 'text-green-600' },
            { label: 'Stalled',        value: summary.stalled_deals,           color: summary.stalled_deals > 0        ? 'text-red-600'    : 'text-gray-500' },
            { label: 'Pending Alerts', value: summary.pending_alerts,          color: summary.pending_alerts > 0       ? 'text-orange-600' : 'text-gray-500' },
            { label: 'Top Lead Score', value: summary.top_lead_score ?? '—',   color: 'text-purple-600' },
            { label: 'Urgent / High',  value: summary.urgent_or_high_alerts,   color: summary.urgent_or_high_alerts > 0 ? 'text-red-600'   : 'text-gray-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Stage distribution bar ──────────────────────────────────────────── */}
      {summary?.deals_by_stage && Object.keys(summary.deals_by_stage).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deals by Stage</p>
          <div className="space-y-2">
            {Object.entries(summary.deals_by_stage)
              .sort(([, a], [, b]) => b - a)
              .map(([stage, count]) => {
                const total = summary.total_open_deals || 1;
                const pct   = Math.round((count / total) * 100);
                return (
                  <div key={stage}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs text-gray-700">{stageLabel(stage)}</span>
                      <span className="text-xs font-semibold text-gray-900">{count} deal{count !== 1 ? 's' : ''} &nbsp;·&nbsp; {pct}%</span>
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

      {/* ── View toggle + search ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {[['deals', 'Deals'], ['leads', 'Leads']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setPipelineView(id); setPipelineSearch(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                pipelineView === id
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
              <span className="ml-2 text-xs opacity-70">
                {id === 'deals' ? (pipelineData?.deals?.length ?? 0) : (pipelineData?.leads?.length ?? 0)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {pipelineLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
          <input
            type="text"
            placeholder={`Search ${pipelineView}...`}
            value={pipelineSearch}
            onChange={e => setPipelineSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-52"
          />
          <button
            onClick={fetchPipelineData}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Deals table ─────────────────────────────────────────────────────── */}
      {pipelineView === 'deals' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {pipelineLoading && !pipelineData ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-3" />
              <span>Loading deals...</span>
            </div>
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Database className="w-10 h-10 mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">{pipelineSearch ? 'No deals match your search' : 'No deals found'}</p>
              <p className="text-sm mt-1">Sync HubSpot or Salesforce to see your pipeline data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Company', 'Stage', 'Amount', 'Owner', 'Close Date', 'Last Activity', 'CRM', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.map((deal, i) => (
                    <tr key={i} className={`hover:bg-gray-50 transition-colors ${deal.is_stalled ? 'bg-red-50/40' : ''}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-900 text-sm">{deal.name}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STAGE_COLORS[deal.stage?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {stageLabel(deal.stage)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900 text-sm">{deal.amount_display || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {deal.owner
                          ? <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium"><Users className="w-3.5 h-3.5" />{deal.owner}</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {deal.close_date || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {deal.days_since_last_activity != null ? (
                          <span className={`text-sm font-medium ${
                            deal.days_since_last_activity > 14 ? 'text-red-600' :
                            deal.days_since_last_activity > 7  ? 'text-orange-500' : 'text-green-600'
                          }`}>
                            {deal.days_since_last_activity}d ago
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          deal.crm === 'hubspot' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {deal.crm === 'hubspot' ? 'HubSpot' : 'Salesforce'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {deal.is_stalled
                          ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertCircle className="w-3.5 h-3.5" />Stalled</span>
                          : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3.5 h-3.5" />Active</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {deals.length} deals{pipelineData?.generatedAt ? ` · Synced ${pipelineData.generatedAt}` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Leads table ─────────────────────────────────────────────────────── */}
      {pipelineView === 'leads' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {pipelineLoading && !pipelineData ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-3" />
              <span>Loading leads...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="w-10 h-10 mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">{pipelineSearch ? 'No leads match your search' : 'No leads found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Company', 'Contact', 'Score', 'Priority', 'Industry', 'Employees', 'Owner', 'Source', 'Recommendation'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead, i) => (
                    <tr key={lead.id || i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-900 text-sm">{lead.company_name}</p>
                        {lead.company_domain && <p className="text-xs text-gray-400">{lead.company_domain}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-800">{lead.contact_name || '—'}</p>
                        <p className="text-xs text-gray-400">{lead.contact_title || ''}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-2xl font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(lead.priority)}`}>
                          {(lead.priority || 'cold').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{lead.industry || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{lead.employee_count ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {lead.owner_name
                          ? <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium"><Users className="w-3.5 h-3.5" />{lead.owner_name}</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          lead.source === 'hubspot' ? 'bg-orange-100 text-orange-700' :
                          lead.source === 'clay'    ? 'bg-blue-100 text-blue-700' :
                                                      'bg-gray-100 text-gray-600'
                        }`}>{lead.source || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs">
                        {lead.recommendation
                          ? <p className="text-xs text-gray-500 truncate" title={lead.recommendation}>{lead.recommendation}</p>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {leads.length} leads
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
