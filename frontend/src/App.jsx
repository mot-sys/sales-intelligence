import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Activity, Database, Brain, Users, Send, CheckCircle, AlertCircle, Clock,
  TrendingUp, Zap, Settings, ExternalLink, RefreshCw, Bell, BellOff, X, ChevronDown,
  MessageSquare, Sparkles, CornerDownLeft, BarChart2, Target, Award, ShieldCheck, FileText,
  Building2, Layers, Filter, Compass, Archive, Radio, Plus, Trash2, Save,
  Camera, History,
} from 'lucide-react';

// Ã¢â€â‚¬Ã¢â€â‚¬ Page components (P1.10 extraction) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
import GTMSetupPage     from './pages/GTMSetupPage';
import IntelligencePage from './pages/IntelligencePage';
import PipelinePage     from './pages/PipelinePage';
import SignalsPage      from './pages/SignalsPage';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// CHAT CHART RENDERER
// Renders AI-generated chart specs from render_chart tool calls
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const CHART_PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#16a34a', '#ea580c', '#0284c7',
];

const formatChartValue = (value, prefix = '', suffix = '') => {
  if (value === null || value === undefined) return 'Ã¢â‚¬â€';
  if (typeof value === 'number' && value >= 1000) {
    return `${prefix}${value >= 1000000
      ? (value / 1000000).toFixed(1) + 'M'
      : (value / 1000).toFixed(0) + 'k'
    }${suffix}`;
  }
  return `${prefix}${value}${suffix}`;
};

