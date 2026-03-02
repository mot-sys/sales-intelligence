import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Activity, Database, Brain, Users, Send, CheckCircle, AlertCircle, Clock,
  TrendingUp, Zap, Settings, ExternalLink, RefreshCw, Bell, BellOff, X, ChevronDown,
  MessageSquare, Sparkles, CornerDownLeft,
} from 'lucide-react';

// ─────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────

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
};

// ─────────────────────────────────────────────
// MOCK FALLBACK DATA (shown when backend is offline)
// ─────────────────────────────────────────────

const MOCK_ALERTS = [
  {
    id: '1',
    type: 'stalled_deal',
    priority: 'urgent',
    source: 'salesforce',
    headline: 'TechCorp A/S deal stalled for 11 days',
    context: {
      opportunity_name: 'TechCorp A/S',
      days_stalled: 11,
      amount_display: '\u20ac45,000',
      close_date: '2024-03-15',
      owner_name: 'Lars Nielsen',
      detail: '\u20ac45,000 opportunity with no Salesforce activity for 11 days, closes 2024-03-15.',
    },
    recommendation: 'Schedule a check-in call and create a follow-up task in Salesforce. Consider sharing a relevant case study to re-engage.',
    status: 'pending',
    lead: { company_name: 'TechCorp A/S', score: 87, priority: 'hot' },
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'intent_spike',
    priority: 'urgent',
    source: 'snitcher',
    headline: 'Nordic Ventures visited 5 pages including pricing',
    context: {
      company_name: 'Nordic Ventures',
      company_domain: 'nordicventures.dk',
      pages_visited: 5,
      pricing_page_visited: true,
      pages: ['/features', '/pricing', '/case-studies', '/about', '/contact'],
    },
    recommendation: "Prospect is showing high buying intent \u2014 reach out within 2 hours while they're actively researching. Lead with ROI numbers.",
    status: 'pending',
    lead: { company_name: 'Nordic Ventures', score: 79, priority: 'hot', owner_name: 'Julie Frost' },
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'score_jump',
    priority: 'high',
    source: 'scoring',
    headline: 'GrowthLab score jumped from 48 \u2192 73',
    context: { old_score: 48, new_score: 73, delta: 25 },
    recommendation: 'Lead score jumped 25 points due to new hiring signals. Review and prioritize for outreach this week.',
    status: 'pending',
    lead: { company_name: 'GrowthLab', score: 73, priority: 'warm', owner_name: 'Mads Holm' },
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'stalled_deal',
    priority: 'high',
    source: 'salesforce',
    headline: 'DataStream ApS deal stalled for 8 days',
    context: {
      opportunity_name: 'DataStream ApS',
      days_stalled: 8,
      amount_display: '\u20ac28,500',
      detail: '\u20ac28,500 opportunity with no Salesforce activity for 8 days.',
    },
    recommendation: 'Send a follow-up email with a link to your product demo. Offer a brief 15-minute call to address any objections.',
    status: 'pending',
    lead: { company_name: 'DataStream ApS', score: 62, priority: 'warm', owner_name: 'Rasmus Bech' },
    created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'intent_spike',
    priority: 'medium',
    source: 'snitcher',
    headline: 'CloudFirst Denmark visited 3 pages',
    context: { company_name: 'CloudFirst Denmark', pages_visited: 3, pricing_page_visited: false },
    recommendation: 'Add to a nurture sequence and monitor for additional intent signals over the next 48 hours.',
    status: 'snoozed',
    lead: { company_name: 'CloudFirst Denmark', score: 54, priority: 'cold', owner_name: 'Julie Frost' },
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

const MOCK_STATS = { pending: 4, snoozed: 1, dismissed: 3, actioned: 7, urgent_high_pending: 3 };

const MOCK_LEADS = [
  { id: 1, company_name: 'TechCorp A/S', score: 92, priority: 'hot', industry: 'SaaS', employee_count: 45, contact_name: 'Lars Nielsen', contact_title: 'CRO', owner_name: 'Mads Holm', source: 'Snitcher' },
  { id: 2, company_name: 'Nordic Ventures', score: 87, priority: 'hot', industry: 'VC', employee_count: 12, contact_name: 'Sofia Andersen', contact_title: 'Partner', owner_name: 'Julie Frost', source: 'Clay' },
  { id: 3, company_name: 'GrowthLab', score: 73, priority: 'warm', industry: 'Marketing', employee_count: 28, contact_name: 'Michael Jensen', contact_title: 'CEO', owner_name: 'Mads Holm', source: 'Clay' },
  { id: 4, company_name: 'DataStream ApS', score: 68, priority: 'warm', industry: 'Analytics', employee_count: 67, contact_name: 'Anne Kristensen', contact_title: 'VP Sales', owner_name: 'Rasmus Bech', source: 'Snitcher' },
  { id: 5, company_name: 'CloudFirst Denmark', score: 54, priority: 'cold', industry: 'Cloud', employee_count: 180, contact_name: 'Peter Madsen', contact_title: 'Director', owner_name: 'Julie Frost', source: 'Outreach.io' },
];

// ─────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// ALERT CARD COMPONENT
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────

const SalesIntelligencePlatform = () => {
  const [activeTab, setActiveTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState(MOCK_STATS);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
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
      setUsingMockData(false);
    } catch {
      setAlerts(MOCK_ALERTS.filter(a => a.status === filterStatus));
      setAlertStats(MOCK_STATS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.get('/leads/?limit=50');
      setLeads(data.leads || data.items || []);
      setUsingMockData(false);
    } catch {
      setLeads(MOCK_LEADS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await API.get('/connections/');
      setConnections(data.integrations || []);
    } catch {
      setConnections([]);
    }
  }, []);

  const fetchChatContext = useCallback(async () => {
    try {
      const [ctxData, sugData] = await Promise.all([
        API.get('/chat/context'),
        API.get('/chat/suggested'),
      ]);
      setChatContext(ctxData.pipeline_summary);
      setSuggestedQuestions(sugData.questions || []);
    } catch {
      setSuggestedQuestions([
        'Hvad skal jeg fokusere på denne uge?',
        'Hvilke deals er mest i fare?',
        'Hvilke leads bør jeg kontakte i dag?',
        'Giv mig et overblik over min pipeline',
      ]);
    }
  }, []);

  const sendChatMessage = async (question) => {
    if (!question.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: question };
    const history = chatMessages.filter(m => m.role !== 'system');
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const data = await API.post('/chat/', { question, history });
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      if (data.pipeline_summary) setChatContext(data.pipeline_summary);
    } catch (e) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Fejl: ${e.message}. Tjek at OPENAI_API_KEY er sat i .env filen.`,
        isError: true,
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'alerts' || activeTab === 'dashboard') fetchAlerts();
    if (activeTab === 'leads') fetchLeads();
    if (activeTab === 'connections') fetchConnections();
    if (activeTab === 'chat') fetchChatContext();
  }, [activeTab, fetchAlerts, fetchLeads, fetchConnections, fetchChatContext]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAlertAction = async (alertId, actionType, payload = null) => {
    setActioningId(alertId);
    try {
      if (usingMockData) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      } else {
        await API.post(`/alerts/${alertId}/action`, { action_type: actionType, payload });
        await fetchAlerts();
      }
    } catch (e) {
      setError(`Action failed: ${e.message}`);
    } finally {
      setActioningId(null);
    }
  };

  const handleConnect = async () => {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const params = new URLSearchParams(connectForm).toString();
      await API.post(`/connections/${connectModal}?${params}`);
      await fetchConnections();
      setConnectModal(null);
      setConnectForm({});
    } catch (e) {
      setConnectError(e.message || 'Connection failed — check your credentials.');
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

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertStats.urgent_high_pending },
    { id: 'chat', label: 'AI Advisor', icon: Sparkles },
    { id: 'connections', label: 'Connections', icon: Database },
    { id: 'leads', label: 'Lead Intel', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Signal Intelligence</h1>
              <p className="text-sm text-gray-500">Continuous monitoring · Event-driven alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {usingMockData && (
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full border border-yellow-200">
                Demo data
              </span>
            )}
            <button
              onClick={fetchAlerts}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex space-x-1 px-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="p-6">

        {/* ── DASHBOARD TAB ── */}
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
                {(usingMockData ? MOCK_ALERTS : alerts).filter(a => a.status === 'pending').slice(0, 3).map(alert => (
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
                      {alert.priority.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ── */}
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

        {/* ── AI CHAT TAB ── */}
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
                        <p className="font-medium text-gray-700">Spørg om din pipeline</p>
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
                      <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : msg.isError
                            ? 'bg-red-50 border border-red-200 text-red-700'
                            : 'bg-gray-50 border border-gray-200 text-gray-800'
                      }`}>
                        {msg.content}
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
                      placeholder="Stil et spørgsmål om din pipeline..."
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

              {/* Context sidebar */}
              <div className="w-64 flex flex-col gap-4">
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
                          <span className={`font-semibold ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Indlæser...</p>
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

        {/* ── CONNECTIONS TAB ── */}
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
              id: 'outreach', name: 'Outreach.io',
              desc: 'Automated sequence enrollment + reply tracking',
              icon: Send,
              fields: [{ key: 'api_key', label: 'API Key', type: 'password' }],
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
                            <button className="p-2 text-gray-400 hover:text-gray-600">
                              <Settings className="w-5 h-5" />
                            </button>
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
                      {['snitcher', 'salesforce', 'outreach'].map(svc => (
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
                        {connectLoading ? 'Connecting…' : `Connect ${activeDef.name}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── LEADS TAB ── */}
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
