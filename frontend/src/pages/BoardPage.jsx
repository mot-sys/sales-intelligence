/**
 * BoardPage  (P2.4 — Board summary + PDF export)
 *
 * Monthly board-level snapshot:
 *   - KPI tiles (revenue, pipeline, win rate, TAM coverage)
 *   - Key wins / losses this month
 *   - Forecast next 3 months
 *   - Rep leaderboard
 *   - "Download PDF" button → GET /api/board/summary.pdf
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Award, TrendingUp, Target, Users, Download,
  RefreshCw, CheckCircle, XCircle, BarChart3,
} from 'lucide-react';
import { get } from '../api/client';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(v, decimals = 0) {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString('da-DK', { maximumFractionDigits: decimals });
}

function pctBar(value, target, colorClass = 'bg-blue-500') {
  const pct = target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── KPI tile ───────────────────────────────────────────────────────────────
function KpiTile({ icon: Icon, label, main, sub, progress, progressTarget, progressColor }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{main}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          {progress != null && progressTarget != null &&
            pctBar(progress, progressTarget, progressColor || 'bg-blue-500')
          }
        </div>
        <div className="ml-3 p-2 bg-blue-50 rounded-lg flex-shrink-0">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function BoardPage() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [dlLoading, setDlLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await get('/board/summary');
      setData(d);
    } catch (e) {
      setError(e.message || 'Kunne ikke hente board summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleDownloadPdf = async () => {
    setDlLoading(true);
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';
      const res = await fetch('/api/board/summary.pdf', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `board-summary-${data?.period?.month_key || 'current'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'PDF download fejlede');
    } finally {
      setDlLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Genererer board summary…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        ⚠️ {error}
      </div>
    );
  }

  if (!data) return null;

  const { period, kpis, wins, losses, forecast, leaderboard } = data;

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Board Summary — {period.month}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Månedligt overblik til bestyrelse og ledelse.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Opdater
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={dlLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {dlLoading ? 'Genererer PDF…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          icon={TrendingUp}
          label="YTD Revenue"
          main={fmt(kpis.ytd_revenue)}
          sub={kpis.target_pct != null ? `${kpis.target_pct}% af årmål` : 'Ingen mål sat'}
          progress={kpis.ytd_revenue}
          progressTarget={kpis.revenue_target}
          progressColor={kpis.target_pct >= 80 ? 'bg-green-500' : 'bg-blue-500'}
        />
        <KpiTile
          icon={Target}
          label="Open Pipeline"
          main={fmt(kpis.pipeline_value)}
          sub={kpis.pipeline_coverage != null ? `${kpis.pipeline_coverage}× coverage` : '—'}
          progress={kpis.pipeline_value}
          progressTarget={kpis.revenue_target * 3}
          progressColor="bg-indigo-500"
        />
        <KpiTile
          icon={CheckCircle}
          label="Win Rate (YTD)"
          main={`${kpis.win_rate_pct}%`}
          sub={`Mål: ${kpis.win_rate_target}%`}
          progress={kpis.win_rate_pct}
          progressTarget={kpis.win_rate_target}
          progressColor={kpis.win_rate_pct >= kpis.win_rate_target ? 'bg-green-500' : 'bg-orange-400'}
        />
        <KpiTile
          icon={Users}
          label="ICP Accounts i CRM"
          main={String(kpis.icp_accounts_in_crm)}
          sub={kpis.tam_coverage_pct != null
            ? `${kpis.tam_coverage_pct}% TAM coverage`
            : `af ${kpis.total_icp_accounts} kendte`}
        />
      </div>

      {/* ── Wins + Losses ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Wins */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <h3 className="font-semibold text-gray-900 text-sm">
              Vinder denne måned ({wins.length})
            </h3>
          </div>
          {wins.length === 0 ? (
            <p className="px-6 py-5 text-sm text-gray-400">Ingen lukkede deals endnu.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {wins.map((w, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.account || '—'}</p>
                    <p className="text-xs text-gray-400">{w.owner || '—'}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{fmt(w.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Losses */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-gray-900 text-sm">
              Tabte deals denne måned ({losses.length})
            </h3>
          </div>
          {losses.length === 0 ? (
            <p className="px-6 py-5 text-sm text-gray-400">Ingen tabte deals denne måned. 🎉</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {losses.map((l, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{l.account || '—'}</p>
                    <p className="text-xs text-gray-400">{l.owner || '—'}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-500">{fmt(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Forecast ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Forecast — næste 3 måneder</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {forecast.map(m => (
              <div key={m.month} className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400 font-medium mb-1">{m.label}</p>
                <p className="text-xl font-bold text-gray-900">{fmt(m.base)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.deal_count} deals</p>
                <p className="text-xs text-gray-300 mt-0.5">base scenario</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Leaderboard ───────────────────────────────────────────────── */}
      {leaderboard.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Rep Leaderboard — vundet denne måned</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {leaderboard.map((r, i) => (
              <div key={r.rep} className="px-6 py-3 flex items-center gap-4">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-100 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
                }`}>{i + 1}</span>
                <p className="flex-1 text-sm font-medium text-gray-900">{r.rep}</p>
                <span className="text-sm font-semibold text-green-600">{fmt(r.won_revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
