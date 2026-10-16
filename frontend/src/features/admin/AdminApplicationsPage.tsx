import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backend, BackendError } from '../../services/backend';
import { toRequest, type BackendApplication } from '../../services/api';
import { PageTitle } from '../cabinet/CabinetShell';
import { ApplicationHistory } from '../shared/ApplicationHistory';
import { RequestBadge, EmptyState, StatCard } from '../../components/ui/Bits';
import { ConfirmDialog } from '../../components/ui/Overlay';
import { useFormat } from '../../app/i18n';
import { useSearchParams } from 'react-router-dom';
import { AdminProposalAnalysisResult, type ProposalAnalysis } from './AdminProposalAnalysisResult';

export default function AdminApplicationsPage() {
  const { t } = useTranslation(); const f = useFormat();
  const [params, setParams] = useSearchParams(); const query = params.toString();
  const [rows, setRows] = useState<BackendApplication[]>([]); const [loading, setLoading] = useState(true);
  const status = params.get('status') ?? 'all'; const [search, setSearch] = useState('');
  const [error, setError] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ row: BackendApplication; kind: string } | null>(null);
  const [report, setReport] = useState<{ totalApplications: number; activeCompetitions: number; totalProposedInvestment: number;
    competitions: { id: string; title: string }[] } | null>(null);
  const [analysis, setAnalysis] = useState<ProposalAnalysis | null>(null);
  const [analysisLandId, setAnalysisLandId] = useState('');
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const showError = (x: unknown) => setError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server'));
  async function load() {
    const analyticsFilters = new URLSearchParams();
    for (const key of ['from', 'to', 'region', 'activity', 'competitionId']) { const value = params.get(key); if (value) analyticsFilters.set(key, value); }
    const [applications, analytics] = await Promise.all([backend<BackendApplication[]>('GET', `/admin/proposals${query ? `?${query}` : ''}`), backend<NonNullable<typeof report>>('GET', `/admin/analytics?${analyticsFilters}`)]);
    setRows(applications); setReport({ activeCompetitions: analytics.activeCompetitions, competitions: analytics.competitions,
      totalApplications: applications.length, totalProposedInvestment: applications.reduce((sum, row) => sum + row.proposedInvestmentAmount, 0) });
  }
  useEffect(() => { setLoading(true); void load().catch(showError).finally(() => setLoading(false)); }, [query]);
  const filtered = rows.filter(r => (status === 'all' || r.status === status) && (r.referenceNumber + ' ' + r.applicantName).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  async function confirm() {
    if (!action || busy) return;
    if (['REJECTED','INFORMATION_REQUESTED'].includes(action.kind) && !note.trim()) { setError(t('competition.commentRequired')); return; }
    setBusy(true);
    const { row, kind } = action;
    try {
      if (kind === 'SELECTED') await backend('POST', '/opportunities/' + row.opportunityId + '/select-winner', { proposalId: row.id });
      else if (kind === 'REJECTED') await backend('POST', '/admin/proposals/' + row.id + '/reject', { reason: note });
      else await backend('POST', '/admin/proposals/' + row.id + '/review', { status: kind, comment: note });
      await load(); setAction(null); setNote(''); setError('');
    } catch(x) { showError(x); } finally { setBusy(false); }
  }
  async function analyze(landId: string) {
    setAnalysisLandId(landId); setAnalysis(null); setAnalysisBusy(true); setError('');
    try { setAnalysis(await backend<ProposalAnalysis>('GET', `/admin/lands/${encodeURIComponent(landId)}/proposal-analysis`)); }
    catch (x) { showError(x); } finally { setAnalysisBusy(false); }
  }
  return <>
    <PageTitle title={t('competition.applications')} actions={<button className="btn btn-outline" onClick={async () => { try { const result = await backend<{ message: string }>('POST', '/admin/integrations/ektis/sync'); window.alert(result.message); } catch(x) { showError(x); } }}>EKTİS · {t('competition.simulation')}</button>} />
    {report && <div className="grid sm:grid-cols-3 gap-4 mb-6"><StatCard icon={null} label={t('competition.applications')} value={String(report.totalApplications)} /><StatCard icon={null} label={t('competition.competitions')} value={String(report.activeCompetitions)} /><StatCard icon={null} label={t('competition.proposedInvestment')} value={f.azn(report.totalProposedInvestment)} /></div>}
    {error && <p role="alert" className="text-danger mb-4">{error}</p>}
    <div className="flex flex-wrap gap-3 mb-6"><input className="field flex-1" aria-label={t('form.search')} placeholder={t('form.search')} value={search} onChange={e => setSearch(e.target.value)} /><select className="field !w-auto" aria-label={t('competition.review')} value={status} onChange={e => { const next = new URLSearchParams(params); if (e.target.value === 'all') next.delete('status'); else next.set('status', e.target.value); setParams(next); }}><option value="all">{t('competition.all')}</option>{['OPEN','UNDER_REVIEW','INFORMATION_REQUESTED','SELECTED','NOT_SELECTED','REJECTED','CANCELLED'].map(s => <option key={s} value={s}>{t('competition.status.'+s)}</option>)}</select></div>
    {query && <div className="flex flex-wrap gap-2 mb-4 text-sm text-muted" aria-label={t('admin.panel.filters')}>{[...params].map(([key, value]) => <span key={key} className="rounded-full bg-sand px-3 py-1">{t(key === 'status' ? 'competition.review' : key === 'month' ? 'admin.panel.byMonth' : `admin.panel.${key === 'competitionId' ? 'competition' : key}`, { defaultValue: key })}: {key === 'region' ? t(`regions.${value}`, { defaultValue: value }) : key === 'activity' ? t(`fieldTypes.${value}`, { defaultValue: value }) : key === 'status' ? t(`competition.status.${value}`, { defaultValue: value }) : key === 'competitionId' ? report?.competitions.find(c => c.id === value)?.title ?? value : value}</span>)}<button type="button" className="btn btn-outline btn-sm" onClick={() => setParams(new URLSearchParams())}>{t('form.reset', { defaultValue: 'Clear filters' })}</button></div>}
    {analysisBusy && <div className="skeleton h-40 mb-5" aria-label={t('form.loading')} />}
    {analysis && <AdminProposalAnalysisResult analysis={analysis} />}
    {loading ? <div className="skeleton h-40" /> : !filtered.length ? <EmptyState title={t('investor.inv.empty')} /> : <ul className="grid gap-4">{filtered.map(row => {
      const r = toRequest(row); const pending = ['OPEN','UNDER_REVIEW','INFORMATION_REQUESTED'].includes(row.status);
      return <li key={row.id} className="card p-5"><div className="flex justify-between gap-3"><div><h2 className="font-display text-xl text-brand">{row.applicantName || row.referenceNumber}</h2><p>{row.taxNumber} · {f.azn(row.proposedInvestmentAmount)}</p></div><RequestBadge status={r.status} /></div><p className="mt-3 whitespace-pre-wrap">{row.businessPlanSummary}</p>
        {(row.projectCosts != null || row.fundingGap != null || row.additionalFinancingRequested != null || row.expectedAnnualRevenue != null || row.expectedProduction) && <dl className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
          {row.projectCosts != null && <div><dt className="text-muted">{t('admin.panel.analysis.projectCosts')}</dt><dd className="font-semibold">{f.azn(row.projectCosts)}</dd></div>}
          {row.fundingGap != null && <div><dt className="text-muted">{t('admin.panel.analysis.fundingGap')}</dt><dd className="font-semibold">{f.azn(row.fundingGap)}</dd></div>}
          {row.additionalFinancingRequested != null && <div><dt className="text-muted">{t('admin.panel.analysis.additionalFinance')}</dt><dd className="font-semibold">{f.azn(row.additionalFinancingRequested)}</dd></div>}
          {row.expectedAnnualRevenue != null && <div><dt className="text-muted">{t('admin.panel.analysis.expectedRevenue')}</dt><dd className="font-semibold">{f.azn(row.expectedAnnualRevenue)}</dd></div>}
          {row.expectedProduction && <div className="sm:col-span-2"><dt className="text-muted">{t('investor.detail.expectedProduction')}</dt><dd className="font-semibold whitespace-pre-wrap">{row.expectedProduction}</dd></div>}
        </dl>}
        <ApplicationHistory application={r} />
        {row.land?.id && <button type="button" className="btn btn-outline btn-sm mt-4" disabled={analysisBusy && analysisLandId === row.land.id} onClick={() => void analyze(row.land!.id)}>{t('admin.panel.analysis.button')}</button>}
        {pending && <div className="flex flex-wrap gap-2 mt-4">{['UNDER_REVIEW','INFORMATION_REQUESTED','SELECTED','REJECTED'].filter(s => s !== row.status).map(kind => <button key={kind} className="btn btn-outline btn-sm" onClick={() => { setAction({ row, kind }); setNote(''); }}>{t('competition.status.'+kind)}</button>)}</div>}
      </li>;
    })}</ul>}
    {action && <ConfirmDialog open busy={busy} onClose={() => setAction(null)} title={t('competition.status.'+action.kind)} text={action.row.referenceNumber} confirmLabel={t('competition.confirm')} onConfirm={confirm}>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <label className="field-label">{t('competition.comment')}<textarea className="field" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></label>
    </ConfirmDialog>}
  </>;
}
