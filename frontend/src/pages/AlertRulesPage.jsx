/**
 * AlertRulesPage  (P2.8 — Custom alert rules)
 *
 * Lists custom alert rules and lets admins create / edit / delete them.
 * Also provides a "Test rules now" dry-run that shows which deals would match.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw,
  ChevronDown, ChevronUp, Play, AlertTriangle,
} from 'lucide-react';
import { get, post, put, del } from '../api/client';
import * as API from '../api/client';

// ── Trigger type definitions ───────────────────────────────────────────────

const TRIGGER_TYPES = [
  {
    id: 'deal_stalled',
    label: 'Deal stalled',
    description: 'Alert when a deal goes N days without any activity',
    conditionFields: [
      { key: 'days_inactive', label: 'Days without activity', type: 'number', default: 21, min: 1 },
      { key: 'min_amount',    label: 'Min deal amount (0 = any)', type: 'number', default: 0, min: 0 },
    ],
  },
  {
    id: 'deal_closing_soon',
    label: 'Closing soon, no activity',
    description: 'Alert when a deal is closing within N days but has had no recent activity',
    conditionFields: [
      { key: 'days_to_close', label: 'Closing within (days)',     type: 'number', default: 14, min: 1 },
      { key: 'days_inactive', label: 'No activity in last (days)', type: 'number', default: 7,  min: 1 },
      { key: 'min_amount',    label: 'Min deal amount (0 = any)',  type: 'number', default: 0,  min: 0 },
    ],
  },
  {
    id: 'deal_amount_gt',
    label: 'High-value deal alert',
    description: 'Alert when any open deal exceeds a certain amount',
    conditionFields: [
      { key: 'min_amount', label: 'Amount threshold (DKK / USD)', type: 'number', default: 100000, min: 1 },
    ],
  },
  {
    id: 'pipeline_below',
    label: 'Pipeline coverage below target',
    description: 'Alert when total open pipeline falls below X% of revenue target',
    conditionFields: [
      { key: 'coverage_pct', label: 'Alert when pipeline < X% of target', type: 'number', default: 200, min: 1 },
    ],
  },
];

const SEVERITIES = [
  { id: 'low',      label: 'Low',      color: 'text-gray-600 bg-gray-100' },
  { id: 'medium',   label: 'Medium',   color: 'text-yellow-700 bg-yellow-100' },
  { id: 'high',     label: 'High',     color: 'text-orange-700 bg-orange-100' },
  { id: 'critical', label: 'Critical', color: 'text-red-700 bg-red-100' },
];

const SEVERITY_COLOR = {
  low:      'text-gray-600  bg-gray-100',
  medium:   'text-yellow-700 bg-yellow-100',
  high:     'text-orange-700 bg-orange-100',
  critical: 'text-red-700   bg-red-100',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function defaultConditions(triggerType) {
  const def = TRIGGER_TYPES.find(t => t.id === triggerType);
  if (!def) return {};
  return Object.fromEntries(def.conditionFields.map(f => [f.key, f.default]));
}

// ── RuleForm ───────────────────────────────────────────────────────────────

function RuleForm({ initial, onSave, onCancel, saving }) {
  const [name,        setName]        = useState(initial?.name        ?? '');
  const [triggerType, setTriggerType] = useState(initial?.trigger_type ?? 'deal_stalled');
  const [severity,    setSeverity]    = useState(initial?.severity     ?? 'medium');
  const [cooldown,    setCooldown]    = useState(initial?.cooldown_hours ?? 24);
  const [conditions,  setConditions]  = useState(
    initial?.conditions ?? defaultConditions(initial?.trigger_type ?? 'deal_stalled')
  );

  const triggerDef = TRIGGER_TYPES.find(t => t.id === triggerType);

  const handleTriggerChange = (v) => {
    setTriggerType(v);
    setConditions(defaultConditions(v));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, trigger_type: triggerType, conditions, severity, cooldown_hours: Number(cooldown) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rule name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Regelnavn *</label>
        <input
          required
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="f.eks. Advarer om store deals der stagnerer"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Trigger type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
        <select
          value={triggerType}
          onChange={e => handleTriggerChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TRIGGER_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {triggerDef && (
          <p className="mt-1 text-xs text-gray-500">{triggerDef.description}</p>
        )}
      </div>

      {/* Condition fields — dynamic based on trigger type */}
      {triggerDef && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Betingelser</p>
          {triggerDef.conditionFields.map(field => (
            <div key={field.key}>
              <label className="block text-sm text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type}
                min={field.min}
                value={conditions[field.key] ?? field.default}
                onChange={e => setConditions(c => ({
                  ...c,
                  [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      )}

      {/* Severity + cooldown */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alvorlighed</label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SEVERITIES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cooldown (timer)</label>
          <input
            type="number"
            min={1}
            value={cooldown}
            onChange={e => setCooldown(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          Annuller
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Gemmer...' : 'Gem regel'}
        </button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AlertRulesPage() {
  const [rules,        setRules]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showNew,      setShowNew]      = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [testing,      setTesting]      = useState(false);
  const [testResults,  setTestResults]  = useState(null);
  const [expandedTest, setExpandedTest] = useState(null); // rule_id

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get('/alert-rules');
      setRules(data);
    } catch (e) {
      setError(e.message || 'Kunne ikke hente regler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleCreate = async (body) => {
    setSaving(true);
    try {
      await post('/alert-rules', body);
      setShowNew(false);
      await fetchRules();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, body) => {
    setSaving(true);
    try {
      await API.put(`/alert-rules/${id}`, body);
      setEditId(null);
      await fetchRules();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await post(`/alert-rules/${id}/toggle`, {});
      await fetchRules();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Slet reglen "${name}"?`)) return;
    try {
      await del(`/alert-rules/${id}`);
      await fetchRules();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const data = await post('/alert-rules/evaluate', {});
      setTestResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  const triggerLabel = (type) => TRIGGER_TYPES.find(t => t.id === type)?.label ?? type;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Custom Alert Regler
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Definer dine egne triggers — fx "advar mig når en deal over 500k er inaktiv i 14 dage".
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing || rules.length === 0}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
              {testing ? 'Tester...' : 'Test regler nu'}
            </button>
            <button
              onClick={fetchRules}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Opdater
            </button>
            <button
              onClick={() => { setShowNew(true); setEditId(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Ny regel
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* New rule form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-blue-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Ny alert-regel</h3>
          <RuleForm
            onSave={handleCreate}
            onCancel={() => setShowNew(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Test results */}
      {testResults && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Play className="w-4 h-4 text-green-600" />
              Testresultat — {testResults.total} regel{testResults.total !== 1 ? 'r' : ''} matchede
            </h3>
            <button onClick={() => setTestResults(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Luk
            </button>
          </div>
          {testResults.total === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              Ingen regler matchede de nuværende data. 🎉
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {testResults.matches.map(m => (
                <div key={m.rule_id} className="px-6 py-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedTest(expandedTest === m.rule_id ? null : m.rule_id)}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.headline}</p>
                        <p className="text-xs text-gray-500">{m.match_count} match(es) · severity: {m.severity}</p>
                      </div>
                    </div>
                    {expandedTest === m.rule_id
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                  {expandedTest === m.rule_id && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs text-gray-600">
                        <tbody>
                          {m.matches.map((item, i) => (
                            <tr key={i} className="border-t border-gray-50">
                              {Object.entries(item).map(([k, v]) => (
                                <td key={k} className="py-1.5 pr-4">
                                  <span className="text-gray-400">{k}: </span>
                                  {v == null ? '—' : String(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rule list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">
            {rules.length} regel{rules.length !== 1 ? 'r' : ''}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Henter regler…</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Ingen regler endnu. Klik "Ny regel" for at oprette din første.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.map(rule => (
              <div key={rule.id} className="px-6 py-4">
                {editId === rule.id ? (
                  <RuleForm
                    initial={rule}
                    onSave={body => handleUpdate(rule.id, body)}
                    onCancel={() => setEditId(null)}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${rule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {rule.name}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[rule.severity] || 'bg-gray-100 text-gray-600'}`}>
                          {rule.severity}
                        </span>
                        {!rule.enabled && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Deaktiveret</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {triggerLabel(rule.trigger_type)} · Cooldown {rule.cooldown_hours}t
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                        {Object.entries(rule.conditions || {}).map(([k, v]) => (
                          v != null && (
                            <span key={k} className="text-xs text-gray-400">
                              {k.replace(/_/g, ' ')}: <strong className="text-gray-600">{v}</strong>
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(rule.id)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={rule.enabled ? 'Deaktiver' : 'Aktiver'}
                      >
                        {rule.enabled
                          ? <ToggleRight className="w-5 h-5 text-blue-600" />
                          : <ToggleLeft  className="w-5 h-5" />
                        }
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => { setEditId(rule.id); setShowNew(false); }}
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        Rediger
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(rule.id, rule.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Slet regel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tip box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">💡 Sådan virker det</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs">
          <li>Reglerne evalueres automatisk ved synkronisering og via den ugentlige Celery-task.</li>
          <li>Brug "Test regler nu" for at se hvilke deals der matcher <em>right now</em> uden at oprette alerts.</li>
          <li>Cooldown-timeren forhindrer den samme regel i at fyre igen for samme data inden for X timer.</li>
        </ul>
      </div>
    </div>
  );
}
