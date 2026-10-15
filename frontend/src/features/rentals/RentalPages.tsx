import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileText, Home, LogOut, Plus, Search, ShieldCheck } from 'lucide-react';
import { backend, BackendError } from '../../services/backend';
import { authService, useCurrentUser } from '../../services/api';
import { useFormat, useLocalePath } from '../../app/i18n';
import { useToast } from '../../components/ui/Overlay';
import { canAdminApplicationAction, isEntity, isForeignIndividual, missingRequiredDocuments, parseDocumentRequirements, requirementsForApplicant, type ApplicantType, type AppStatus, type DocumentRequirement as Requirement, type ForeignKind } from './rental-workflow';

type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN' | 'ARCHIVED';
type RentalProperty = 'LAND' | 'BUSINESS_PROPERTY';
type OwnerCategory = 'PRIVATE' | 'MUNICIPAL' | 'STATE';
type Procedure = 'DIRECT' | 'AUCTION' | 'TENDER' | 'INVESTMENT_COMPETITION' | 'EXTERNAL_PROCEDURE' | 'LEGAL_REVIEW_REQUIRED';

interface RentalListing {
  id: string; propertyType: RentalProperty; title: string; description: string; ownerCategory: OwnerCategory;
  legalDesignation: string; region: string; address: string; area: number; areaUnit: string; permittedUse: string;
  rentAmount: number; currency: string; paymentPeriod: string; minimumLeaseMonths: number | null; maximumLeaseMonths: number | null;
  depositAmount: number | null; additionalCharges: string; infrastructure: string; photoUrls: string[]; procedure: Procedure;
  procedureReference: string; procedureNotes: string; eligibilityRules: string; authorityBasis?: string | null; authorityReference?: string | null; authorityReviewed?: boolean | null; status: ListingStatus; isAvailable: boolean;
  documentRequirements: Requirement[]; documents?: { id: string; kind: string; fileName: string; url: string }[]; updatedAt: string;
}
interface ApplicantProfile {
  id?: string; applicantType: ApplicantType; foreignKind: ForeignKind | null; fullLegalName: string; citizenship: string;
  countryOfResidence: string; residenceAddress: string; idDocumentType: string; idDocumentNumber: string; fin: string;
  legalName: string; legalForm: string; countryOfIncorporation: string; registrationIdentifier: string; taxIdentifier: string;
  registeredAddress: string; contactPhone: string; contactEmail: string; contactAddress: string; representativeName: string;
  representativePosition: string; authorityToAct: string; consentGrantedAt?: string; updatedAt?: string;
}
interface RentalApplication {
  id: string; referenceNumber: string; listingId: string; listingTitle: string; status: AppStatus; intendedUse: string;
  proposedLeaseMonths: number | null; message: string; additionalInformationResponse: string; decisionReason: string | null; createdAt: string; submittedAt: string | null;
  history: { status: string; comment: string; createdAt: string }[];
  documents: { id: string; kind: string; fileName: string; url: string }[];
  applicantProfile: ApplicantProfile | null; applicantSnapshot: string | null; requirements?: Requirement[];
}
interface ApplicantProfileInput extends ApplicantProfile { consentToProcess: boolean }
interface ListingInput {
  propertyType: RentalProperty; title: string; description: string; ownerCategory: OwnerCategory; legalDesignation: string;
  region: string; address: string; area: number; areaUnit: string; permittedUse: string; rentAmount: number; currency: string;
  paymentPeriod: string; minimumLeaseMonths: number | null; maximumLeaseMonths: number | null; depositAmount: number | null;
  additionalCharges: string; infrastructure: string; photoUrls: string[]; authorityBasis: string; authorityReference: string;
  authorityReviewed: boolean; procedure: Procedure; procedureReference: string; procedureNotes: string; eligibilityRules: string;
  documentRequirements: Requirement[];
}

const EMPTY_PROFILE: ApplicantProfileInput = {
  applicantType: 'INDIVIDUAL', foreignKind: null, fullLegalName: '', citizenship: '', countryOfResidence: '', residenceAddress: '',
  idDocumentType: '', idDocumentNumber: '', fin: '', legalName: '', legalForm: '', countryOfIncorporation: '', registrationIdentifier: '',
  taxIdentifier: '', registeredAddress: '', contactPhone: '', contactEmail: '', contactAddress: '', representativeName: '',
  representativePosition: '', authorityToAct: '', consentToProcess: false,
};
const EMPTY_LISTING: ListingInput = {
  propertyType: 'LAND', title: '', description: '', ownerCategory: 'PRIVATE', legalDesignation: '', region: '', address: '', area: 0,
  areaUnit: 'ha', permittedUse: '', rentAmount: 0, currency: 'AZN', paymentPeriod: 'month', minimumLeaseMonths: null,
  maximumLeaseMonths: null, depositAmount: null, additionalCharges: '', infrastructure: '', photoUrls: [], authorityBasis: '',
  authorityReference: '', authorityReviewed: false, procedure: 'LEGAL_REVIEW_REQUIRED', procedureReference: '', procedureNotes: '',
  eligibilityRules: '', documentRequirements: [],
};

const Alert: React.FC<{ children: React.ReactNode; tone?: 'error' | 'success' | 'info' }> = ({ children, tone = 'error' }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'bg-[#F6E3DF] text-danger' : tone === 'success' ? 'bg-sage text-brand' : 'bg-[#FBF6E9] text-[#76550D]'}`}>{children}</p>
);
const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }> = ({ label, hint, className = '', ...props }) => {
  const { t } = useTranslation();
  return <label className="block text-sm font-semibold text-ink">{label}{props.required ? <span className="text-danger"> *</span> : <span className="text-xs font-normal text-muted"> · {t('rental.optional')}</span>}
    <input {...props} className={`mt-1.5 w-full min-h-11 rounded-xl border border-line bg-white px-3.5 text-base font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`} />
    {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
  </label>;
};
const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }> = ({ label, hint, className = '', ...props }) => {
  const { t } = useTranslation();
  return <label className="block text-sm font-semibold text-ink">{label}{props.required ? <span className="text-danger"> *</span> : <span className="text-xs font-normal text-muted"> · {t('rental.optional')}</span>}
    <textarea {...props} className={`mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`} />
    {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
  </label>;
};
const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, className = '', children, ...props }) => {
  const { t } = useTranslation();
  return <label className="block text-sm font-semibold text-ink">{label}{props.required ? <span className="text-danger"> *</span> : <span className="text-xs font-normal text-muted"> · {t('rental.optional')}</span>}
    <select {...props} className={`mt-1.5 w-full min-h-11 rounded-xl border border-line bg-white px-3.5 text-base font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}>{children}</select>
  </label>;
};
const PageHeading: React.FC<{ title: string; text?: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-display text-3xl sm:text-4xl text-brand">{title}</h1>{text && <p className="mt-2 max-w-3xl text-muted">{text}</p>}</div>{action}</div>
);

