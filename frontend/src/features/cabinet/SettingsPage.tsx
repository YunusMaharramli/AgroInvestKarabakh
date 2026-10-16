import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Trash2, Upload } from 'lucide-react';
import { authService, useCurrentUser, errorText } from '../../services/api';
import { PageTitle, Avatar } from './CabinetShell';
import { Chips, Field, Segmented, Toggle } from '../../components/ui/Bits';
import { useToast } from '../../components/ui/Overlay';
import { applyLang, LANGS, Lang, useLang } from '../../app/i18n';
import { CATEGORIES } from '../../data/categories';
import { REGIONS } from '../../data/regions';
import type { CabinetRole, InvestorProfile, RiskTolerance } from '../../types/agro';

/** Editable, applicant-specific profile; values remain private and are self-declared. */
const InvestorProfileCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const me = useCurrentUser()!;
  const [documentCategory, setDocumentCategory] = useState('OTHER');
  const [currentPassword, setCurrentPassword] = useState('');
  const p = me.investorProfile;
  const individual = me.applicantType === 'INDIVIDUAL' || me.applicantType === 'FOREIGN_INDIVIDUAL';
  const foreign = me.applicantType === 'FOREIGN_INDIVIDUAL' || me.applicantType === 'FOREIGN_ENTITY';
  const keys = individual
    ? ['incomeStability','monthlyNetIncome','incomePeriod','financialCurrency','outstandingDebt','debtRepaymentAmount','debtRepaymentFrequency','ownContribution','postInvestmentReserve','additionalFinancingRequired','incomeSource','experienceYears','experienceDescription',...(foreign ? ['citizenshipCountry','residenceCountry','residencyStatus','address','dateOfBirth','identityDocumentType','identityDocumentNumber'] : [])]
    : ['companyName','taxIdentificationNumber','foreignTaxNumber','country','legalForm','registrationDate','activityStartDate','activityStatus','businessActivity','ceoName','address','operatingAddress','representativeRole','annualRevenue','netProfitOrLoss','operatingCashFlow','financialReportingPeriod','liquidFundsAvailable','outstandingDebt','debtRepaymentAmount','ownContribution','postInvestmentReserve','additionalFinancingRequired','experienceYears','experienceDescription','operationalCapacity','previousProjects'];
  const stringKeys = new Set(['incomeStability','incomePeriod','financialCurrency','debtRepaymentFrequency','incomeSource','experienceDescription','citizenshipCountry','residenceCountry','residencyStatus','address','dateOfBirth','identityDocumentType','identityDocumentNumber','companyName','taxIdentificationNumber','foreignTaxNumber','country','legalForm','registrationDate','activityStatus','businessActivity','ceoName','operatingAddress','representativeRole','financialReportingPeriod','operationalCapacity','previousProjects']);
  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = { ...(p ?? {}) };
    keys.forEach(key => { const value = String(form.get(key) ?? '').trim(); patch[key] = value === '' ? null : stringKeys.has(key) ? value : Number(value); });
    try { await authService.updateInvestorProfile({ ...patch, currentPassword } as Partial<InvestorProfile>); setCurrentPassword(''); toast(t('settings.savedToast')); }
    catch (x) { toast(errorText(t, x)); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try { await authService.uploadInvestorProfileDocument(file, documentCategory); await authService.refreshRole(); toast(t('settings.savedToast')); }
    catch (x) { toast(errorText(t, x)); }
  };
  const deleteDocument = async (id: string) => {
    try { await authService.deleteInvestorProfileDocument(id); await authService.refreshRole(); toast(t('settings.savedToast')); }
    catch (x) { toast(errorText(t, x)); }
  };
  return (
    <section className="card p-6 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-display text-2xl text-brand">{t('settings.investorProfile')}</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#F4ECD6] text-gold-dark px-4 py-1.5 text-sm font-bold">{t('settings.applicantType')}: {t(`auth.applicant.${me.applicantType}`)}</span>
      </div>
      <p className="text-sm text-muted mb-5">{t('settings.profilePrivacy')}</p>
      {foreign && <p className="rounded-xl bg-[#FBF6E8] p-4 text-sm text-ink mb-5">{t('settings.foreignLandNotice')} <a className="font-bold underline text-brand" href="https://e-qanun.az/framework/46942" target="_blank" rel="noreferrer">{t('settings.foreignLandLaw')}</a></p>}
      <form onSubmit={saveProfile} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {keys.map(key => {
          const value = p?.[key as keyof typeof p];
          const date = key === 'registrationDate' || key === 'activityStartDate' || key === 'dateOfBirth';
          const area = ['experienceDescription','operationalCapacity','previousProjects'].includes(key);
          const options: Record<string, string[]> = { incomeStability: ['STABLE','SEASONAL','IRREGULAR','OTHER'], incomePeriod: ['MONTHLY','ANNUAL'], debtRepaymentFrequency: ['MONTHLY','ANNUAL'], residencyStatus: ['PERMANENT_RESIDENT','TEMPORARY_RESIDENT','NON_RESIDENT'], activityStatus: ['BRANCH','REPRESENTATIVE_OFFICE','SUBSIDIARY','NOT_REGISTERED'] };
          return <Field key={key} label={t(`settings.profileFields.${key}`, { defaultValue: key })} htmlFor={`inv-${key}`} className={area ? 'sm:col-span-2 lg:col-span-3' : ''}>
            {area ? <textarea id={`inv-${key}`} name={key} className="field min-h-24" defaultValue={typeof value === 'string' ? value : ''} />
              : options[key] ? <select id={`inv-${key}`} name={key} className="field" defaultValue={value == null ? '' : String(value)}><option value="">—</option>{options[key].map(option => <option key={option} value={option}>{t(`settings.profileOptions.${key}.${option}`, { defaultValue: option })}</option>)}</select>
              : <input id={`inv-${key}`} name={key} className="field" type={date ? 'date' : stringKeys.has(key) ? 'text' : 'number'} step={stringKeys.has(key) || date ? undefined : '0.01'} defaultValue={value == null ? '' : String(value)} />}
          </Field>;
        })}
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label={t('settings.currentPasswordConfirm')} htmlFor="investor-profile-password" hint={t('settings.currentPasswordConfirmHint')}>
            <input id="investor-profile-password" type="password" autoComplete="current-password" className="field" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-3 items-center"><button className="btn btn-primary" type="submit">{t('form.save')}</button><span className="text-xs text-muted">{t('settings.profileSelfDeclared')}</span></div>
      </form>
      <div className="border-t border-line mt-6 pt-5">
        <h3 className="font-semibold mb-3">{t('settings.profileDocuments')}</h3>
        <div className="flex flex-wrap gap-3 items-center"><select className="field !w-auto" aria-label={t('settings.profileDocumentCategory')} value={documentCategory} onChange={e => setDocumentCategory(e.target.value)}>{['IDENTITY','REGISTRATION','FINANCIAL','EXPERIENCE','OTHER'].map(category => <option key={category} value={category}>{t(`settings.documentCategories.${category}`)}</option>)}</select><label className="btn btn-outline btn-sm cursor-pointer"><Upload className="w-4 h-4" />{t('settings.profileUpload')}<input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label></div>
        <ul className="mt-3 grid gap-2">{(p?.documents ?? []).map(doc => <li key={doc.id} className="flex gap-3 items-center text-sm"><a className="text-brand underline" href={doc.url} target="_blank" rel="noreferrer">{doc.fileName}</a><button type="button" aria-label={t('settings.profileDelete')} onClick={() => void deleteDocument(doc.id)} className="text-danger"><Trash2 className="w-4 h-4" /></button></li>)}</ul>
      </div>
    </section>
  );
};

