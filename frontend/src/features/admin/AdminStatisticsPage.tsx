import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { backend, BackendError } from '../../services/backend';
import { useFormat, useLocalePath } from '../../app/i18n';
import { INVESTMENT_REGIONS } from '../../data/regions';
import { CATEGORIES } from '../../data/categories';
import { StatCard } from '../../components/ui/Bits';
import { PageTitle } from '../cabinet/CabinetShell';
import { adminLands, type AdminLandListItem } from '../../services/adminLands';
import { AdminProposalAnalysisResult, type ProposalAnalysis } from './AdminProposalAnalysisResult';

interface Analytics {
  publishedLands: number; activeCompetitions: number; totalApplications: number; totalProposedInvestment: number;
  applicationsByRegion: { region: string; count: number; investment: number }[];
  applicationsBySector: { sector: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  timeline: { month: string; applications: number }[];
  landPipeline?: { draft: number; published: number; archived: number };
  competitions?: { id: string; title: string }[];
}

type Datum = { key: string; name: string; value: number };
const filterKeys = ['from', 'to', 'region', 'activity', 'competitionId'] as const;

export function AdminStatisticsPage() {
  const { t, i18n } = useTranslation(); const f = useFormat(); const lp = useLocalePath(); const navigate = useNavigate();
  const [params, setParams] = useSearchParams(); const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState(''); const [regionAmount, setRegionAmount] = useState(false);
  const [analysisLands, setAnalysisLands] = useState<AdminLandListItem[]>([]);
  const [analysisLandId, setAnalysisLandId] = useState('');
  const [analysis, setAnalysis] = useState<ProposalAnalysis | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState('');
  const query = params.toString();
  useEffect(() => {
    let alive = true;
    adminLands.list('all', '').then(lands => {
      if (!alive) return;
      const available = lands.filter(land => land.listingStatus !== null).sort((a, b) => a.title.localeCompare(b.title));
      setAnalysisLands(available);
      setAnalysisLandId(current => current || available[0]?.id || '');
    }).catch((x: unknown) => {
      if (alive) setAnalysisError(x instanceof Error && x.message ? x.message : t('auth.errors.server'));
    }).finally(() => { if (alive) setAnalysisLoading(false); });
    return () => { alive = false; };
  }, [t]);
  useEffect(() => {
    let alive = true;
    backend<Analytics>('GET', `/admin/analytics${query ? `?${query}` : ''}`)
      .then(value => { if (alive) { setData(value); setError(''); } })
      .catch((x: unknown) => { if (alive) { setData(null); setError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server')); } });
    return () => { alive = false; };
  }, [query, t]);
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); };
  const runAnalysis = async () => {
    if (!analysisLandId || analysisBusy) return;
    setAnalysis(null); setAnalysisError(''); setAnalysisBusy(true);
    try { setAnalysis(await backend<ProposalAnalysis>('GET', `/admin/lands/${encodeURIComponent(analysisLandId)}/proposal-analysis`)); }
    catch (x) { setAnalysisError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server')); }
    finally { setAnalysisBusy(false); }
  };
  const drill = (kind: 'applications' | 'lands', extra: Record<string, string>) => {
    const next = new URLSearchParams(); filterKeys.forEach(k => { const value = params.get(k); if (value) next.set(k, value); });
    Object.entries(extra).forEach(([key, value]) => next.set(key, value));
    navigate(`${lp(`/admin/${kind}`)}?${next}`);
  };
  const chart = (title: string, rows: Datum[], kind: 'applications' | 'lands', filter: string, money = false) =>
    <section className="card p-5 min-w-0" aria-label={title}>
      <h2 className="font-display text-xl text-brand mb-3">{title}</h2>
      {rows.length === 0 || rows.every(r => r.value === 0) ? <p className="text-sm text-muted">{t('admin.panel.noData')}</p> : <>
        <div style={{ height: Math.max(220, rows.length * 40) }} role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={n => money ? f.compactAzn(n) : f.num(n)} />
              <YAxis dataKey="name" type="category" width={115} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => money ? f.azn(Number(value)) : f.num(Number(value))} />
              <Bar dataKey="value" fill="#4F7F2C" radius={[0, 4, 4, 0]} cursor="pointer"
                onClick={(_, index) => { const row = rows[index]; if (row) drill(kind, { [filter]: row.key }); }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={title}>
          {rows.map(r => <li key={r.key}><button type="button" className="btn btn-outline btn-sm" onClick={() => drill(kind, { [filter]: r.key })}>{r.name}: {money ? f.azn(r.value) : f.num(r.value)}</button></li>)}
        </ul>
      </>}
    </section>;
  const status = (Array.isArray(data?.applicationsByStatus) ? data.applicationsByStatus : []).map(r => ({ key: r.status, name: t(`competition.status.${r.status}`), value: r.count }));
  const regions = (Array.isArray(data?.applicationsByRegion) ? data.applicationsByRegion : []).map(r => ({ key: r.region, name: t(`regions.${r.region}`, { defaultValue: r.region }), value: regionAmount ? r.investment : r.count }));
  const activities = (Array.isArray(data?.applicationsBySector) ? data.applicationsBySector : []).map(r => ({ key: r.sector, name: r.sector === 'unknown' ? t('admin.panel.unknownActivity') : t(`fieldTypes.${r.sector}`, { defaultValue: r.sector }), value: r.count }));
  const monthLabel = (month: string) => i18n.language === 'az' ? `${month.slice(5)}.${month.slice(0, 4)}`
    : new Intl.DateTimeFormat(f.locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  const timeline = (Array.isArray(data?.timeline) ? data.timeline : []).map(r => ({ key: r.month, name: monthLabel(r.month), value: r.applications }));
  const landPipeline = data?.landPipeline ?? { draft: 0, published: 0, archived: 0 };
  const competitions = Array.isArray(data?.competitions) ? data.competitions : [];
  const pipeline = data ? [{ name: t('admin.panel.landPipeline'), ...landPipeline }] : [];
  return <>
    <PageTitle title={t('admin.panel.statistics')} subtitle={t('admin.panel.statisticsHint')} />
    <section className="card p-5 mb-5" aria-labelledby="admin-ai-title">
      <h2 id="admin-ai-title" className="font-display text-xl text-brand mb-2">{t('admin.panel.analysis.title')}</h2>
      <p className="text-sm text-muted mb-4">{t('admin.panel.analysis.hint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold flex-1 min-w-[220px]">{t('admin.panel.analysis.chooseLand')}
          <select className="field mt-1" value={analysisLandId} disabled={analysisLoading || analysisBusy} onChange={e => { setAnalysisLandId(e.target.value); setAnalysis(null); setAnalysisError(''); }}>
            {analysisLands.length === 0 && <option value="">{analysisLoading ? t('form.loading') : t('admin.panel.analysis.noLands')}</option>}
            {analysisLands.map(land => <option key={land.id} value={land.id}>{land.title}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={!analysisLandId || analysisBusy} onClick={() => void runAnalysis()}>{analysisBusy ? t('form.loading') : t('admin.panel.analysis.button')}</button>
      </div>
      {analysisError && <p role="alert" className="text-danger mt-3">{analysisError}</p>}
    </section>
    {analysisBusy && <div className="skeleton h-40 mb-5" aria-label={t('form.loading')} />}
    {analysis && <AdminProposalAnalysisResult analysis={analysis} />}
    <div className="card p-4 mb-5 grid sm:grid-cols-2 xl:grid-cols-5 gap-3" aria-label={t('admin.panel.filters')}>
      <label className="text-sm font-semibold">{t('admin.panel.from')}<input type="date" className="field mt-1" value={params.get('from') ?? ''} max={params.get('to') ?? undefined} onChange={e => setFilter('from', e.target.value)} /></label>
      <label className="text-sm font-semibold">{t('admin.panel.to')}<input type="date" className="field mt-1" value={params.get('to') ?? ''} min={params.get('from') ?? undefined} onChange={e => setFilter('to', e.target.value)} /></label>
      <label className="text-sm font-semibold">{t('admin.form.region')}<select className="field mt-1" value={params.get('region') ?? ''} onChange={e => setFilter('region', e.target.value)}><option value="">{t('admin.panel.allRegions')}</option>{INVESTMENT_REGIONS.map(r => <option key={r.key} value={r.key}>{t(`regions.${r.key}`)}</option>)}</select></label>
      <label className="text-sm font-semibold">{t('admin.panel.activity')}<select className="field mt-1" value={params.get('activity') ?? ''} onChange={e => setFilter('activity', e.target.value)}><option value="">{t('competition.all')}</option>{CATEGORIES.map(c => <option key={c.key} value={c.key}>{t(`fieldTypes.${c.key}`)}</option>)}</select></label>
      <label className="text-sm font-semibold">{t('admin.panel.competition')}<select className="field mt-1" value={params.get('competitionId') ?? ''} onChange={e => setFilter('competitionId', e.target.value)}><option value="">{t('competition.all')}</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="text-danger mb-4">{error}</p>}
    {!data ? <div className="skeleton h-40" /> : <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={null} label={t('admin.panel.publishedLands')} value={f.num(data.publishedLands)} />
        <StatCard icon={null} label={t('competition.competitions')} value={f.num(data.activeCompetitions)} />
        <StatCard icon={null} label={t('competition.applications')} value={f.num(data.totalApplications)} />
        <StatCard icon={null} label={t('competition.proposedInvestment')} value={f.azn(data.totalProposedInvestment)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card p-5 min-w-0"><h2 className="font-display text-xl text-brand mb-3">{t('admin.panel.byMonth')}</h2>
          {timeline.length === 0 ? <p className="text-sm text-muted">{t('admin.panel.noData')}</p> : <>
            <div className="h-64" role="img" aria-label={t('admin.panel.byMonth')}><ResponsiveContainer width="100%" height="100%"><BarChart data={timeline}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#4F7F2C" cursor="pointer" onClick={(_, i) => drill('applications', { month: timeline[i].key })} /></BarChart></ResponsiveContainer></div>
            <div className="flex flex-wrap gap-2 mt-3">{timeline.map(r => <button type="button" key={r.key} className="btn btn-outline btn-sm" onClick={() => drill('applications', { month: r.key })}>{r.name}: {f.num(r.value)}</button>)}</div>
          </>}
        </section>
        {chart(t('admin.panel.byStatus'), status, 'applications', 'status')}
        <section className="min-w-0"><div className="flex items-center justify-between mb-2"><h2 className="sr-only">{t('admin.panel.byRegion')}</h2><button type="button" className="btn btn-outline btn-sm" aria-pressed={regionAmount} onClick={() => setRegionAmount(v => !v)}>{regionAmount ? t('competition.applications') : t('competition.proposedInvestment')}</button></div>{chart(t('admin.panel.byRegion'), regions, 'applications', 'region', regionAmount)}</section>
        {chart(t('admin.panel.byActivity'), activities, 'applications', 'activity')}
        <section className="card p-5 lg:col-span-2"><h2 className="font-display text-xl text-brand mb-3">{t('admin.panel.landPipeline')}</h2>
          {landPipeline.draft + landPipeline.published + landPipeline.archived === 0 ? <p className="text-sm text-muted">{t('admin.panel.noData')}</p> : <div className="h-48" role="img" aria-label={t('admin.panel.landPipeline')}><ResponsiveContainer width="100%" height="100%"><BarChart data={pipeline} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} /><Tooltip /><Legend />{(['draft', 'published', 'archived'] as const).map((key, i) => <Bar key={key} dataKey={key} name={t(`admin.panel.pipeline.${key}`)} stackId="pipeline" fill={['#CFAF66', '#4F7F2C', '#8D9A91'][i]} cursor="pointer" onClick={() => drill('lands', { status: key === 'published' ? 'approved' : key })} />)}</BarChart></ResponsiveContainer></div>}
          <div className="flex flex-wrap gap-2 mt-3">{(['draft', 'published', 'archived'] as const).map(key => <button type="button" key={key} className="btn btn-outline btn-sm" onClick={() => drill('lands', { status: key === 'published' ? 'approved' : key })}>{t(`admin.panel.pipeline.${key}`)}: {f.num(landPipeline[key])}</button>)}</div>
        </section>
      </div>
    </>}
  </>;
}
