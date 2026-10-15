import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backend, BackendError } from '../../services/backend';
import { useFormat } from '../../app/i18n';
import type { ApplicantType, InvestorProfile } from '../../types/agro';
import { EmptyState, StatCard } from '../../components/ui/Bits';
import { PageTitle } from '../cabinet/CabinetShell';

interface Investor {
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null; applicantType: ApplicantType | null; needsOnboarding: boolean; emailConfirmed: boolean; createdAt: string };
  profile: InvestorProfile | null;
  applicationCount: number;
  proposedInvestment: number;
}
interface InvestorPage { items: Investor[]; total: number; page: number; pageSize: number }
interface StatItem { region?: string; sector?: string; status?: string; count: number; investment?: number }
interface Analytics {
  totalApplications: number; activeCompetitions: number; publishedLands: number; openProposals: number;
  selectedProposals: number; totalProposedInvestment: number; applicationsByRegion: StatItem[];
  applicationsBySector: StatItem[]; applicationsByStatus: StatItem[];
  timeline: { month: string; applications: number; investment: number }[];
}

const profileFields: (keyof InvestorProfile)[] = [
  'companyName', 'taxIdentificationNumber', 'businessActivity', 'foreignTaxNumber', 'country', 'activityStatus',
  'activityStartDate', 'ceoName', 'address', 'maritalStatus', 'incomeLast6Months', 'residencyStatus', 'incomeSource',
  'hasCredit', 'monthlyCreditPayment', 'hasFixedIncome', 'fixedMonthlyIncome', 'minimumFunds',
];

export function AdminInvestorsPage() {
  const { t } = useTranslation(); const f = useFormat();
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [data, setData] = useState<InvestorPage | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      backend<InvestorPage>('GET', `/admin/investors?page=${page}&search=${encodeURIComponent(search)}`)
        .then(r => { if (alive) { setData(r); setError(''); } })
        .catch((x: unknown) => { if (alive) setError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server')); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [page, search, t]);
  return <>
    <PageTitle title={t('admin.panel.investors')} subtitle={t('admin.panel.investorsHint')} />
    <input className="field mb-5" aria-label={t('form.search')} placeholder={t('form.search')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
    {error && <p className="text-danger mb-4" role="alert">{error}</p>}
    {!data ? <div className="skeleton h-40" /> : data.items.length === 0 ? <EmptyState title={t('admin.panel.noInvestors')} /> :
      <div className="grid gap-4">{data.items.map(({ user, profile, applicationCount, proposedInvestment }) =>
        <details key={user.id} className="card p-5 group">
          <summary className="cursor-pointer list-none flex flex-wrap justify-between gap-3">
            <span><span className="font-display text-xl text-brand block">{user.firstName} {user.lastName}</span>
              <span className="text-sm text-muted">{user.email} · {user.phone ?? '—'}</span></span>
            <span className="text-sm text-muted text-right">{user.applicantType ? t(`admin.panel.types.${user.applicantType}`) : '—'}<br />
              {t('admin.panel.applicationsCount', { count: applicationCount })} · {f.azn(proposedInvestment)}</span>
          </summary>
          <div className="border-t border-line mt-4 pt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><span className="text-muted">{t('admin.panel.registered')}</span><p className="font-semibold">{f.date(user.createdAt)}</p></div>
            <div><span className="text-muted">{t('admin.panel.accountStatus')}</span><p className="font-semibold">{user.needsOnboarding ? t('admin.panel.incomplete') : user.emailConfirmed ? t('admin.panel.confirmed') : t('admin.panel.unconfirmed')}</p></div>
            {profile && profileFields.map(key => {
              const value = profile[key];
              if (value === null || value === undefined || value === '') return null;
              return <div key={key}><span className="text-muted">{t(`admin.panel.fields.${key}`)}</span>
                <p className="font-semibold break-words">{typeof value === 'boolean' ? (value ? t('form.yes') : t('form.no')) : String(value)}</p></div>;
            })}
          </div>
        </details>)}</div>}
    {data && data.total > data.pageSize && <div className="flex items-center justify-center gap-4 mt-5">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('admin.panel.previous')}</button>
      <span className="text-sm">{page} / {Math.ceil(data.total / data.pageSize)}</span>
      <button className="btn btn-outline btn-sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>{t('admin.panel.next')}</button>
    </div>}
  </>;
}

export function AdminStatisticsPage() {
  const { t } = useTranslation(); const f = useFormat();
  const [data, setData] = useState<Analytics | null>(null); const [error, setError] = useState('');
  useEffect(() => { backend<Analytics>('GET', '/admin/analytics').then(setData)
    .catch((x: unknown) => setError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server'))); }, [t]);
  const group = (title: string, rows: { name: string; count: number; amount?: number }[]) =>
    <section className="card p-5"><h2 className="font-display text-xl text-brand mb-3">{title}</h2>
      {rows.length ? <ul className="divide-y divide-line">{rows.map((r, i) =>
        <li key={i} className="flex justify-between gap-3 py-2 text-sm"><span>{r.name}</span><strong>{r.count}{r.amount !== undefined ? ` · ${f.azn(r.amount)}` : ''}</strong></li>)}</ul> : <p className="text-sm text-muted">{t('admin.panel.noData')}</p>}
    </section>;
  return <>
    <PageTitle title={t('admin.panel.statistics')} subtitle={t('admin.panel.statisticsHint')} />
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!data ? <div className="skeleton h-40" /> : <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={null} label={t('competition.applications')} value={String(data.totalApplications)} />
        <StatCard icon={null} label={t('competition.competitions')} value={String(data.activeCompetitions)} />
        <StatCard icon={null} label={t('admin.panel.publishedLands')} value={String(data.publishedLands)} />
        <StatCard icon={null} label={t('competition.proposedInvestment')} value={f.azn(data.totalProposedInvestment)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {group(t('admin.panel.byRegion'), data.applicationsByRegion.map(r => ({ name: t(`regions.${r.region}`, { defaultValue: r.region }), count: r.count, amount: r.investment })))}
        {group(t('admin.panel.byActivity'), data.applicationsBySector.map(r => ({ name: t(`fieldTypes.${r.sector}`, { defaultValue: r.sector }), count: r.count })))}
        {group(t('admin.panel.byStatus'), data.applicationsByStatus.map(r => ({ name: t(`competition.status.${r.status}`, { defaultValue: r.status }), count: r.count })))}
        {group(t('admin.panel.byMonth'), data.timeline.map(r => ({ name: r.month, count: r.applications, amount: r.investment })))}
      </div>
    </>}
  </>;
}
