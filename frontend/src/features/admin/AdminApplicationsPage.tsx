import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backend, BackendError } from '../../services/backend';
import { toRequest, type BackendApplication } from '../../services/api';
import { PageTitle } from '../cabinet/CabinetShell';
import { ApplicationHistory } from '../shared/ApplicationHistory';
import { RequestBadge, EmptyState, StatCard } from '../../components/ui/Bits';
import { ConfirmDialog } from '../../components/ui/Overlay';
import { useFormat } from '../../app/i18n';

export default function AdminApplicationsPage() {
  const { t } = useTranslation(); const f = useFormat();
  const [rows, setRows] = useState<BackendApplication[]>([]); const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all'); const [search, setSearch] = useState('');
  const [error, setError] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ row: BackendApplication; kind: string } | null>(null);
  const [report, setReport] = useState<{ totalApplications: number; activeCompetitions: number; totalProposedInvestment: number } | null>(null);
  const showError = (x: unknown) => setError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server'));
  async function load() {
    const [applications, analytics] = await Promise.all([backend<BackendApplication[]>('GET', '/admin/proposals'), backend<NonNullable<typeof report>>('GET', '/admin/analytics')]);
    setRows(applications); setReport(analytics);
  }
  useEffect(() => { void load().catch(showError).finally(() => setLoading(false)); }, []);
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
  return <>
    <PageTitle title={t('competition.applications')} actions={<button className="btn btn-outline" onClick={async () => { try { const result = await backend<{ message: string }>('POST', '/admin/integrations/ektis/sync'); window.alert(result.message); } catch(x) { showError(x); } }}>EKTİS · {t('competition.simulation')}</button>} />
    {report && <div className="grid sm:grid-cols-3 gap-4 mb-6"><StatCard icon={null} label={t('competition.applications')} value={String(report.totalApplications)} /><StatCard icon={null} label={t('competition.competitions')} value={String(report.activeCompetitions)} /><StatCard icon={null} label={t('competition.proposedInvestment')} value={f.azn(report.totalProposedInvestment)} /></div>}
    {error && <p role="alert" className="text-danger mb-4">{error}</p>}
    <div className="flex flex-wrap gap-3 mb-6"><input className="field flex-1" aria-label={t('form.search')} placeholder={t('form.search')} value={search} onChange={e => setSearch(e.target.value)} /><select className="field !w-auto" aria-label={t('competition.review')} value={status} onChange={e => setStatus(e.target.value)}><option value="all">{t('competition.all')}</option>{['OPEN','UNDER_REVIEW','INFORMATION_REQUESTED','SELECTED','NOT_SELECTED','REJECTED','CANCELLED'].map(s => <option key={s} value={s}>{t('competition.status.'+s)}</option>)}</select></div>
    {loading ? <div className="skeleton h-40" /> : !filtered.length ? <EmptyState title={t('investor.inv.empty')} /> : <ul className="grid gap-4">{filtered.map(row => {
      const r = toRequest(row); const pending = ['OPEN','UNDER_REVIEW','INFORMATION_REQUESTED'].includes(row.status);
      return <li key={row.id} className="card p-5"><div className="flex justify-between gap-3"><div><h2 className="font-display text-xl text-brand">{row.applicantName || row.referenceNumber}</h2><p>{row.taxNumber} · {f.azn(row.proposedInvestmentAmount)}</p></div><RequestBadge status={r.status} /></div><p className="mt-3 whitespace-pre-wrap">{row.businessPlanSummary}</p><ApplicationHistory application={r} />
        {pending && <div className="flex flex-wrap gap-2 mt-4">{['UNDER_REVIEW','INFORMATION_REQUESTED','SELECTED','REJECTED'].filter(s => s !== row.status).map(kind => <button key={kind} className="btn btn-outline btn-sm" onClick={() => { setAction({ row, kind }); setNote(''); }}>{t('competition.status.'+kind)}</button>)}</div>}
      </li>;
    })}</ul>}
    {action && <ConfirmDialog open busy={busy} onClose={() => setAction(null)} title={t('competition.status.'+action.kind)} text={action.row.referenceNumber} confirmLabel={t('competition.confirm')} onConfirm={confirm}>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <label className="field-label">{t('competition.comment')}<textarea className="field" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></label>
    </ConfirmDialog>}
  </>;
}
