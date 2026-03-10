/**
 * DashboardPage — Overview with alert stats, charts, and top pending alerts
 * Store state: alerts, alertStats, fetchAlerts
 * Props: onNavigateToAlerts — called when user clicks "View all"
 */
import { useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Bell, BellOff, CheckCircle, AlertCircle } from 'lucide-react';
import useDataStore from '../store/dataStore';

const PRIORITY_STYLES = {
  urgent: { badge: 'bg-red-100 text-red-700 border-red-300',    dot: 'bg-red-500',    border: 'border-l-red-500' },
  high:   { badge: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500', border: 'border-l-orange-500' },
  medium: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500', border: 'border-l-yellow-400' },
  low:    { badge: 'bg-gray-100 text-gray-600 border-gray-300',  dot: 'bg-gray-400',   border: 'border-l-gray-300' },
};

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const WEEK_ACTIVITY = [
  { date: 'Mon', alerts: 8,  actioned: 6 },
  { date: 'Tue', alerts: 12, actioned: 10 },
  { date: 'Wed', alerts: 5,  actioned: 4 },
  { date: 'Thu', alerts: 15, actioned: 11 },
  { date: 'Fri', alerts: 9,  actioned: 7 },
  { date: 'Sat', alerts: 2,  actioned: 2 },
  { date: 'Sun', alerts: 1,  actioned: 1 },
];

export default function DashboardPage({ onNavigateToAlerts }) {
  const { alerts, alertStats, fetchAlerts } = useDataStore();

  useEffect(() => { fetchAlerts('pending'); }, [fetchAlerts]);

  const signalDistribution = [
    { name: 'Stalled Deals', value: alertStats.pending,                                       color: '#ef4444' },
    { name: 'Intent Spikes', value: Math.max(1, Math.floor(alertStats.pending * 0.6)),         color: '#f59e0b' },
    { name: 'Score Jumps',   value: Math.max(1, Math.floor(alertStats.pending * 0.3)),         color: '#3b82f6' },
    { name: 'Actioned',      value: alertStats.actioned,                                       color: '#10b981' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending Alerts',  value: alertStats.pending,            icon: Bell,         color: 'text-blue-500' },
          { label: 'Urgent / High',   value: alertStats.urgent_high_pending, icon: AlertCircle, color: 'text-red-500',   valueColor: 'text-red-600' },
          { label: 'Actioned Today',  value: alertStats.actioned,            icon: CheckCircle, color: 'text-green-500', valueColor: 'text-green-600' },
          { label: 'Snoozed',         value: alertStats.snoozed,             icon: BellOff,     color: 'text-gray-400' },
        ].map(({ label, value, icon: Icon, color, valueColor }) => (
          <div key={label} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-3xl font-bold ${valueColor || 'text-gray-900'}`}>{value}</p>
              </div>
              <Icon className={`w-10 h-10 ${color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Alert Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={WEEK_ACTIVITY}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="alerts"   fill="#3b82f6" name="Alerts" />
              <Bar dataKey="actioned" fill="#10b981" name="Actioned" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Alert Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={signalDistribution}
                cx="50%" cy="50%"
                labelLine={false}
                label={({ name, value }) => value > 0 ? name : ''}
                outerRadius={75}
                dataKey="value"
              >
                {signalDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top pending alerts ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Top Pending Alerts</h3>
          {onNavigateToAlerts && (
            <button onClick={onNavigateToAlerts} className="text-sm text-blue-600 hover:underline">
              View all
            </button>
          )}
        </div>
        <div className="p-5 space-y-3">
          {alerts.filter(a => a.status === 'pending').slice(0, 3).map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_STYLES[alert.priority]?.dot}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{alert.headline}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500">{timeAgo(alert.created_at)}</p>
                    {(alert.context?.owner_name || alert.lead?.owner_name) && (
                      <span className="text-xs text-indigo-600 font-medium">
                        · {alert.context?.owner_name || alert.lead?.owner_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[alert.priority]?.badge}`}>
                {alert.priority?.toUpperCase()}
              </span>
            </div>
          ))}
          {alerts.filter(a => a.status === 'pending').length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No pending alerts 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
}
