import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backend, BackendError } from '../../services/backend';
import { useFormat } from '../../app/i18n';
import type { ApplicantType, InvestorProfile } from '../../types/agro';
import { EmptyState } from '../../components/ui/Bits';
import { PageTitle } from '../cabinet/CabinetShell';
export { AdminStatisticsPage } from './AdminStatisticsPage';

interface Investor {
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null; applicantType: ApplicantType | null; needsOnboarding: boolean; emailConfirmed: boolean; isVerified: boolean; createdAt: string };
  profile: InvestorProfile | null;
  applicationCount: number;
  proposedInvestment: number;
}
interface InvestorPage { items: Investor[]; total: number; page: number; pageSize: number }

const profileFields: (keyof InvestorProfile)[] = [
  'companyName', 'taxIdentificationNumber', 'businessActivity', 'foreignTaxNumber', 'country', 'activityStatus',
  'activityStartDate', 'ceoName', 'address', 'incomeLast6Months', 'residencyStatus', 'incomeSource',
  'hasCredit', 'monthlyCreditPayment', 'hasFixedIncome', 'fixedMonthlyIncome', 'minimumFunds', 'incomeStability', 'monthlyNetIncome',
  'incomePeriod', 'financialCurrency', 'outstandingDebt', 'debtRepaymentAmount', 'debtRepaymentFrequency', 'annualRevenue',
  'netProfitOrLoss', 'operatingCashFlow', 'financialReportingPeriod', 'liquidFundsAvailable', 'ownContribution',
  'postInvestmentReserve', 'additionalFinancingRequired', 'operatingAddress', 'legalForm', 'registrationDate',
  'representativeRole', 'experienceYears', 'experienceDescription', 'operationalCapacity', 'previousProjects',
  'citizenshipCountry', 'residenceCountry', 'dateOfBirth', 'identityDocumentType', 'identityDocumentNumber',
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
            {profile && <p className="sm:col-span-2 text-muted">{t('settings.profileSelfDeclared')}</p>}
            <div><span className="text-muted">{t('admin.panel.registered')}</span><p className="font-semibold">{f.date(user.createdAt)}</p></div>
            <div><span className="text-muted">{t('admin.panel.accountStatus')}</span><p className="font-semibold">{user.needsOnboarding ? t('admin.panel.incomplete') : user.emailConfirmed ? t('admin.panel.confirmed') : t('admin.panel.unconfirmed')}</p></div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><span className="font-semibold">{t(user.isVerified ? 'settings.verifiedInvestor' : 'settings.notVerified')}</span><button type="button" className="btn btn-outline btn-sm" onClick={async e => {
              e.preventDefault(); e.stopPropagation();
              try {
                await backend('PATCH', `/admin/investors/${encodeURIComponent(user.id)}/verification`, { isVerified: !user.isVerified });
                setData(current => current ? { ...current, items: current.items.map(item => item.user.id === user.id ? { ...item, user: { ...item.user, isVerified: !user.isVerified } } : item) } : current);
              } catch (x) { setError(x instanceof BackendError && x.message ? x.message : t('auth.errors.server')); }
            }}>{t(user.isVerified ? 'admin.panel.markUnverified' : 'admin.panel.markVerified')}</button></div>
            {profile && profileFields.map(key => {
              const value = profile[key];
              if (value === null || value === undefined || value === '') return null;
              return <div key={key}><span className="text-muted">{t(`settings.profileFields.${key}`, { defaultValue: key })}</span>
                <p className="font-semibold break-words">{typeof value === 'boolean' ? (value ? t('form.yes') : t('form.no')) : String(value)}</p></div>;
            })}
            {profile?.documents.map(doc => <div key={doc.id}><span className="text-muted">{t(`settings.documentCategories.${doc.category}`, { defaultValue: t('settings.profileDocuments') })}</span><p><a className="text-brand underline" href={doc.url} target="_blank" rel="noreferrer">{doc.fileName}</a></p></div>)}
          </div>
        </details>)}</div>}
    {data && data.total > data.pageSize && <div className="flex items-center justify-center gap-4 mt-5">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('admin.panel.previous')}</button>
      <span className="text-sm">{page} / {Math.ceil(data.total / data.pageSize)}</span>
      <button className="btn btn-outline btn-sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>{t('admin.panel.next')}</button>
    </div>}
  </>;
}
