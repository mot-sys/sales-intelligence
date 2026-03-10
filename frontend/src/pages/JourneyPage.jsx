/**
 * JourneyPage
 * Full touchpoint timeline for any account — deals, signals, alerts in one view.
 */
import { useState, useEffect } from 'react';
import { Target, RefreshCw, Clock } from 'lucide-react';
import useDataStore from '../store/dataStore';

const EVENT_COLORS = {
  blue:   'border-blue-400 bg-blue-50',
  orange: 'border-orange-400 bg-orange-50',
  red:    'border-red-400 bg-red-50',
  purple: 'border-purple-400 bg-purple-50',
  green:  'border-green-400 bg-green-50',
  indigo: 'border-indigo-400 bg-indigo-50',
  yellow: 'border-yellow-400 bg-yellow-50',
  gray:   'border-gray-300 bg-gray-50',
};

export default function JourneyPage() {
  const [journeyCompany, setJourneyCompany] = useState('');

  const {
    journeyAccounts,
    journeyData,
    journeyLoading,
    fetchJourneyAccounts,
    fetchJourney,
  } = useDataStore();

  useEffect(() => { fetchJourneyAccounts(); }, [fetchJourneyAccounts]);

  const handleSearch = () => {
    if (journeyCompany.trim()) fetchJourney(journeyCompany.trim());
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-blue-600" />
          Buyer Journey
        </h2>
        <p className="text-sm text-gray-500 mb-5">Full touchpoint timeline for any account — deals, signals, alerts in one view</p>

        {/* Search */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search account name…"
            value={journeyCompany}
            onChange={e => setJourneyCompany(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={journeyLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {journeyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'View Journey'}
          </button>
        </div>

        {/* Quick-select accounts */}
        {!journeyData && journeyAccounts.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Recent accounts</p>
            <div className="flex flex-wrap gap-2">
              {journeyAccounts.slice(0, 10).map((acc, i) => (
                <button
                  key={i}
                  onClick={() => { setJourneyCompany(acc.name); fetchJourney(acc.name); }}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 border border-gray-200 rounded-full transition-colors"
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Journey timeline */}
      {journeyData && (
        <div className="space-y-4">
          {/* Deal summary */}
          {journeyData.deal && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-blue-900 text-lg">{journeyData.deal.account_name}</p>
                <p className="text-sm text-blue-700">
                  Stage: <strong>{journeyData.deal.stage}</strong>
                  {journeyData.deal.amount ? ` · €${journeyData.deal.amount.toLocaleString()}` : ''}
                  {journeyData.deal.owner ? ` · ${journeyData.deal.owner}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {journeyData.deal.is_stalled && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-semibold">⚠️ Stalled</span>
                )}
                {journeyData.deal.close_date && (
                  <span className="px-2 py-1 bg-white border border-blue-200 rounded-full text-xs text-blue-700">
                    Closes: {new Date(journeyData.deal.close_date).toLocaleDateString('da-DK')}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-600 mb-4">
              {journeyData.total_events} events for <span className="text-blue-700">{journeyData.company}</span>
            </p>
            {journeyData.events.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
                No events found for this account.
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {journeyData.events.map((evt, i) => {
                    const colorClass = EVENT_COLORS[evt.color] || EVENT_COLORS.gray;
                    return (
                      <div key={i} className="relative flex gap-4 pl-12">
                        {/* Icon bubble */}
                        <div className={`absolute left-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-base flex-shrink-0 bg-white ${colorClass.split(' ')[0]}`}>
                          {evt.icon}
                        </div>
                        {/* Content */}
                        <div className={`flex-1 rounded-lg border p-3 ${colorClass}`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 text-sm">{evt.title}</p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {evt.priority && (
                                <span className="text-xs px-1.5 py-0.5 bg-white border rounded-full text-gray-600 capitalize">{evt.priority}</span>
                              )}
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {evt.timestamp
                                  ? new Date(evt.timestamp).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : '—'}
                              </span>
                            </div>
                          </div>
                          {evt.detail && <p className="text-xs text-gray-600 mt-1">{evt.detail}</p>}
                          <p className="text-xs text-gray-400 mt-1">via {evt.source}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
