/**
 * ReportPage — Weekly AI Sales Report
 * Store state: weeklyReport, weeklyReportLoading, weeklyReportGenerating,
 *              weeklyReportError, fetchWeeklyReport, generateWeeklyReport
 */
import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, FileText, Activity, Target, Award, Mail } from 'lucide-react';
import useDataStore from '../store/dataStore';
import { post } from '../api/client';

// Simple markdown line renderer
function renderMd(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="font-semibold text-gray-900 mt-4 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith('## '))  return <h2 key={i} className="font-bold text-gray-900 mt-5 mb-2 text-base">{line.slice(3)}</h2>;
    if (line.startsWith('- [ ] ')) return (
      <div key={i} className="flex items-start gap-2 my-1">
        <input type="checkbox" className="mt-1 accent-blue-600" readOnly />
        <span className="text-sm text-gray-700">{line.slice(6)}</span>
      </div>
    );
    if (line.startsWith('- '))    return <li key={i} className="ml-4 text-sm text-gray-700 my-0.5 list-disc">{line.slice(2)}</li>;
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-900 mt-2">{line.slice(2, -2)}</p>;
    if (line.trim() === '')        return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm text-gray-700 my-0.5">{line}</p>;
  });
}

export default function ReportPage() {
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult,  setEmailResult]  = useState(null); // { ok: bool, msg: string }

  const {
    weeklyReport,
    weeklyReportLoading,
    weeklyReportGenerating,
    weeklyReportError,
    fetchWeeklyReport,
    generateWeeklyReport,
  } = useDataStore();

  useEffect(() => { fetchWeeklyReport(); }, [fetchWeeklyReport]);

  const handleSendEmail = async () => {
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await post('/reports/weekly/send', {});
      setEmailResult({ ok: true, msg: `Sent til ${res.recipient}` });
    } catch (e) {
      setEmailResult({ ok: false, msg: e?.message || 'Email fejlede' });
    } finally {
      setEmailSending(false);
    }
  };

  const report    = weeklyReport;
  const hasReport = report && (report.section_what_happened || report.section_this_week || report.section_management);

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Ugentlig Salgsrapport
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {hasReport
                ? `Uge startende ${report.week_start} · Genereret ${new Date(report.generated_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${report.model_used || 'AI'}`
                : 'Klik "Generer rapport" for at lave denne uges analyse'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
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
            {hasReport && (
              <button
                onClick={handleSendEmail}
                disabled={emailSending}
                title="Send rapporten til din email via Resend (kræver RESEND_API_KEY)"
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Mail className={`w-4 h-4 ${emailSending ? 'animate-pulse' : ''}`} />
                {emailSending ? 'Sender…' : 'Send email'}
              </button>
            )}
            <button
              onClick={generateWeeklyReport}
              disabled={weeklyReportGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${weeklyReportGenerating ? 'animate-spin' : ''}`} />
              {weeklyReportGenerating ? 'Genererer…' : hasReport ? 'Regenerer' : 'Generer rapport'}
            </button>
          </div>
        </div>

        {weeklyReportError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {weeklyReportError}
          </div>
        )}

        {emailResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            emailResult.ok
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {emailResult.ok ? '✅' : '⚠️'} {emailResult.msg}
          </div>
        )}

        {weeklyReportGenerating && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-700">
              Claude analyserer pipeline, alerts og HubSpot-opgaver…
            </span>
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!hasReport && !weeklyReportLoading && !weeklyReportGenerating && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Ingen rapport endnu</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            Klik "Generer rapport" ovenfor — AI analyserer din pipeline og skriver rapporten.
          </p>
          <p className="text-xs text-gray-400">Rapporten opdateres automatisk mandag morgen kl. 8 (via Railway cron).</p>
        </div>
      )}

      {/* ── Report sections ─────────────────────────────────────────────────── */}
      {hasReport && !weeklyReportGenerating && (
        <div className="grid grid-cols-1 gap-5">

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">📅 Hvad skete der denne uge</h3>
            </div>
            <div className="prose-sm text-gray-700 space-y-0.5">
              {renderMd(report.section_what_happened)}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">🏯 Hvad skal der ske denne uge</h3>
            </div>
            <div className="prose-sm text-gray-700 space-y-0.5">
              {renderMd(report.section_this_week)}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">🤝 Hvad kan sales management gøre</h3>
            </div>
            <div className="prose-sm text-gray-700 space-y-0.5">
              {renderMd(report.section_management)}
            </div>
          </div>

          {report.data_snapshot && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data grundlag</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Deals i pipeline',  value: report.data_snapshot.pipeline?.total_deals ?? '—' },
                  { label: 'Aktive deals (uge)', value: report.data_snapshot.pipeline?.recently_active_deals ?? '—' },
                  { label: 'Alerts trigget',     value: report.data_snapshot.alerts?.total ?? '—' },
                  { label: 'HubSpot-opgaver',    value: report.data_snapshot.tasks?.total ?? (report.data_snapshot.tasks?.available === false ? 'N/A' : '—') },
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
}
