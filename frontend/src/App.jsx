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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Page components (P1.10 extraction) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
import GTMSetupPage     from './pages/GTMSetupPage';
import IntelligencePage from './pages/IntelligencePage';
import PipelinePage     from './pages/PipelinePage';
import SignalsPage      from './pages/SignalsPage';
import AnalyticsPage    from './pages/AnalyticsPage';
import JourneyPage      from './pages/JourneyPage';
import WorkflowsPage    from './pages/WorkflowsPage';
import ConnectionsPage  from './pages/ConnectionsPage';
import CMTPage          from './pages/CMTPage';

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
// CHAT CHART RENDERER
// Renders AI-generated chart specs from render_chart tool calls
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

const CHART_PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#16a34a', '#ea580c', '#0284c7',
];

const formatChartValue = (value, prefix = '', suffix = '') => {
  if (value === null || value === undefined) return 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â';
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

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Vertical bar chart ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Horizontal bar chart ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Pie chart ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                'VÃƒÆ’Ã‚Â¦rdi',
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
// API HELPERS
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
// UTILITY HELPERS
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
// ALERT CARD COMPONENT
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
// MAIN APP
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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
  // Weekly Report tab
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [weeklyReportGenerating, setWeeklyReportGenerating] = useState(false);
  const [weeklyReportError, setWeeklyReportError] = useState(null);


  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Legacy dropdown state ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
        'Hvad skal jeg fokusere pÃƒÆ’Ã‚Â¥ denne uge?',
        'Hvilke deals er mest i fare?',
        'Hvilke leads bÃƒÆ’Ã‚Â¸r jeg kontakte i dag?',
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


  useEffect(() => {
    if (activeTab === 'alerts' || activeTab === 'dashboard') fetchAlerts();
    if (activeTab === 'leads') fetchLeads();
    if (activeTab === 'chat') fetchChatContext();
    if (activeTab === 'data') fetchPipelineData();
    if (activeTab === 'report') fetchWeeklyReport();
    // analytics, journey, workflows, connections, cmt, gtm-setup, intelligence, pipeline, signals
    // → extracted page components fetch their own data via dataStore on mount
  }, [activeTab, fetchAlerts, fetchLeads, fetchChatContext, fetchPipelineData, fetchWeeklyReport]);

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
      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Header ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Signal Intelligence</h1>
              <p className="text-sm text-gray-500">GTM Intelligence Platform Ãƒâ€šÃ‚Â· Board-level insights</p>
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

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Primary Nav ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ DASHBOARD TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                              Ãƒâ€šÃ‚Â· {alert.context?.owner_name || alert.lead?.owner_name}
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

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ALERTS TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ AI CHAT TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                        <p className="font-medium text-gray-700">SpÃƒÆ’Ã‚Â¸rg om din pipeline</p>
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
                      placeholder="Stil et spÃƒÆ’Ã‚Â¸rgsmÃƒÆ’Ã‚Â¥l om din pipeline..."
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
                          <span className={`font-semibold ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">IndlÃƒÆ’Ã‚Â¦ser...</p>
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
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Best</span>
                            )}
                            {m.tier === 'powerful' && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">ÃƒÂ¢Ã…Â¡Ã‚Â¡ Max</span>
                            )}
                            {m.tier === 'fast' && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Fast</span>
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
                          placeholder="Fx: Svar altid pÃƒÆ’Ã‚Â¥ dansk"
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
                          placeholder="Fx: Vi sÃƒÆ’Ã‚Â¦lger B2B SaaS til nordiske virksomheder med 50-500 ansatte. Vores ICP er Operations directors..."
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
                          'Svar altid pÃƒÆ’Ã‚Â¥ dansk',
                          'FokusÃƒÆ’Ã‚Â©r pÃƒÆ’Ã‚Â¥ deals der lukker inden for 30 dage',
                          'Brug MEDDIC salgsmÃƒÆ’Ã‚Â¸ntoden',
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

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ WEEKLY REPORT TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                        ? `Uge startende ${report.week_start} Ãƒâ€šÃ‚Â· Genereret ${new Date(report.generated_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} Ãƒâ€šÃ‚Â· ${report.model_used || 'AI'}`
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
                      {weeklyReportGenerating ? 'GenerererÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦' : hasReport ? 'Regenerer' : 'Generer rapport'}
                    </button>
                  </div>
                </div>

                {weeklyReportError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â {weeklyReportError}
                  </div>
                )}

                {weeklyReportGenerating && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-blue-700">
                      Claude analyserer pipeline, alerts, HubSpot-opgaver og outbound aktivitetÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦
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
                    Klik "Generer rapport" ovenfor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â AI analyserer din pipeline og skriver rapporten.
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
                      <h3 className="font-semibold text-gray-900">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Hvad skete der denne uge</h3>
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
                      <h3 className="font-semibold text-gray-900">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ Hvad skal der ske denne uge</h3>
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
                      <h3 className="font-semibold text-gray-900">ÃƒÂ°Ã…Â¸Ã‚Â¤Ã‚Â Hvad kan sales management gÃƒÆ’Ã‚Â¸re</h3>
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
                          { label: 'Deals i pipeline', value: report.data_snapshot.pipeline?.total_deals ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
                          { label: 'Aktive deals (uge)', value: report.data_snapshot.pipeline?.recently_active_deals ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
                          { label: 'Alerts trigget', value: report.data_snapshot.alerts?.total ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
                          { label: 'HubSpot-opgaver', value: report.data_snapshot.tasks?.total ?? (report.data_snapshot.tasks?.available === false ? 'N/A' : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â') },
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

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ PIPELINE DATA TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
            : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â';

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

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Summary cards ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Open Deals', value: summary.total_open_deals, color: 'text-blue-600' },
                    { label: 'Pipeline Value', value: summary.total_pipeline_display, color: 'text-green-600' },
                    { label: 'Stalled', value: summary.stalled_deals, color: summary.stalled_deals > 0 ? 'text-red-600' : 'text-gray-500' },
                    { label: 'Pending Alerts', value: summary.pending_alerts, color: summary.pending_alerts > 0 ? 'text-orange-600' : 'text-gray-500' },
                    { label: 'Top Lead Score', value: summary.top_lead_score ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â', color: 'text-purple-600' },
                    { label: 'Urgent / High', value: summary.urgent_or_high_alerts, color: summary.urgent_or_high_alerts > 0 ? 'text-red-600' : 'text-gray-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className={`text-xl font-bold ${color}`}>{value ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Stage distribution bar ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                              <span className="text-xs font-semibold text-gray-900">{count} deal{count !== 1 ? 's' : ''} &nbsp;Ãƒâ€šÃ‚Â·&nbsp; {pct}%</span>
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

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ View toggle + search ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Deals table ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                                <span className="font-semibold text-gray-900 text-sm">{deal.amount_display || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                {deal.owner ? (
                                  <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
                                    <Users className="w-3.5 h-3.5" />
                                    {deal.owner}
                                  </span>
                                ) : <span className="text-xs text-gray-400">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>}
                              </td>
                              <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                                {deal.close_date || <span className="text-gray-400">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                {deal.days_since_last_activity != null ? (
                                  <span className={`text-sm font-medium ${
                                    deal.days_since_last_activity > 14 ? 'text-red-600' :
                                    deal.days_since_last_activity > 7 ? 'text-orange-500' : 'text-green-600'
                                  }`}>
                                    {deal.days_since_last_activity}d ago
                                  </span>
                                ) : <span className="text-xs text-gray-400">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>}
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
                        {deals.length} deals Ãƒâ€šÃ‚Â· {pipelineData?.generatedAt && `Synced ${pipelineData.generatedAt}`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Leads table ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                                <p className="text-sm text-gray-800">{lead.contact_name || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</p>
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
                              <td className="px-5 py-3.5 text-sm text-gray-600">{lead.industry || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td>
                              <td className="px-5 py-3.5 text-sm text-gray-600">{lead.employee_count ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td>
                              <td className="px-5 py-3.5">
                                {lead.owner_name ? (
                                  <span className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
                                    <Users className="w-3.5 h-3.5" />
                                    {lead.owner_name}
                                  </span>
                                ) : <span className="text-xs text-gray-400">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  lead.source === 'hubspot' ? 'bg-orange-100 text-orange-700' :
                                  lead.source === 'clay' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{lead.source || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</span>
                              </td>
                              <td className="px-5 py-3.5 max-w-xs">
                                {lead.recommendation ? (
                                  <p className="text-xs text-gray-500 truncate" title={lead.recommendation}>{lead.recommendation}</p>
                                ) : <span className="text-xs text-gray-300">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>}
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

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && <AnalyticsPage />}

        {/* ── BUYER JOURNEY TAB ── */}
        {activeTab === 'journey' && <JourneyPage />}

        {/* ── WORKFLOWS TAB ── */}
        {activeTab === 'workflows' && <WorkflowsPage />}

        {/* ── CONNECTIONS TAB ── */}
        {activeTab === 'connections' && <ConnectionsPage />}

        {/* ── CMT DASHBOARD TAB ── */}
        {activeTab === 'cmt' && <CMTPage onNavigateToConnections={() => setActiveTab('connections')} />}

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ LEADS TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                            <span className="text-xs text-gray-400">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>
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

        {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
        {/* Ã¢â€â‚¬Ã¢â€â‚¬ GTM SETUP TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
        {/* Extracted to src/pages/GTMSetupPage.jsx (P1.10) */}
        {activeTab === 'gtm-setup' && (
          <GTMSetupPage
            onOpenConnectModal={(id) => { setConnectModal(id); setConnectForm({}); setConnectError(null); }}
          />
        )}


        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ INTELLIGENCE TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        {/* Extracted to src/pages/IntelligencePage.jsx (P1.10) */}
        {activeTab === 'intelligence' && <IntelligencePage />}


        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ PIPELINE TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        {/* Extracted to src/pages/PipelinePage.jsx (P1.10) */}
        {activeTab === 'pipeline' && <PipelinePage />}

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SIGNALS TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
              {/* Score Breakdown ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â HockeyStack-style explainable scoring */}
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
                              <span className="text-xs text-gray-400 ml-1">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {desc}</span>
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
