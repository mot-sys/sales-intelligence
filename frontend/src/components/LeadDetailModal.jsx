/**
 * LeadDetailModal
 * Shared modal showing full AI scoring breakdown for a lead.
 * Used in PipelinePage (Prospects) and SignalsPage (Leads sub-tab).
 */
import { Send, Users, X } from 'lucide-react';

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

export default function LeadDetailModal({ lead, onClose }) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-lg max-w-xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">{lead.company_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Score + priority */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-gray-500">AI Score</p>
              <p className={`text-5xl font-bold ${getScoreColor(lead.score)}`}>{lead.score}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getPriorityColor(lead.priority)}`}>
              {(lead.priority || 'cold').toUpperCase()}
            </span>
          </div>

          {/* Owner */}
          {lead.owner_name && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <Users className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Owner</p>
                <p className="text-sm font-semibold text-indigo-900">{lead.owner_name}</p>
              </div>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Contact',   lead.contact_name],
              ['Title',     lead.contact_title],
              ['Industry',  lead.industry],
              ['Employees', lead.employee_count],
            ].map(([label, val]) => val && (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-gray-900">{val}</p>
              </div>
            ))}
          </div>

          {/* Score Breakdown */}
          {lead.scoring_breakdown && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Score Breakdown</p>
              <div className="space-y-2">
                {[
                  { label: 'Firmographics', key: 'firmographics', max: 20, color: 'bg-blue-500',   desc: 'Company size + industry fit' },
                  { label: 'Signals',       key: 'signals',       max: 40, color: 'bg-purple-500', desc: 'Funding, hiring, tech changes' },
                  { label: 'Intent',        key: 'intent',        max: 30, color: 'bg-orange-500', desc: 'Website visits + engagement' },
                  { label: 'Historical',    key: 'historical',    max: 10, color: 'bg-green-500',  desc: 'Conversion patterns' },
                ].map(({ label, key, max, color, desc }) => {
                  const val = lead.scoring_breakdown[key] ?? 0;
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

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Send className="w-4 h-4" /> Add to Sequence
            </button>
            <button className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              View in Salesforce
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
