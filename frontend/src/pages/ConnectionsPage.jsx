/**
 * ConnectionsPage
 * Connect and manage data integrations: Salesforce, HubSpot, Clay, Snitcher, Notion.
 * Also shows read-only status of notification channels (Slack, Email/Resend).
 */
import { useState, useEffect } from 'react';
import { Database, Activity, Layers, CheckCircle, AlertCircle, RefreshCw, X, Zap, Bell, Mail } from 'lucide-react';
import useDataStore from '../store/dataStore';
import { post, get } from '../api/client';

const INTEGRATION_DEFS = [
  {
    id: 'salesforce', name: 'Salesforce',
    desc: 'Deal monitoring + stall detection via CDC webhooks',
    icon: Database,
    fields: [
      { key: 'username',       label: 'Username',       type: 'text' },
      { key: 'password',       label: 'Password',       type: 'password' },
      { key: 'security_token', label: 'Security Token', type: 'text', placeholder: 'Optional' },
    ],
  },
  {
    id: 'hubspot', name: 'HubSpot',
    desc: 'Deal + company sync via OAuth Connected App',
    icon: Database,
    fields: [
      { key: 'client_id',     label: 'App Client ID',     type: 'text' },
      { key: 'client_secret', label: 'App Client Secret', type: 'password' },
    ],
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

export default function ConnectionsPage() {
  const [connectModal,   setConnectModal]   = useState(null); // service id or null
  const [connectForm,    setConnectForm]    = useState({});
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError,   setConnectError]   = useState(null);
  const [notifStatus,    setNotifStatus]    = useState(null); // notification channel status

  const {
    connections,
    syncingId,
    syncResult,
    fetchConnections,
    handleSync,
    handleDisconnect,
  } = useDataStore();

  useEffect(() => {
    fetchConnections();
    get('/settings/notifications').then(setNotifStatus).catch(() => {});

    // Detect HubSpot OAuth callback result (e.g. /connections?hubspot=connected)
    const urlParams = new URLSearchParams(window.location.search);
    const hsResult = urlParams.get('hubspot');
    if (hsResult === 'connected') {
      window.history.replaceState({}, '', '/connections');
      fetchConnections();
    } else if (hsResult === 'error') {
      window.history.replaceState({}, '', '/connections');
      setConnectError('HubSpot OAuth mislykkedes — tjek credentials og prøv igen.');
    }
  }, [fetchConnections]);

  const connectedIds = new Set(connections.map(c => c.service));
  const activeDef    = INTEGRATION_DEFS.find(d => d.id === connectModal);

  const handleConnect = async () => {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const params = new URLSearchParams(connectForm).toString();
      const data = await post(`/connections/${connectModal}?${params}`);
      // OAuth services return an auth_url — redirect current tab so the callback lands here
      if (data.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
      await fetchConnections();
      setConnectModal(null);
      setConnectForm({});
    } catch (e) {
      setConnectError(e.message || 'Connection failed — check your credentials.');
    } finally {
      setConnectLoading(false);
    }
  };

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
          {INTEGRATION_DEFS.map(({ id, name, desc, icon: Icon }) => {
            const connected = connectedIds.has(id);
            const conn      = connections.find(c => c.service === id);
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
                        {syncingId === conn.id ? 'Syncing…' : 'Sync now'}
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
                      {syncResult[conn.id].ok ? '✓' : '✗'} {syncResult[conn.id].msg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notification Channels */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" /> Notification Channels
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Server-side notification channels configured via environment variables.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {/* Slack */}
          <div className="flex items-center justify-between p-5 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Slack</h3>
                <p className="text-sm text-gray-500">
                  Alerts posted to a Slack channel via Incoming Webhook.
                  {notifStatus?.slack?.configured && (
                    <span className="ml-2 text-xs text-gray-400">
                      Min. prioritet: <strong>{notifStatus.slack.min_priority}</strong>
                    </span>
                  )}
                </p>
                {!notifStatus?.slack?.configured && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Set <code className="bg-gray-100 px-1 rounded">SLACK_WEBHOOK_URL</code> i Railway Variables for at aktivere.
                  </p>
                )}
              </div>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
              notifStatus?.slack?.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {notifStatus?.slack?.configured
                ? <><CheckCircle className="w-3.5 h-3.5" /> Aktiv</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Ikke konfigureret</>
              }
            </span>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between p-5 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Email (Resend)</h3>
                <p className="text-sm text-gray-500">
                  Ugentlig rapport sendt via Resend.
                  {notifStatus?.email?.configured && notifStatus.email.from_email && (
                    <span className="ml-2 text-xs text-gray-400">Fra: {notifStatus.email.from_email}</span>
                  )}
                </p>
                {notifStatus?.email?.configured && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Auto-send: <strong>{notifStatus.email.auto_send ? 'Aktiv' : 'Deaktiveret'}</strong> — sæt <code className="bg-gray-100 px-1 rounded">EMAIL_REPORT_ENABLED=True</code> for automatisk udsendelse.
                  </p>
                )}
                {!notifStatus?.email?.configured && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Set <code className="bg-gray-100 px-1 rounded">RESEND_API_KEY</code> i Railway Variables for at aktivere.
                  </p>
                )}
              </div>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
              notifStatus?.email?.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {notifStatus?.email?.configured
                ? <><CheckCircle className="w-3.5 h-3.5" /> Aktiv</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Ikke konfigureret</>
              }
            </span>
          </div>
        </div>
      </div>

      {/* Webhook info */}
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
                {connectLoading ? 'Connecting…' : `Connect ${activeDef.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
