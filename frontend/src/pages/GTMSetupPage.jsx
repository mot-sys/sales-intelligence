/**
 * GTMSetupPage
 * Primary tab: GTM Setup — Strategy, ICP & TAM, Goals/Calculator, Integrations
 *
 * Local state  : sub-tab, all form state, saving/saved indicators, input helpers
 * Server state : gtmConfig, progressData, connections — all from useDataStore
 * Props        : onOpenConnectModal(serviceId) — triggers the global connect modal in App.jsx
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Target, Users, TrendingUp, Database,
  Save, Plus, Trash2, X, CheckCircle,
} from 'lucide-react';
import useDataStore from '../store/dataStore';

export default function GTMSetupPage({ onOpenConnectModal }) {
  // ── Local UI state ───────────────────────────────────────────────────────
  const [gtmTab,    setGtmTab]    = useState('strategy');
  const [gtmSaving, setGtmSaving] = useState(false);
  const [gtmSaved,  setGtmSaved]  = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────
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

  // ── Input helpers ────────────────────────────────────────────────────────
  const [industryInput,  setIndustryInput]  = useState('');
  const [geoInput,       setGeoInput]       = useState('');
  const [bottomUpPerDay, setBottomUpPerDay] = useState(5);
  const [goalsInputMode, setGoalsInputMode] = useState('absolute');
  const [growthPct,      setGrowthPct]      = useState(0);

  // ── Server state ─────────────────────────────────────────────────────────
  const {
    gtmConfig,
    progressData, progressLoading,
    connections,
    syncingId, syncResult,
    fetchGtmSetupTab,
    saveGtmConfig: storeSaveGtmConfig,
    fetchGtmProgress,
    handleSync,
    handleDisconnect,
  } = useDataStore();

  // Fetch on mount
  useEffect(() => { fetchGtmSetupTab(); }, [fetchGtmSetupTab]);

  // Populate forms when server config loads
  useEffect(() => {
    if (!gtmConfig) return;
    if (gtmConfig.company_description !== undefined) {
      setStrategyForm({
        company_description: gtmConfig.company_description || '',
        value_proposition:   gtmConfig.value_proposition   || '',
        competitors:         gtmConfig.competitors         || [],
        offerings:           gtmConfig.offerings           || [],
      });
    }
    if (gtmConfig.icp && Object.keys(gtmConfig.icp).length) {
      setIcpForm(prev => ({ ...prev, ...gtmConfig.icp }));
    }
    if (gtmConfig.goals && Object.keys(gtmConfig.goals).length) {
      setGoalsForm(prev => ({ ...prev, ...gtmConfig.goals }));
      if (gtmConfig.goals.input_mode === 'percent') {
        setGoalsInputMode('percent');
        setGrowthPct(gtmConfig.goals.growth_pct || 0);
      } else {
        setGoalsInputMode('absolute');
        setGrowthPct(0);
      }
    }
  }, [gtmConfig]);

  // Save wrapper — adds saving/saved feedback on top of store action
  const handleSave = useCallback(async (section, formData) => {
    setGtmSaving(true);
    try {
      await storeSaveGtmConfig(section, formData);
      setGtmSaved(true);
      setTimeout(() => setGtmSaved(false), 2500);
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setGtmSaving(false);
    }
  }, [storeSaveGtmConfig]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">GTM Setup</h2>
          <p className="text-sm text-gray-500 mt-0.5">Konfigurer din go-to-market strategi, ICP og målsætninger</p>
        </div>
        {gtmSaved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" /> Gemt
          </span>
        )}
      </div>

      {/* Sub-tab pills */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'strategy',     label: 'Strategi',     icon: Target     },
          { id: 'icp',          label: 'ICP & TAM',    icon: Users      },
          { id: 'goals',        label: 'Målsætninger', icon: TrendingUp },
          { id: 'integrations', label: 'Integrationer', icon: Database   },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setGtmTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              gtmTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Strategy ── */}
      {gtmTab === 'strategy' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Virksomhedsbeskrivelse</label>
              <p className="text-xs text-gray-400 mb-3">Hvad gør I? Elevator pitch til AI-analysen.</p>
              <textarea
                rows={4}
                value={strategyForm.company_description}
                onChange={e => setStrategyForm(f => ({ ...f, company_description: e.target.value }))}
                placeholder="Vi tilbyder en SaaS-platform der hjælper B2B-salgshold med at..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Value Proposition</label>
              <p className="text-xs text-gray-400 mb-3">Hvad differentiere jer fra konkurrenterne?</p>
              <textarea
                rows={3}
                value={strategyForm.value_proposition}
                onChange={e => setStrategyForm(f => ({ ...f, value_proposition: e.target.value }))}
                placeholder="Vi er de eneste der kombinerer realtids intent signals med CRM-data og..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Konkurrenter</label>
                <button
                  onClick={() => setStrategyForm(f => ({ ...f, competitors: [...f.competitors, { name: '', weakness: '', how_we_win: '' }] }))}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tilføj
                </button>
              </div>
              <div className="space-y-3">
                {(strategyForm.competitors || []).map((c, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 items-start">
                    <input value={c.name || ''} onChange={e => { const arr = [...strategyForm.competitors]; arr[i] = { ...arr[i], name: e.target.value }; setStrategyForm(f => ({ ...f, competitors: arr })); }} placeholder="Navn" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input value={c.weakness || ''} onChange={e => { const arr = [...strategyForm.competitors]; arr[i] = { ...arr[i], weakness: e.target.value }; setStrategyForm(f => ({ ...f, competitors: arr })); }} placeholder="Svaghed" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <div className="flex gap-1">
                      <input value={c.how_we_win || ''} onChange={e => { const arr = [...strategyForm.competitors]; arr[i] = { ...arr[i], how_we_win: e.target.value }; setStrategyForm(f => ({ ...f, competitors: arr })); }} placeholder="Hvorfor vi vinder" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <button onClick={() => setStrategyForm(f => ({ ...f, competitors: f.competitors.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {!strategyForm.competitors?.length && <p className="text-xs text-gray-400 italic">Ingen konkurrenter tilføjet endnu.</p>}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Produkter / Services</label>
                <button
                  onClick={() => setStrategyForm(f => ({ ...f, offerings: [...f.offerings, { name: '', description: '', price_range: '' }] }))}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tilføj
                </button>
              </div>
              <div className="space-y-2">
                {(strategyForm.offerings || []).map((o, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input value={o.name || ''} onChange={e => { const arr = [...strategyForm.offerings]; arr[i] = { ...arr[i], name: e.target.value }; setStrategyForm(f => ({ ...f, offerings: arr })); }} placeholder="Navn" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none" />
                    <input value={o.description || ''} onChange={e => { const arr = [...strategyForm.offerings]; arr[i] = { ...arr[i], description: e.target.value }; setStrategyForm(f => ({ ...f, offerings: arr })); }} placeholder="Beskrivelse" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none" />
                    <div className="flex gap-1">
                      <input value={o.price_range || ''} onChange={e => { const arr = [...strategyForm.offerings]; arr[i] = { ...arr[i], price_range: e.target.value }; setStrategyForm(f => ({ ...f, offerings: arr })); }} placeholder="Pris" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none" />
                      <button onClick={() => setStrategyForm(f => ({ ...f, offerings: f.offerings.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {!strategyForm.offerings?.length && <p className="text-xs text-gray-400 italic">Ingen produkter tilføjet endnu.</p>}
              </div>
            </div>
          </div>
          <div className="col-span-2 flex justify-end">
            <button
              onClick={() => handleSave('strategy', strategyForm)}
              disabled={gtmSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {gtmSaving ? 'Gemmer...' : 'Gem Strategi'}
            </button>
          </div>
        </div>
      )}

      {/* ── ICP & TAM ── */}
      {gtmTab === 'icp' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Industrier</label>
              <p className="text-xs text-gray-400 mb-3">Tryk Enter for at tilføje en industri</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(icpForm.company_filters?.industries || []).map((ind, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {ind}
                    <button onClick={() => setIcpForm(f => ({ ...f, company_filters: { ...f.company_filters, industries: f.company_filters.industries.filter((_, j) => j !== i) } }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <input
                value={industryInput}
                onChange={e => setIndustryInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && industryInput.trim()) { setIcpForm(f => ({ ...f, company_filters: { ...f.company_filters, industries: [...(f.company_filters?.industries || []), industryInput.trim()] } })); setIndustryInput(''); e.preventDefault(); }}}
                placeholder="SaaS, Fintech, Logistik..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Virksomhedsstørrelse (antal ansatte)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Min</label>
                  <input type="number" value={icpForm.company_filters?.employee_min || ''} onChange={e => setIcpForm(f => ({ ...f, company_filters: { ...f.company_filters, employee_min: parseInt(e.target.value) || 0 } }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max</label>
                  <input type="number" value={icpForm.company_filters?.employee_max || ''} onChange={e => setIcpForm(f => ({ ...f, company_filters: { ...f.company_filters, employee_max: parseInt(e.target.value) || 5000 } }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Geografi</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(icpForm.company_filters?.geographies || []).map((g, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    {g}
                    <button onClick={() => setIcpForm(f => ({ ...f, company_filters: { ...f.company_filters, geographies: f.company_filters.geographies.filter((_, j) => j !== i) } }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <input
                value={geoInput}
                onChange={e => setGeoInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && geoInput.trim()) { setIcpForm(f => ({ ...f, company_filters: { ...f.company_filters, geographies: [...(f.company_filters?.geographies || []), geoInput.trim()] } })); setGeoInput(''); e.preventDefault(); }}}
                placeholder="Danmark, Sverige, DACH..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-1">TAM – Total Addressable Market</label>
              <p className="text-xs text-gray-400 mb-3">Hvor mange virksomheder matcher jeres ICP i alt (eksternt estimat)?</p>
              <input
                type="number"
                value={icpForm.tam_total || ''}
                onChange={e => setIcpForm(f => ({ ...f, tam_total: parseInt(e.target.value) || 0 }))}
                placeholder="F.eks. 1200"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                rows={2}
                value={icpForm.tam_notes || ''}
                onChange={e => setIcpForm(f => ({ ...f, tam_notes: e.target.value }))}
                placeholder="Kilde eller noter til TAM-estimatet..."
                className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none resize-none"
              />
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Buyer Personas</label>
                <button onClick={() => setIcpForm(f => ({ ...f, personas: [...(f.personas || []), { title: '', department: '', pain_points: '' }] }))} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus className="w-3 h-3" /> Tilføj</button>
              </div>
              <div className="space-y-3">
                {(icpForm.personas || []).map((p, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={p.title || ''} onChange={e => { const arr = [...icpForm.personas]; arr[i] = { ...arr[i], title: e.target.value }; setIcpForm(f => ({ ...f, personas: arr })); }} placeholder="Titel (f.eks. VP Sales)" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none" />
                      <input value={p.department || ''} onChange={e => { const arr = [...icpForm.personas]; arr[i] = { ...arr[i], department: e.target.value }; setIcpForm(f => ({ ...f, personas: arr })); }} placeholder="Afdeling" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none" />
                    </div>
                    <div className="flex gap-1">
                      <input value={p.pain_points || ''} onChange={e => { const arr = [...icpForm.personas]; arr[i] = { ...arr[i], pain_points: e.target.value }; setIcpForm(f => ({ ...f, personas: arr })); }} placeholder="Pain points" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none" />
                      <button onClick={() => setIcpForm(f => ({ ...f, personas: f.personas.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {!icpForm.personas?.length && <p className="text-xs text-gray-400 italic">Ingen personas tilføjet endnu.</p>}
              </div>
            </div>
          </div>
          <div className="col-span-2 flex justify-end">
            <button onClick={() => handleSave('icp', icpForm)} disabled={gtmSaving} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              <Save className="w-4 h-4" />{gtmSaving ? 'Gemmer...' : 'Gem ICP'}
            </button>
          </div>
        </div>
      )}

      {/* ── Goals / Activity Calculator ── */}
      {gtmTab === 'goals' && (() => {
        const g = goalsForm;
        const rev  = goalsInputMode === 'percent'
          ? Math.round((parseFloat(g.current_arr) || 0) * (parseFloat(growthPct) || 0) / 100)
          : parseFloat(g.revenue_target) || 0;
        const acv  = parseFloat(g.acv) || 0;
        const wr   = parseFloat(g.win_rate_pct) / 100 || 0.01;
        const mor  = parseFloat(g.opp_to_meeting_rate_pct) / 100 || 0.01;
        const rr   = parseFloat(g.outreach_response_rate_pct) / 100 || 0.01;
        const weeks    = g.period === 'quarterly' ? 13 : 52;
        const workdays = weeks * 5;

        const deals  = acv > 0 ? Math.ceil(rev / acv) : 0;
        const opps   = wr > 0 ? Math.ceil(deals / wr) : 0;
        const mtgs   = mor > 0 ? Math.ceil(opps / mor) : 0;
        const accts  = rr > 0 ? Math.ceil(mtgs / rr) : 0;
        const acctsPrDay = workdays > 0 ? (accts / workdays).toFixed(1) : 0;
        const mtgsPrDay  = workdays > 0 ? (mtgs / workdays).toFixed(1) : 0;

        const buPerDay = parseFloat(bottomUpPerDay) || 0;
        const buTotal  = buPerDay * workdays;
        const buMtgs   = Math.floor(buTotal * rr);
        const buOpps   = Math.floor(buMtgs * mor);
        const buDeals  = Math.floor(buOpps * wr);
        const buRev    = buDeals * acv;
        const buPct    = rev > 0 ? Math.round(buRev / rev * 100) : 0;
        const buGap    = Math.max(rev - buRev, 0);

        const fmtKr = (n) => n >= 1000000
          ? `${(n / 1000000).toFixed(1)}M kr`
          : n >= 1000 ? `${(n / 1000).toFixed(0)}k kr` : `${n} kr`;

        return (
          <div className="grid grid-cols-5 gap-6">
            {/* Left: Inputs */}
            <div className="col-span-2 bg-white p-6 rounded-lg border border-gray-200 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Konverteringsrater & mål</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-0.5">Periode</label>
                  <select value={g.period} onChange={e => setGoalsForm(f => ({ ...f, period: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none">
                    <option value="annual">Årlig (52 uger)</option>
                    <option value="quarterly">Kvartal (13 uger)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-0.5">Nuværende ARR</label>
                  <div className="flex items-center">
                    <input type="number" value={g.current_arr || ''} onChange={e => setGoalsForm(f => ({ ...f, current_arr: parseFloat(e.target.value) || 0 }))} placeholder="0" className="flex-1 text-sm border border-gray-300 rounded-l-lg px-3 py-2 focus:outline-none" />
                    <span className="px-2 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-xs text-gray-500">kr</span>
                  </div>
                </div>
              </div>

              {/* Revenue target: toggle absolute / % growth */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">Omsætningsmål (ny ARR)</label>
                  <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setGoalsInputMode('absolute')}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${goalsInputMode === 'absolute' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >Beløb</button>
                    <button
                      onClick={() => setGoalsInputMode('percent')}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${goalsInputMode === 'percent' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >% vækst</button>
                  </div>
                </div>

                {goalsInputMode === 'absolute' ? (
                  <>
                    <p className="text-xs text-gray-400 mb-1">Ny omsætning der skal genereres i perioden</p>
                    <div className="flex items-center">
                      <input type="number" value={g.revenue_target || ''} onChange={e => setGoalsForm(f => ({ ...f, revenue_target: parseFloat(e.target.value) || 0 }))} placeholder="5000000" className="flex-1 text-sm border border-gray-300 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-xs text-gray-500 font-medium">kr</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-1">Vækst ift. nuværende ARR ({fmtKr(parseFloat(g.current_arr) || 0)})</p>
                    <div className="flex gap-2 items-stretch">
                      <div className="flex items-center flex-1">
                        <input
                          type="number" value={growthPct || ''} min={0} max={999}
                          onChange={e => setGrowthPct(parseFloat(e.target.value) || 0)}
                          placeholder="40"
                          className="flex-1 text-base font-bold border-2 border-blue-300 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-700"
                        />
                        <span className="px-3 py-2.5 bg-blue-50 border-2 border-l-0 border-blue-300 rounded-r-lg text-sm text-blue-600 font-bold">%</span>
                      </div>
                      <div className="flex items-center flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">= nyt mål</div>
                          <div className="text-sm font-bold text-gray-800">{fmtKr(rev)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Other conversion rate inputs */}
              {[
                { key: 'acv',                       label: 'Gns. kontraktværdi (ACV)',              hint: 'Gennemsnitlig årlig kontraktværdi pr. ny kunde',                              placeholder: '250000', suffix: 'kr' },
                { key: 'win_rate_pct',               label: 'Opportunity → Deal (win rate)',         hint: '% af opportunities der lukkes som betalende kunde',                          placeholder: '25',     suffix: '%'  },
                { key: 'opp_to_meeting_rate_pct',    label: 'Møde → Opportunity (kvalificeringsrate)', hint: '% af møder der kvalificerer og åbnes som opportunity i CRM',             placeholder: '40',     suffix: '%'  },
                { key: 'outreach_response_rate_pct', label: 'Account kontaktet → Møde booket',       hint: '% af kontaktede accounts der siger ja til et møde',                         placeholder: '5',      suffix: '%'  },
              ].map(({ key, label, hint, placeholder, suffix }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-700 block mb-0.5">{label}</label>
                  <p className="text-xs text-gray-400 mb-1">{hint}</p>
                  <div className="flex items-center">
                    <input type="number" value={g[key] || ''} onChange={e => setGoalsForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} placeholder={placeholder} className="flex-1 text-sm border border-gray-300 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-xs text-gray-500 font-medium">{suffix}</span>
                  </div>
                </div>
              ))}

              <button onClick={() => {
                const payload = { ...goalsForm };
                if (goalsInputMode === 'percent') {
                  payload.revenue_target = rev;
                  payload.input_mode = 'percent';
                  payload.growth_pct = parseFloat(growthPct) || 0;
                } else {
                  payload.input_mode = 'absolute';
                  payload.growth_pct = 0;
                }
                handleSave('goals', payload);
              }} disabled={gtmSaving} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                <Save className="w-4 h-4" />{gtmSaving ? 'Gemmer...' : 'Gem Målsætninger'}
              </button>
            </div>

            {/* Right: Top-down + Bottom-up */}
            <div className="col-span-3 space-y-4">

              {/* Top-down waterfall */}
              <div className="bg-white p-5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">⬇ Top-down – hvad kræver det?</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Fra mål → daglig aktivitet</span>
                </div>
                {deals > 0 ? (
                  <>
                    <div className="space-y-1.5">
                      {[
                        { step: '🎯', label: 'Omsætningsmål',                                       value: fmtKr(rev),           sub: `${g.period === 'quarterly' ? 'kvartal' : 'år'}`,   color: 'bg-slate-700 text-white' },
                        { step: '÷', label: `ACV ${fmtKr(acv)} pr. kunde`,                          value: `${deals} nye kunder`,  sub: 'skal lukkes',                                   color: 'bg-blue-600 text-white',  arrow: true },
                        { step: '÷', label: `Win rate ${g.win_rate_pct}%  (opportunity → deal)`,    value: `${opps} opportunities`, sub: 'skal oprettes i CRM',                           color: 'bg-indigo-500 text-white', arrow: true },
                        { step: '÷', label: `Kvalificeringsrate ${g.opp_to_meeting_rate_pct}%  (møde → opportunity)`, value: `${mtgs} møder`, sub: 'skal holdes',              color: 'bg-violet-500 text-white', arrow: true },
                        { step: '÷', label: `Møde-rate ${g.outreach_response_rate_pct}%  (kontakt → møde)`, value: `${accts} accounts`, sub: 'skal kontaktes i alt',           color: 'bg-orange-500 text-white', arrow: true },
                      ].map(({ step, label, value, sub, color, arrow }, idx) => (
                        <div key={idx}>
                          {arrow && <div className="flex items-center gap-2 my-1 pl-3"><div className="w-px h-3 bg-gray-300 ml-2" /><span className="text-xs text-gray-400">{step} {label}</span></div>}
                          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${color}`}>
                            {!arrow && <span className="text-xs opacity-75">{label}</span>}
                            {arrow && <span className="text-xs opacity-0">_</span>}
                            <div className="text-right">
                              <div className="font-bold text-base">{value}</div>
                              <div className="text-xs opacity-70">{sub}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-600">{acctsPrDay}</div>
                        <div className="text-xs text-orange-700 font-medium">accounts/dag</div>
                        <div className="text-xs text-orange-500">du skal kontakte</div>
                      </div>
                      <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-violet-600">{mtgsPrDay}</div>
                        <div className="text-xs text-violet-700 font-medium">møder/dag</div>
                        <div className="text-xs text-violet-500">du skal holde</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{(opps / weeks).toFixed(1)}</div>
                        <div className="text-xs text-blue-700 font-medium">opps/uge</div>
                        <div className="text-xs text-blue-500">der skal åbnes</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Udfyld omsætningsmål og ACV for at se formlen</p>
                  </div>
                )}
              </div>

              {/* Bottom-up calculator */}
              <div className="bg-white p-5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">⬆ Bottom-up – hvad kan I nå?</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Fra kapacitet → forventet omsætning</span>
                </div>
                <div className="flex items-end gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 block mb-0.5">Accounts aktiveret per dag</label>
                    <p className="text-xs text-gray-400 mb-1">Hvor mange nye accounts kan jeres team realistisk kontakte dagligt?</p>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={bottomUpPerDay}
                        onChange={e => setBottomUpPerDay(parseFloat(e.target.value) || 0)}
                        min={1} max={500}
                        className="flex-1 text-lg font-bold border-2 border-blue-300 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-700"
                      />
                      <span className="px-3 py-2.5 bg-blue-50 border-2 border-l-0 border-blue-300 rounded-r-lg text-sm text-blue-600 font-medium">acc/dag</span>
                    </div>
                  </div>
                  {acv > 0 && buPerDay > 0 && (
                    <div className={`px-4 py-2.5 rounded-lg text-center border-2 ${buPct >= 100 ? 'bg-green-50 border-green-400' : buPct >= 70 ? 'bg-amber-50 border-amber-400' : 'bg-red-50 border-red-300'}`}>
                      <div className={`text-3xl font-black ${buPct >= 100 ? 'text-green-600' : buPct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>{buPct}%</div>
                      <div className="text-xs text-gray-500">af mål</div>
                    </div>
                  )}
                </div>

                {acv > 0 && buPerDay > 0 ? (
                  <>
                    <div className="space-y-1.5">
                      {[
                        { emoji: '📞', label: `${buPerDay} accounts/dag × ${workdays} arbejdsdage`, value: `${buTotal.toLocaleString()} accounts kontaktet`, color: 'bg-gray-100 text-gray-800' },
                        { emoji: '📅', label: `× møde-rate ${g.outreach_response_rate_pct}%`,        value: `${buMtgs.toLocaleString()} møder holdt`,          color: 'bg-orange-50 text-orange-800', border: 'border border-orange-200' },
                        { emoji: '📋', label: `× kvalificeringsrate ${g.opp_to_meeting_rate_pct}%`,  value: `${buOpps.toLocaleString()} opportunities åbnet`,  color: 'bg-violet-50 text-violet-800', border: 'border border-violet-200' },
                        { emoji: '🏆', label: `× win rate ${g.win_rate_pct}%`,                        value: `${buDeals.toLocaleString()} nye kunder`,          color: 'bg-blue-50 text-blue-800',    border: 'border border-blue-200'   },
                        { emoji: '💰', label: `× ACV ${fmtKr(acv)}`,                                 value: fmtKr(buRev),                                       color: buPct >= 100 ? 'bg-green-100 text-green-900' : 'bg-amber-50 text-amber-900', border: buPct >= 100 ? 'border border-green-300' : 'border border-amber-300' },
                      ].map(({ emoji, label, value, color, border = '' }, idx, arr) => (
                        <div key={idx}>
                          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${color} ${border}`}>
                            <span className="text-xs">{emoji} {label}</span>
                            <span className="text-sm font-bold">{value}</span>
                          </div>
                          {idx < arr.length - 1 && <div className="text-center text-gray-300 text-xs">↓</div>}
                        </div>
                      ))}
                    </div>
                    {buGap > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs font-semibold text-red-700">
                          ⚠ Gap: du mangler {fmtKr(buGap)} for at nå målet
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">
                          Løsninger: øg til {Math.ceil(accts / workdays * (rev / Math.max(buRev, 1))).toFixed(0)} accounts/dag · eller forbedr win rate · eller hæv ACV
                        </p>
                      </div>
                    )}
                    {buPct >= 100 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-semibold text-green-700">✓ Med {buPerDay} accounts/dag når du dit omsætningsmål!</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <p className="text-sm">Udfyld konverteringsraterne til venstre og angiv accounts/dag for at se projekteringen</p>
                  </div>
                )}
              </div>

              {/* CRM Progress panel */}
              <div className="bg-white p-5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">📊 CRM Fremdrift – er vi på sporet?</h3>
                  {progressData && progressData.revenue?.target > 0 && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${progressData.revenue.on_track ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {progressData.revenue.on_track ? '✓ På sporet' : '⚠ Bagud'}
                    </span>
                  )}
                </div>

                {progressLoading ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Henter CRM data...</div>
                ) : progressData && progressData.revenue?.target > 0 ? (() => {
                  const pr = progressData;
                  const fmtK = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Tid brugt: <strong>{pr.elapsed_pct}%</strong> af {pr.period === 'quarterly' ? 'kvartalet' : 'året'}</span>
                          <span><strong>{pr.weeks_remaining}</strong> uger tilbage</span>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                          <div className="h-full bg-gray-200 rounded-full absolute inset-0" style={{ width: `${pr.elapsed_pct}%` }} />
                          <div className={`h-full rounded-full absolute inset-0 transition-all ${pr.revenue.on_track ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(pr.revenue.achieved_pct, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className={`font-semibold ${pr.revenue.on_track ? 'text-green-600' : 'text-amber-600'}`}>{pr.revenue.achieved_pct}% af mål nået</span>
                          <span className="text-gray-400">{pr.elapsed_pct}% forventet nu</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                          { label: 'Deals lukket',       display: String(pr.deals.won),          sub: `/ ${pr.deals.needed_total} mål`,        ok: pr.deals.on_track },
                          { label: 'Omsætning vundet',   display: `${fmtK(pr.revenue.won)}kr`,   sub: `/ ${fmtK(pr.revenue.target)}kr mål`,    ok: pr.revenue.on_track },
                          { label: 'Pipeline (vægtet)',  display: `${fmtK(pr.pipeline.weighted_value)}kr`, sub: `dækker ${pr.pipeline.covers_gap_pct}%`, ok: pr.pipeline.covers_gap_pct >= 100 },
                        ].map(({ label, display, sub, ok }) => (
                          <div key={label} className={`p-3 rounded-lg border text-center ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="text-xs text-gray-500 mb-1">{label}</div>
                            <div className={`text-base font-bold leading-tight ${ok ? 'text-green-700' : 'text-red-600'}`}>{display}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                          </div>
                        ))}
                      </div>

                      {pr.deals.remaining > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                          <p className="text-xs font-semibold text-amber-800 mb-2">Hvad mangler du de næste {pr.weeks_remaining} uger?</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white rounded-lg p-2 border border-amber-100">
                              <div className="text-lg font-black text-amber-700">{pr.deals.remaining}</div>
                              <div className="text-xs text-amber-600">deals ({pr.deals.weekly_needed}/uge)</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-amber-100">
                              <div className="text-lg font-black text-amber-700">{pr.activity_remaining.meetings_needed}</div>
                              <div className="text-xs text-amber-600">møder</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-amber-100">
                              <div className="text-lg font-black text-amber-700">{pr.activity_remaining.accounts_needed}</div>
                              <div className="text-xs text-amber-600">accounts ({pr.activity_remaining.weekly_accounts}/uge)</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {pr.alerts.length > 0 && (
                        <div className="space-y-1.5">
                          {pr.alerts.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <span className="text-gray-400 text-xs mt-0.5">•</span>
                              <p className="text-xs text-gray-600">{a}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {pr.deals.remaining === 0 && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-semibold text-green-700">✓ Du har nået dit omsætningsmål for perioden!</p>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm font-medium mb-1">Gem dine målsætninger</p>
                    <p className="text-xs">Forbind dit CRM (HubSpot/Salesforce) for at se fremdriften automatisk</p>
                    <button onClick={fetchGtmProgress} className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline">Genindlæs</button>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Integrations ── */}
      {gtmTab === 'integrations' && (() => {
        const INTEGRATION_DEFS = [
          { id: 'salesforce', name: 'Salesforce', icon: '☁️', desc: 'CRM deals, accounts, contacts', color: 'bg-blue-50 border-blue-200' },
          { id: 'hubspot',    name: 'HubSpot',    icon: '🟠', desc: 'Deals, companies, contacts',    color: 'bg-orange-50 border-orange-200' },
          { id: 'clay',       name: 'Clay',       icon: '🧱', desc: 'Lead enrichment & signals',     color: 'bg-purple-50 border-purple-200' },
          { id: 'snitcher',   name: 'Snitcher',   icon: '👁️', desc: 'Website visitor intent',        color: 'bg-green-50 border-green-200' },
          { id: 'notion',     name: 'Notion',     icon: '📓', desc: 'Project & initiative tracking', color: 'bg-gray-50 border-gray-200' },
        ];
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">Forbind din GTM tech-stack. Data fra disse integrationer bruges i alle analyser.</p>
            <div className="grid grid-cols-3 gap-4">
              {INTEGRATION_DEFS.map(def => {
                const conn = connections.find(c => c.service === def.id);
                return (
                  <div key={def.id} className={`p-5 rounded-lg border-2 ${def.color}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{def.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{def.name}</div>
                          <div className="text-xs text-gray-500">{def.desc}</div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conn?.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {conn?.status === 'connected' ? '● Forbundet' : '○ Ikke forbundet'}
                      </span>
                    </div>
                    {conn?.status === 'connected' ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleSync(def.id, conn.id)} disabled={syncingId === conn.id} className="flex-1 text-xs py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                          {syncingId === conn.id ? 'Synkroniserer...' : '↻ Sync'}
                        </button>
                        <button onClick={() => handleDisconnect(conn.id)} className="text-xs py-1.5 px-3 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                          Fjern
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onOpenConnectModal?.(def.id)}
                        className="w-full text-xs py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Forbind
                      </button>
                    )}
                    {syncResult[conn?.id]?.msg && (
                      <p className={`text-xs mt-2 ${syncResult[conn.id].ok ? 'text-green-600' : 'text-red-600'}`}>{syncResult[conn.id].msg}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