export const RentalListingsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const [rows, setRows] = useState<RentalListing[] | null>(null);
  const [search, setSearch] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (propertyType) query.set('propertyType', propertyType);
    void backend<RentalListing[]>('GET', `/rentals?${query}`).then(x => { if (live) { setRows(x); setError(''); } })
      .catch((x: BackendError) => { if (live) { setRows([]); setError(x.message || t('rental.loadError')); } });
    return () => { live = false; };
  }, [search, propertyType, t]);
  return <section className="container-x py-10 sm:py-14">
    <PageHeading title={t('rental.marketTitle')} text={t('rental.marketIntro')} />
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_14rem]">
      <label className="relative"><Search className="absolute left-3.5 top-3.5 w-4 h-4 text-muted" aria-hidden="true" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('rental.search')} className="w-full min-h-11 rounded-xl border border-line bg-white pl-10 pr-3 text-base" /></label>
      <SelectInput label={t('rental.propertyType')} value={propertyType} onChange={e => setPropertyType(e.target.value)}><option value="">{t('rental.allTypes')}</option><option value="LAND">{t('rental.land')}</option><option value="BUSINESS_PROPERTY">{t('rental.businessProperty')}</option></SelectInput>
    </div>
    {error && <Alert>{error}</Alert>}
    {rows === null ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(x => <div key={x} className="skeleton h-72 rounded-2xl" />)}</div>
      : rows.length === 0 ? <div className="card p-8 text-center text-muted">{t('rental.noListings')}</div>
        : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map(row => <article key={row.id} className="card overflow-hidden flex flex-col">
          {row.photoUrls.length ? <img src={row.photoUrls[0]} alt="" className="w-full aspect-[16/10] object-cover" /> : <div className="aspect-[16/10] bg-sage grid place-items-center text-brand"><Home className="w-10 h-10" aria-hidden="true" /></div>}
          <div className="p-5 flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-brand">{t(`rental.${camel(row.propertyType)}`)}</span><span className="rounded-full bg-[#FBF6E9] px-3 py-1 text-xs font-bold text-[#76550D]">{t(`rental.ownerCategory.${camel(row.ownerCategory)}`)}</span></div>
            <h2 className="font-display text-xl text-brand">{row.title}</h2>
            <p className="text-sm text-muted">{row.region} · {row.area} {t(`rental.areaUnit.${row.areaUnit}`)}</p>
            <p className="text-sm line-clamp-3">{row.description}</p>
            <div className="mt-auto border-t border-line pt-3 flex items-end justify-between gap-3"><p className="font-extrabold text-brand">{f.num(row.rentAmount)} {row.currency}<span className="text-xs font-semibold text-muted"> / {t(`rental.period.${camel(row.paymentPeriod)}`)}</span></p><Link className="btn btn-outline btn-sm" to={lp(`/rentals/${row.id}`)}>{t('rental.view')}<ArrowRight className="w-4 h-4" /></Link></div>
          </div>
        </article>)}</div>}
  </section>;
};

export const RentalDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const user = useCurrentUser();
  const [listing, setListing] = useState<RentalListing | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setListing(null); void backend<RentalListing>('GET', `/rentals/${encodeURIComponent(id)}`).then(setListing).catch((e: BackendError) => setError(e.message || t('rental.loadError'))); }, [id, t]);
  if (!listing && !error) return <section className="container-x py-16"><div className="skeleton h-80 rounded-2xl" /></section>;
  if (!listing) return <section className="container-x py-16"><Alert>{error || t('rental.noListings')}</Alert><Link className="btn btn-outline mt-5" to={lp('/rentals')}>{t('rental.backToListings')}</Link></section>;
  const requirements = listing.documentRequirements;
  return <section className="container-x py-8 sm:py-12 max-w-6xl">
    <Link to={lp('/rentals')} className="text-sm font-bold text-brand hover:underline">← {t('rental.backToListings')}</Link>
    <div className="mt-5 grid gap-8 lg:grid-cols-[1.45fr_.9fr]">
      <div>
        {listing.photoUrls.length > 0 && <img src={listing.photoUrls[0]} alt="" className="w-full aspect-[16/9] rounded-2xl object-cover" />}
        <div className="mt-6"><span className="text-xs font-bold uppercase tracking-wide text-leaf">{t(`rental.${camel(listing.propertyType)}`)} · {t(`rental.ownerCategory.${camel(listing.ownerCategory)}`)}</span><h1 className="mt-2 font-display text-3xl sm:text-4xl text-brand">{listing.title}</h1><p className="mt-2 text-muted">{listing.region} · {listing.address}</p><p className="mt-5 whitespace-pre-line leading-7">{listing.description}</p></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Fact label={t('rental.designation')} value={listing.legalDesignation} /><Fact label={t('rental.area')} value={`${listing.area} ${t(`rental.areaUnit.${listing.areaUnit}`)}`} />
          <Fact label={t('rental.permittedUse')} value={listing.permittedUse} /><Fact label={t('rental.procedure')} value={t(`rental.procedure.${camel(listing.procedure)}`)} />
          {listing.procedureReference && <Fact label={t('rental.procedureReference')} value={listing.procedureReference} />}
          {listing.procedureNotes && <Fact label={t('rental.procedureNotes')} value={listing.procedureNotes} />}
          {listing.infrastructure && <Fact label={t('rental.infrastructure')} value={listing.infrastructure} />}
          {listing.eligibilityRules && <Fact label={t('rental.eligibility')} value={listing.eligibilityRules} />}
          {listing.additionalCharges && <Fact label={t('rental.additionalCharges')} value={listing.additionalCharges} />}
        </div>
      </div>
      <aside className="card h-fit p-5 sm:p-6 lg:sticky lg:top-28">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('rental.rent')}</p>
        <p className="mt-2 text-3xl font-extrabold text-brand">{f.num(listing.rentAmount)} {listing.currency}<span className="text-base font-semibold text-muted"> / {t(`rental.period.${camel(listing.paymentPeriod)}`)}</span></p>
        {listing.depositAmount !== null && <p className="mt-2 text-sm text-muted">{t('rental.deposit')}: {f.num(listing.depositAmount)} {listing.currency}</p>}
        <p className="mt-3 text-sm text-muted">{t('rental.leaseDuration')}: {listing.minimumLeaseMonths ?? '—'} – {listing.maximumLeaseMonths ?? '—'} {t('rental.months')}</p>
        <div className="my-5 border-t border-line pt-4"><h2 className="font-bold">{t('rental.documents')}</h2>
          {requirements.length === 0 ? <p className="mt-2 text-sm text-muted">{t('rental.noDocumentRequirements')}</p> : <ul className="mt-3 space-y-2 text-sm">{requirements.map((r, i) => <li key={`${r.kind}-${i}`} className="flex gap-2"><FileText className="w-4 h-4 mt-0.5 shrink-0 text-leaf" /><span>{r.label}{r.isRequired ? ` · ${t('rental.required')}` : ` · ${t('rental.optional')}`}<small className="block text-muted">{t(`rental.scope.${camel(r.applicantScope)}`)}</small></span></li>)}</ul>}
        </div>
        <Alert tone="info">{t('rental.approvalDisclaimer')}</Alert>
        <Link className="btn btn-primary w-full mt-4" to={user ? lp(`/rental-apply/${listing.id}`) : lp('/login')}>{user ? t('rental.apply') : t('rental.loginToApply')}</Link>
      </aside>
    </div>
  </section>;
};