const ChatChart = ({ spec }) => {
  if (!spec || !spec.data || spec.data.length === 0) return null;
  const { chart_type, title, data, value_prefix = '', value_suffix = '' } = spec;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label || payload[0]?.name}</p>
        <p className="text-purple-700 font-bold">
          {formatChartValue(payload[0]?.value, value_prefix, value_suffix)}
        </p>
      </div>
    );
  };

  return (
    <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      {title && (
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{title}</p>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Vertical bar chart Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {chart_type === 'bar' && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={v => formatChartValue(v, value_prefix, value_suffix)}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Horizontal bar chart Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {chart_type === 'horizontal_bar' && (
        <div className="space-y-2">
          {data.map((item, i) => {
            const max = Math.max(...data.map(d => d.value || 0));
            const pct = max > 0 ? Math.round((item.value / max) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs text-gray-700 truncate max-w-[60%]">{item.name}</span>
                  <span className="text-xs font-semibold text-gray-900 ml-2">
                    {formatChartValue(item.value, value_prefix, value_suffix)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Pie chart Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {chart_type === 'pie' && (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              label={({ name, percent }) =>
                percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val) => [
                formatChartValue(val, value_prefix, value_suffix),
                'VÃƒÂ¦rdi',
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// API HELPERS
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

// API requests use relative URLs so Vercel proxies them to Railway server-side.
// Override with VITE_API_URL only if you need to bypass the proxy.
const API_BASE = ((import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '')
  || '').replace(/^(?!https?:\/\/)(.+)/, 'https://$1');

const API = {
  async get(path) {
    const res = await fetch(`${API_BASE}/api${path}`);
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  },
  async put(path, body) {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  },
  async delete(path) {
    const res = await fetch(`${API_BASE}/api${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  },
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// UTILITY HELPERS
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const PRIORITY_STYLES = {
  urgent: { badge: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500', border: 'border-l-red-500' },
  high:   { badge: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500', border: 'border-l-orange-500' },
  medium: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500', border: 'border-l-yellow-400' },
  low:    { badge: 'bg-gray-100 text-gray-600 border-gray-300', dot: 'bg-gray-400', border: 'border-l-gray-300' },
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

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'hot': return 'bg-red-100 text-red-700 border-red-200';
    case 'warm': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'cold': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getScoreColor(score) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-orange-500';
  return 'text-gray-500';
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ALERT CARD COMPONENT
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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
                  {alert.priority.toUpperCase()}
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
                  <span className="flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                    <Users className="w-3 h-3" />
                    {alert.context?.owner_name || alert.lead?.owner_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(alert.created_at)}</span>
            <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600">
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expandable context */}
        {expanded && alert.context && (
          <div className="mt-3 ml-5 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 space-y-1">
            {alert.context.detail && <p>{alert.context.detail}</p>}
            {alert.context.pages && (
              <p><span className="font-medium">Pages visited:</span> {alert.context.pages.join(', ')}</p>
            )}
            {alert.context.delta && (
              <p><span className="font-medium">Score change:</span> +{alert.context.delta} points</p>
            )}
          </div>
        )}

        {/* AI Recommendation */}
        {alert.recommendation && (
          <div className="mt-3 ml-5 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Brain className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{alert.recommendation}</p>
          </div>
        )}

        {/* Action buttons */}
        {alert.status === 'pending' && (
          <div className="mt-4 ml-5 flex flex-wrap gap-2">
            <button
              disabled={isActioning}
              onClick={() => onAction(alert.id, 'mark_actioned')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark Actioned
            </button>
            <button
              disabled={isActioning}
              onClick={() => onAction(alert.id, 'snooze', { hours: 24 })}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5" />
              Snooze 24h
            </button>
            <button
              disabled={isActioning}
              onClick={() => onAction(alert.id, 'dismiss')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// MAIN APP
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const SalesIntelligencePlatform = () => {
  const [activeTab, setActiveTab] = useState('gtm-setup');
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({ pending: 0, snoozed: 0, dismissed: 0, actioned: 0, urgent_high_pending: 0 });
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [selectedLead, setSelectedLead] = useState(null);
  const [filterOwner, setFilterOwner] = useState('all');
  const [connections, setConnections] = useState([]);
  const [connectModal, setConnectModal] = useState(null); // service id or null
  const [connectForm, setConnectForm] = useState({});
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState(null);
  // AI Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatContext, setChatContext] = useState(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const chatBottomRef = React.useRef(null);
  // AI Settings / Skills
  const [aiSettings, setAiSettings] = useState(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [contextInput, setContextInput] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  // Pipeline Data tab
  const [pipelineData, setPipelineData] = useState(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineView, setPipelineView] = useState('deals'); // deals | leads
  // Analytics tab
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsView, setAnalyticsView] = useState('forecast'); // forecast | funnel | health | accounts
  // Weekly Report tab
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [weeklyReportGenerating, setWeeklyReportGenerating] = useState(false);
  const [weeklyReportError, setWeeklyReportError] = useState(null);
  // Workflows tab
  const [workflows, setWorkflows] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [wfModal, setWfModal] = useState(null);        // null | 'create' | workflow-object
  const [wfRunning, setWfRunning] = useState(null);    // workflow id being run
  const [wfRunResult, setWfRunResult] = useState({});  // id Ã¢â€ â€™ result
  const [wfForm, setWfForm] = useState({ name: '', description: '', trigger_type: 'manual', conditions: [], actions: [] });
  // Buyer Journey tab
  const [journeyCompany, setJourneyCompany] = useState('');
  const [journeyData, setJourneyData] = useState(null);
  const [journeyAccounts, setJourneyAccounts] = useState([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  // Attribution
  const [attributionData, setAttributionData] = useState(null);
  const [attributionLoading, setAttributionLoading] = useState(false);
  // CMT Dashboard tab
  const [cmtOverview, setCmtOverview] = useState(null);
  const [cmtDepartments, setCmtDepartments] = useState([]);
  const [cmtLoading, setCmtLoading] = useState(false);
  const [cmtError, setCmtError] = useState(null);
  const [cmtSyncing, setCmtSyncing] = useState(false);
  const [cmtSyncMsg, setCmtSyncMsg] = useState(null);
  const [cmtStatusFilter, setCmtStatusFilter] = useState('all');
  const [cmtDeptFilter, setCmtDeptFilter] = useState('all');

  // Ã¢â€â‚¬Ã¢â€â‚¬ GTM Setup state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [gtmTab, setGtmTab] = useState('strategy');
  const [gtmConfig, setGtmConfig] = useState(null);
  const [gtmSaving, setGtmSaving] = useState(false);
  const [gtmSaved, setGtmSaved] = useState(false);
  const [strategyForm, setStrategyForm] = useState({
    company_description: '', value_proposition: '', competitors: [], offerings: [],
  });
  const [icpForm, setIcpForm] = useState({
    personas: [],
    company_filters: { industries: [], employee_min: 1, employee_max: 5000, geographies: [], technologies: [] },
    tam_total: 0, tam_notes: '',
  });
  const [goalsForm, setGoalsForm] = useState({
    period: 'annual', revenue_target: 0, acv: 0,
    win_rate_pct: 25, opp_to_meeting_rate_pct: 30, outreach_response_rate_pct: 10,
    current_arr: 0,
  });
  // Industry/geo chip input helpers
  const [industryInput, setIndustryInput] = useState('');
  const [geoInput, setGeoInput] = useState('');
  // Bottom-up calculator
  const [bottomUpPerDay, setBottomUpPerDay] = useState(5);

  // Goals input mode: 'absolute' = enter kr amount, 'percent' = enter % growth of current ARR
  const [goalsInputMode, setGoalsInputMode] = useState('absolute');
  const [growthPct, setGrowthPct] = useState(0);

  // CRM progress / gap analysis
  const [progressData, setProgressData] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Intelligence state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceSubTab, setIntelligenceSubTab] = useState('overblik');

  // Ã¢â€â‚¬Ã¢â€â‚¬ Daily report (scorekort) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [dailyReport, setDailyReport] = useState(null);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Forecast Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastHistory, setForecastHistory] = useState(null);
  const [forecastHistoryLoading, setForecastHistoryLoading] = useState(false);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Learnings Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [learnings, setLearnings] = useState(null);
  const [learningsLoading, setLearningsLoading] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Management Tasks Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [mgmtTasks, setMgmtTasks] = useState(null);
  const [mgmtTasksLoading, setMgmtTasksLoading] = useState(false);
  const [dismissedTaskIds, setDismissedTaskIds] = useState(new Set());

  // Ã¢â€â‚¬Ã¢â€â‚¬ AI Agent Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [agentData, setAgentData] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ New sub-tab state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [pipelineSubTab, setPipelineSubTab] = useState('deals');
  const [signalsSubTab, setSignalsSubTab] = useState('alerts');

  // Ã¢â€â‚¬Ã¢â€â‚¬ Legacy dropdown state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [legacyOpen, setLegacyOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsData, statsData] = await Promise.all([
        API.get(`/alerts/?status=${filterStatus}&limit=50`),
        API.get('/alerts/stats'),
      ]);
      setAlerts(alertsData.alerts || []);
      setAlertStats(statsData);
    } catch {
      setAlerts([]);
      setAlertStats({ pending: 0, snoozed: 0, dismissed: 0, actioned: 0, urgent_high_pending: 0 });
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.get('/leads?limit=50');
      setLeads(data.leads || data.items || []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await API.get('/connections');
      setConnections(data.integrations || []);
    } catch {
      setConnections([]);
    }
  }, []);

  const fetchChatContext = useCallback(async () => {
    try {
      const [ctxData, sugData, settingsData] = await Promise.all([
        API.get('/chat/context'),
        API.get('/chat/suggested'),
        API.get('/settings/ai'),
      ]);
      setChatContext(ctxData.pipeline_summary);
      setSuggestedQuestions(sugData.questions || []);
      setAiSettings(settingsData);
      setContextInput(settingsData.company_context || '');
    } catch {
      setSuggestedQuestions([
        'Hvad skal jeg fokusere pÃƒÂ¥ denne uge?',
        'Hvilke deals er mest i fare?',
        'Hvilke leads bÃƒÂ¸r jeg kontakte i dag?',
        'Giv mig et overblik over min pipeline',
      ]);
    }
  }, []);

  const saveAiSettings = async (updates) => {
    if (!aiSettings) return;
    setSettingsSaving(true);
    try {
      const saved = await API.put('/settings/ai', {
        model: updates.model ?? aiSettings.model,
        skills: updates.skills ?? aiSettings.skills,
        company_context: updates.company_context ?? aiSettings.company_context,
      });
      setAiSettings(saved);
    } catch (e) {
      console.error('Failed to save AI settings:', e);
    } finally {
      setSettingsSaving(false);
    }
  };

  const addSkill = async () => {
    if (!skillInput.trim() || !aiSettings) return;
    const newSkills = [...(aiSettings.skills || []), skillInput.trim()];
    setSkillInput('');
    await saveAiSettings({ skills: newSkills });
  };

  const removeSkill = async (index) => {
    if (!aiSettings) return;
    const newSkills = aiSettings.skills.filter((_, i) => i !== index);
    await saveAiSettings({ skills: newSkills });
  };

  const fetchPipelineData = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const [ctx, leadsData] = await Promise.all([
        API.get('/chat/context'),
        API.get('/leads?limit=100'),
      ]);
      setPipelineData({
        summary: ctx.pipeline_summary,
        deals: ctx.open_deals || [],
        leads: leadsData.leads || leadsData.items || [],
        generatedAt: ctx.generated_at,
      });
    } catch {
      setPipelineData(null);
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const [forecast, funnel, health, accounts] = await Promise.all([
        API.get('/analysis/forecast'),
        API.get('/analysis/funnel'),
        API.get('/analysis/health'),
        API.get('/analysis/accounts?limit=30'),
      ]);
      setAnalyticsData({ forecast, funnel, health, accounts });
    } catch (e) {
      console.error('Analytics fetch failed:', e);
      setAnalyticsError(e.message || 'Unknown error');
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchWeeklyReport = useCallback(async () => {
    setWeeklyReportLoading(true);
    setWeeklyReportError(null);
    try {
      const data = await API.get('/reports/weekly');
      setWeeklyReport(data);
    } catch (e) {
      setWeeklyReportError(e.message || 'Kunne ikke hente rapport');
    } finally {
      setWeeklyReportLoading(false);
    }
  }, []);

  const generateWeeklyReport = async () => {
    setWeeklyReportGenerating(true);
    setWeeklyReportError(null);
    try {
      const data = await API.post('/reports/weekly/generate', {});
      setWeeklyReport(data);
    } catch (e) {
      setWeeklyReportError(e.message || 'Rapport-generering fejlede');
    } finally {
      setWeeklyReportGenerating(false);
    }
  };

  const fetchCmt = useCallback(async () => {
    setCmtLoading(true);
    setCmtError(null);
    try {
      const [overview, depts] = await Promise.all([
        API.get('/cmt/overview'),
        API.get('/cmt/departments'),
      ]);
      setCmtOverview(overview);
      setCmtDepartments(depts.departments || []);
    } catch (e) {
      setCmtError(e.message || 'Could not load CMT data');
    } finally {
      setCmtLoading(false);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    try {
      const data = await API.get('/workflows');
      setWorkflows(data.workflows || []);
    } catch (e) {
      console.error('Workflows fetch failed:', e);
    } finally {
      setWorkflowsLoading(false);
    }
  }, []);

  const fetchJourneyAccounts = useCallback(async () => {
    setJourneyLoading(true);
    try {
      const data = await API.get('/analysis/journey');
      setJourneyAccounts(data.accounts || []);
    } catch (e) {
      console.error('Journey accounts fetch failed:', e);
    } finally {
      setJourneyLoading(false);
    }
  }, []);

  const fetchJourney = async (company) => {
    setJourneyLoading(true);
    setJourneyData(null);
    try {
      const data = await API.get(`/analysis/journey?company=${encodeURIComponent(company)}`);
      setJourneyData(data);
      setJourneyCompany(company);
    } catch (e) {
      console.error('Journey fetch failed:', e);
    } finally {
      setJourneyLoading(false);
    }
  };

  const fetchAttribution = useCallback(async () => {
    setAttributionLoading(true);
    try {
      const data = await API.get('/analysis/attribution');
      setAttributionData(data);
    } catch (e) {
      console.error('Attribution fetch failed:', e);
    } finally {
      setAttributionLoading(false);
    }
  }, []);

  const handleCmtSync = async () => {
    setCmtSyncing(true);
    setCmtSyncMsg(null);
    try {
      const data = await API.post('/connections/notion/sync');
      setCmtSyncMsg(`Ã¢Å“â€œ Synced Ã¢â‚¬â€ ${data.created ?? 0} new, ${data.updated ?? 0} updated`);
      await fetchCmt();
    } catch (e) {
      setCmtSyncMsg(`Ã¢Å“â€” ${e.message}`);
    } finally {
      setCmtSyncing(false);
    }
  };

  const sendChatMessage = async (question) => {
    if (!question.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: question };
    const history = chatMessages.filter(m => m.role !== 'system');
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const data = await API.post('/chat', { question, history });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        charts: data.charts && data.charts.length > 0 ? data.charts : null,
      }]);
      if (data.pipeline_summary) setChatContext(data.pipeline_summary);
    } catch (e) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Fejl: ${e.message}. Tjek at ANTHROPIC_API_KEY er sat i Railway Variables.`,
        isError: true,
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchGtmConfig = useCallback(async () => {
    try {
      const data = await API.get('/gtm/config');
      setGtmConfig(data);
      if (data.company_description !== undefined) {
        setStrategyForm({
          company_description: data.company_description || '',
          value_proposition:   data.value_proposition   || '',
          competitors:         data.competitors         || [],
          offerings:           data.offerings           || [],
        });
      }
      if (data.icp && Object.keys(data.icp).length) {
        setIcpForm(prev => ({ ...prev, ...data.icp }));
      }
      if (data.goals && Object.keys(data.goals).length) {
        setGoalsForm(prev => ({ ...prev, ...data.goals }));
        // Restore % growth mode if it was saved
        if (data.goals.input_mode === 'percent') {
          setGoalsInputMode('percent');
          setGrowthPct(data.goals.growth_pct || 0);
        } else {
          setGoalsInputMode('absolute');
          setGrowthPct(0);
        }
      }
    } catch { /* silent Ã¢â‚¬â€ use form defaults */ }
  }, []);

  const saveGtmConfig = async (section, formData) => {
    setGtmSaving(true);
    try {
      const payload = section === 'strategy'
        ? { company_description: formData.company_description, value_proposition: formData.value_proposition, competitors: formData.competitors, offerings: formData.offerings }
        : section === 'icp'
        ? { icp: formData }
        : { goals: formData };
      const updated = await API.put('/gtm/config', payload);
      setGtmConfig(updated);
      setGtmSaved(true);
      setTimeout(() => setGtmSaved(false), 2500);
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setGtmSaving(false);
    }
  };

  const fetchIntelligence = useCallback(async () => {
    setIntelligenceLoading(true);
    try {
      const data = await API.get('/gtm/intelligence');
      setIntelligenceData(data);
    } catch {
      setIntelligenceData(null);
    } finally {
      setIntelligenceLoading(false);
    }
  }, []);

  const fetchGtmProgress = useCallback(async () => {
    setProgressLoading(true);
    try {
      const data = await API.get('/gtm/progress');
      setProgressData(data);
    } catch {
      setProgressData(null);
    } finally {
      setProgressLoading(false);
    }
  }, []);

  const fetchDailyReport = useCallback(async () => {
    setDailyReportLoading(true);
    try {
      const data = await API.get('/gtm/daily-report');
      setDailyReport(data);
    } catch { setDailyReport(null); }
    finally { setDailyReportLoading(false); }
  }, []);

  const fetchForecast = useCallback(async () => {
    setForecastLoading(true);
    try {
      const data = await API.get('/gtm/forecast');
      setForecast(data);
    } catch { setForecast(null); }
    finally { setForecastLoading(false); }
  }, []);

  const fetchForecastHistory = useCallback(async () => {
    setForecastHistoryLoading(true);
    try {
      const data = await API.get('/gtm/forecast/history');
      setForecastHistory(data);
    } catch { setForecastHistory(null); }
    finally { setForecastHistoryLoading(false); }
  }, []);

  const saveSnapshot = useCallback(async () => {
    setSnapshotSaving(true);
    try {
      await API.post('/gtm/forecast/snapshot', {});
      await fetchForecastHistory();
    } catch(e) { console.error(e); }
    finally { setSnapshotSaving(false); }
  }, [fetchForecastHistory]);

  const fetchLearnings = useCallback(async () => {
    setLearningsLoading(true);
    try {
      const data = await API.get('/gtm/learnings');
      setLearnings(data);
    } catch { setLearnings(null); }
    finally { setLearningsLoading(false); }
  }, []);

  const fetchMgmtTasks = useCallback(async () => {
    setMgmtTasksLoading(true);
    try {
      const data = await API.get('/gtm/management-tasks');
      setMgmtTasks(data);
    } catch { setMgmtTasks(null); }
    finally { setMgmtTasksLoading(false); }
  }, []);

  const runAgent = useCallback(async () => {
    setAgentLoading(true);
    setAgentData(null);
    try {
      const data = await API.post('/gtm/agent/analyze', {});
      setAgentData(data);
    } catch (e) {
      setAgentData({ thinking: [], insights: 'Agent fejlede: ' + e.message, tasks: [] });
    } finally { setAgentLoading(false); }
  }, []);

  useEffect(() => {
    // Legacy tab triggers (unchanged)
    if (activeTab === 'alerts' || activeTab === 'dashboard') fetchAlerts();
    if (activeTab === 'leads') fetchLeads();
    if (activeTab === 'connections') fetchConnections();
    if (activeTab === 'chat') fetchChatContext();
    if (activeTab === 'data') fetchPipelineData();
    if (activeTab === 'analytics') { fetchAnalytics(); fetchAttribution(); }
    if (activeTab === 'report') fetchWeeklyReport();
    if (activeTab === 'cmt') fetchCmt();
    if (activeTab === 'workflows') fetchWorkflows();
    if (activeTab === 'journey') fetchJourneyAccounts();
    // New primary tab triggers
    if (activeTab === 'gtm-setup')    { fetchGtmConfig(); fetchGtmProgress(); }
    if (activeTab === 'intelligence') {
      fetchIntelligence();
      fetchDailyReport();
      fetchForecast();
      fetchForecastHistory();
      fetchLearnings();
      fetchMgmtTasks();
    }
    if (activeTab === 'pipeline')     { fetchPipelineData(); fetchAnalytics(); fetchLeads(); }
    if (activeTab === 'signals')      { fetchAlerts(); fetchJourneyAccounts(); fetchLeads(); }
  }, [activeTab, fetchAlerts, fetchLeads, fetchConnections, fetchChatContext, fetchPipelineData, fetchAnalytics, fetchWeeklyReport, fetchCmt, fetchWorkflows, fetchJourneyAccounts, fetchAttribution, fetchGtmConfig, fetchIntelligence, fetchGtmProgress, fetchDailyReport, fetchForecast, fetchForecastHistory, fetchLearnings, fetchMgmtTasks]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAlertAction = async (alertId, actionType, payload = null) => {
    setActioningId(alertId);
    try {
      await API.post(`/alerts/${alertId}/action`, { action_type: actionType, payload });
      await fetchAlerts();
    } catch (e) {
      setError(`Action failed: ${e.message}`);
    } finally {
      setActioningId(null);
    }
  };

  const [syncingId, setSyncingId] = React.useState(null);
  const [syncResult, setSyncResult] = React.useState({});

  const handleSync = async (service, integrationId) => {
    setSyncingId(integrationId);
    setSyncResult(r => ({ ...r, [integrationId]: null }));
    try {
      const data = await API.post(`/connections/${service}/sync`);
      setSyncResult(r => ({ ...r, [integrationId]: { ok: true, msg: data.message || 'Sync complete' } }));
      await fetchConnections();
    } catch (e) {
      setSyncResult(r => ({ ...r, [integrationId]: { ok: false, msg: e.message } }));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (integrationId) => {
    if (!window.confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      await API.delete(`/connections/${integrationId}`);
      await fetchConnections();
    } catch (e) {
      alert('Disconnect failed: ' + e.message);
    }
  };

  const handleConnect = async () => {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const params = new URLSearchParams(connectForm).toString();
      const data = await API.post(`/connections/${connectModal}?${params}`);
      // OAuth services return an auth_url Ã¢â‚¬â€ open it in a new tab
      if (data.auth_url) {
        window.open(data.auth_url, '_blank', 'noopener,noreferrer');
        setConnectModal(null);
        setConnectForm({});
        return;
      }
      await fetchConnections();
      setConnectModal(null);
      setConnectForm({});
    } catch (e) {
      setConnectError(e.message || 'Connection failed Ã¢â‚¬â€ check your credentials.');
    } finally {
      setConnectLoading(false);
    }
  };

  const weekActivity = [
    { date: 'Mon', alerts: 8, actioned: 6 },
    { date: 'Tue', alerts: 12, actioned: 10 },
    { date: 'Wed', alerts: 5, actioned: 4 },
    { date: 'Thu', alerts: 15, actioned: 11 },
    { date: 'Fri', alerts: 9, actioned: 7 },
    { date: 'Sat', alerts: 2, actioned: 2 },
    { date: 'Sun', alerts: 1, actioned: 1 },
  ];

  const signalDistribution = [
    { name: 'Stalled Deals', value: alertStats.pending, color: '#ef4444' },
    { name: 'Intent Spikes', value: Math.max(1, Math.floor(alertStats.pending * 0.6)), color: '#f59e0b' },
    { name: 'Score Jumps', value: Math.max(1, Math.floor(alertStats.pending * 0.3)), color: '#3b82f6' },
    { name: 'Actioned', value: alertStats.actioned, color: '#10b981' },
  ];

  const PRIMARY_TABS = [
    { id: 'gtm-setup',    label: 'GTM Setup',    icon: Compass },
    { id: 'intelligence', label: 'Intelligence', icon: Brain },
    { id: 'pipeline',     label: 'Pipeline',     icon: TrendingUp },
    { id: 'signals',      label: 'Signals',      icon: Radio, badge: alertStats.urgent_high_pending },
  ];

  const LEGACY_TABS = [
    { id: 'dashboard',   label: 'Dashboard',     icon: Activity },
    { id: 'alerts',      label: 'Alerts',        icon: Bell },
    { id: 'chat',        label: 'AI Advisor',    icon: Sparkles },
    { id: 'report',      label: 'Ugerapport',    icon: FileText },
    { id: 'cmt',         label: 'CMT Dashboard', icon: Building2 },
    { id: 'journey',     label: 'Buyer Journey', icon: Target },
    { id: 'workflows',   label: 'Workflows',     icon: Zap },
    { id: 'data',        label: 'Pipeline Data', icon: TrendingUp },
    { id: 'analytics',   label: 'Analytics',     icon: BarChart2 },
    { id: 'connections', label: 'Connections',   icon: Database },
    { id: 'leads',       label: 'Lead Intel',    icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Header Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Signal Intelligence</h1>
              <p className="text-sm text-gray-500">GTM Intelligence Platform Ã‚Â· Board-level insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAlerts}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Primary Nav Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="flex items-center space-x-1 px-6">
          {PRIMARY_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setLegacyOpen(false); }}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Legacy dropdown */}
          <div className="relative ml-2">
            <button
              onClick={() => setLegacyOpen(o => !o)}
              className={`flex items-center space-x-1.5 px-3 py-3 border-b-2 transition-colors ${
                LEGACY_TABS.some(t => t.id === activeTab)
                  ? 'border-gray-400 text-gray-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span className="text-sm font-medium">Legacy</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${legacyOpen ? 'rotate-180' : ''}`} />
            </button>

            {legacyOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                {LEGACY_TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setLegacyOpen(false); }}
                      className={`w-full flex items-center space-x-2 px-4 py-2 text-sm transition-colors text-left ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="p-6">

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ DASHBOARD TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Pending Alerts', value: alertStats.pending, icon: Bell, color: 'text-blue-500' },
                { label: 'Urgent / High', value: alertStats.urgent_high_pending, icon: AlertCircle, color: 'text-red-500', valueColor: 'text-red-600' },
                { label: 'Actioned Today', value: alertStats.actioned, icon: CheckCircle, color: 'text-green-500', valueColor: 'text-green-600' },
                { label: 'Snoozed', value: alertStats.snoozed, icon: BellOff, color: 'text-gray-400' },
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

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Alert Activity (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weekActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="alerts" fill="#3b82f6" name="Alerts" />
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
                      label={({ name, value }) => value > 0 ? `${name}` : ''}
                      outerRadius={75}
                      dataKey="value"
                    >
                      {signalDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Top Pending Alerts</h3>
                <button onClick={() => setActiveTab('alerts')} className="text-sm text-blue-600 hover:underline">View all</button>
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
                              Ã‚Â· {alert.context?.owner_name || alert.lead?.owner_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[alert.priority]?.badge}`}>
                      {alert.priority.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ ALERTS TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
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

            {loading ? (
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
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ AI CHAT TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'chat' && (() => {
          return (
            <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[500px]">

              {/* Chat panel */}
              <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">AI Pipeline Advisor</h2>
                    <p className="text-xs text-gray-500">Analyser din pipeline med naturligt sprog</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                      <div className="p-4 bg-purple-50 rounded-full">
                        <MessageSquare className="w-8 h-8 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">SpÃƒÂ¸rg om din pipeline</p>
                        <p className="text-sm text-gray-400 mt-1">AI'en har adgang til alle dine deals, leads og alerts</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {suggestedQuestions.slice(0, 4).map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendChatMessage(q)}
                            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 text-gray-600 transition-colors text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : msg.isError ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {msg.role === 'user' ? 'U' : <Sparkles className="w-4 h-4" />}
                      </div>
                      <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'max-w-[75%] bg-blue-600 text-white'
                          : msg.isError
                            ? 'max-w-[85%] bg-red-50 border border-red-200 text-red-700'
                            : 'max-w-[85%] bg-gray-50 border border-gray-200 text-gray-800'
                      }`}>
                        {/* Charts first, then text */}
                        {msg.charts && msg.charts.length > 0 && (
                          <div className="space-y-3 mb-3">
                            {msg.charts.map((chart, ci) => (
                              <ChatChart key={ci} spec={chart} />
                            ))}
                          </div>
                        )}
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-200">
                  <form
                    onSubmit={e => { e.preventDefault(); sendChatMessage(chatInput); }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Stil et spÃƒÂ¸rgsmÃƒÂ¥l om din pipeline..."
                      disabled={chatLoading}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium"
                    >
                      <CornerDownLeft className="w-4 h-4" />
                      Send
                    </button>
                  </form>
                </div>
              </div>

              {/* Context + Skills sidebar */}
              <div className="w-72 flex flex-col gap-4 overflow-y-auto">

                {/* Pipeline snapshot */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline snapshot</p>
                  {chatContext ? (
                    <div className="space-y-2.5">
                      {[
                        { label: 'Open deals', value: chatContext.total_open_deals },
                        { label: 'Total value', value: chatContext.total_pipeline_display },
                        { label: 'Stalled deals', value: chatContext.stalled_deals, warn: chatContext.stalled_deals > 0 },
                        { label: 'Pending alerts', value: chatContext.pending_alerts },
                        { label: 'Urgent/High', value: chatContext.urgent_or_high_alerts, warn: chatContext.urgent_or_high_alerts > 0 },
                      ].map(({ label, value, warn }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className={`font-semibold ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value ?? 'Ã¢â‚¬â€'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">IndlÃƒÂ¦ser...</p>
                  )}
                </div>

                {/* Model selector */}
                {aiSettings && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">AI Model</p>
                    <div className="space-y-2">
                      {(aiSettings.available_models || []).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => saveAiSettings({ model: m.id })}
                          disabled={settingsSaving}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                            aiSettings.model === m.id
                              ? 'bg-purple-50 border-purple-300 text-purple-900'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{m.label}</span>
                            {m.tier === 'recommended' && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Ã¢Å“â€œ Best</span>
                            )}
                            {m.tier === 'powerful' && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Ã¢Å¡Â¡ Max</span>
                            )}
                            {m.tier === 'fast' && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Ã°Å¸Å¡â‚¬ Fast</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                        </button>
                      ))}
                    </div>
                    {settingsSaving && <p className="text-xs text-gray-400 mt-2 text-center">Gemmer...</p>}
                  </div>
                )}

                {/* Skills panel */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <button
                    onClick={() => setSkillsOpen(o => !o)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Skills</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {aiSettings?.skills?.length > 0 ? `${aiSettings.skills.length} aktiv` : 'Ingen skills endnu'}
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${skillsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {skillsOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      {/* Existing skills */}
                      {(aiSettings?.skills || []).map((skill, i) => (
                        <div key={i} className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                          <p className="flex-1 text-xs text-purple-800">{skill}</p>
                          <button
                            onClick={() => removeSkill(i)}
                            className="text-purple-400 hover:text-red-500 flex-shrink-0 mt-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add new skill */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Fx: Svar altid pÃƒÂ¥ dansk"
                          value={skillInput}
                          onChange={e => setSkillInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addSkill()}
                          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                        <button
                          onClick={addSkill}
                          disabled={!skillInput.trim() || settingsSaving}
                          className="px-2.5 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-40 font-medium"
                        >
                          +
                        </button>
                      </div>

                      {/* Company context */}
                      <div className="pt-1">
                        <p className="text-xs text-gray-500 font-medium mb-1.5">Virksomhedskontekst</p>
                        <textarea
                          rows={3}
                          placeholder="Fx: Vi sÃƒÂ¦lger B2B SaaS til nordiske virksomheder med 50-500 ansatte. Vores ICP er Operations directors..."
                          value={contextInput}
                          onChange={e => setContextInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                        />
                        <button
                          onClick={() => saveAiSettings({ company_context: contextInput })}
                          disabled={settingsSaving}
                          className="mt-1.5 w-full py-1.5 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-900 disabled:opacity-40 font-medium"
                        >
                          {settingsSaving ? 'Gemmer...' : 'Gem kontekst'}
                        </button>
                      </div>

                      {/* Skill ideas */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-1.5">Forslag:</p>
                        {[
                          'Svar altid pÃƒÂ¥ dansk',
                          'FokusÃƒÂ©r pÃƒÂ¥ deals der lukker inden for 30 dage',
                          'Brug MEDDIC salgsmÃƒÂ¸ntoden',
                          'Vores ICP: SaaS, 50-500 ansatte',
                        ].map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setSkillInput(s)}
                            className="w-full text-left text-xs text-gray-500 hover:text-purple-700 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested questions */}
                {chatMessages.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Forslag</p>
                    <div className="space-y-2">
                      {suggestedQuestions.slice(0, 4).map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendChatMessage(q)}
                          disabled={chatLoading}
                          className="w-full text-left text-xs text-gray-600 hover:text-purple-700 hover:bg-purple-50 px-2 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ WEEKLY REPORT TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'report' && (() => {
          const report = weeklyReport;
          const hasReport = report && (report.section_what_happened || report.section_this_week || report.section_management);

          // Simple markdown renderer for the report sections
          const renderMd = (text) => {
            if (!text) return null;
            return text.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h3 key={i} className="font-semibold text-gray-900 mt-4 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('## ')) return <h2 key={i} className="font-bold text-gray-900 mt-5 mb-2 text-base">{line.slice(3)}</h2>;
              if (line.startsWith('- [ ] ')) return <div key={i} className="flex items-start gap-2 my-1"><input type="checkbox" className="mt-1 accent-blue-600" /><span className="text-sm text-gray-700">{line.slice(6)}</span></div>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-sm text-gray-700 my-0.5 list-disc">{line.slice(2)}</li>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-900 mt-2">{line.slice(2, -2)}</p>;
              if (line.trim() === '') return <div key={i} className="h-1" />;
              return <p key={i} className="text-sm text-gray-700 my-0.5">{line}</p>;
            });
          };

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Ugentlig Salgsrapport
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {hasReport
                        ? `Uge startende ${report.week_start} Ã‚Â· Genereret ${new Date(report.generated_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} Ã‚Â· ${report.model_used || 'AI'}`
                        : 'Klik "Generer rapport" for at lave denne uges analyse'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {hasReport && (
                      <button
                        onClick={fetchWeeklyReport}
                        disabled={weeklyReportLoading}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${weeklyReportLoading ? 'animate-spin' : ''}`} />
                        Opdater
                      </button>
                    )}
                    <button
                      onClick={generateWeeklyReport}
                      disabled={weeklyReportGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Sparkles className={`w-4 h-4 ${weeklyReportGenerating ? 'animate-spin' : ''}`} />
                      {weeklyReportGenerating ? 'GenerererÃ¢â‚¬Â¦' : hasReport ? 'Regenerer' : 'Generer rapport'}
                    </button>
                  </div>
                </div>

                {weeklyReportError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    Ã¢Å¡Â Ã¯Â¸Â {weeklyReportError}
                  </div>
                )}

                {weeklyReportGenerating && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-blue-700">
                      Claude analyserer pipeline, alerts, HubSpot-opgaver og outbound aktivitetÃ¢â‚¬Â¦
                    </span>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {!hasReport && !weeklyReportLoading && !weeklyReportGenerating && (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Ingen rapport endnu</p>
                  <p className="text-sm text-gray-400 mt-1 mb-6">
                    Klik "Generer rapport" ovenfor Ã¢â‚¬â€ AI analyserer din pipeline og skriver rapporten.
                  </p>
                  <p className="text-xs text-gray-400">Rapporten opdateres automatisk mandag morgen kl. 8 (via Railway cron).</p>
                </div>
              )}

              {/* Report sections */}
              {hasReport && !weeklyReportGenerating && (
                <div className="grid grid-cols-1 gap-5">

                  {/* Section 1: What happened */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Activity className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Ã°Å¸â€œÅ  Hvad skete der denne uge</h3>
                    </div>
                    <div className="prose-sm text-gray-700 space-y-0.5">
                      {renderMd(report.section_what_happened)}
                    </div>
                  </div>

                  {/* Section 2: This week's actions */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Ã°Å¸Å½Â¯ Hvad skal der ske denne uge</h3>
                    </div>
                    <div className="prose-sm text-gray-700 space-y-0.5">
                      {renderMd(report.section_this_week)}
                    </div>
                  </div>

                  {/* Section 3: Management actions */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Award className="w-4 h-4 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Ã°Å¸Â¤Â Hvad kan sales management gÃƒÂ¸re</h3>
                    </div>
                    <div className="prose-sm text-gray-700 space-y-0.5">
                      {renderMd(report.section_management)}
                    </div>
                  </div>

                  {/* Data snapshot summary cards */}
                  {report.data_snapshot && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data grundlag</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Deals i pipeline', value: report.data_snapshot.pipeline?.total_deals ?? 'Ã¢â‚¬â€' },
                          { label: 'Aktive deals (uge)', value: report.data_snapshot.pipeline?.recently_active_deals ?? 'Ã¢â‚¬â€' },
                          { label: 'Alerts trigget', value: report.data_snapshot.alerts?.total ?? 'Ã¢â‚¬â€' },
                          { label: 'HubSpot-opgaver', value: report.data_snapshot.tasks?.total ?? (report.data_snapshot.tasks?.available === false ? 'N/A' : 'Ã¢â‚¬â€') },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                            <p className="text-lg font-bold text-gray-900">{value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ PIPELINE DATA TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'data' && (() => {
          const STAGE_COLORS = {
            closedwon: 'bg-green-100 text-green-800 border-green-200',
            contractsent: 'bg-blue-100 text-blue-800 border-blue-200',
            decisionmakerboughtin: 'bg-purple-100 text-purple-800 border-purple-200',
            presentationscheduled: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            qualifiedtobuy: 'bg-cyan-100 text-cyan-800 border-cyan-200',
            appointmentscheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            closedlost: 'bg-red-100 text-red-800 border-red-200',
          };
          const stageLabel = s => s
            ? s.replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
            : 'Ã¢â‚¬â€';

          const deals = (pipelineData?.deals || []).filter(d => {
            if (!pipelineSearch) return true;
            const q = pipelineSearch.toLowerCase();
            return (d.name || '').toLowerCase().includes(q)
              || (d.stage || '').toLowerCase().includes(q)
              || (d.owner || '').toLowerCase().includes(q);
          });

          const leads = (pipelineData?.leads || []).filter(d => {
            if (!pipelineSearch) return true;
            const q = pipelineSearch.toLowerCase();
            return (d.company_name || '').toLowerCase().includes(q)
              || (d.owner_name || '').toLowerCase().includes(q)
              || (d.priority || '').toLowerCase().includes(q);
          });

          const summary = pipelineData?.summary;

          return (
            <div className="space-y-5">

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Summary cards Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Open Deals', value: summary.total_open_deals, color: 'text-blue-600' },
                    { label: 'Pipeline Value', value: summary.total_pipeline_display, color: 'text-green-600' },
                    { label: 'Stalled', value: summary.stalled_deals, color: summary.stalled_deals > 0 ? 'text-red-600' : 'text-gray-500' },
                    { label: 'Pending Alerts', value: summary.pending_alerts, color: summary.pending_alerts > 0 ? 'text-orange-600' : 'text-gray-500' },
                    { label: 'Top Lead Score', value: summary.top_lead_score ?? 'Ã¢â‚¬â€', color: 'text-purple-600' },
                    { label: 'Urgent / High', value: summary.urgent_or_high_alerts, color: summary.urgent_or_high_alerts > 0 ? 'text-red-600' : 'text-gray-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className={`text-xl font-bold ${color}`}>{value ?? 'Ã¢â‚¬â€'}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Stage distribution bar Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {summary?.deals_by_stage && Object.keys(summary.deals_by_stage).length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deals by Stage</p>
                  <div className="space-y-2">
                    {Object.entries(summary.deals_by_stage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([stage, count]) => {
                        const total = summary.total_open_deals || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={stage}>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-xs text-gray-700">{stageLabel(stage)}</span>
                              <span className="text-xs font-semibold text-gray-900">{count} deal{count !== 1 ? 's' : ''} &nbsp;Ã‚Â·&nbsp; {pct}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ View toggle + search Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
                        {id === 'deals' ? pipelineData?.deals?.length ?? 0 : pipelineData?.leads?.length ?? 0}
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

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Deals table Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
                                <span className="font-semibold text-gray-900 text-sm">{deal.amount_display || 'Ã¢â‚¬â€'}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                {deal.owner ? (
                                  <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
                                    <Users className="w-3.5 h-3.5" />
                                    {deal.owner}
                                  </span>
                                ) : <span className="text-xs text-gray-400">Ã¢â‚¬â€</span>}
                              </td>
                              <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                                {deal.close_date || <span className="text-gray-400">Ã¢â‚¬â€</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                {deal.days_since_last_activity != null ? (
                                  <span className={`text-sm font-medium ${
                                    deal.days_since_last_activity > 14 ? 'text-red-600' :
                                    deal.days_since_last_activity > 7 ? 'text-orange-500' : 'text-green-600'
                                  }`}>
                                    {deal.days_since_last_activity}d ago
                                  </span>
                                ) : <span className="text-xs text-gray-400">Ã¢â‚¬â€</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  deal.crm === 'hubspot' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {deal.crm === 'hubspot' ? 'HubSpot' : 'Salesforce'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {deal.is_stalled ? (
                                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Stalled
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs text-green-600">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Active
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                        {deals.length} deals Ã‚Â· {pipelineData?.generatedAt && `Synced ${pipelineData.generatedAt}`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Leads table Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
                                <p className="text-sm text-gray-800">{lead.contact_name || 'Ã¢â‚¬â€'}</p>
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
                              <td className="px-5 py-3.5 text-sm text-gray-600">{lead.industry || 'Ã¢â‚¬â€'}</td>
                              <td className="px-5 py-3.5 text-sm text-gray-600">{lead.employee_count ?? 'Ã¢â‚¬â€'}</td>
                              <td className="px-5 py-3.5">
                                {lead.owner_name ? (
                                  <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
                                    <Users className="w-3.5 h-3.5" />
                                    {lead.owner_name}
                                  </span>
                                ) : <span className="text-xs text-gray-400">Ã¢â‚¬â€</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  lead.source === 'hubspot' ? 'bg-orange-100 text-orange-700' :
                                  lead.source === 'clay' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{lead.source || 'Ã¢â‚¬â€'}</span>
                              </td>
                              <td className="px-5 py-3.5 max-w-xs">
                                {lead.recommendation ? (
                                  <p className="text-xs text-gray-500 truncate" title={lead.recommendation}>{lead.recommendation}</p>
                                ) : <span className="text-xs text-gray-300">Ã¢â‚¬â€</span>}
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
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ ANALYTICS TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'analytics' && (() => {
          const ad = analyticsData;
          const fcast = ad?.forecast;
          const funnel = ad?.funnel;
          const health = ad?.health;
          const accts = ad?.accounts;

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
                    <p className="text-xs text-red-500 mt-2">Railway deployer muligvis stadig Ã¢â‚¬â€ vent 1-2 min og klik Refresh</p>
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

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ REVENUE FORECAST Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {analyticsView === 'forecast' && fcast && (
                <div className="space-y-5">
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Weighted Forecast', value: fcast.weighted_forecast_display, sub: 'amount Ãƒâ€” stage probability', color: 'text-purple-600', bg: 'bg-purple-50' },
                      { label: 'Commit Forecast',   value: fcast.commit_forecast_display,  sub: 'stages Ã¢â€°Â¥70% probability',    color: 'text-blue-600',   bg: 'bg-blue-50' },
                      { label: 'Best Case',          value: fcast.best_case_display,        sub: '100% of open pipeline',      color: 'text-green-600',  bg: 'bg-green-50' },
                      { label: 'Already Won',        value: fcast.closed_won_display,       sub: `${fcast.open_deal_count} open deals`,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
                                  <span className="text-xs text-gray-700">{m.month === 'No Date' ? 'Ã¢â‚¬â€ No close date' : m.month}</span>
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

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ FUNNEL Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {analyticsView === 'funnel' && funnel && (
                <div className="space-y-5">
                  {/* Summary */}
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

                  {/* Funnel stages */}
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
                              {/* Stage number */}
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
                                    style={{
                                      width: `${barPct}%`,
                                      backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length],
                                    }}
                                  />
                                </div>
                              </div>
                              {/* Conversion arrow */}
                              {s.conversion_to_next_pct != null && (
                                <div className="flex-shrink-0 text-right w-20">
                                  <p className="text-xs text-gray-400">Ã¢â€ â€™ next</p>
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

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ CRM HEALTH Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {analyticsView === 'health' && health && (
                <div className="space-y-5">
                  {/* Score card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-6">
                      <div className="relative w-28 h-28 flex-shrink-0">
                        {/* Circular gauge via SVG */}
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
                        <p className="text-sm text-gray-500 mt-1">{health.total_deals} deals analysed Ã‚Â· {health.clean_deals ?? 'Ã¢â‚¬â€'} clean</p>
                        {health.issues.length === 0 && (
                          <p className="mt-3 flex items-center gap-2 text-green-700 font-medium">
                            <CheckCircle className="w-4 h-4" /> Your CRM data is in great shape!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Issues list */}
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
                          {/* Progress bar */}
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

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ TOP ACCOUNTS Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {analyticsView === 'accounts' && accts && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">{accts.total} accounts ranked by priority score Ã‚Â· {accts.generated_at}</p>
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
                                  <p className="text-xs text-gray-400">{acc.contact}{acc.contact_title ? ` Ã‚Â· ${acc.contact_title}` : ''}</p>
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
                                ) : <span className="text-xs text-gray-300">Ã¢â‚¬â€</span>}
                              </td>
                              <td className="px-4 py-3.5">
                                {acc.has_open_deal ? (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700">{acc.deal_stage}</p>
                                    {acc.deal_amount_display && (
                                      <p className="text-xs text-green-700 font-semibold">{acc.deal_amount_display}</p>
                                    )}
                                    {acc.deal_close_date && (
                                      <p className="text-xs text-gray-400">Ã¢â€ â€™ {acc.deal_close_date}</p>
                                    )}
                                  </div>
                                ) : <span className="text-xs text-gray-300">No deal</span>}
                              </td>
                              <td className="px-4 py-3.5 max-w-[200px]">
                                {acc.urgency_signals && acc.urgency_signals.length > 0 ? (
                                  <div className="space-y-1">
                                    {acc.urgency_signals.slice(0, 2).map((sig, si) => (
                                      <span key={si} className="block text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 truncate">
                                        Ã¢Å¡Â  {sig}
                                      </span>
                                    ))}
                                  </div>
                                ) : <span className="text-xs text-gray-300">Ã¢â‚¬â€</span>}
                              </td>
                              <td className="px-4 py-3.5 max-w-[180px]">
                                {acc.next_action ? (
                                  <p className="text-xs text-gray-500 truncate" title={acc.next_action}>{acc.next_action}</p>
                                ) : <span className="text-xs text-gray-300">Ã¢â‚¬â€</span>}
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
                        {accts.accounts.length} accounts Ã‚Â· sorted by priority score (lead score Ãƒâ€” stage probability Ãƒâ€” recency)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ ATTRIBUTION VIEW Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {analyticsView === 'attribution' && (() => {
                const attr = attributionData;
                if (attributionLoading) return (
                  <div className="flex items-center justify-center py-16 text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading attributionÃ¢â‚¬Â¦
                  </div>
                );
                if (!attr) return (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <BarChart2 className="w-10 h-10 mb-3 opacity-40" />
                    <p>No attribution data yet Ã¢â‚¬â€ connect HubSpot or Salesforce.</p>
                  </div>
                );
                const { summary, stage_breakdown, signal_attribution, owner_performance, forecast_narrative } = attr;
                return (
                  <div className="space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Closed Won', value: summary.closed_won_display, sub: `${summary.closed_won_count} deals`, color: 'text-green-600' },
                        { label: 'Weighted Pipeline', value: summary.weighted_pipeline_display, sub: `${summary.active_count} active deals`, color: 'text-blue-600' },
                        { label: 'Win Rate', value: `${summary.win_rate}%`, sub: `${summary.closed_lost_count} lost`, color: summary.win_rate >= 30 ? 'text-green-600' : 'text-orange-600' },
                        { label: 'Active Pipeline', value: summary.active_value ? `Ã¢â€šÂ¬${(summary.active_value/1000).toFixed(0)}k` : 'Ã¢â€šÂ¬0', sub: 'total value', color: 'text-indigo-600' },
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
                                  <span className="text-gray-500 flex-shrink-0">{s.count} deals Ã‚Â· {s.value_display}</span>
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
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ BUYER JOURNEY TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'journey' && (() => {
          const EVENT_COLORS = {
            blue: 'border-blue-400 bg-blue-50',
            orange: 'border-orange-400 bg-orange-50',
            red: 'border-red-400 bg-red-50',
            purple: 'border-purple-400 bg-purple-50',
            green: 'border-green-400 bg-green-50',
            indigo: 'border-indigo-400 bg-indigo-50',
            yellow: 'border-yellow-400 bg-yellow-50',
            gray: 'border-gray-300 bg-gray-50',
          };
          return (
            <div className="space-y-5">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5 text-blue-600" />
                  Buyer Journey
                </h2>
                <p className="text-sm text-gray-500 mb-5">Full touchpoint timeline for any account Ã¢â‚¬â€ deals, signals, alerts in one view</p>
                {/* Search */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Search account nameÃ¢â‚¬Â¦"
                    value={journeyCompany}
                    onChange={e => setJourneyCompany(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && journeyCompany.trim() && fetchJourney(journeyCompany.trim())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => journeyCompany.trim() && fetchJourney(journeyCompany.trim())}
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
                          {journeyData.deal.amount ? ` Ã‚Â· Ã¢â€šÂ¬${journeyData.deal.amount.toLocaleString()}` : ''}
                          {journeyData.deal.owner ? ` Ã‚Â· ${journeyData.deal.owner}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {journeyData.deal.is_stalled && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-semibold">Ã¢Å¡Â Ã¯Â¸Â Stalled</span>
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
                                        {evt.timestamp ? new Date(evt.timestamp).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ã¢â‚¬â€'}
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
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ WORKFLOWS TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'workflows' && (() => {
          const TRIGGER_LABELS = {
            manual: 'Manual only',
            score_threshold: 'On lead scored',
            alert_created: 'On alert created',
          };
          const ACTION_LABELS = {
            create_alert: 'Create Alert',
            update_priority: 'Update Priority',
            log: 'Log message',
          };
          const FIELD_OPTIONS = ['score', 'priority', 'source', 'industry'];
          const OP_OPTIONS = ['gt', 'lt', 'eq', 'neq', 'contains'];
          const OP_LABELS = { gt: '>', lt: '<', eq: '=', neq: 'Ã¢â€°Â ', contains: 'contains' };

          const addCondition = () => setWfForm(f => ({ ...f, conditions: [...f.conditions, { field: 'score', op: 'gt', value: '' }] }));
          const removeCondition = (i) => setWfForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
          const updateCondition = (i, key, val) => setWfForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [key]: val } : c) }));
          const addAction = () => setWfForm(f => ({ ...f, actions: [...f.actions, { type: 'create_alert', params: { priority: 'high', message: '' } }] }));
          const removeAction = (i) => setWfForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
          const updateAction = (i, key, val) => setWfForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, [key]: val } : a) }));
          const updateActionParam = (i, key, val) => setWfForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, params: { ...a.params, [key]: val } } : a) }));

          const handleSaveWorkflow = async () => {
            try {
              if (wfModal === 'create') {
                await API.post('/workflows', wfForm);
              } else {
                await API.put(`/workflows/${wfModal.id}`, wfForm);
              }
              setWfModal(null);
              setWfForm({ name: '', description: '', trigger_type: 'manual', conditions: [], actions: [] });
              await fetchWorkflows();
            } catch (e) { alert(`Save failed: ${e.message}`); }
          };

          const handleRunWorkflow = async (wf) => {
            setWfRunning(wf.id);
            try {
              const result = await API.post(`/workflows/${wf.id}/run`);
              setWfRunResult(r => ({ ...r, [wf.id]: result }));
              await fetchWorkflows();
            } catch (e) { setWfRunResult(r => ({ ...r, [wf.id]: { error: e.message } })); }
            finally { setWfRunning(null); }
          };

          const handleToggle = async (wf) => {
            try {
              await API.put(`/workflows/${wf.id}/toggle`);
              await fetchWorkflows();
            } catch (e) { console.error(e); }
          };

          const handleDelete = async (wf) => {
            if (!window.confirm(`Delete workflow "${wf.name}"?`)) return;
            try {
              await API.delete(`/workflows/${wf.id}`);
              await fetchWorkflows();
            } catch (e) { console.error(e); }
          };

          const openCreate = () => {
            setWfForm({ name: '', description: '', trigger_type: 'manual', conditions: [], actions: [] });
            setWfModal('create');
          };

          const openEdit = (wf) => {
            setWfForm({ name: wf.name, description: wf.description || '', trigger_type: wf.trigger_type, conditions: wf.conditions || [], actions: wf.actions || [] });
            setWfModal(wf);
          };

          return (
            <div className="space-y-5">
              {/* Header */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Workflow Automation
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">If-this-then-that rules Ã¢â‚¬â€ automatically act on leads based on conditions</p>
                </div>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  + New Workflow
                </button>
              </div>

              {/* Workflow list */}
              {workflowsLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> LoadingÃ¢â‚¬Â¦
                </div>
              ) : workflows.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No workflows yet</h3>
                  <p className="text-sm text-gray-400 mb-4">Create your first automation rule to act on signals automatically.</p>
                  <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    Create Workflow
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {workflows.map(wf => {
                    const result = wfRunResult[wf.id];
                    return (
                      <div key={wf.id} className="bg-white rounded-lg border border-gray-200 p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <h3 className="font-semibold text-gray-900">{wf.name}</h3>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{TRIGGER_LABELS[wf.trigger_type] || wf.trigger_type}</span>
                            </div>
                            {wf.description && <p className="text-sm text-gray-500 mb-2">{wf.description}</p>}
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                              {(wf.conditions || []).map((c, i) => (
                                <span key={i} className="bg-blue-50 border border-blue-100 text-blue-700 rounded px-2 py-0.5">
                                  {c.field} {OP_LABELS[c.op] || c.op} {c.value}
                                </span>
                              ))}
                              {wf.conditions?.length > 0 && <span className="text-gray-400">Ã¢â€ â€™</span>}
                              {(wf.actions || []).map((a, i) => (
                                <span key={i} className="bg-green-50 border border-green-100 text-green-700 rounded px-2 py-0.5">
                                  {ACTION_LABELS[a.type] || a.type}
                                </span>
                              ))}
                            </div>
                            {wf.last_run && <p className="text-xs text-gray-400 mt-2">Last run: {new Date(wf.last_run).toLocaleString()} Ã‚Â· {wf.run_count} runs total</p>}
                            {result && (
                              <div className={`mt-2 text-xs rounded px-3 py-2 ${result.error ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                {result.error ? `Ã¢Å“â€” ${result.error}` : `Ã¢Å“â€œ ${result.leads_matched}/${result.leads_evaluated} leads matched Ã‚Â· ${result.actions_fired} actions fired`}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleRunWorkflow(wf)}
                              disabled={wfRunning === wf.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              <Zap className={`w-3 h-3 ${wfRunning === wf.id ? 'animate-pulse' : ''}`} />
                              {wfRunning === wf.id ? 'RunningÃ¢â‚¬Â¦' : 'Run'}
                            </button>
                            <button
                              onClick={() => handleToggle(wf)}
                              className={`px-3 py-1.5 text-xs rounded-lg border ${wf.status === 'active' ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                            >
                              {wf.status === 'active' ? 'Pause' : 'Activate'}
                            </button>
                            <button onClick={() => openEdit(wf)} className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">Edit</button>
                            <button onClick={() => handleDelete(wf)} className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Create/Edit Modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {wfModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                      <h2 className="text-xl font-bold">{wfModal === 'create' ? 'New Workflow' : 'Edit Workflow'}</h2>
                      <button onClick={() => setWfModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 space-y-5">
                      {/* Name + trigger */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Workflow name</label>
                          <input value={wfForm.name} onChange={e => setWfForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Hot lead alert" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Trigger</label>
                          <select value={wfForm.trigger_type} onChange={e => setWfForm(f => ({ ...f, trigger_type: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="manual">Manual only</option>
                            <option value="score_threshold">On lead scored</option>
                            <option value="alert_created">On alert created</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                        <input value={wfForm.description} onChange={e => setWfForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="What does this workflow do?" />
                      </div>

                      {/* Conditions */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">IF Ã¢â‚¬â€ Conditions (all must match)</label>
                          <button onClick={addCondition} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add condition</button>
                        </div>
                        {wfForm.conditions.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No conditions Ã¢â‚¬â€ workflow runs on ALL leads</p>
                        ) : (
                          <div className="space-y-2">
                            {wfForm.conditions.map((c, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <select value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                                  {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <select value={c.op} onChange={e => updateCondition(i, 'op', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none w-24">
                                  {OP_OPTIONS.map(o => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
                                </select>
                                <input value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} placeholder="value" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                                <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">THEN Ã¢â‚¬â€ Actions</label>
                          <button onClick={addAction} className="text-xs text-green-600 hover:text-green-800 font-medium">+ Add action</button>
                        </div>
                        {wfForm.actions.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No actions Ã¢â‚¬â€ add at least one</p>
                        ) : (
                          <div className="space-y-3">
                            {wfForm.actions.map((a, i) => (
                              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <select value={a.type} onChange={e => updateAction(i, 'type', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                                    <option value="create_alert">Create Alert</option>
                                    <option value="update_priority">Update Priority</option>
                                    <option value="log">Log message</option>
                                  </select>
                                  <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                                </div>
                                {a.type === 'create_alert' && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <select value={a.params.priority || 'high'} onChange={e => updateActionParam(i, 'priority', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                                      <option value="urgent">Urgent</option>
                                      <option value="high">High</option>
                                      <option value="medium">Medium</option>
                                      <option value="low">Low</option>
                                    </select>
                                    <input value={a.params.message || ''} onChange={e => updateActionParam(i, 'message', e.target.value)} placeholder="Alert message" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                                  </div>
                                )}
                                {a.type === 'update_priority' && (
                                  <select value={a.params.priority || 'warm'} onChange={e => updateActionParam(i, 'priority', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white w-full">
                                    <option value="hot">Hot</option>
                                    <option value="warm">Warm</option>
                                    <option value="cold">Cold</option>
                                  </select>
                                )}
                                {a.type === 'log' && (
                                  <input value={a.params.message || ''} onChange={e => updateActionParam(i, 'message', e.target.value)} placeholder="Log message" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setWfModal(null)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                        <button onClick={handleSaveWorkflow} disabled={!wfForm.name.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Save Workflow</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ CONNECTIONS TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'connections' && (() => {
          const INTEGRATION_DEFS = [
            {
              id: 'salesforce', name: 'Salesforce',
              desc: 'Deal monitoring + stall detection via CDC webhooks',
              icon: Database,
              fields: [
                { key: 'username', label: 'Username', type: 'text' },
                { key: 'password', label: 'Password', type: 'password' },
                { key: 'security_token', label: 'Security Token', type: 'text', placeholder: 'Optional' },
              ],
            },
            {
              id: 'hubspot', name: 'HubSpot',
              desc: 'Deal + company sync via Private App access token',
              icon: Database,
              fields: [{ key: 'access_token', label: 'Private App Access Token', type: 'password' }],
            },
            {
              id: 'clay', name: 'Clay',
              desc: 'Lead enrichment + company intelligence',
              icon: Database,
              fields: [{ key: 'api_key', label: 'API Key', type: 'password' }],
            },
            {
              id: 'snitcher', name: 'Snitcher',
              desc: 'Real-time website visitor identification + intent spikes',
              icon: Activity,
              fields: [{ key: 'api_key', label: 'API Key', type: 'password' }],
            },
            {
              id: 'notion', name: 'Notion',
              desc: 'Department initiative tracking for CMT Dashboard',
              icon: Layers,
              fields: [{ key: 'api_key', label: 'Internal Integration Token', type: 'password', placeholder: 'secret_...' }],
            },
          ];
          const connectedIds = new Set(connections.map(c => c.service));
          const activeDef = INTEGRATION_DEFS.find(d => d.id === connectModal);
          return (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold">Data Connections</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Connect your sources. Webhooks enable real-time alerts; sync provides historical backfill.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {INTEGRATION_DEFS.map(({ id, name, desc, icon: Icon, fields }) => {
                    const connected = connectedIds.has(id);
                    const conn = connections.find(c => c.service === id);
                    return (
                      <div key={id} className="flex items-center justify-between p-5 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <Icon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{name}</h3>
                            <p className="text-sm text-gray-500">{desc}</p>
                            {conn?.last_sync && (
                              <p className="text-xs text-gray-400 mt-0.5">Last sync: {new Date(conn.last_sync).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {connected ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {connected ? 'Connected' : 'Not connected'}
                          </span>
                          {!connected && (
                            <button
                              onClick={() => { setConnectModal(id); setConnectForm({}); setConnectError(null); }}
                              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                            >
                              Connect
                            </button>
                          )}
                          {connected && (
                            <>
                              <button
                                onClick={() => handleSync(id, conn.id)}
                                disabled={syncingId === conn.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncingId === conn.id ? 'animate-spin' : ''}`} />
                                {syncingId === conn.id ? 'SyncingÃ¢â‚¬Â¦' : 'Sync now'}
                              </button>
                              <button
                                onClick={() => handleDisconnect(conn.id)}
                                className="px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"
                              >
                                Disconnect
                              </button>
                            </>
                          )}
                          {syncResult[conn?.id] && (
                            <span className={`text-xs ${syncResult[conn.id].ok ? 'text-green-600' : 'text-red-500'}`}>
                              {syncResult[conn.id].ok ? 'Ã¢Å“â€œ' : 'Ã¢Å“â€”'} {syncResult[conn.id].msg}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Webhook Endpoints</p>
                    <p className="text-sm text-blue-700 mt-1">Point your integrations at these for real-time event processing:</p>
                    <div className="mt-2 space-y-1">
                      {['snitcher', 'salesforce'].map(svc => (
                        <code key={svc} className="block text-xs bg-white border border-blue-100 text-blue-800 px-2 py-1 rounded font-mono">
                          POST /api/webhooks/{svc} &nbsp; X-Customer-Id: &lt;your-id&gt;
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Connect Modal */}
              {connectModal && activeDef && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConnectModal(null)}>
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Connect {activeDef.name}</h3>
                      <button onClick={() => setConnectModal(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-5">{activeDef.desc}</p>
                    <div className="space-y-4">
                      {activeDef.fields.map(({ key, label, type, placeholder }) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                          <input
                            type={type}
                            placeholder={placeholder || ''}
                            value={connectForm[key] || ''}
                            onChange={e => setConnectForm(f => ({ ...f, [key]: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                    {connectError && (
                      <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{connectError}</p>
                    )}
                    <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setConnectModal(null)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                      <button
                        onClick={handleConnect}
                        disabled={connectLoading}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {connectLoading ? 'ConnectingÃ¢â‚¬Â¦' : activeDef.oauth ? `Authorize with ${activeDef.name}` : `Connect ${activeDef.name}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ CMT DASHBOARD TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'cmt' && (() => {
          const STATUS_STYLES = {
            done:        { badge: 'bg-green-100 text-green-700 border-green-200',       dot: 'bg-green-500',  label: 'Done' },
            in_progress: { badge: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-500',   label: 'In Progress' },
            not_started: { badge: 'bg-gray-100 text-gray-500 border-gray-200',          dot: 'bg-gray-400',   label: 'Not Started' },
            blocked:     { badge: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500',    label: 'Blocked' },
          };

          const filteredDepts = cmtDepartments.map(dept => ({
            ...dept,
            initiatives: dept.initiatives.filter(i => {
              const statusOk = cmtStatusFilter === 'all' || i.status_category === cmtStatusFilter;
              return statusOk;
            }),
          })).filter(dept =>
            (cmtDeptFilter === 'all' || dept.name === cmtDeptFilter) &&
            dept.initiatives.length > 0
          );

          const allDeptNames = cmtDepartments.map(d => d.name);

          return (
            <div className="space-y-6">
              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Header Ã¢â€â‚¬Ã¢â€â‚¬ */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      CMT Dashboard
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Cross-department initiative progress Ã¢â‚¬â€ synced from Notion
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
                      {cmtSyncing ? 'SyncingÃ¢â‚¬Â¦' : 'Sync Notion'}
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
                  <p className={`mt-3 text-sm font-medium ${cmtSyncMsg.startsWith('Ã¢Å“â€œ') ? 'text-green-600' : 'text-red-500'}`}>
                    {cmtSyncMsg}
                  </p>
                )}

                {/* Not connected notice */}
                {cmtOverview && !cmtOverview.notion_connected && (
                  <div className="mt-4 flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Notion is not connected. Go to <button onClick={() => setActiveTab('connections')} className="underline font-semibold ml-1">Connections</button> to add your Integration Token.
                  </div>
                )}

                {/* Stats row */}
                {cmtOverview && cmtOverview.total > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                    {[
                      { label: 'Total Initiatives', value: cmtOverview.total, color: 'text-gray-900' },
                      { label: 'Done', value: cmtOverview.by_status?.done ?? 0, color: 'text-green-600' },
                      { label: 'In Progress', value: cmtOverview.by_status?.in_progress ?? 0, color: 'text-blue-600' },
                      { label: 'Overdue', value: cmtOverview.overdue ?? 0, color: cmtOverview.overdue > 0 ? 'text-red-600' : 'text-gray-500' },
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

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Filters Ã¢â€â‚¬Ã¢â€â‚¬ */}
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-gray-400" />
                {/* Status filter */}
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
                {/* Department filter */}
                <select
                  value={cmtDeptFilter}
                  onChange={e => setCmtDeptFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All departments</option>
                  {allDeptNames.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Loading / Error Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {cmtLoading && (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                  Loading initiativesÃ¢â‚¬Â¦
                </div>
              )}
              {cmtError && !cmtLoading && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {cmtError}
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Empty state Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {!cmtLoading && !cmtError && cmtDepartments.length === 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No initiatives yet</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Connect Notion and sync your department databases to see initiative progress here.
                  </p>
                  <button
                    onClick={() => setActiveTab('connections')}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                  >
                    Connect Notion
                  </button>
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Department Cards Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Initiative list */}
                    <div className="divide-y divide-gray-50">
                      {dept.initiatives.map(item => {
                        const st = STATUS_STYLES[item.status_category] || STATUS_STYLES.not_started;
                        const overdue = item.is_overdue;
                        return (
                          <div
                            key={item.id}
                            className={`p-4 hover:bg-gray-50 transition-colors ${overdue ? 'border-l-4 border-l-red-400' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {/* Status badge */}
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
                                      item.progress >= 40 ? 'bg-blue-500' :
                                      'bg-yellow-400'
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
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ LEADS TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {activeTab === 'leads' && (() => {
          const owners = ['all', ...Array.from(new Set(leads.map(l => l.owner_name).filter(Boolean)))];
          const visibleLeads = filterOwner === 'all' ? leads : leads.filter(l => l.owner_name === filterOwner);
          return (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold">Lead Intelligence</h2>
                  <p className="text-sm text-gray-500 mt-1">AI-scored leads from all connected sources</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Owner filter */}
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
                            <span className="text-xs text-gray-400">Ã¢â‚¬â€</span>
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
                          <button onClick={() => setSelectedLead(lead)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        {/* â”€â”€ GTM SETUP TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        {/* Extracted to src/pages/GTMSetupPage.jsx (P1.10) */}
        {activeTab === 'gtm-setup' && (
          <GTMSetupPage
            onOpenConnectModal={(id) => { setConnectModal(id); setConnectForm({}); setConnectError(null); }}
          />
        )}


        {/* Ã¢â€â‚¬Ã¢â€â‚¬ INTELLIGENCE TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Extracted to src/pages/IntelligencePage.jsx (P1.10) */}
        {activeTab === 'intelligence' && <IntelligencePage />}


        {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Ã¢â€â‚¬Ã¢â€â‚¬ PIPELINE TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Extracted to src/pages/PipelinePage.jsx (P1.10) */}
        {activeTab === 'pipeline' && <PipelinePage />}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ SIGNALS TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Extracted to src/pages/SignalsPage.jsx (P1.10) */}
        {activeTab === 'signals' && <SignalsPage />}

</div>

      {/* Lead detail modal */}
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
                {[['Contact', selectedLead.contact_name], ['Title', selectedLead.contact_title], ['Industry', selectedLead.industry], ['Employees', selectedLead.employee_count]].map(([label, val]) => val && (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-gray-900">{val}</p>
                  </div>
                ))}
              </div>
              {/* Score Breakdown Ã¢â‚¬â€ HockeyStack-style explainable scoring */}
              {selectedLead.scoring_breakdown && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Score Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Firmographics', key: 'firmographics', max: 20, color: 'bg-blue-500', desc: 'Company size + industry fit' },
                      { label: 'Signals', key: 'signals', max: 40, color: 'bg-purple-500', desc: 'Funding, hiring, tech changes' },
                      { label: 'Intent', key: 'intent', max: 30, color: 'bg-orange-500', desc: 'Website visits + engagement' },
                      { label: 'Historical', key: 'historical', max: 10, color: 'bg-green-500', desc: 'Conversion patterns' },
                    ].map(({ label, key, max, color, desc }) => {
                      const val = selectedLead.scoring_breakdown[key] ?? 0;
                      const pct = Math.round((val / max) * 100);
                      return (
                        <div key={key}>
                          <div className="flex justify-between items-center mb-0.5">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{label}</span>
                              <span className="text-xs text-gray-400 ml-1">Ã¢â‚¬â€ {desc}</span>
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
    </div>
  );
};

export default SalesIntelligencePlatform;
