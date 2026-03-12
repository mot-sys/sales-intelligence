import React, { useState, useEffect } from 'react';
import {
  Activity, Database, Brain, Users,
  TrendingUp, Zap, RefreshCw, Bell, X, ChevronDown,
  Sparkles, BarChart2, Target, FileText,
  Building2, Compass, Archive, Radio, UserCog, Award,
} from 'lucide-react';
import useAuthStore from './store/authStore';

// ── Page components (P1.10 extraction) ───────────────────────────────────────
import GTMSetupPage     from './pages/GTMSetupPage';
import IntelligencePage from './pages/IntelligencePage';
import PipelinePage     from './pages/PipelinePage';
import SignalsPage      from './pages/SignalsPage';
import AnalyticsPage    from './pages/AnalyticsPage';
import JourneyPage      from './pages/JourneyPage';
import WorkflowsPage    from './pages/WorkflowsPage';
import ConnectionsPage  from './pages/ConnectionsPage';
import CMTPage          from './pages/CMTPage';
import DashboardPage    from './pages/DashboardPage';
import AlertsPage       from './pages/AlertsPage';
import ChatPage         from './pages/ChatPage';
import ReportPage       from './pages/ReportPage';
import DataPage         from './pages/DataPage';
import LeadsPage        from './pages/LeadsPage';
import TeamPage         from './pages/TeamPage';
import AlertRulesPage   from './pages/AlertRulesPage';
import BoardPage        from './pages/BoardPage';

import useDataStore from './store/dataStore';

// ── Login / Register Screen ───────────────────────────────────────────────────
const AuthScreen = () => {
  const { login, register } = useAuthStore();
  const [tab,      setTab]      = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) { setError('Navn er påkrævet'); setLoading(false); return; }
        await register(name.trim(), email, password);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Noget gik galt';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Signal Intelligence</h1>
            <p className="text-xs text-gray-500">GTM Intelligence Platform</p>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              {t === 'login' ? 'Log ind' : 'Opret konto'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Dit navn" required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="din@email.com" required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adgangskode</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 tegn" required minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {tab === 'login' ? 'Logger ind...' : 'Opretter konto...'}
              </span>
            ) : (
              tab === 'login' ? 'Log ind' : 'Opret konto'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};


// ── Main App ──────────────────────────────────────────────────────────────────
const SalesIntelligencePlatform = () => {
  const [activeTab,   setActiveTab]   = useState('gtm-setup');
  const [error,       setError]       = useState(null);
  const [legacyOpen,  setLegacyOpen]  = useState(false);

  const { alertStats, fetchAlerts } = useDataStore();

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
    { id: 'team',        label: 'Team',          icon: UserCog },
    { id: 'alert-rules', label: 'Alert Regler',  icon: Bell },
    { id: 'board',       label: 'Board Summary', icon: Award },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Signal Intelligence</h1>
              <p className="text-sm text-gray-500">GTM Intelligence Platform · Board-level insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAlerts('pending')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Primary Nav ───────────────────────────────────────────────────── */}
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

      {/* ── Error banner ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      <div className="p-6">

        {/* ── Primary tabs (extracted P1.10) ─────────────────────────────── */}
        {activeTab === 'gtm-setup'    && <GTMSetupPage onOpenConnectModal={() => setActiveTab('connections')} />}
        {activeTab === 'intelligence' && <IntelligencePage />}
        {activeTab === 'pipeline'     && <PipelinePage />}
        {activeTab === 'signals'      && <SignalsPage />}

        {/* ── Legacy tabs (extracted P1.10) ──────────────────────────────── */}
        {activeTab === 'dashboard'   && <DashboardPage onNavigateToAlerts={() => setActiveTab('alerts')} />}
        {activeTab === 'alerts'      && <AlertsPage />}
        {activeTab === 'chat'        && <ChatPage />}
        {activeTab === 'report'      && <ReportPage />}
        {activeTab === 'data'        && <DataPage />}
        {activeTab === 'analytics'   && <AnalyticsPage />}
        {activeTab === 'journey'     && <JourneyPage />}
        {activeTab === 'workflows'   && <WorkflowsPage />}
        {activeTab === 'connections' && <ConnectionsPage />}
        {activeTab === 'cmt'         && <CMTPage onNavigateToConnections={() => setActiveTab('connections')} />}
        {activeTab === 'leads'       && <LeadsPage />}
        {activeTab === 'team'        && <TeamPage />}
        {activeTab === 'alert-rules' && <AlertRulesPage />}
        {activeTab === 'board'       && <BoardPage />}

      </div>
    </div>
  );
};

export default SalesIntelligencePlatform;