const ApplicantGuard: React.FC = () => {
  const user = useCurrentUser();
  const lp = useLocalePath();
  const [checked, setChecked] = useState(false);
  useEffect(() => { void authService.refreshRole().finally(() => setChecked(true)); }, []);
  if (!user) return <Navigate to={lp('/login')} replace />;
  if (user.isAdmin) return <Navigate to={lp('/admin')} replace />;
  if (!authService.hasBackendSession()) return <Navigate to={lp('/login')} replace />;
  if (!checked) return <div className="container-x py-16"><div className="skeleton h-40 rounded-2xl" /></div>;
  return <Outlet />;
};

export const ApplicantHomePage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const user = useCurrentUser();
  return <section className="container-x py-10 sm:py-14 max-w-5xl">
    <PageHeading title={t('rental.applicantCabinet')} text={t('rental.applicantCabinetIntro')} action={<button className="btn btn-outline" type="button" onClick={() => { authService.logout(); window.location.assign(lp('/login')); }}><LogOut className="w-4 h-4" />{t('rental.logout')}</button>} />
    <p className="mb-5 text-sm text-muted">{user?.fullName} · {user?.email}</p>
    <div className="grid gap-4 sm:grid-cols-2"><Link to={lp('/applicant/profile')} className="card p-6 hover:shadow-[var(--shadow-lift)]"><ShieldCheck className="w-6 h-6 text-leaf" /><h2 className="mt-4 font-display text-2xl text-brand">{t('rental.profile')}</h2><p className="mt-2 text-sm text-muted">{t('rental.profileIntro')}</p></Link><Link to={lp('/applicant/applications')} className="card p-6 hover:shadow-[var(--shadow-lift)]"><FileText className="w-6 h-6 text-leaf" /><h2 className="mt-4 font-display text-2xl text-brand">{t('rental.myApplications')}</h2><p className="mt-2 text-sm text-muted">{t('rental.applicationsIntro')}</p></Link></div>
    <Link to={lp('/rentals')} className="btn btn-primary mt-6">{t('rental.browse')}<ArrowRight className="w-4 h-4" /></Link>
  </section>;
};

export const ApplicantProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const user = useCurrentUser();
  const toast = useToast();
  const [form, setForm] = useState<ApplicantProfileInput>({ ...EMPTY_PROFILE, contactEmail: user?.email ?? '', contactPhone: user?.phone ?? '' });
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void backend<ApplicantProfile | null>('GET', '/applicant/profile').then(p => { if (p) setForm({ ...EMPTY_PROFILE, ...p, consentToProcess: true }); }).catch((e: BackendError) => setError(e.message || t('rental.loadError'))).finally(() => setBusy(false)); }, [t]);
  const set = (key: keyof ApplicantProfileInput, value: string | boolean | null) => setForm(f => ({ ...f, [key]: value }));
  const entity = isEntity(form.applicantType, form.foreignKind);
  const individual = form.applicantType === 'INDIVIDUAL' || isForeignIndividual(form.applicantType, form.foreignKind);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try { const saved = await backend<ApplicantProfile>('POST', '/applicant/profile', form); setForm({ ...EMPTY_PROFILE, ...saved, consentToProcess: true }); toast(t('rental.profileSaved')); }
    catch (x) { setError(x instanceof BackendError ? x.message || t('rental.checkFields') : t('rental.checkFields')); }
    finally { setSaving(false); }
  };
  if (busy) return <section className="container-x py-12"><div className="skeleton h-96 rounded-2xl" /></section>;
  return <section className="container-x py-10 max-w-4xl">
    <PageHeading title={t('rental.profile')} text={t('rental.profileIntro')} action={<Link className="btn btn-outline" to={lp('/applicant')}>{t('rental.back')}</Link>} />
    {error && <Alert>{error}</Alert>}
    <form onSubmit={submit} className="card mt-5 p-5 sm:p-8 space-y-5">
      <SelectInput label={t('rental.applicantType')} required value={form.applicantType} onChange={e => { set('applicantType', e.target.value as ApplicantType); set('foreignKind', e.target.value === 'FOREIGN_APPLICANT' ? (form.foreignKind ?? 'INDIVIDUAL') : null); }}>
        <option value="INDIVIDUAL">{t('rental.typeIndividual')}</option><option value="LEGAL_ENTITY">{t('rental.typeEntity')}</option><option value="FOREIGN_APPLICANT">{t('rental.typeForeign')}</option>
      </SelectInput>
      {form.applicantType === 'FOREIGN_APPLICANT' && <SelectInput label={t('rental.foreignSubtype')} required value={form.foreignKind ?? 'INDIVIDUAL'} onChange={e => set('foreignKind', e.target.value as ForeignKind)}><option value="INDIVIDUAL">{t('rental.typeForeignIndividual')}</option><option value="LEGAL_ENTITY">{t('rental.typeForeignEntity')}</option></SelectInput>}
      {individual && <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label={t('rental.fullLegalName')} required value={form.fullLegalName} onChange={e => set('fullLegalName', e.target.value)} />
        <TextInput label={t('rental.citizenship')} required={isForeignIndividual(form.applicantType, form.foreignKind)} value={form.citizenship} onChange={e => set('citizenship', e.target.value)} />
        <TextInput label={t('rental.countryOfResidence')} required={isForeignIndividual(form.applicantType, form.foreignKind)} value={form.countryOfResidence} onChange={e => set('countryOfResidence', e.target.value)} />
        <TextInput label={t('rental.residenceAddress')} value={form.residenceAddress} onChange={e => set('residenceAddress', e.target.value)} />
        <TextInput label={t('rental.idType')} value={form.idDocumentType} onChange={e => set('idDocumentType', e.target.value)} />
        <TextInput label={t('rental.idNumber')} value={form.idDocumentNumber} onChange={e => set('idDocumentNumber', e.target.value)} />
        {form.applicantType === 'INDIVIDUAL' && <TextInput label={t('rental.finOptional')} hint={t('rental.optionalNoFin')} value={form.fin} onChange={e => set('fin', e.target.value)} />}
      </div>}
      {entity && <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label={t('rental.legalName')} required value={form.legalName} onChange={e => set('legalName', e.target.value)} />
        <TextInput label={t('rental.legalForm')} required value={form.legalForm} onChange={e => set('legalForm', e.target.value)} />
        <TextInput label={t('rental.countryOfIncorporation')} required value={form.countryOfIncorporation} onChange={e => set('countryOfIncorporation', e.target.value)} />
        <TextInput label={t('rental.registrationIdentifier')} required value={form.registrationIdentifier} onChange={e => set('registrationIdentifier', e.target.value)} />
        <TextInput label={t('rental.taxIdentifierOptional')} hint={t('rental.optionalNoTaxId')} value={form.taxIdentifier} onChange={e => set('taxIdentifier', e.target.value)} />
        <TextInput label={t('rental.registeredAddress')} value={form.registeredAddress} onChange={e => set('registeredAddress', e.target.value)} />
        <TextInput label={t('rental.representative')} required value={form.representativeName} onChange={e => set('representativeName', e.target.value)} />
        <TextInput label={t('rental.representativePosition')} required value={form.representativePosition} onChange={e => set('representativePosition', e.target.value)} />
        <TextInput label={t('rental.authorityToAct')} required value={form.authorityToAct} onChange={e => set('authorityToAct', e.target.value)} />
      </div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label={t('rental.contactPhone')} type="tel" required hint={t('rental.internationalPhone')} value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
        <TextInput label={t('rental.contactEmail')} type="email" required value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
        <TextInput label={t('rental.contactAddress')} value={form.contactAddress} onChange={e => set('contactAddress', e.target.value)} />
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-sage/60 p-4 text-sm"><input type="checkbox" checked={form.consentToProcess} required onChange={e => set('consentToProcess', e.target.checked)} className="mt-1 h-4 w-4 accent-brand" /><span>{t('rental.consent')}</span></label>
      <div className="flex flex-wrap gap-3"><button disabled={saving} className="btn btn-primary" type="submit">{saving ? t('rental.saving') : t('rental.saveProfile')}</button><Link className="btn btn-outline" to={lp('/applicant/applications')}>{t('rental.myApplications')}</Link></div>
    </form>
  </section>;
};

