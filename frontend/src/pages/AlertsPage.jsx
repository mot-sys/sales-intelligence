/**
 * AlertsPage — Alert list with filter tabs and AlertCard
 * Store state: alerts, alertStats, alertsLoading, actioningId, handleAlertAction, fetchAlerts
 * Local state: filterStatus
 */
import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, Clock, ExternalLink, X } from 'lucide-react';
import useDataStore from '../store/dataStore';

// ─── Shared constants ─────────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  urgent: { badge: 'bg-red-100 text-red-700 border-red-300',         dot: 'bg-red-500',    border: 'border-l-red-500' },
  high:   { badge: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500', border: 'border-l-orange-500' },
  medium: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500', border: 'border-l-yellow-400' },
  low:    { badge: 'bg-gray-100 text-gray-600 border-gray-300',       dot: 'bg-gray-400',   border: 'border-l-gray-300' },
};

const ALERT_TYPE_LABELS = {
  stalled_deal: 'Stalled Deal',
  intent_spike: 'Intent Spike',
  score_jump:   'Score Jump',
  daily_digest: 'Daily Digest',
};

const SOURCE_LABELS = {
  salesforce: 'Salesforce',
  snitcher:   'Snitcher',
  clay:       'Clay',
  scoring:    'AI Scoring',
};

function getScoreColor(score) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-orange-500';
  return 'text-gray-500';
}

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── AlertCard ────────────────────────────────────────────────────────────────
function AlertCard({ alert, onAction, isActioning }) {
  const pStyle = PRIORITY_STYLES[alert.priority] || PRIORITY_STYLES.low;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-lg border border-l-4 ${pStyle.border} border-gray-200 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${pStyle.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${pStyle.badge}`}>
                  {alert.priority?.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">{ALERT_TYPE_LABELS[alert.type] || alert.type}</span>
                <span className="text-xs text-gray-400">via {SOURCE_LABELS[alert.source] || alert.source}</span>
                {alert.status !== 'pending' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{alert.status}</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 text-base leading-snug">{alert.headline}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {alert.lead && (
                  <p className="text-sm text-gray-500">
                    {alert.lead.company_name} &bull; Score{' '}
                    <span className={`font-semibold ${getScoreColor(alert.lead.score)}`}>{alert.lead.score}</span>
                  </p>
                )}
                {(alert.context?.owner_name || alert.lead?.owner_name) && (
                  <p className="text-sm text-indigo-600 font-medium">
                    {alert.context?.owner_name || alert.lead?.owner_name}
                  </p>
                )}
                <p className="text-xs text-gray-400 ml-auto">{timeAgo(alert.created_at)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {alert.lead?.website && (
              <a href={`https://${alert.lead.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100">
              {expanded ? 'Less' : 'More'}
            </button>
          </div>
        </div>

        {/* Expanded body */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {alert.body && <p className="text-sm text-gray-700 mb-3 leading-relaxed">{alert.body}</p>}
            {alert.context?.deal_name && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 mb-3">
                {alert.context.deal_name  && <div><span className="font-medium">Deal:</span> {alert.context.deal_name}</div>}
                {alert.context.deal_value && <div><span className="font-medium">Value:</span> {alert.context.deal_value}</div>}
                {alert.context.deal_stage && <div><span className="font-medium">Stage:</span> {alert.context.deal_stage}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (only for pending) */}
      {alert.status === 'pending' && (
        <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-gray-50 pt-3">
          <button
            onClick={() => onAction(alert.id, 'action')}
            disabled={isActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Mark Actioned
          </button>
          <button
            onClick={() => onAction(alert.id, 'snooze', { hours: 24 })}
            disabled={isActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5" />
            Snooze 24h
          </button>
          <button
            onClick={() => onAction(alert.id, 'dismiss')}
            disabled={isActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AlertsPage ───────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [filterStatus, setFilterStatus] = useState('pending');

  const {
    alerts, alertStats, alertsLoading, actioningId,
    handleAlertAction, fetchAlerts,
  } = useDataStore();

  // Fetch when filter changes
  useEffect(() => { fetchAlerts(filterStatus); }, [filterStatus, fetchAlerts]);

  return (
    <div className="space-y-4">
      {/* Filter tabs + count */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['pending', 'snoozed', 'actioned', 'dismissed'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                filterStatus === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s === 'pending' && alertStats.pending > 0 && (
                <span className={`ml-2 px-1.5 text-xs rounded-full ${filterStatus === s ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                  {alertStats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500">{alerts.length} alerts</p>
      </div>

      {/* Content */}
      {alertsLoading ? (
        <div className="text-center py-12 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>Loading alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-gray-700">All clear!</p>
          <p className="text-sm mt-1">No {filterStatus} alerts right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAction={handleAlertAction}
              isActioning={actioningId === alert.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
