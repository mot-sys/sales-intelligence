/**
 * CMTPage
 * Cross-department Management Team dashboard — initiative progress synced from Notion.
 */
import { useState, useEffect } from 'react';
import { Building2, AlertCircle, RefreshCw, Users, Clock, ExternalLink, Filter } from 'lucide-react';
import useDataStore from '../store/dataStore';

const STATUS_STYLES = {
  done:        { badge: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500', label: 'Done'        },
  in_progress: { badge: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500',  label: 'In Progress'  },
  not_started: { badge: 'bg-gray-100 text-gray-500 border-gray-200',    dot: 'bg-gray-400',  label: 'Not Started'  },
  blocked:     { badge: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500',   label: 'Blocked'      },
};

export default function CMTPage({ onNavigateToConnections }) {
  const [cmtStatusFilter, setCmtStatusFilter] = useState('all');
  const [cmtDeptFilter,   setCmtDeptFilter]   = useState('all');

  const {
    cmtDepartments, cmtOverview, cmtLoading, cmtError,
    cmtSyncing, cmtSyncMsg,
    fetchCmt, handleCmtSync,
  } = useDataStore();

  useEffect(() => { fetchCmt(); }, [fetchCmt]);

  const allDeptNames = cmtDepartments.map(d => d.name);

  const filteredDepts = cmtDepartments.map(dept => ({
    ...dept,
    initiatives: dept.initiatives.filter(i => {
      return cmtStatusFilter === 'all' || i.status_category === cmtStatusFilter;
    }),
  })).filter(dept =>
    (cmtDeptFilter === 'all' || dept.name === cmtDeptFilter) &&
    dept.initiatives.length > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              CMT Dashboard
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Cross-department initiative progress — synced from Notion
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {cmtOverview?.last_sync && (
              <span className="text-xs text-gray-400">
                Last sync: {new Date(cmtOverview.last_sync).toLocaleString()}
              </span>
            )}
            <button
              onClick={handleCmtSync}
              disabled={cmtSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cmtSyncing ? 'animate-spin' : ''}`} />
              {cmtSyncing ? 'Syncing…' : 'Sync Notion'}
            </button>
            <button
              onClick={fetchCmt}
              disabled={cmtLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cmtLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Sync feedback */}
        {cmtSyncMsg && (
          <p className={`mt-3 text-sm font-medium ${cmtSyncMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {cmtSyncMsg}
          </p>
        )}

        {/* Not connected notice */}
        {cmtOverview && !cmtOverview.notion_connected && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Notion is not connected.
            {onNavigateToConnections && (
              <button onClick={onNavigateToConnections} className="underline font-semibold ml-1">
                Go to Connections
              </button>
            )}
          </div>
        )}

        {/* Stats row */}
        {cmtOverview && cmtOverview.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {[
              { label: 'Total Initiatives', value: cmtOverview.total,                      color: 'text-gray-900' },
              { label: 'Done',              value: cmtOverview.by_status?.done ?? 0,        color: 'text-green-600' },
              { label: 'In Progress',       value: cmtOverview.by_status?.in_progress ?? 0, color: 'text-blue-600' },
              { label: 'Overdue',           value: cmtOverview.overdue ?? 0,                color: cmtOverview.overdue > 0 ? 'text-red-600' : 'text-gray-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4 text-center">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Avg progress bar */}
        {cmtOverview?.avg_progress != null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall avg. progress</span>
              <span className="font-semibold text-indigo-700">{cmtOverview.avg_progress}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                style={{ width: `${cmtOverview.avg_progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={cmtStatusFilter}
          onChange={e => setCmtStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          <option value="in_progress">In Progress</option>
          <option value="not_started">Not Started</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          value={cmtDeptFilter}
          onChange={e => setCmtDeptFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All departments</option>
          {allDeptNames.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Loading / Error */}
      {cmtLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-3" />
          Loading initiatives…
        </div>
      )}
      {cmtError && !cmtLoading && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {cmtError}
        </div>
      )}

      {/* Empty state */}
      {!cmtLoading && !cmtError && cmtDepartments.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No initiatives yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Connect Notion and sync your department databases to see initiative progress here.
          </p>
          {onNavigateToConnections && (
            <button
              onClick={onNavigateToConnections}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Connect Notion
            </button>
          )}
        </div>
      )}

      {/* Department Cards */}
      {!cmtLoading && filteredDepts.map(dept => {
        const pct = dept.total > 0 ? Math.round((dept.done / dept.total) * 100) : 0;
        return (
          <div key={dept.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Dept header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{dept.name}</h3>
                  <p className="text-xs text-gray-500">{dept.total} initiative{dept.total !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">{pct}%</p>
                  <p className="text-xs text-gray-500">{dept.done}/{dept.total} done</p>
                </div>
                <div className="w-24">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Initiative list */}
            <div className="divide-y divide-gray-50">
              {dept.initiatives.map(item => {
                const st      = STATUS_STYLES[item.status_category] || STATUS_STYLES.not_started;
                const overdue = item.is_overdue;
                return (
                  <div
                    key={item.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${overdue ? 'border-l-4 border-l-red-400' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                          {overdue && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                              Overdue
                            </span>
                          )}
                          {item.priority && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 capitalize">
                              {item.priority}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 truncate">
                          {item.notion_url ? (
                            <a
                              href={item.notion_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-indigo-600 hover:underline inline-flex items-center gap-1"
                            >
                              {item.title}
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ) : item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 text-xs text-gray-500 flex-shrink-0">
                        {item.owner && (
                          <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
                            <Users className="w-3 h-3" />
                            {item.owner}
                          </span>
                        )}
                        {item.due_date && (
                          <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            <Clock className="w-3 h-3" />
                            {new Date(item.due_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar (only if progress set and not done) */}
                    {item.progress != null && item.status_category !== 'done' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                          <span>Progress</span>
                          <span>{item.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.progress >= 75 ? 'bg-green-500' :
                              item.progress >= 40 ? 'bg-blue-500' : 'bg-yellow-400'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
