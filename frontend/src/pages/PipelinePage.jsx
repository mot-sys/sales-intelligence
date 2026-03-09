/**
 * PipelinePage
 * Primary tab: Pipeline — Deals, Accounts, Prospects
 *
 * Reads all server state from useDataStore; manages only local UI state.
 */
import { useState, useEffect } from 'react';
import { Building2, TrendingUp, Users } from 'lucide-react';
import useDataStore from '../store/dataStore';
import LeadDetailModal from '../components/LeadDetailModal';

export default function PipelinePage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [subTab,         setSubTab]         = useState('deals');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [selectedLead,   setSelectedLead]   = useState(null);

  // ── Server state ────────────────────────────────────────────────────────
  const {
    pipelineData,    pipelineLoading,
    analyticsData,   analyticsLoading,
    leads,
    fetchPipelineTab,
  } = useDataStore();

  // Fetch on mount
  useEffect(() => { fetchPipelineTab(); }, [fetchPipelineTab]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const deals = (pipelineData?.deals || []).filter(d =>
    !pipelineSearch || (d.name || d.account_name || '').toLowerCase().includes(pipelineSearch.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pipeline</h2>
          <p className="text-sm text-gray-500 mt-0.5">Deals, accounts og prospects fra din CRM</p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { id: 'deals',     label: 'Deals',     Icon: TrendingUp },
            { id: 'accounts',  label: 'Accounts',  Icon: Building2  },
            { id: 'prospects', label: 'Prospects', Icon: Users      },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                subTab === id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* ── Deals ── */}
        {subTab === 'deals' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                value={pipelineSearch}
                onChange={e => setPipelineSearch(e.target.value)}
                placeholder="Søg deals..."
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
              />
              <span className="text-sm text-gray-500">{deals.length} deals</span>
            </div>

            {pipelineLoading ? (
              <div className="text-center py-10 text-gray-400">Indlæser pipeline...</div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-6 py-3 text-left">Virksomhed</th>
                      <th className="px-6 py-3 text-right">Beløb</th>
                      <th className="px-6 py-3 text-left">Stage</th>
                      <th className="px-6 py-3 text-left">Ejer</th>
                      <th className="px-6 py-3 text-left">Lukkdato</th>
                      <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deals.slice(0, 30).map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{d.name || d.account_name || '—'}</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-700">
                          {d.amount ? `${(d.amount / 1000).toFixed(0)}k` : '—'}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{d.stage || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{d.owner || d.owner_name || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {d.close_date ? new Date(d.close_date).toLocaleDateString('da-DK') : '—'}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {d.is_stalled
                            ? <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Stalled</span>
                            : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Aktiv</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {deals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                          Ingen deals fundet. Sync din CRM under Integrationer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Accounts ── */}
        {subTab === 'accounts' && (
          <div className="bg-white rounded-lg border border-gray-200">
            {analyticsLoading ? (
              <div className="text-center py-10 text-gray-400">Indlæser accounts...</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Virksomhed</th>
                    <th className="px-6 py-3 text-left">Industri</th>
                    <th className="px-6 py-3 text-right">Ansatte</th>
                    <th className="px-6 py-3 text-right">Prioritetsscore</th>
                    <th className="px-6 py-3 text-left">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(analyticsData?.accounts?.accounts || []).slice(0, 25).map((a, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        {a.account_name || a.company_name || '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{a.industry || '—'}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-600">
                        {a.employee_count?.toLocaleString() || '—'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-sm font-bold text-blue-600">
                          {Math.round(a.priority_score || a.score || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {a.stage || a.current_stage || '—'}
                      </td>
                    </tr>
                  ))}
                  {!(analyticsData?.accounts?.accounts?.length) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">
                        Sync HubSpot eller Salesforce for at se accounts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Prospects ── */}
        {subTab === 'prospects' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Virksomhed</th>
                    <th className="px-6 py-3 text-left">Industri</th>
                    <th className="px-6 py-3 text-right">Score</th>
                    <th className="px-6 py-3 text-left">Prioritet</th>
                    <th className="px-6 py-3 text-left">Ejer</th>
                    <th className="px-6 py-3 text-left">Kilde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.slice(0, 25).map(lead => (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{lead.company_name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{lead.industry || '—'}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`text-sm font-bold ${
                          lead.score >= 70 ? 'text-green-600'
                          : lead.score >= 40 ? 'text-amber-600'
                          : 'text-gray-500'
                        }`}>{lead.score}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          lead.priority === 'hot'  ? 'bg-red-100 text-red-700'
                          : lead.priority === 'warm' ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{lead.priority || 'cold'}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{lead.owner_name || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{lead.source}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                        Ingen prospects. Sync din CRM eller Clay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </>
  );
}