/** Profile & Settings (3.6 / 4.6), shared by both cabinets. */
export const SettingsPage: React.FC<{ role: CabinetRole }> = ({ role }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const lang = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const me = useCurrentUser()!;
  const [info, setInfo] = useState({ fullName: me.fullName, email: me.email, phone: me.phone, companyName: me.companyName ?? '' });
  const [notify, setNotify] = useState(me.notify ?? { email: true, sms: false, push: true });
  const [prefs, setPrefs] = useState(me.preferences);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [identityPassword, setIdentityPassword] = useState('');
  const [pwErr, setPwErr] = useState('');
  const save = async (patch: Parameters<typeof authService.updateProfile>[0]) => { await authService.updateProfile(patch); toast(t('settings.savedToast')); };
  const changeLang = (l: Lang) => { applyLang(l); navigate(pathname.replace(/^\/(az|en|ru)/, `/${l}`), { replace: true }); };

  return (
    <>
      <PageTitle title={t('settings.title')} />
      <div className="grid xl:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-display text-2xl text-brand mb-5">{t('settings.personal')}</h2>
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={me.fullName} gold={role === 'investor'} />
            <label className="btn btn-outline btn-sm cursor-pointer"><Upload className="w-4 h-4" />{t('settings.changePhoto')}<input type="file" accept="image/*" className="sr-only" onChange={() => toast(t('settings.savedToast'))} /></label>
          </div>
          <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void save({ fullName: info.fullName, phone: info.phone, companyName: info.companyName || undefined, currentPassword: identityPassword }).then(() => setIdentityPassword('')).catch(x => toast(errorText(t, x))); }}>
            <Field label={t('auth.fullName')} htmlFor="st-name"><input id="st-name" className="field" value={info.fullName} onChange={e => setInfo({ ...info, fullName: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('auth.email')} htmlFor="st-email"><input id="st-email" className="field bg-sand/40" value={info.email} readOnly /></Field>
              <Field label={t('auth.phone')} htmlFor="st-phone"><input id="st-phone" className="field" value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} /></Field>
            </div>
            {role === 'investor' && <Field label={t('settings.company')} htmlFor="st-company"><input id="st-company" className="field" value={info.companyName} onChange={e => setInfo({ ...info, companyName: e.target.value })} /></Field>}
            <Field label={t('settings.currentPasswordConfirm')} htmlFor="st-current-password" hint={t('settings.currentPasswordConfirmHint')}><input id="st-current-password" type="password" autoComplete="current-password" className="field" value={identityPassword} onChange={e => setIdentityPassword(e.target.value)} /></Field>
            <button type="submit" className="btn btn-primary justify-self-start">{t('form.save')}</button>
          </form>
        </section>

        <div className="grid gap-6 content-start">
          <section className="card p-6">
            <h2 className="font-display text-2xl text-brand mb-4">{t('settings.verification')}</h2>
            {me.verified
              ? <span className="inline-flex items-center gap-2 rounded-full bg-[#F4ECD6] text-gold-dark px-4 py-2 font-bold"><BadgeCheck className="w-5 h-5" />{role === 'landowner' ? t('settings.verifiedOwner') : t('settings.verifiedInvestor')}</span>
              : <span className="text-muted">{t('settings.notVerified')}</span>}
          </section>
          <section className="card p-6">
            <h2 className="font-display text-2xl text-brand mb-4">{t('settings.language')}</h2>
            <Segmented label={t('settings.language')} value={lang} onChange={changeLang} options={LANGS.map(l => ({ value: l, label: t(`lang.${l}`) }))} />
          </section>
          <section className="card p-6">
            <h2 className="font-display text-2xl text-brand mb-4">{t('settings.notifications')}</h2>
            <div className="grid gap-4">
              {(['email', 'sms', 'push'] as const).map(k => (
                <Toggle key={k} id={`st-n-${k}`} checked={notify[k]} label={t(`settings.n${k === 'email' ? 'Email' : k === 'sms' ? 'Sms' : 'Push'}`)}
                  onChange={v => { const n = { ...notify, [k]: v }; setNotify(n); void save({ notify: n }); }} />
              ))}
            </div>
          </section>
        </div>

        {role === 'investor' && (
          <section id="preferences" className="card p-6 xl:col-span-2 scroll-mt-24">
            <h2 className="font-display text-2xl text-brand">{t('settings.preferences')}</h2>
            <p className="text-muted text-sm mb-5">{t('settings.preferencesText')}</p>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={`${t('investor.search.budget')} — ${t('investor.search.min')}`} htmlFor="pr-min"><input id="pr-min" type="number" className="field" value={prefs.budgetMin} onChange={e => setPrefs({ ...prefs, budgetMin: Number(e.target.value) })} /></Field>
                <Field label={`${t('investor.search.budget')} — ${t('investor.search.max')}`} htmlFor="pr-max"><input id="pr-max" type="number" className="field" value={prefs.budgetMax} onChange={e => setPrefs({ ...prefs, budgetMax: Number(e.target.value) })} /></Field>
                <div className="sm:col-span-2"><p className="field-label">{t('investor.search.risk')}</p><Segmented label={t('investor.search.risk')} value={prefs.riskTolerance} onChange={(v: RiskTolerance) => setPrefs({ ...prefs, riskTolerance: v })} options={(['low', 'medium', 'high'] as const).map(r => ({ value: r, label: t(`risk.${r}`) }))} /></div>
              </div>
              <div className="grid gap-4">
                <div><p className="field-label">{t('investor.search.types')}</p><Chips label={t('investor.search.types')} options={CATEGORIES.map(c => ({ value: c.key, label: t(`fieldTypes.${c.key}`) }))} selected={prefs.fieldTypes} onChange={v => setPrefs({ ...prefs, fieldTypes: v })} limit={10} /></div>
                <div><p className="field-label">{t('investor.search.regions')}</p><Chips label={t('investor.search.regions')} options={REGIONS.map(r => ({ value: r.key, label: t(`regions.${r.key}`) }))} selected={prefs.regions} onChange={v => setPrefs({ ...prefs, regions: v })} limit={10} /></div>
              </div>
            </div>
            <button type="button" className="btn btn-primary mt-6" onClick={async () => { await authService.updatePreferences(prefs); toast(t('settings.savedToast')); }}>{t('form.save')}</button>
          </section>
        )}

        {role === 'investor' && me.applicantType && <InvestorProfileCard />}

        {me.isAdmin ? (
          <section className="card p-6 xl:col-span-2">
            <h2 className="font-display text-2xl text-brand mb-2">{t('settings.password')}</h2>
            <p className="text-muted">{t('settings.adminPassword')}</p>
          </section>
        ) : (
        <section className="card p-6 xl:col-span-2">
          <h2 className="font-display text-2xl text-brand mb-4">{t('settings.password')}</h2>
          <form className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end" onSubmit={async e => {
            e.preventDefault();
            if (pw.next.length < 8) { setPwErr(t('form.minLength', { n: 8 })); return; }
            try { await authService.changePassword(pw.current, pw.next); setPw({ current: '', next: '' }); setPwErr(''); toast(t('settings.pwChanged')); }
            catch (x) { setPwErr(errorText(t, x)); }
          }}>
            <Field label={t('settings.current')} htmlFor="pw-cur"><input id="pw-cur" type="password" className="field" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label={t('settings.newPw')} htmlFor="pw-new" error={pwErr}><input id="pw-new" type="password" className="field" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></Field>
            <button type="submit" className="btn btn-primary">{t('settings.updatePw')}</button>
          </form>
        </section>
        )}
      </div>
    </>
  );
};