export const ApplicantApplicationsPage: React.FC = () => {
  const { t } = useTranslation(); const lp = useLocalePath(); const f = useFormat();
  const [rows, setRows] = useState<RentalApplication[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { void backend<RentalApplication[]>('GET', '/rental-applications').then(setRows).catch((e: BackendError) => { setRows([]); setError(e.message || t('rental.loadError')); }); }, [t]);
  return <section className="container-x py-10 max-w-5xl"><PageHeading title={t('rental.myApplications')} text={t('rental.applicationsIntro')} action={<Link className="btn btn-outline" to={lp('/applicant')}>{t('rental.back')}</Link>} />
    {error && <Alert>{error}</Alert>}{rows === null ? <div className="skeleton h-56 rounded-2xl" /> : rows.length === 0 ? <div className="card p-8 text-center"><p className="text-muted">{t('rental.noApplications')}</p><Link className="btn btn-primary mt-4" to={lp('/rentals')}>{t('rental.browse')}</Link></div> : <ul className="space-y-3">{rows.map(a => <li key={a.id}><Link to={lp(`/applicant/applications/${a.id}`)} className="card p-4 sm:p-5 flex flex-col gap-2 sm:flex-row sm:items-center hover:shadow-[var(--shadow-lift)]"><div className="flex-1"><span className="text-xs text-muted">{a.referenceNumber} · {f.date(a.createdAt)}</span><h2 className="font-display text-xl text-brand">{a.listingTitle}</h2></div><span className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-brand">{t(`rental.status.${camel(a.status)}`)}</span><span className="text-sm font-bold text-brand">{t('rental.details')} →</span></Link></li>)}</ul>}</section>;
};

export const NewRentalApplicationPage: React.FC = () => {
  const { listingId = '' } = useParams(); const { t } = useTranslation(); const lp = useLocalePath(); const navigate = useNavigate(); const toast = useToast();
  const [listing, setListing] = useState<RentalListing | null>(null); const [profile, setProfile] = useState<ApplicantProfile | null>(null); const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [intendedUse, setIntendedUse] = useState(''); const [months, setMonths] = useState(''); const [message, setMessage] = useState(''); const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [draftId, setDraftId] = useState<string | null>(null);
  useEffect(() => { void Promise.all([backend<RentalListing>('GET', `/rentals/${encodeURIComponent(listingId)}`), backend<ApplicantProfile | null>('GET', '/applicant/profile')]).then(([l, p]) => { setListing(l); setProfile(p); }).catch((e: BackendError) => setError(e.message || t('rental.loadError'))); }, [listingId, t]);
  const requirements = useMemo(() => requirementsForApplicant(listing?.documentRequirements ?? [], profile), [listing, profile]);
  const submit = async () => {
    if (!listing) return;
    const missing = missingRequiredDocuments(requirements, Object.keys(files).filter(kind => files[kind]));
    if (missing.length) { setError(`${t('rental.missingDocuments')}: ${missing.map(x => x.label).join(', ')}`); return; }
    setBusy(true); setError('');
    try {
      const app = draftId ? { id: draftId } : await backend<RentalApplication>('POST', '/rental-applications', { listingId, intendedUse, proposedLeaseMonths: months ? Number(months) : null, message });
      if (!draftId) setDraftId(app.id);
      const form = new FormData();
      Object.entries(files).forEach(([kind, file]) => { if (file) { form.append('documents', file); form.append('kinds', kind); } });
      if (Object.keys(files).some(k => files[k])) await backend('POST', `/rental-applications/${app.id}/documents`, form);
      await backend('POST', `/rental-applications/${app.id}/submit`);
      toast(t('rental.applicationSubmitted')); navigate(lp(`/applicant/applications/${app.id}`));
    } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.submitError') : t('rental.submitError')); }
    finally { setBusy(false); }
  };
  if (!profile) return <section className="container-x py-12 max-w-3xl">{error && <Alert>{error}</Alert>}<div className="card p-7"><h1 className="font-display text-3xl text-brand">{t('rental.profileRequired')}</h1><p className="mt-3 text-muted">{t('rental.profileIntro')}</p><Link className="btn btn-primary mt-5" to={lp('/applicant/profile')}>{t('rental.completeProfile')}</Link></div></section>;
  if (!listing) return <section className="container-x py-12"><div className="skeleton h-80 rounded-2xl" />{error && <Alert>{error}</Alert>}</section>;
  return <section className="container-x py-10 max-w-3xl"><PageHeading title={t('rental.newApplication')} text={listing.title} action={<Link to={lp(`/rentals/${listing.id}`)} className="btn btn-outline">{t('rental.back')}</Link>} />
    {error && <Alert>{error}</Alert>}
    <div className="card p-5 sm:p-7 space-y-5">
      {step === 'edit' ? <>
        <div className="rounded-xl bg-sage p-4"><p className="font-bold">{t('rental.applicantType')}: {t(`rental.type${profile.applicantType === 'INDIVIDUAL' ? 'Individual' : profile.applicantType === 'LEGAL_ENTITY' ? 'Entity' : 'Foreign'}`)}</p>{profile.applicantType === 'FOREIGN_APPLICANT' && <p className="text-sm text-muted">{t(profile.foreignKind === 'LEGAL_ENTITY' ? 'rental.typeForeignEntity' : 'rental.typeForeignIndividual')}</p>}<Link className="text-sm underline font-semibold" to={lp('/applicant/profile')}>{t('rental.editProfile')}</Link></div>
        <TextArea label={t('rental.intendedUse')} required rows={3} value={intendedUse} onChange={e => setIntendedUse(e.target.value)} />
        <TextInput label={t('rental.proposedDuration')} type="number" min={listing.minimumLeaseMonths ?? 1} max={listing.maximumLeaseMonths ?? undefined} value={months} onChange={e => setMonths(e.target.value)} hint={`${listing.minimumLeaseMonths ?? '—'} – ${listing.maximumLeaseMonths ?? '—'} ${t('rental.months')}`} />
        <TextArea label={t('rental.messageOptional')} rows={3} value={message} onChange={e => setMessage(e.target.value)} />
        {requirements.length > 0 && <div><h2 className="font-bold">{t('rental.documents')}</h2><div className="mt-3 space-y-3">{requirements.map((r, i) => <label key={`${r.kind}-${i}`} className="block rounded-xl border border-line p-4 text-sm"><span className="font-bold">{r.label} {r.isRequired ? <em className="not-italic text-danger">· {t('rental.required')}</em> : <em className="not-italic text-muted">· {t('rental.optional')}</em>}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFiles(v => ({ ...v, [r.kind]: e.target.files?.[0] }))} className="mt-2 block w-full text-sm" /></label>)}</div><p className="mt-2 text-xs text-muted">{t('rental.privateDocuments')}</p></div>}
        <button type="button" disabled={!intendedUse.trim()} onClick={() => { setError(''); setStep('review'); }} className="btn btn-primary">{t('rental.reviewApplication')}<ArrowRight className="w-4 h-4" /></button>
      </> : <>
        <h2 className="font-display text-2xl text-brand">{t('rental.reviewTitle')}</h2><p><b>{t('rental.listing')}:</b> {listing.title}</p><p><b>{t('rental.applicant')}:</b> {profile.fullLegalName || profile.legalName}</p><p><b>{t('rental.intendedUse')}:</b> {intendedUse}</p>{months && <p><b>{t('rental.proposedDuration')}:</b> {months} {t('rental.months')}</p>}
        <ul className="space-y-1 text-sm">{Object.entries(files).filter(([, file]) => file).map(([kind, file]) => <li key={kind}>• {file!.name}</li>)}</ul><Alert tone="info">{t('rental.approvalDisclaimer')}</Alert>
        <div className="flex flex-wrap gap-3"><button disabled={busy} type="button" onClick={submit} className="btn btn-primary">{busy ? t('rental.submitting') : t('rental.submitApplication')}</button><button type="button" onClick={() => setStep('edit')} className="btn btn-outline">{t('rental.backToEdit')}</button></div>
      </>}
    </div>
  </section>;
};

export const RentalApplicationDetailPage: React.FC = () => {
  const { id = '' } = useParams(); const { t } = useTranslation(); const lp = useLocalePath(); const toast = useToast();
  const [item, setItem] = useState<RentalApplication | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [files, setFiles] = useState<Record<string, File | undefined>>({}); const [response, setResponse] = useState('');
  const load = () => backend<RentalApplication>('GET', `/rental-applications/${encodeURIComponent(id)}`).then(setItem).catch((e: BackendError) => setError(e.message || t('rental.loadError')));
  useEffect(() => { void load(); }, [id]);
  const requirements = requirementsForApplicant(item?.requirements ?? [], item?.applicantProfile ?? null);
  const addInfo = async () => {
    if (!item) return;
    setBusy(true); setError('');
    try { const form = new FormData(); form.append('response', response); Object.entries(files).forEach(([kind, file]) => { if (file) { form.append('documents', file); form.append('kinds', kind); } }); await backend('POST', `/rental-applications/${item.id}/documents`, form); const updated = await backend<RentalApplication>('POST', `/rental-applications/${item.id}/submit`); setItem(updated); setFiles({}); setResponse(''); toast(t('rental.additionalSubmitted')); }
    catch (e) { setError(e instanceof BackendError ? e.message || t('rental.submitError') : t('rental.submitError')); }
    finally { setBusy(false); }
  };
  if (!item) return <section className="container-x py-12 max-w-4xl">{error && <Alert>{error}</Alert>}<div className="skeleton h-80 rounded-2xl" /></section>;
  return <section className="container-x py-10 max-w-4xl"><PageHeading title={item.listingTitle} text={`${item.referenceNumber} · ${t(`rental.status.${camel(item.status)}`)}`} action={<Link className="btn btn-outline" to={lp('/applicant/applications')}>{t('rental.back')}</Link>} />
    {error && <Alert>{error}</Alert>}{item.decisionReason && <Alert tone={item.status === 'REJECTED' ? 'error' : 'info'}>{item.decisionReason}</Alert>}
    <div className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><h2 className="font-bold">{t('rental.applicationDetails')}</h2><p className="mt-3"><b>{t('rental.intendedUse')}:</b> {item.intendedUse}</p>{item.proposedLeaseMonths && <p className="mt-2"><b>{t('rental.proposedDuration')}:</b> {item.proposedLeaseMonths} {t('rental.months')}</p>}<p className="mt-2 text-sm text-muted">{item.message}</p><h3 className="mt-5 font-bold">{t('rental.documents')}</h3>{item.documents.length ? <ul className="mt-2 space-y-2">{item.documents.map(d => <li key={d.id}><a href={d.url} className="flex gap-2 text-sm text-brand underline"><FileText className="w-4 h-4" />{d.fileName}</a></li>)}</ul> : <p className="mt-2 text-sm text-muted">{t('rental.noDocumentsUploaded')}</p>}</div>
      <div className="card p-5"><h2 className="font-bold">{t('rental.submittedProfile')}</h2>{item.applicantProfile ? <dl className="mt-3 space-y-2 text-sm">{Object.entries({ [t('rental.applicantType')]: item.applicantProfile.applicantType, [t('rental.fullLegalName')]: item.applicantProfile.fullLegalName || item.applicantProfile.legalName, [t('rental.countryOfIncorporation')]: item.applicantProfile.countryOfIncorporation, [t('rental.registrationIdentifier')]: item.applicantProfile.registrationIdentifier, [t('rental.contactEmail')]: item.applicantProfile.contactEmail, [t('rental.contactPhone')]: item.applicantProfile.contactPhone }).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-semibold break-words">{v}</dd></div>)}</dl> : <p className="mt-2 text-sm text-muted">{t('rental.profileSnapshotPending')}</p>}</div></div>
    <div className="card mt-5 p-5"><h2 className="font-bold">{t('rental.statusHistory')}</h2><ol className="mt-4 space-y-3">{item.history.map((h, i) => <li key={`${h.createdAt}-${i}`} className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-leaf shrink-0" /><div><p className="font-semibold">{t(`rental.status.${camel(h.status)}`)}</p><p className="text-sm text-muted">{h.comment}</p></div></li>)}</ol></div>
    {item.status === 'ADDITIONAL_INFORMATION_REQUIRED' && <div className="card mt-5 p-5"><h2 className="font-bold">{t('rental.sendAdditionalInfo')}</h2><TextArea label={t('rental.additionalResponse')} rows={3} value={response} onChange={e => setResponse(e.target.value)} /><div className="mt-3 space-y-3">{requirements.map((r, i) => <label key={`${r.kind}-${i}`} className="block rounded-xl border border-line p-4 text-sm"><span className="font-bold">{r.label}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFiles(v => ({ ...v, [r.kind]: e.target.files?.[0] }))} className="mt-2 block w-full text-sm" /></label>)}</div><button disabled={busy || (!response.trim() && !Object.values(files).some(Boolean))} className="btn btn-primary mt-4" type="button" onClick={addInfo}>{busy ? t('rental.submitting') : t('rental.sendAdditionalInfo')}</button></div>}
  </section>;
};

export const RentalApplicantLayout: React.FC = () => <ApplicantGuard />;

export const AdminRentalListingsPage: React.FC = () => {
  const { t } = useTranslation(); const lp = useLocalePath(); const [rows, setRows] = useState<RentalListing[] | null>(null); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const load = () => backend<RentalListing[]>("GET", `/admin/rentals${status ? `?status=${status}` : ''}`).then(setRows).catch((e: BackendError) => { setRows([]); setError(e.message || t('rental.loadError')); });
  useEffect(() => { void load(); }, [status]);
  const act = async (id: string, action: string) => { try { const reason = action === 'withdraw' ? window.prompt(t('rental.withdrawReason')) : null; if (action === 'withdraw' && !reason) return; await backend('POST', `/admin/rentals/${id}/${action}`, action === 'withdraw' ? { reason } : undefined); await load(); } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.actionError') : t('rental.actionError')); } };
  return <section><PageHeading title={t('rental.adminListings')} text={t('rental.adminListingsIntro')} action={<Link to={lp('/admin/rentals/new')} className="btn btn-primary"><Plus className="w-4 h-4" />{t('rental.createListing')}</Link>} />
    {error && <Alert>{error}</Alert>}<div className="mb-5 flex flex-wrap gap-2">{['', 'DRAFT', 'PUBLISHED', 'WITHDRAWN', 'ARCHIVED'].map(s => <button key={s || 'all'} onClick={() => setStatus(s)} className={`rounded-full px-4 py-2 text-sm font-bold ${status === s ? 'bg-brand text-white' : 'bg-white border border-line'}`}>{s ? t(`rental.listingStatus.${camel(s)}`) : t('rental.all')}</button>)}</div>
    {rows === null ? <div className="skeleton h-56 rounded-2xl" /> : rows.length === 0 ? <div className="card p-7 text-center text-muted">{t('rental.noListings')}</div> : <div className="space-y-3">{rows.map(x => <article key={x.id} className="card p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex-1"><span className="text-xs text-muted">{t(`rental.listingStatus.${camel(x.status)}`)} · {t(`rental.ownerCategory.${camel(x.ownerCategory)}`)}</span><h2 className="font-display text-xl text-brand">{x.title}</h2><p className="text-sm text-muted">{x.region} · {x.area} {x.areaUnit} · {x.rentAmount} {x.currency}</p></div><Link to={lp(`/admin/rentals/${x.id}`)} className="btn btn-outline btn-sm">{t('rental.edit')}</Link>{x.status === 'DRAFT' && <button className="btn btn-primary btn-sm" onClick={() => void act(x.id, 'publish')}>{t('rental.publish')}</button>}{x.status === 'PUBLISHED' && <button className="btn btn-outline btn-sm" onClick={() => void act(x.id, 'withdraw')}>{t('rental.withdraw')}</button>}</article>)}</div>}
  </section>;
};

export const AdminRentalListingEditorPage: React.FC = () => {
  const { id } = useParams(); const { t } = useTranslation(); const lp = useLocalePath(); const toast = useToast(); const navigate = useNavigate();
  const [form, setForm] = useState<ListingInput>(EMPTY_LISTING); const [requirementText, setRequirementText] = useState('');
  const [listing, setListing] = useState<RentalListing | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) void backend<RentalListing>('GET', `/admin/rentals/${id}`).then(x => { setListing(x); setForm({ ...EMPTY_LISTING, ...x, authorityBasis: x.authorityBasis ?? '', authorityReference: x.authorityReference ?? '', authorityReviewed: x.authorityReviewed ?? false, documentRequirements: x.documentRequirements }); setRequirementText(x.documentRequirements.map(r => `${r.applicantScope}|${r.kind}|${r.label}|${r.isRequired ? 'required' : 'optional'}`).join('\n')); }).catch((e: BackendError) => setError(e.message || t('rental.loadError'))); }, [id, t]);
  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => setForm(f => ({ ...f, [key]: value }));
  const requirements = () => parseDocumentRequirements(requirementText);
  const save = async () => { setBusy(true); setError(''); try { const payload = { ...form, documentRequirements: requirements() }; const result = await backend<RentalListing>('POST', id ? `/admin/rentals/${id}` : '/admin/rentals', payload); setListing(result); toast(t('rental.draftSaved')); if (!id) navigate(lp(`/admin/rentals/${result.id}`), { replace: true }); } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.actionError') : t('rental.actionError')); } finally { setBusy(false); } };
  const upload = async (file?: File) => { if (!file || !listing) return; setBusy(true); const body = new FormData(); body.append('kind', 'authority'); body.append('documents', file); try { const result = await backend('POST', `/admin/rentals/${listing.id}/documents`, body); toast(t('rental.documentUploaded')); const refreshed = await backend<RentalListing>('GET', `/admin/rentals/${listing.id}`); setListing(refreshed); } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.actionError') : t('rental.actionError')); } finally { setBusy(false); } };
  const publish = async () => { if (!listing) return; setBusy(true); try { const result = await backend<RentalListing>('POST', `/admin/rentals/${listing.id}/publish`); setListing(result); toast(t('rental.published')); } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.actionError') : t('rental.actionError')); } finally { setBusy(false); } };
  const field = (key: keyof ListingInput, value: string | number | boolean | null | string[]) => set(key as keyof ListingInput, value as never);
  return <section className="container-x py-10 max-w-5xl"><PageHeading title={id ? t('rental.editListing') : t('rental.createListing')} text={t('rental.adminListingDisclaimer')} action={<Link to={lp('/admin')} className="btn btn-outline">{t('rental.back')}</Link>} />
    {error && <Alert>{error}</Alert>}<div className="card p-5 sm:p-7 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label={t('rental.propertyType')} required value={form.propertyType} onChange={e => field('propertyType', e.target.value)}><option value="LAND">{t('rental.land')}</option><option value="BUSINESS_PROPERTY">{t('rental.businessProperty')}</option></SelectInput>
        <SelectInput label={t('rental.ownerCategory')} required value={form.ownerCategory} onChange={e => field('ownerCategory', e.target.value)}><option value="PRIVATE">{t('rental.ownerCategory.private')}</option><option value="MUNICIPAL">{t('rental.ownerCategory.municipal')}</option><option value="STATE">{t('rental.ownerCategory.state')}</option></SelectInput>
        <TextInput label={t('rental.title')} required value={form.title} onChange={e => field('title', e.target.value)} />
        <TextInput label={t('rental.region')} required value={form.region} onChange={e => field('region', e.target.value)} />
        <TextInput label={t('rental.legalDesignation')} required value={form.legalDesignation} onChange={e => field('legalDesignation', e.target.value)} />
        <TextInput label={t('rental.address')} required value={form.address} onChange={e => field('address', e.target.value)} />
        <TextInput label={t('rental.area')} type="number" min="0.01" step="any" required value={String(form.area || '')} onChange={e => field('area', Number(e.target.value))} />
        <SelectInput label={t('rental.areaUnitLabel')} required value={form.areaUnit} onChange={e => field('areaUnit', e.target.value)}><option value="ha">ha</option><option value="m2">m²</option></SelectInput>
        <TextInput label={t('rental.rent')} type="number" min="0.01" step="any" required value={String(form.rentAmount || '')} onChange={e => field('rentAmount', Number(e.target.value))} />
        <div className="grid grid-cols-2 gap-3"><SelectInput label={t('rental.currency')} required value={form.currency} onChange={e => field('currency', e.target.value)}><option>AZN</option><option>USD</option><option>EUR</option></SelectInput><SelectInput label={t('rental.paymentPeriod')} required value={form.paymentPeriod} onChange={e => field('paymentPeriod', e.target.value)}><option value="month">{t('rental.period.month')}</option><option value="year">{t('rental.period.year')}</option><option value="day">{t('rental.period.day')}</option></SelectInput></div>
        <TextInput label={t('rental.minimumLease')} type="number" min="1" value={form.minimumLeaseMonths ?? ''} onChange={e => field('minimumLeaseMonths', e.target.value ? Number(e.target.value) : null)} />
        <TextInput label={t('rental.maximumLease')} type="number" min="1" value={form.maximumLeaseMonths ?? ''} onChange={e => field('maximumLeaseMonths', e.target.value ? Number(e.target.value) : null)} />
        <TextInput label={t('rental.deposit')} type="number" min="0" step="any" value={form.depositAmount ?? ''} onChange={e => field('depositAmount', e.target.value ? Number(e.target.value) : null)} />
        <SelectInput label={t('rental.externalProcedure')} required value={form.procedure} onChange={e => field('procedure', e.target.value)}><option value="LEGAL_REVIEW_REQUIRED">{t('rental.procedure.legalReviewRequired')}</option><option value="DIRECT">{t('rental.procedure.direct')}</option><option value="AUCTION">{t('rental.procedure.auction')}</option><option value="TENDER">{t('rental.procedure.tender')}</option><option value="INVESTMENT_COMPETITION">{t('rental.procedure.investmentCompetition')}</option><option value="EXTERNAL_PROCEDURE">{t('rental.procedure.externalProcedure')}</option></SelectInput>
      </div>
      <TextArea label={t('rental.description')} rows={4} required value={form.description} onChange={e => field('description', e.target.value)} />
      <TextArea label={t('rental.permittedUse')} rows={2} required value={form.permittedUse} onChange={e => field('permittedUse', e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2"><TextInput label={t('rental.authorityBasis')} required value={form.authorityBasis} onChange={e => field('authorityBasis', e.target.value)} /><TextInput label={t('rental.authorityReference')} required value={form.authorityReference} onChange={e => field('authorityReference', e.target.value)} /><TextInput label={t('rental.procedureReference')} value={form.procedureReference} onChange={e => field('procedureReference', e.target.value)} /><TextInput label={t('rental.photoUrls')} hint={t('rental.photoUrlsHint')} value={form.photoUrls.join(', ')} onChange={e => field('photoUrls', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} /></div>
      <TextArea label={t('rental.procedureNotes')} rows={2} value={form.procedureNotes} onChange={e => field('procedureNotes', e.target.value)} />
      <TextArea label={t('rental.eligibility')} rows={3} value={form.eligibilityRules} onChange={e => field('eligibilityRules', e.target.value)} />
      <TextArea label={t('rental.infrastructure')} rows={2} value={form.infrastructure} onChange={e => field('infrastructure', e.target.value)} />
      <TextArea label={t('rental.additionalCharges')} rows={2} value={form.additionalCharges} onChange={e => field('additionalCharges', e.target.value)} />
      <TextArea label={t('rental.documentRuleEditor')} rows={8} value={requirementText} onChange={e => setRequirementText(e.target.value)} hint={t('rental.documentRuleFormat')} />
      <label className="flex gap-3 rounded-xl bg-[#FBF6E9] p-4 text-sm"><input type="checkbox" checked={form.authorityReviewed} onChange={e => field('authorityReviewed', e.target.checked)} className="mt-1 h-4 w-4 accent-brand" /><span>{t('rental.authorityReviewed')}</span></label>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={save} className="btn btn-primary">{busy ? t('rental.saving') : t('rental.saveDraft')}</button>{listing && listing.status !== 'PUBLISHED' && <button type="button" disabled={busy} onClick={publish} className="btn btn-outline">{t('rental.publish')}</button>}</div>
      {listing && <div className="border-t border-line pt-5"><h2 className="font-bold">{t('rental.authorityDocuments')}</h2><label className="mt-3 block text-sm">{t('rental.uploadAuthority')}<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => void upload(e.target.files?.[0])} className="mt-2 block w-full" /></label><ul className="mt-3 space-y-2">{listing.documents?.map(d => <li key={d.id}><a href={d.url} className="text-sm text-brand underline">{d.kind}: {d.fileName}</a></li>)}</ul></div>}
    </div>
  </section>;
};

export const AdminRentalApplicationsPage: React.FC = () => {
  const { t } = useTranslation(); const lp = useLocalePath(); const [rows, setRows] = useState<RentalApplication[] | null>(null); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  useEffect(() => { void backend<RentalApplication[]>('GET', `/admin/rental-applications${status ? `?status=${status}` : ''}`).then(setRows).catch((e: BackendError) => { setRows([]); setError(e.message || t('rental.loadError')); }); }, [status, t]);
  return <section className="container-x py-10 max-w-5xl"><PageHeading title={t('rental.adminApplications')} text={t('rental.adminApplicationsIntro')} />{error && <Alert>{error}</Alert>}
    <div className="mb-5 flex flex-wrap gap-2">{['', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN'].map(s => <button key={s || 'all'} onClick={() => setStatus(s)} className={`rounded-full px-3 py-2 text-sm font-bold ${status === s ? 'bg-brand text-white' : 'bg-white border border-line'}`}>{s ? t(`rental.status.${camel(s)}`) : t('rental.all')}</button>)}</div>
    {rows === null ? <div className="skeleton h-56 rounded-2xl" /> : rows.length === 0 ? <div className="card p-7 text-center text-muted">{t('rental.noApplications')}</div> : <div className="space-y-3">{rows.map(x => <Link key={x.id} to={lp(`/admin/applications/${x.id}`)} className="card p-4 sm:p-5 flex flex-col gap-2 sm:flex-row sm:items-center hover:shadow-[var(--shadow-lift)]"><div className="flex-1"><span className="text-xs text-muted">{x.referenceNumber}</span><h2 className="font-display text-xl text-brand">{x.listingTitle}</h2><p className="text-sm text-muted">{x.applicantProfile?.fullLegalName || x.applicantProfile?.legalName || t('rental.applicant')}</p></div><span className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-brand">{t(`rental.status.${camel(x.status)}`)}</span><span className="font-bold text-brand">{t('rental.details')} →</span></Link>)}</div>}
  </section>;
};

export const AdminRentalApplicationDetailPage: React.FC = () => {
  const { id = '' } = useParams(); const { t } = useTranslation(); const lp = useLocalePath(); const toast = useToast();
  const [item, setItem] = useState<RentalApplication | null>(null); const [error, setError] = useState(''); const [reason, setReason] = useState(''); const [agreement, setAgreement] = useState(''); const [startsAt, setStartsAt] = useState(''); const [endsAt, setEndsAt] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => backend<RentalApplication>('GET', `/admin/rental-applications/${encodeURIComponent(id)}`).then(setItem).catch((e: BackendError) => setError(e.message || t('rental.loadError')));
  useEffect(() => { void load(); }, [id]);
  const act = async (action: string, body?: unknown) => { setBusy(true); setError(''); try { const x = await backend<RentalApplication>('POST', `/admin/rental-applications/${id}/${action}`, body ?? {}); setItem(x); toast(t('rental.actionSaved')); } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.actionError') : t('rental.actionError')); } finally { setBusy(false); } };
  const finalize = async () => { setBusy(true); setError(''); try { await backend('POST', `/admin/rental-applications/${id}/finalize-lease`, { agreementReference: agreement, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }); toast(t('rental.leaseFinalized')); await load(); } catch (e) { setError(e instanceof BackendError ? e.message || t('rental.actionError') : t('rental.actionError')); } finally { setBusy(false); } };
  if (!item) return <section className="container-x py-12 max-w-5xl">{error && <Alert>{error}</Alert>}<div className="skeleton h-80 rounded-2xl" /></section>;
  const profile = item.applicantProfile;
  return <section className="container-x py-10 max-w-5xl"><PageHeading title={`${item.referenceNumber} · ${item.listingTitle}`} text={t(`rental.status.${camel(item.status)}`)} action={<Link className="btn btn-outline" to={lp('/admin/applications')}>{t('rental.back')}</Link>} />{error && <Alert>{error}</Alert>}
    <div className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><h2 className="font-bold">{t('rental.applicationDetails')}</h2><p className="mt-3"><b>{t('rental.intendedUse')}:</b> {item.intendedUse}</p><p className="mt-2"><b>{t('rental.proposedDuration')}:</b> {item.proposedLeaseMonths ?? '—'} {t('rental.months')}</p><p className="mt-2">{item.message}</p>{item.additionalInformationResponse && <p className="mt-3 rounded-lg bg-sage p-3 text-sm"><b>{t('rental.additionalResponse')}:</b> {item.additionalInformationResponse}</p>}<h3 className="mt-5 font-bold">{t('rental.documents')}</h3><ul className="mt-2 space-y-2">{item.documents.map(d => <li key={d.id}><a href={d.url} className="text-sm text-brand underline">{d.kind}: {d.fileName}</a></li>)}</ul></div>
      <div className="card p-5"><h2 className="font-bold">{t('rental.applicantSnapshot')}</h2>{profile && <dl className="mt-3 space-y-2 text-sm">{Object.entries(profile).filter(([k, v]) => v && !['id', 'updatedAt', 'consentGrantedAt'].includes(k)).map(([k, v]) => <div key={k}><dt className="text-muted">{t(`rental.field.${camel(k)}`, { defaultValue: k })}</dt><dd className="font-semibold break-words">{String(v)}</dd></div>)}</dl>}</div></div>
    <div className="card mt-5 p-5"><TextArea label={t('rental.decisionReason')} rows={3} value={reason} onChange={e => setReason(e.target.value)} /><div className="mt-4 flex flex-wrap gap-2">{canAdminApplicationAction(item.status, 'start-review') && <button disabled={busy} onClick={() => void act('under-review')} className="btn btn-outline">{t('rental.startReview')}</button>}{canAdminApplicationAction(item.status, 'approve') && <><button disabled={busy || !reason.trim()} onClick={() => void act('request-information', { reason })} className="btn btn-outline">{t('rental.requestInformation')}</button><button disabled={busy} onClick={() => void act('approve', { reason })} className="btn btn-primary">{t('rental.approve')}</button><button disabled={busy || !reason.trim()} onClick={() => void act('reject', { reason })} className="btn btn-outline text-danger">{t('rental.reject')}</button></>}</div></div>
    {canAdminApplicationAction(item.status, 'finalize-lease') && <div className="card mt-5 p-5"><h2 className="font-display text-2xl text-brand">{t('rental.finalizeLease')}</h2><p className="mt-2 mb-4 text-sm text-muted">{t('rental.finalizeLeaseHint')}</p><div className="grid gap-4 sm:grid-cols-3"><TextInput label={t('rental.agreementReference')} required value={agreement} onChange={e => setAgreement(e.target.value)} /><TextInput label={t('rental.startsAt')} type="datetime-local" required value={startsAt} onChange={e => setStartsAt(e.target.value)} /><TextInput label={t('rental.endsAt')} type="datetime-local" required value={endsAt} onChange={e => setEndsAt(e.target.value)} /></div><button disabled={busy || !agreement || !startsAt || !endsAt} className="btn btn-primary mt-4" onClick={finalize}>{t('rental.finalizeLease')}</button></div>}
  </section>;
};

export const RentalApplicationRoutes: React.FC = () => <ApplicantGuard />;

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl bg-white border border-line p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-semibold whitespace-pre-line">{value}</p></div>;
function camel(value: string) {
  if (!value.includes('_')) return value.charAt(0).toLowerCase() + value.slice(1);
  return value.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
