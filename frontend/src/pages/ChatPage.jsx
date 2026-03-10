/**
 * ChatPage — AI Pipeline Advisor
 * Local state: chatInput, skillsOpen, skillInput, contextInput, settingsSaving, chatBottomRef
 * Store state: chatMessages, chatContext, suggestedQuestions, aiSettings, chatLoading,
 *              sendChatMessage, saveAiSettings, addSkill, removeSkill, fetchChatContext
 */
import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { MessageSquare, Sparkles, CornerDownLeft, ChevronDown, X } from 'lucide-react';
import useDataStore from '../store/dataStore';

// ─── Chart palette ───────────────────────────────────────────────────────────
const CHART_PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#16a34a', '#ea580c', '#0284c7',
];

const formatChartValue = (value, prefix = '', suffix = '') => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && value >= 1000) {
    return `${prefix}${value >= 1_000_000
      ? (value / 1_000_000).toFixed(1) + 'M'
      : (value / 1_000).toFixed(0) + 'k'
    }${suffix}`;
  }
  return `${prefix}${value}${suffix}`;
};

// ─── ChatChart — renders AI-generated chart specs ────────────────────────────
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

      {chart_type === 'bar' && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => formatChartValue(v, value_prefix, value_suffix)} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

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
                    style={{ width: `${pct}%`, backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chart_type === 'pie' && (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}
              label={({ name, percent }) => percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
              labelLine={false}
            >
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={val => [formatChartValue(val, value_prefix, value_suffix), 'Værdi']} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ─── ChatPage ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [chatInput, setChatInput]           = useState('');
  const [skillsOpen, setSkillsOpen]         = useState(false);
  const [skillInput, setSkillInput]         = useState('');
  const [contextInput, setContextInput]     = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const chatBottomRef = useRef(null);

  const {
    chatMessages, chatContext, suggestedQuestions, aiSettings, chatLoading,
    sendChatMessage, saveAiSettings, addSkill, removeSkill, fetchChatContext,
  } = useDataStore();

  // Fetch context on mount
  useEffect(() => { fetchChatContext(); }, [fetchChatContext]);

  // Sync contextInput when aiSettings loads/changes
  useEffect(() => {
    if (aiSettings) setContextInput(aiSettings.company_context || '');
  }, [aiSettings?.company_context]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handleSaveSettings = async (updates) => {
    setSettingsSaving(true);
    try { await saveAiSettings(updates); } catch (e) { console.error(e); } finally { setSettingsSaving(false); }
  };

  const handleAddSkill = () => {
    if (!skillInput.trim()) return;
    addSkill(skillInput);
    setSkillInput('');
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[500px]">

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
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
                    onClick={() => { sendChatMessage(q); }}
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
                {msg.charts && msg.charts.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {msg.charts.map((chart, ci) => <ChatChart key={ci} spec={chart} />)}
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
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex gap-2">
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

      {/* ── Context + Skills sidebar ────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-4 overflow-y-auto">

        {/* Pipeline snapshot */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline snapshot</p>
          {chatContext ? (
            <div className="space-y-2.5">
              {[
                { label: 'Open deals',    value: chatContext.total_open_deals },
                { label: 'Total value',   value: chatContext.total_pipeline_display },
                { label: 'Stalled deals', value: chatContext.stalled_deals,           warn: chatContext.stalled_deals > 0 },
                { label: 'Pending alerts', value: chatContext.pending_alerts },
                { label: 'Urgent/High',   value: chatContext.urgent_or_high_alerts,   warn: chatContext.urgent_or_high_alerts > 0 },
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

        {/* Model selector */}
        {aiSettings && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">AI Model</p>
            <div className="space-y-2">
              {(aiSettings.available_models || []).map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSaveSettings({ model: m.id })}
                  disabled={settingsSaving}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    aiSettings.model === m.id
                      ? 'bg-purple-50 border-purple-300 text-purple-900'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{m.label}</span>
                    {m.tier === 'recommended' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">✓ Best</span>}
                    {m.tier === 'powerful'    && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">⚡ Max</span>}
                    {m.tier === 'fast'        && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">🚀 Fast</span>}
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
              {(aiSettings?.skills || []).map((skill, i) => (
                <div key={i} className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                  <p className="flex-1 text-xs text-purple-800">{skill}</p>
                  <button onClick={() => removeSkill(i)} className="text-purple-400 hover:text-red-500 flex-shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Fx: Svar altid på dansk"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSkill(); }}
                  className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={handleAddSkill}
                  disabled={!skillInput.trim() || settingsSaving}
                  className="px-2.5 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-40 font-medium"
                >+</button>
              </div>

              <div className="pt-1">
                <p className="text-xs text-gray-500 font-medium mb-1.5">Virksomhedskontekst</p>
                <textarea
                  rows={3}
                  placeholder="Fx: Vi sælger B2B SaaS til nordiske virksomheder med 50-500 ansatte. Vores ICP er Operations directors..."
                  value={contextInput}
                  onChange={e => setContextInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                />
                <button
                  onClick={() => handleSaveSettings({ company_context: contextInput })}
                  disabled={settingsSaving}
                  className="mt-1.5 w-full py-1.5 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-900 disabled:opacity-40 font-medium"
                >
                  {settingsSaving ? 'Gemmer...' : 'Gem kontekst'}
                </button>
              </div>

              <div className="pt-1 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5">Forslag:</p>
                {[
                  'Svar altid på dansk',
                  'Fokusér på deals der lukker inden for 30 dage',
                  'Brug MEDDIC salgsmetoden',
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

        {/* Suggested questions (after first message) */}
        {chatMessages.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Forslag</p>
            <div className="space-y-2">
              {suggestedQuestions.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => { sendChatMessage(q); }}
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
}
