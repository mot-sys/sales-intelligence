/**
 * SignalsPage
 * Primary tab: Signals — Alerts, Buyer Journey, Lead Intel
 *
 * Reads all server state from useDataStore; manages only local UI state.
 */
import { useState, useEffect } from 'react';
import { Bell, Target, Users } from 'lucide-react';
import useDataStore from '../store/dataStore';
import LeadDetailModal from '../components/LeadDetailModal';

export default function SignalsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [subTab,         setSubTab]         = useState('alerts');
  const [filterStatus,   setFilterStatus]   = useState('pending');
  const [journeyCompany, setJourneyCompany] = useState('');
  const [selectedLead,   setSelectedLead]   = useState(null);

  // ── Server state ────────────────────────────────────────────────────────
  const {
    alerts, alertStats, alertsLoading, actioningId,
    leads,
    journeyAccounts, journeyData, journeyLoading,
    fetchAlerts, handleAlertAction, fetchJourney, fetchSignalsTab,
  } = useDataStore();

  // Fetch on mount
  useEffect(() => { fetchSignalsTab(filterStatus); }, []);   // eslint-disable-line

  // Re-fetch alerts when filter changes
  useEffect(() => { fetchAlerts(filterStatus); }, [filterStatus, fetchAlerts]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Signals</h2>
          <p className="text-sm text-gray-500 mt-0.5">Intent signals, alerts og kunderejser</p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { id: 'alerts',  label: 'Alerts',       Icon: Bell,   badge: alertStats.urgent_high_pending },
              { id: 'journey', label: 'Buyer Journey', Icon: Target },
              { id: 'leads',   label: 'Lead Intel',    Icon: Users  },
            ].map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => setSubTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  subTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
                {badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full leading-none">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Alerts sub-tab ── */}
        {subTab === 'alerts' && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {['pending', 'snoozed', 'actioned', 'dismissed'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  {s === 'pending' && alertStats.pending > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {alertStats.pending}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Alert list */}
            {alertsLoading ? (
              <div className="text-center py-10 text-gray-400">Indlæser alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-white rounded-lg border border-gray-200">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ingen {filterStatus} alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 20).map(alert => (
                  <div key={alert.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            alert.priority === 'urgent' ? 'bg-red-100 text-red-700'
                            : alert.priority === 'high' ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>{alert.priority}</span>
                          <span className="text-xs text-gray-400">{alert.type?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{alert.headline}</p>
                        {alert.recommendation && (
                          <p className="text-xs text-gray-500 mt-1">{alert.recommendation}</p>
                        )}
                      </div>
                      {filterStatus === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleAlertAction(alert.id, 'mark_actioned')}
                            disabled={actioningId === alert.id}
                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            Handl
                          </button>
                          <button
                            onClick={() => handleAlertAction(alert.id, 'snooze', { hours: 24 })}
                            disabled={actioningId === alert.id}
                            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            Snooz
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Buyer Journey sub-tab ── */}
        {subTab === 'journey' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-3">
              <input
                value={journeyCompany}
                onChange={e => setJourneyCompany(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && journeyCompany.trim()) {
                    fetchJourney(journeyCompany.trim());
                  }
                }}
                placeholder="Søg virksomhedsnavn..."
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
              />
              <button
                onClick={() => { if (journeyCompany.trim()) fetchJourney(journeyCompany.trim()); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Søg
              </button>
            </div>

            {/* Recent accounts quick-select */}
            {journeyAccounts.length > 0 && !journeyData && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Seneste accounts:</p>
                <div className="flex flex-wrap gap-2">
                  {journeyAccounts.slice(0, 12).map(a => (
                    <button
                      key={a.name}
                      onClick={() => { setJourneyCompany(a.name); fetchJourney(a.name); }}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {journeyLoading && (
              <div className="text-center py-10 text-gray-400">Indlæser kunderejse...</div>
            )}

            {/* Journey timeline */}
            {journeyData && !journeyLoading && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900">{journeyData.company}</h3>
                  <span className="text-sm text-gray-500">{journeyData.total_events} events</span>
                </div>
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-3">
                    {(journeyData.events || []).map((ev, i) => (
                      <div key={i} className="flex items-start gap-4 pl-4">
                        <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs z-10 ${
                          ev.color?.includes('red')    ? 'bg-red-500'
                          : ev.color?.includes('blue')   ? 'bg-blue-500'
                          : ev.color?.includes('green')  ? 'bg-green-500'
                          : ev.color?.includes('purple') ? 'bg-purple-500'
                          : 'bg-gray-400'
                        }`}>
                          {ev.icon || '•'}
                        </div>
                        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium text-gray-900">{ev.title}</p>
                            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString('da-DK') : ''}
                            </span>
                          </div>
                          {ev.detail && <p className="text-xs text-gray-500 mt-0.5">{ev.detail}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              {ev.category}
                            </span>
                            <span className="text-xs text-gray-400">{ev.source}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Lead Intel sub-tab ── */}
        {subTab === 'leads' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Virksomhed</th>
                  <th className="px-6 py-3 text-left">Industri</th>
                  <th className="px-6 py-3 text-right">Score</th>
                  <th className="px-6 py-3 text-left">Prioritet</th>
                  <th className="px-6 py-3 text-left">Seneste aktivitet</th>
                  <th className="px-6 py-3 text-left">Kilde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map(lead => (
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
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {lead.last_activity ? new Date(lead.last_activity).toLocaleDateString('da-DK') : '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{lead.source}</td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                      Ingen leads fundet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
