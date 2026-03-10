/**
 * LeadsPage — Lead Intelligence admin list
 * Store state: leads, leadsLoading, fetchLeads
 * Local state: filterOwner, selectedLead
 */
import { useState, useEffect } from 'react';
import { Users, Send, X } from 'lucide-react';
import useDataStore from '../store/dataStore';

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

export default function LeadsPage() {
  const [filterOwner, setFilterOwner]   = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  const { leads, leadsLoading, fetchLeads } = useDataStore();

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const owners = ['all', ...Array.from(new Set(leads.map(l => l.owner_name).filter(Boolean)))];
  const visibleLeads = filterOwner === 'all' ? leads : leads.filter(l => l.owner_name === filterOwner);

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Lead Intelligence</h2>
            <p className="text-sm text-gray-500 mt-1">AI-scored leads from all connected sources</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <select
                value={filterOwner}
                onChange={e => setFilterOwner(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {owners.map(o => (
                  <option key={o} value={o}>{o === 'all' ? 'All owners' : o}</option>
                ))}
              </select>
            </div>
            <input type="text" placeholder="Search leads..." className="px-4 py-2 border border-gray-300 rounded-lg w-48 text-sm" />
          </div>
        </div>

        {leadsLoading && !leads.length ? (
          <div className="py-12 text-center text-gray-400">Loading leads...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Company', 'Contact', 'Owner', 'Score', 'Priority', 'Source', ''].map((h, i) => (
                    <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleLeads.map((lead, i) => (
                  <tr key={lead.id || i} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{lead.company_name}</p>
                      <p className="text-sm text-gray-500">{lead.industry} &bull; {lead.employee_count} emp</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{lead.contact_name}</p>
                      <p className="text-xs text-gray-500">{lead.contact_title}</p>
                    </td>
                    <td className="px-6 py-4">
                      {lead.owner_name ? (
                        <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
                          <Users className="w-3.5 h-3.5" />
                          {lead.owner_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-2xl font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(lead.priority)}`}>
                        {(lead.priority || 'cold').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.source}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Lead detail modal ───────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-lg max-w-xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">{selectedLead.company_name}</h2>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-500">AI Score</p>
                  <p className={`text-5xl font-bold ${getScoreColor(selectedLead.score)}`}>{selectedLead.score}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getPriorityColor(selectedLead.priority)}`}>
                  {(selectedLead.priority || 'cold').toUpperCase()}
                </span>
              </div>

              {selectedLead.owner_name && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <Users className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Owner</p>
                    <p className="text-sm font-semibold text-indigo-900">{selectedLead.owner_name}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Contact',   selectedLead.contact_name],
                  ['Title',     selectedLead.contact_title],
                  ['Industry',  selectedLead.industry],
                  ['Employees', selectedLead.employee_count],
                ].map(([label, val]) => val && (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-gray-900">{val}</p>
                  </div>
                ))}
              </div>

              {selectedLead.scoring_breakdown && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Score Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Firmographics', key: 'firmographics', max: 20,  color: 'bg-blue-500',   desc: 'Company size + industry fit' },
                      { label: 'Signals',       key: 'signals',       max: 40,  color: 'bg-purple-500', desc: 'Funding, hiring, tech changes' },
                      { label: 'Intent',        key: 'intent',        max: 30,  color: 'bg-orange-500', desc: 'Website visits + engagement' },
                      { label: 'Historical',    key: 'historical',    max: 10,  color: 'bg-green-500',  desc: 'Conversion patterns' },
                    ].map(({ label, key, max, color, desc }) => {
                      const val = selectedLead.scoring_breakdown[key] ?? 0;
                      const pct = Math.round((val / max) * 100);
                      return (
                        <div key={key}>
                          <div className="flex justify-between items-center mb-0.5">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{label}</span>
                              <span className="text-xs text-gray-400 ml-1">— {desc}</span>
                            </div>
                            <span className="text-xs font-bold text-gray-900">{val}/{max}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  <Send className="w-4 h-4" />Add to Sequence
                </button>
                <button className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  View in Salesforce
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
