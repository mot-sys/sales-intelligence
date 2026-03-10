/**
 * WorkflowsPage
 * If-this-then-that automation rules for leads.
 */
import { useState, useEffect } from 'react';
import { Zap, RefreshCw, X } from 'lucide-react';
import useDataStore from '../store/dataStore';
import { post, put, del } from '../api/client';

const TRIGGER_LABELS = {
  manual:        'Manual only',
  score_threshold: 'On lead scored',
  alert_created:   'On alert created',
};
const ACTION_LABELS = {
  create_alert:    'Create Alert',
  update_priority: 'Update Priority',
  log:             'Log message',
};
const FIELD_OPTIONS = ['score', 'priority', 'source', 'industry'];
const OP_OPTIONS    = ['gt', 'lt', 'eq', 'neq', 'contains'];
const OP_LABELS     = { gt: '>', lt: '<', eq: '=', neq: '≠', contains: 'contains' };

const EMPTY_FORM = { name: '', description: '', trigger_type: 'manual', conditions: [], actions: [] };

export default function WorkflowsPage() {
  const [wfModal,     setWfModal]     = useState(null);   // null | 'create' | workflow-object
  const [wfForm,      setWfForm]      = useState(EMPTY_FORM);
  const [wfRunning,   setWfRunning]   = useState(null);   // workflow id being run
  const [wfRunResult, setWfRunResult] = useState({});     // id → result

  const { workflows, workflowsLoading, fetchWorkflows } = useDataStore();

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  // ── Condition helpers ──────────────────────────────────────────────────────
  const addCondition      = ()        => setWfForm(f => ({ ...f, conditions: [...f.conditions, { field: 'score', op: 'gt', value: '' }] }));
  const removeCondition   = (i)       => setWfForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition   = (i, k, v) => setWfForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [k]: v } : c) }));
  const addAction         = ()        => setWfForm(f => ({ ...f, actions: [...f.actions, { type: 'create_alert', params: { priority: 'high', message: '' } }] }));
  const removeAction      = (i)       => setWfForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction      = (i, k, v) => setWfForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, [k]: v } : a) }));
  const updateActionParam = (i, k, v) => setWfForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, params: { ...a.params, [k]: v } } : a) }));

  const openCreate = () => { setWfForm(EMPTY_FORM); setWfModal('create'); };
  const openEdit   = (wf) => {
    setWfForm({ name: wf.name, description: wf.description || '', trigger_type: wf.trigger_type, conditions: wf.conditions || [], actions: wf.actions || [] });
    setWfModal(wf);
  };

  const handleSaveWorkflow = async () => {
    try {
      if (wfModal === 'create') {
        await post('/workflows', wfForm);
      } else {
        await put(`/workflows/${wfModal.id}`, wfForm);
      }
      setWfModal(null);
      setWfForm(EMPTY_FORM);
      await fetchWorkflows();
    } catch (e) { alert(`Save failed: ${e.message}`); }
  };

  const handleRunWorkflow = async (wf) => {
    setWfRunning(wf.id);
    try {
      const result = await post(`/workflows/${wf.id}/run`);
      setWfRunResult(r => ({ ...r, [wf.id]: result }));
      await fetchWorkflows();
    } catch (e) { setWfRunResult(r => ({ ...r, [wf.id]: { error: e.message } })); }
    finally     { setWfRunning(null); }
  };

  const handleToggle = async (wf) => {
    try { await put(`/workflows/${wf.id}/toggle`); await fetchWorkflows(); }
    catch (e) { console.error(e); }
  };

  const handleDelete = async (wf) => {
    if (!window.confirm(`Delete workflow "${wf.name}"?`)) return;
    try { await del(`/workflows/${wf.id}`); await fetchWorkflows(); }
    catch (e) { console.error(e); }
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
          <p className="text-sm text-gray-500 mt-1">If-this-then-that rules — automatically act on leads based on conditions</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          + New Workflow
        </button>
      </div>

      {/* List */}
      {workflowsLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
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
                      {wf.conditions?.length > 0 && <span className="text-gray-400">→</span>}
                      {(wf.actions || []).map((a, i) => (
                        <span key={i} className="bg-green-50 border border-green-100 text-green-700 rounded px-2 py-0.5">
                          {ACTION_LABELS[a.type] || a.type}
                        </span>
                      ))}
                    </div>
                    {wf.last_run && <p className="text-xs text-gray-400 mt-2">Last run: {new Date(wf.last_run).toLocaleString()} · {wf.run_count} runs total</p>}
                    {result && (
                      <div className={`mt-2 text-xs rounded px-3 py-2 ${result.error ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                        {result.error ? `✗ ${result.error}` : `✓ ${result.leads_matched}/${result.leads_evaluated} leads matched · ${result.actions_fired} actions fired`}
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
                      {wfRunning === wf.id ? 'Running…' : 'Run'}
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

      {/* Create/Edit Modal */}
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
                  <input
                    value={wfForm.name}
                    onChange={e => setWfForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Hot lead alert"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Trigger</label>
                  <select
                    value={wfForm.trigger_type}
                    onChange={e => setWfForm(f => ({ ...f, trigger_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual">Manual only</option>
                    <option value="score_threshold">On lead scored</option>
                    <option value="alert_created">On alert created</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                <input
                  value={wfForm.description}
                  onChange={e => setWfForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="What does this workflow do?"
                />
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">IF — Conditions (all must match)</label>
                  <button onClick={addCondition} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add condition</button>
                </div>
                {wfForm.conditions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No conditions — workflow runs on ALL leads</p>
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
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">THEN — Actions</label>
                  <button onClick={addAction} className="text-xs text-green-600 hover:text-green-800 font-medium">+ Add action</button>
                </div>
                {wfForm.actions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No actions — add at least one</p>
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
}
