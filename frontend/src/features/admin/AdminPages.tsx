import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Archive, ArchiveRestore, CheckCircle2, ChevronRight, CircleSlash, ExternalLink, Eye, FileText, Globe, History, Landmark,
  LayoutGrid, LogOut, Plus, Send, ShieldAlert, ShieldCheck, Trash2, Upload, UserCog, XCircle,
} from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher';
import { useFormat, useLocalePath } from '../../app/i18n';
import { authService, useCurrentUser } from '../../services/api';
import { adminLands, AdminError, type AdminLandDetail, type AdminLandListItem, type AdminOptions, type LandIssue, type LandUseInput, type LandUseType } from '../../services/adminLands';
import { EmptyState, Field, Photo, Tabs } from '../../components/ui/Bits';
import { ConfirmDialog, Modal, useToast } from '../../components/ui/Overlay';
import { PinPicker, polygonAreaHa, type BoundaryPath } from '../../components/map/LandsMap';
import { CATEGORIES } from '../../data/categories';
import { REGIONS, regionByKey } from '../../data/regions';
import { PageTitle, Avatar } from '../cabinet/CabinetShell';
import { LandSearchBar } from '../shared/LandSearch';

/* ======================================================================
 * Ministry (admin) panel: land records and listings.
 * Every action is also checked on the server (Admin policy); this UI only hides what a non-admin cannot do.
 * ====================================================================== */

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-sand text-ink', APPROVED: 'bg-sage text-brand', ARCHIVED: 'bg-[#ECE7DA] text-muted',
  PENDING_REVIEW: 'bg-[#FBF6E9] text-gold-dark', DOCUMENTS_REQUESTED: 'bg-[#FBF6E9] text-gold-dark', REJECTED: 'bg-[#F6E3DF] text-danger',
};
const VERIFY_STYLE: Record<string, string> = {
  ADMIN_ENTERED: 'bg-[#EEF1E8] text-ink', EVIDENCE_PENDING: 'bg-[#FBF6E9] text-gold-dark', VERIFIED: 'bg-sage text-leaf-dark',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[status] ?? 'bg-sand'}`}>{t(`admin.status.${status}`)}</span>;
};
export const VerificationPill: React.FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation();
  const Icon = value === 'VERIFIED' ? ShieldCheck : ShieldAlert;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${VERIFY_STYLE[value] ?? ''}`}><Icon className="w-3.5 h-3.5" aria-hidden="true" />{t(`admin.verification.${value}`)}</span>;
};

/* ---------------- layout + guard ---------------- */

export const AdminShell: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [checked, setChecked] = useState(false);
  useEffect(() => { void authService.refreshRole().finally(() => setChecked(true)); }, []);

  if (!user) return <Navigate to={lp('/login')} replace />;
  if (!user.isAdmin || !authService.hasBackendSession()) {
    if (!checked) return <div className="min-h-[100svh] grid place-items-center bg-cream" aria-busy="true"><div className="skeleton h-10 w-64" /></div>;
    return (
      <div className="min-h-[100svh] grid place-items-center bg-cream px-4">
        <EmptyState icon={<CircleSlash className="w-7 h-7" />} title={t('admin.noAccess')} text={t('admin.noAccessText')}
          action={<Link to={lp('/')} className="btn btn-primary">{t('cabinet.website')}</Link>} />
      </div>
    );
  }

  const nav = [
    { to: lp('/admin'), label: t('admin.nav.lands'), icon: <LayoutGrid className="w-5 h-5" />, end: true },
    { to: lp('/admin/lands/new'), label: t('admin.nav.add'), icon: <Plus className="w-5 h-5" /> },
    { to: lp('/admin/workflow'), label: 'Müraciətlər', icon: <FileText className="w-5 h-5" /> },
  ];
  return (
    <div className="min-h-[100svh] bg-cream">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 h-16 px-4 lg:px-6">
          <Link to={lp('/admin')} className="flex items-center gap-3 min-w-0"><span className="sm:hidden"><Logo compact /></span><span className="hidden sm:inline"><Logo /></span></Link>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-brand text-white"><Landmark className="w-3.5 h-3.5" aria-hidden="true" />{t('admin.badge')}</span>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <Link to={lp('/')} className="hidden sm:inline-flex p-2.5 rounded-full hover:bg-sand" aria-label={t('cabinet.website')} title={t('cabinet.website')}><Globe className="w-5 h-5" /></Link>
            <span className="hidden md:block text-right leading-tight"><span className="block text-sm font-bold">{user.fullName}</span><span className="block text-xs text-muted">{user.email}</span></span>
            <Avatar name={user.fullName} />
            <button type="button" onClick={() => { authService.logout(); navigate(lp('/login')); }} className="p-2.5 rounded-full hover:bg-sand text-danger" aria-label={t('cabinet.logout')} title={t('cabinet.logout')}><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="hidden lg:flex flex-col sticky top-16 h-[calc(100svh-4rem)] w-60 border-r border-line bg-white">
          <nav aria-label={t('admin.badge')} className="flex-1 p-3 flex flex-col gap-1">
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand text-white' : 'text-ink hover:bg-sage'}`}>
                <span aria-hidden="true">{n.icon}</span>{n.label}
              </NavLink>
            ))}
          </nav>
          <p className="p-4 text-xs text-muted border-t border-line">{t('admin.disclaimer')}</p>
        </aside>
        <main id="main" className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-8 pb-28 lg:pb-12">
          <Suspense fallback={<div className="skeleton h-40" />}><Outlet /></Suspense>
        </main>
      </div>
      <nav aria-label={t('admin.badge')} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line grid grid-cols-3">
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${isActive ? 'text-brand' : 'text-muted'}`}>
            <span aria-hidden="true">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

/* ---------------- land list ---------------- */

export const AdminLandsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const [status, setStatus] = useState<'active' | 'draft' | 'approved' | 'archived'>('active');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [rows, setRows] = useState<AdminLandListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const serverStatus = status === 'active' ? '' : status;
    const id = setTimeout(() => {
      adminLands.list(serverStatus, q).then(r => { if (alive) { setRows(r); setError(''); } })
        .catch((x: AdminError) => { if (alive) { setRows([]); setError(x.message || t('auth.errors.server')); } });
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [status, q]);

  const shown = (rows ?? []).filter(r => !type || r.landUse === type);
  const place = (r: AdminLandListItem) => [t(`regions.${r.region}`, { defaultValue: r.region }), r.district, r.settlement].filter(Boolean).join(' · ');

  return (
    <>
      <PageTitle title={t('admin.lands.title')} subtitle={t('admin.lands.subtitle')}
        actions={<Link to={lp('/admin/lands/new')} className="btn btn-primary"><Plus className="w-4 h-4" />{t('admin.nav.add')}</Link>} />
      <LandSearchBar value={q} onChange={setQ} type={type} onTypeChange={setType} className="mb-4" />
      <Tabs label={t('admin.lands.title')} value={status} onChange={setStatus} tabs={[
        { id: 'active', label: t('admin.lands.tabActive') }, { id: 'draft', label: t('admin.status.DRAFT') },
        { id: 'approved', label: t('admin.status.APPROVED') }, { id: 'archived', label: t('admin.status.ARCHIVED') },
      ]} />
      <div className="mt-6">
        {error && <p role="alert" className="mb-4 rounded-xl bg-[#F6E3DF] text-danger px-4 py-3 text-sm font-semibold">{error}</p>}
        {rows === null ? <div className="grid gap-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-20" />)}</div>
          : shown.length === 0 ? <EmptyState title={t('admin.lands.empty')} action={<Link to={lp('/admin/lands/new')} className="btn btn-primary"><Plus className="w-4 h-4" />{t('admin.nav.add')}</Link>} />
          : (
            <ul className="grid gap-3">
              {shown.map(r => (
                <li key={r.id}>
                  <Link to={lp(`/admin/lands/${r.id}`)} className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-[var(--shadow-lift)] transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-1.5"><StatusPill status={r.status} /><VerificationPill value={r.verification} />
                        {r.entrySource === 'ADMIN_ON_BEHALF' && <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold bg-[#EEF1E8]">{t('admin.entry.ADMIN_ON_BEHALF')}</span>}</div>
                      <p className="font-display text-xl text-brand truncate">{r.title}</p>
                      <p className="text-sm text-muted truncate">{place(r)} · {t('land.ha', { n: Math.round(r.areaHectares * 100) / 100 })}{r.landUse ? ` · ${t(`fieldTypes.${r.landUse}`, { defaultValue: r.landUse })}` : ''}</p>
                    </div>
                    <div className="text-xs text-muted sm:text-right shrink-0">
                      <p>{t('admin.lands.updated', { date: f.date(r.updatedAt), name: r.updatedBy ?? '—' })}</p>
                      <p>{r.cadastralNumber ?? (r.cadastralUnavailable ? t('admin.form.cadastralNone') : '—')}</p>
                    </div>
                    <ChevronRight className="hidden sm:block w-5 h-5 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </div>
    </>
  );
};

/* ---------------- form state ---------------- */

interface FormState {
  title: string; landUse: string; intendedUse: string; description: string; entrySource: 'admin' | 'on_behalf'; onBehalfOf: string;
  cadastralNumber: string; cadastralUnavailable: boolean; legalCategory: string; categoryConvertible: '' | 'true' | 'false'; ownershipForm: string;
  hasEncumbrance: '' | 'true' | 'false'; encumbrances: string;
  region: string; district: string; settlement: string; pin: { lat: number; lng: number } | null; boundary: BoundaryPath; areaValue: string; areaUnit: 'ha' | 'sot';
  waterAccess: string; roadAccessType: string; roadDistanceKm: string; settlementDistanceKm: string; currentUse: string; soilQuality: string; waterSupply: string;
  attributes: Record<string, string>; details: Record<string, string>;
  estimatedInvestmentRequirement: string; applicationDeadline: string; eligibilityConditions: string; requiredDocuments: string; adminNotes: string;
}

const EMPTY: FormState = {
  title: '', landUse: '', intendedUse: '', description: '', entrySource: 'admin', onBehalfOf: '',
  cadastralNumber: '', cadastralUnavailable: false, legalCategory: '', categoryConvertible: '', ownershipForm: '', hasEncumbrance: '', encumbrances: '',
  region: '', district: '', settlement: '', pin: null, boundary: [], areaValue: '', areaUnit: 'ha',
  waterAccess: '', roadAccessType: '', roadDistanceKm: '', settlementDistanceKm: '', currentUse: '', soilQuality: '', waterSupply: '',
  attributes: {}, details: {},
  estimatedInvestmentRequirement: '', applicationDeadline: '', eligibilityConditions: '', requiredDocuments: '', adminNotes: '',
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool3 = (v: boolean | null) => (v === null ? '' : v ? 'true' : 'false') as '' | 'true' | 'false';
const toStrings = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, str(v)]));

function fromDetail(d: AdminLandDetail): FormState {
  const x = d.fields;
  const ring = x.boundary?.coordinates?.[0] ?? [];
  const boundary = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring) as BoundaryPath;
  return {
    title: x.title, landUse: x.landUse, intendedUse: x.intendedUse, description: x.description,
    entrySource: x.entrySource === 'ADMIN_ON_BEHALF' ? 'on_behalf' : 'admin', onBehalfOf: str(x.onBehalfOf),
    cadastralNumber: str(x.cadastralNumber), cadastralUnavailable: x.cadastralUnavailable, legalCategory: str(x.legalCategory),
    categoryConvertible: bool3(x.categoryConvertible), ownershipForm: str(x.ownershipForm), hasEncumbrance: bool3(x.hasEncumbrance), encumbrances: str(x.encumbrances),
    region: x.region, district: str(x.district), settlement: str(x.settlement),
    pin: x.latitude || x.longitude ? { lat: x.latitude, lng: x.longitude } : null, boundary,
    areaValue: x.areaHectares ? String(x.areaHectares) : '', areaUnit: 'ha',
    waterAccess: str(x.waterAccess), roadAccessType: str(x.roadAccessType), roadDistanceKm: str(x.roadDistanceKm), settlementDistanceKm: str(x.settlementDistanceKm),
    currentUse: str(x.currentUse), soilQuality: str(x.soilQuality), waterSupply: str(x.waterSupply),
    attributes: toStrings(x.attributes), details: toStrings(x.details),
    estimatedInvestmentRequirement: x.estimatedInvestmentRequirement ? String(x.estimatedInvestmentRequirement) : '',
    applicationDeadline: x.applicationDeadline ? x.applicationDeadline.slice(0, 10) : '',
    eligibilityConditions: x.eligibilityConditions.join('\n'), requiredDocuments: x.requiredDocuments.join('\n'), adminNotes: str(x.adminNotes),
  };
}

/** Typed values for the jsonb objects (numbers and yes/no as JSON, empty values left out). */
function jsonValues(values: Record<string, string>, inputs: LandUseInput[]): string {
  const out: Record<string, unknown> = {};
  for (const input of inputs) {
    const v = (values[input.key] ?? '').trim();
    if (!v) continue;
    out[input.key] = input.kind === 'NUMBER' ? Number(v.replace(',', '.')) : input.kind === 'YES_NO' ? v === 'true' : v;
  }
  return JSON.stringify(out);
}

interface NewFile { id: string; file: File; kind: string }

/* ---------------- editor (create + edit) ---------------- */

export const AdminLandEditor: React.FC = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<AdminLandDetail | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [options, setOptions] = useState<AdminOptions | null>(null);
  const [types, setTypes] = useState<LandUseType[]>([]);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<NewFile[]>([]);
  const [photos, setPhotos] = useState<NewFile[]>([]);
  const [dialog, setDialog] = useState<null | 'publish' | 'unpublish' | 'archive' | 'restore' | 'reassign' | 'verify' | { removeDoc: string } | { removePhoto: string }>(null);
  const [dirty, setDirty] = useState(false);
  const requestId = useRef(crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

  useEffect(() => {
    adminLands.options().then(setOptions).catch(() => setOptions(null));
    adminLands.landUses().then(r => setTypes(r.types)).catch(() => setTypes([]));
  }, []);
  useEffect(() => {
    setErrors({}); setFormError(''); setDocs([]); setPhotos([]); setDirty(false);
    if (isNew) { setDetail(null); setForm(EMPTY); requestId.current = crypto.randomUUID?.() ?? `${Date.now()}`; return; }
    adminLands.get(id!).then(d => { setDetail(d); setForm(fromDetail(d)); setLoadError(''); })
      .catch((x: AdminError) => setLoadError(x.status === 404 ? t('admin.form.notFound') : x.message || t('auth.errors.server')));
  }, [id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm(s => ({ ...s, [k]: v })); setDirty(true); };
  const type = types.find(x => x.key === form.landUse);
  const archived = detail?.record.status === 'ARCHIVED';
  const readOnly = archived;
  const boundaryHa = form.boundary.length >= 3 ? polygonAreaHa(form.boundary) : 0;
  const areaHa = Number(form.areaValue.replace(',', '.')) * (form.areaUnit === 'sot' ? 0.01 : 1);

  const buildForm = (): FormData => {
    const fd = new FormData();
    const add = (k: string, v: string) => fd.append(k, v);
    add('title', form.title); add('landUse', form.landUse); add('intendedUse', form.intendedUse); add('description', form.description);
    add('entrySource', form.entrySource); add('onBehalfOf', form.entrySource === 'on_behalf' ? form.onBehalfOf : '');
    add('cadastralNumber', form.cadastralUnavailable ? '' : form.cadastralNumber); add('cadastralUnavailable', String(form.cadastralUnavailable));
    add('legalCategory', form.legalCategory); add('categoryConvertible', form.categoryConvertible); add('ownershipForm', form.ownershipForm);
    add('hasEncumbrance', form.hasEncumbrance); add('encumbrances', form.hasEncumbrance === 'true' ? form.encumbrances : '');
    add('region', form.region); add('district', form.district); add('settlement', form.settlement);
    add('latitude', form.pin ? String(form.pin.lat) : ''); add('longitude', form.pin ? String(form.pin.lng) : '');
    add('boundary', form.boundary.length >= 3 ? JSON.stringify(form.boundary) : '');
    add('areaValue', form.areaValue.replace(',', '.')); add('areaUnit', form.areaUnit);
    add('waterAccess', form.waterAccess); add('roadAccessType', form.roadAccessType); add('roadDistanceKm', form.roadDistanceKm);
    add('settlementDistanceKm', form.settlementDistanceKm); add('currentUse', form.currentUse); add('soilQuality', form.soilQuality); add('waterSupply', form.waterSupply);
    add('attributes', type ? jsonValues(form.attributes, type.inputs) : '{}');
    add('details', options ? jsonValues(form.details, options.details) : '{}');
    add('estimatedInvestmentRequirement', form.estimatedInvestmentRequirement); add('applicationDeadline', form.applicationDeadline);
    add('eligibilityConditions', form.eligibilityConditions); add('requiredDocuments', form.requiredDocuments); add('adminNotes', form.adminNotes);
    docs.forEach(d => { fd.append('documents', d.file, d.file.name); fd.append('documentKinds', d.kind); });
    photos.forEach(p => fd.append('photos', p.file, p.file.name));
    if (isNew) add('clientRequestId', requestId.current);
    return fd;
  };

  const onError = (x: unknown) => {
    const e = x instanceof AdminError ? x : new AdminError('', 0);
    setErrors(e.fields);
    setFormError(e.status === 0 ? t('auth.errors.server') : e.message || t('form.error'));
    const first = Object.keys(e.fields)[0];
    if (first) document.getElementById(`af-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!form.title.trim()) { setErrors({ title: t('admin.form.titleRequired') }); document.getElementById('af-title')?.scrollIntoView({ block: 'center' }); return; }
    setBusy(true); setErrors({}); setFormError('');
    try {
      const d = isNew ? await adminLands.create(buildForm()) : await adminLands.update(id!, buildForm());
      setDocs([]); setPhotos([]); setDirty(false);
      toast(t('admin.form.saved'));
      if (isNew) navigate(lp(`/admin/lands/${d.land.id}`), { replace: true });
      else { setDetail(d); setForm(fromDetail(d)); }
    } catch (x) { onError(x); } finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<AdminLandDetail>, okText: string) => {
    setBusy(true); setFormError('');
    try { const d = await fn(); setDetail(d); setForm(fromDetail(d)); setDialog(null); toast(okText); }
    catch (x) { if (x instanceof AdminError && x.blockers.length) { setDialog(null); setFormError(x.message); setDetail(dd => dd ? { ...dd, checks: { ...dd.checks, canPublish: false, blockers: x.blockers } } : dd); } else onError(x); }
    finally { setBusy(false); }
  };

  if (loadError) return <EmptyState icon={<XCircle className="w-7 h-7" />} title={loadError} action={<Link to={lp('/admin')} className="btn btn-outline">{t('admin.nav.lands')}</Link>} />;
  if (!isNew && !detail) return <div className="grid gap-4" aria-busy="true"><div className="skeleton h-10 w-72" /><div className="skeleton h-64" /></div>;

  const E = (k: string) => errors[k];
  const L = (k: string) => t(`admin.form.${k}`);
  const choice = (k: keyof FormState, list: string[] | undefined, prefix: string, label: string, optional = false) => (
    <Field label={label} htmlFor={`af-${k}`} error={E(k)} optional={optional}>
      <select id={`af-${k}`} className="field" value={String(form[k])} disabled={readOnly} onChange={e => set(k, e.target.value as never)} aria-invalid={!!E(k)}>
        <option value="">{t('owner.add.choose')}</option>
        {(list ?? []).map(o => <option key={o} value={o}>{t(`${prefix}.${o}`, { defaultValue: o })}</option>)}
      </select>
    </Field>
  );
  const text = (k: keyof FormState, label: string, opts: { optional?: boolean; area?: boolean; type?: string; hint?: string; max?: number } = {}) => (
    <Field label={label} htmlFor={`af-${k}`} error={E(k)} optional={opts.optional} hint={opts.hint}>
      {opts.area
        ? <textarea id={`af-${k}`} className="field min-h-28" value={String(form[k])} disabled={readOnly} maxLength={opts.max} onChange={e => set(k, e.target.value as never)} aria-invalid={!!E(k)} />
        : <input id={`af-${k}`} className="field" type={opts.type ?? 'text'} value={String(form[k])} disabled={readOnly} maxLength={opts.max} onChange={e => set(k, e.target.value as never)} aria-invalid={!!E(k)} />}
    </Field>
  );
  const yesNo = (k: 'categoryConvertible' | 'hasEncumbrance', label: string) => (
    <Field label={label} htmlFor={`af-${k}`} error={E(k)} optional>
      <select id={`af-${k}`} className="field" value={form[k]} disabled={readOnly} onChange={e => set(k, e.target.value as '' | 'true' | 'false')}>
        <option value="">{L('unknown')}</option><option value="true">{t('form.yes')}</option><option value="false">{t('form.no')}</option>
      </select>
    </Field>
  );
  const dynamic = (inputs: LandUseInput[], values: Record<string, string>, key: 'attributes' | 'details', labelOf: (i: LandUseInput) => string) => (
    <div className="grid sm:grid-cols-2 gap-5">
      {inputs.map(input => {
        const fid = `af-${key}-${input.key}`;
        const v = values[input.key] ?? '';
        const change = (nv: string) => set(key, { ...values, [input.key]: nv });
        return (
          <Field key={input.key} label={`${labelOf(input)}${input.unit ? ` (${input.unit})` : ''}`} htmlFor={fid} optional={!input.required}>
            {input.kind === 'YES_NO' ? (
              <select id={fid} className="field" value={v} disabled={readOnly} onChange={e => change(e.target.value)}>
                <option value="">{L('unknown')}</option><option value="true">{t('form.yes')}</option><option value="false">{t('form.no')}</option>
              </select>
            ) : input.kind === 'CHOICE' ? (
              <select id={fid} className="field" value={v} disabled={readOnly} onChange={e => change(e.target.value)}>
                <option value="">{t('owner.add.choose')}</option>
                {(input.options ?? []).map(o => <option key={o} value={o}>{t(`admin.opt.${o}`, { defaultValue: o })}</option>)}
              </select>
            ) : (
              <input id={fid} className="field" type={input.kind === 'NUMBER' ? 'number' : 'text'} inputMode={input.kind === 'NUMBER' ? 'decimal' : undefined}
                min={input.min ?? undefined} max={input.max ?? undefined} step="any" value={v} disabled={readOnly} onChange={e => change(e.target.value)} maxLength={input.kind === 'TEXT' ? 500 : undefined} />
            )}
          </Field>
        );
      })}
    </div>
  );

  const section = (title: string, children: React.ReactNode, hint?: string) => (
    <section className="card p-5 sm:p-7">
      <h2 className="font-display text-2xl text-brand">{title}</h2>
      {hint && <p className="text-sm text-muted mt-1">{hint}</p>}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );

  const checks = detail?.checks;
  const record = detail?.record;
  const blockersFor = (field: string) => (checks?.blockers ?? []).concat(checks?.flags ?? []).filter(b => b.field === field);
  const goTo = (issue: LandIssue) => document.getElementById(`af-${issue.field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <>
      <PageTitle title={isNew ? t('admin.form.newTitle') : form.title || t('admin.form.editTitle')}
        subtitle={isNew ? t('admin.form.newSubtitle') : undefined}
        actions={!isNew && record ? <div className="flex flex-wrap gap-2 items-center"><StatusPill status={record.status} /><VerificationPill value={record.verification} /></div> : undefined} />

      {formError && <p role="alert" className="mb-6 rounded-xl bg-[#F6E3DF] text-danger px-4 py-3 text-sm font-semibold">{formError}</p>}
      {archived && <p className="mb-6 rounded-xl bg-[#ECE7DA] px-4 py-3 text-sm font-semibold">{t('admin.form.archivedNote')}</p>}

      <div className="grid xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="grid gap-6 min-w-0">
          {section(L('sBasic'), <>
            <div id="af-title">{text('title', L('title'), { max: 200 })}</div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div id="af-landUse">{choice('landUse', CATEGORIES.map(c => c.key), 'fieldTypes', L('landUse'))}</div>
              {text('intendedUse', L('intendedUse'), { optional: true, max: 500 })}
            </div>
            {text('description', L('description'), { optional: true, area: true, max: 4000 })}
            <fieldset>
              <legend className="field-label">{L('entrySource')}</legend>
              <div className="flex flex-wrap gap-4">
                {(['admin', 'on_behalf'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input type="radio" name="entrySource" checked={form.entrySource === v} disabled={readOnly} onChange={() => set('entrySource', v)} className="accent-[#1F4D2E]" />
                    {t(`admin.entry.${v === 'admin' ? 'ADMIN' : 'ADMIN_ON_BEHALF'}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {form.entrySource === 'on_behalf' && <div id="af-onBehalfOf">{text('onBehalfOf', L('onBehalfOf'), { max: 200 })}</div>}
          </>)}

          {section(L('sLegal'), <>
            <div id="af-cadastralNumber" className="grid gap-2">
              {text('cadastralNumber', L('cadastral'), { optional: form.cadastralUnavailable, max: 50, hint: L('cadastralHint') })}
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input type="checkbox" checked={form.cadastralUnavailable} disabled={readOnly} onChange={e => set('cadastralUnavailable', e.target.checked)} className="w-4 h-4 accent-[#1F4D2E]" />
                {L('cadastralNone')}
              </label>
              {form.cadastralUnavailable && <p className="text-sm rounded-xl bg-[#FBF6E9] px-3 py-2">{L('cadastralManual')}</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div id="af-legalCategory">{choice('legalCategory', options?.legalCategories, 'admin.opt', L('legalCategory'))}</div>
              {yesNo('categoryConvertible', L('categoryConvertible'))}
              <div id="af-ownershipForm">{choice('ownershipForm', options?.ownershipForms, 'admin.opt', L('ownershipForm'))}</div>
              {yesNo('hasEncumbrance', L('hasEncumbrance'))}
            </div>
            {form.hasEncumbrance === 'true' && text('encumbrances', L('encumbrances'), { area: true, max: 1000 })}
          </>, L('sLegalHint'))}

          {section(L('sLocation'), <>
            <div className="grid sm:grid-cols-3 gap-5">
              <div id="af-region">{choice('region', REGIONS.map(r => r.key), 'regions', L('region'))}</div>
              {text('district', L('district'), { optional: true, max: 100 })}
              {text('settlement', L('settlement'), { optional: true, max: 100 })}
            </div>
            <div id="af-location">
              <div id="af-boundary" className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <p className="field-label !mb-0">{L('map')}</p>
                {record?.verification !== 'VERIFIED' && <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF6E9] text-gold-dark px-2.5 py-1 text-xs font-bold"><ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />{L('unverifiedMap')}</span>}
              </div>
              {readOnly ? <p className="text-sm text-muted">{form.pin ? `${form.pin.lat}, ${form.pin.lng}` : '—'}</p> : (
                <PinPicker value={form.pin} onChange={v => set('pin', v)} center={regionByKey(form.region) ?? undefined} error={E('location') || E('boundary')}
                  boundary={form.boundary} onBoundaryChange={v => set('boundary', v)} onUseArea={ha => { set('areaValue', String(ha)); set('areaUnit', 'ha'); }} />
              )}
            </div>
            <div id="af-area" className="grid sm:grid-cols-[1fr_160px] gap-3 items-start">
              <Field label={L('area')} htmlFor="af-areaValue" error={E('area')}
                hint={form.areaValue ? (form.areaUnit === 'sot' ? L('areaInHa').replace('{{n}}', String(Math.round(areaHa * 10000) / 10000)) : L('areaInSot').replace('{{n}}', String(Math.round(areaHa * 100 * 100) / 100))) : L('areaHint')}>
                <input id="af-areaValue" className="field" type="number" inputMode="decimal" min={0} step="any" value={form.areaValue} disabled={readOnly} onChange={e => set('areaValue', e.target.value)} aria-invalid={!!E('area')} />
              </Field>
              <Field label={L('unit')} htmlFor="af-areaUnit">
                <select id="af-areaUnit" className="field" value={form.areaUnit} disabled={readOnly} onChange={e => set('areaUnit', e.target.value as 'ha' | 'sot')}>
                  <option value="ha">{L('ha')}</option><option value="sot">{L('sot')}</option>
                </select>
              </Field>
            </div>
            {boundaryHa > 0 && areaHa > 0 && Math.abs(boundaryHa - areaHa) > 0.5 && Math.abs(boundaryHa - areaHa) / areaHa > 0.2 && (
              <p className="text-sm rounded-xl bg-[#FBF6E9] px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-gold-dark mt-0.5" aria-hidden="true" />{L('areaMismatch').replace('{{a}}', String(Math.round(areaHa * 100) / 100)).replace('{{b}}', boundaryHa.toFixed(2))}</p>
            )}
          </>)}

          {section(L('sWater'), <>
            <div className="grid sm:grid-cols-2 gap-5">
              <div id="af-waterAccess">{choice('waterAccess', options?.waterAccessOptions, 'admin.opt', L('waterAccess'))}</div>
              {choice('roadAccessType', options?.roadAccessTypes, 'admin.opt', L('roadAccessType'), true)}
              {text('roadDistanceKm', L('roadDistanceKm'), { optional: true, type: 'number' })}
              {text('settlementDistanceKm', L('settlementDistanceKm'), { optional: true, type: 'number' })}
            </div>
            {text('currentUse', L('currentUse'), { optional: true, max: 500 })}
            <div className="grid sm:grid-cols-2 gap-5">
              {text('soilQuality', L('soilQuality'), { optional: true, max: 500 })}
              {text('waterSupply', L('waterSupply'), { optional: true, max: 500 })}
            </div>
          </>)}

          {options && section(L('sDetails'), <>
            {E('details') && <p className="field-error" role="alert">{E('details')}</p>}
            {dynamic(options.details, form.details, 'details', i => t(`admin.details.${i.key}`, { defaultValue: i.label }))}
          </>, L('sDetailsHint'))}

          {type && type.inputs.length > 0 && section(t('admin.form.sType', { type: t(`fieldTypes.${type.key}`, { defaultValue: type.name }) }), <>
            {E('attributes') && <p id="af-attributes" className="field-error" role="alert">{E('attributes')}</p>}
            {dynamic(type.inputs, form.attributes, 'attributes', i => i.label)}
          </>, L('sTypeHint'))}

          {section(L('sListing'), <>
            <div className="grid sm:grid-cols-2 gap-5">
              {text('estimatedInvestmentRequirement', L('investment'), { optional: true, type: 'number' })}
              <div id="af-applicationDeadline">{text('applicationDeadline', L('deadline'), { optional: true, type: 'date' })}</div>
            </div>
            {text('eligibilityConditions', L('eligibility'), { optional: true, area: true, hint: L('linesHint') })}
            {text('requiredDocuments', L('requiredDocs'), { optional: true, area: true, hint: L('linesHint') })}
          </>)}

          {section(L('sDocuments'), <>
            <div id="af-documents">
              {E('documents') && <p className="field-error mb-3" role="alert">{E('documents')}</p>}
              {blockersFor('documents').map(b => <p key={b.code} className="mb-3 text-sm rounded-xl bg-[#FBF6E9] px-3 py-2">{b.message}</p>)}
              <ul className="grid gap-2">
                {(detail?.documents ?? []).map(d => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                    <FileText className="w-5 h-5 text-brand shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{d.fileName}</span><span className="block text-xs text-muted">{t(`admin.docKind.${d.kind}`)} · {f.date(d.uploadedAt)}</span></span>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-sand" aria-label={t('admin.form.openDoc', { name: d.fileName })}><ExternalLink className="w-4 h-4" /></a>
                    {!readOnly && <button type="button" className="p-2 rounded-full hover:bg-sand text-danger" onClick={() => setDialog({ removeDoc: d.id })} aria-label={t('admin.form.removeDoc', { name: d.fileName })}><Trash2 className="w-4 h-4" /></button>}
                  </li>
                ))}
                {docs.map(d => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-brand/40 bg-sage/40 px-3 py-2.5">
                    <Upload className="w-5 h-5 text-brand shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm font-semibold truncate">{d.file.name}</span>
                    <select className="field !w-auto !min-h-9 !py-1" value={d.kind} aria-label={t('admin.form.docKind', { name: d.file.name })}
                      onChange={e => setDocs(list => list.map(x => (x.id === d.id ? { ...x, kind: e.target.value } : x)))}>
                      {(options?.documentKinds ?? ['ownership', 'lease', 'authorization', 'soil_analysis', 'water_analysis', 'other']).map(k => <option key={k} value={k}>{t(`admin.docKind.${k}`)}</option>)}
                    </select>
                    <button type="button" className="p-2 rounded-full hover:bg-sand" onClick={() => setDocs(list => list.filter(x => x.id !== d.id))} aria-label={t('form.remove')}><XCircle className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
              {!readOnly && (
                <label className="mt-3 btn btn-outline btn-sm cursor-pointer">
                  <Upload className="w-4 h-4" />{L('addDocs')}
                  <input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only"
                    onChange={e => { const files = Array.from(e.target.files ?? []); setDocs(list => [...list, ...files.map(file => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, kind: 'ownership' }))]); setDirty(true); e.target.value = ''; }} />
                </label>
              )}
              <p className="text-xs text-muted mt-2">{L('docsHint')}</p>
            </div>
            <div id="af-photos">
              <p className="field-label">{L('photos')}</p>
              {E('photos') && <p className="field-error mb-2" role="alert">{E('photos')}</p>}
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(detail?.land.photos ?? []).map(p => (
                  <li key={p.id} className="relative rounded-xl overflow-hidden border border-line aspect-[4/3]">
                    <Photo src={p.url} alt="" className="w-full h-full" />
                    {!readOnly && <button type="button" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 grid place-items-center text-danger shadow" onClick={() => setDialog({ removePhoto: p.id })} aria-label={L('removePhoto')}><Trash2 className="w-4 h-4" /></button>}
                  </li>
                ))}
                {photos.map(p => (
                  <li key={p.id} className="relative rounded-xl overflow-hidden border border-dashed border-brand/40 aspect-[4/3]">
                    <img src={URL.createObjectURL(p.file)} alt="" className="w-full h-full object-cover" />
                    <button type="button" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 grid place-items-center shadow" onClick={() => setPhotos(list => list.filter(x => x.id !== p.id))} aria-label={t('form.remove')}><XCircle className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
              {!readOnly && (
                <label className="mt-3 btn btn-outline btn-sm cursor-pointer">
                  <Upload className="w-4 h-4" />{L('addPhotos')}
                  <input type="file" multiple accept="image/jpeg,image/png" className="sr-only"
                    onChange={e => { const files = Array.from(e.target.files ?? []); setPhotos(list => [...list, ...files.map(file => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, kind: 'photo' }))]); setDirty(true); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </>, L('sDocumentsHint'))}

          {section(L('sNotes'), text('adminNotes', L('adminNotes'), { optional: true, area: true, max: 4000 }))}

          {!readOnly && (
            <div className="sticky bottom-20 lg:bottom-4 z-30 card p-4 flex flex-wrap items-center gap-3 shadow-[var(--shadow-lift)]">
              <p className="text-sm text-muted flex-1 min-w-48">{dirty || docs.length || photos.length ? L('unsaved') : isNew ? L('newHint') : L('savedHint')}</p>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('form.loading') : isNew ? L('saveDraft') : L('save')}</button>
            </div>
          )}

          {detail && (
            <section className="card p-5 sm:p-7">
              <h2 className="font-display text-2xl text-brand flex items-center gap-2"><History className="w-5 h-5" aria-hidden="true" />{L('audit')}</h2>
              <ol className="mt-4 grid gap-3">
                {detail.audit.map(a => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className="w-2 h-2 mt-2 rounded-full bg-brand shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p><span className="font-bold">{t(`admin.audit.${a.action}`, { defaultValue: a.action })}</span> · <span className="text-muted">{a.actor?.name ?? '—'} · {new Date(a.at).toLocaleString(f.locale)}</span></p>
                      {a.details && <p className="text-muted break-words">{a.details}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Side panel: status, checks, actions, record */}
        <aside className="grid gap-4 xl:sticky xl:top-24">
          {isNew ? (
            <div className="card p-5 text-sm">
              <p className="font-bold text-brand">{L('howTitle')}</p>
              <ol className="list-decimal pl-5 mt-2 grid gap-1 text-muted">{(t('admin.form.howSteps', { returnObjects: true }) as unknown as string[]).map(s => <li key={s}>{s}</li>)}</ol>
            </div>
          ) : detail && record && checks && (
            <>
              <div className="card p-5">
                <p className="font-bold text-brand mb-3">{L('checks')}</p>
                {checks.canPublish
                  ? <p className="flex gap-2 text-sm text-leaf-dark font-semibold"><CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />{L('readyToPublish')}</p>
                  : <ul className="grid gap-2">{checks.blockers.map(b => (
                    <li key={b.code}><button type="button" onClick={() => goTo(b)} className="w-full text-left flex gap-2 text-sm rounded-xl bg-[#F6E3DF] px-3 py-2 hover:ring-2 hover:ring-danger/30"><XCircle className="w-4 h-4 shrink-0 text-danger mt-0.5" aria-hidden="true" /><span>{b.message}</span></button></li>
                  ))}</ul>}
                {checks.flags.length > 0 && <>
                  <p className="font-bold text-sm mt-4 mb-2">{L('flags')}</p>
                  <ul className="grid gap-2">{checks.flags.map(b => (
                    <li key={b.code}><button type="button" onClick={() => goTo(b)} className="w-full text-left flex gap-2 text-sm rounded-xl bg-[#FBF6E9] px-3 py-2"><AlertTriangle className="w-4 h-4 shrink-0 text-gold-dark mt-0.5" aria-hidden="true" /><span>{b.message}</span></button></li>
                  ))}</ul>
                </>}
                {dirty && <p className="text-xs text-muted mt-3">{L('checksAfterSave')}</p>}
              </div>

              <div className="card p-5 grid gap-2">
                <p className="font-bold text-brand mb-1">{L('actions')}</p>
                {record.status === 'DRAFT' && <button type="button" className="btn btn-primary w-full" disabled={busy || dirty || !checks.canPublish} onClick={() => setDialog('publish')}><Send className="w-4 h-4" />{L('publish')}</button>}
                {record.status === 'DRAFT' && dirty && <p className="text-xs text-muted">{L('saveFirst')}</p>}
                {record.status === 'APPROVED' && <a href={lp(`/lands/${detail.land.id}`)} target="_blank" rel="noopener noreferrer" className="btn btn-outline w-full"><Eye className="w-4 h-4" />{L('viewPublic')}</a>}
                {record.status === 'APPROVED' && <button type="button" className="btn btn-outline w-full" disabled={busy} onClick={() => setDialog('unpublish')}><CircleSlash className="w-4 h-4" />{L('unpublish')}</button>}
                {!archived && <button type="button" className="btn btn-outline w-full" disabled={busy} onClick={() => setDialog('verify')}><ShieldCheck className="w-4 h-4" />{L('verify')}</button>}
                {!archived && <button type="button" className="btn btn-outline w-full" disabled={busy} onClick={() => setDialog('reassign')}><UserCog className="w-4 h-4" />{L('reassign')}</button>}
                {!archived && <button type="button" className="btn btn-danger-outline w-full" disabled={busy} onClick={() => setDialog('archive')}><Archive className="w-4 h-4" />{L('archive')}</button>}
                {archived && <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => setDialog('restore')}><ArchiveRestore className="w-4 h-4" />{L('restore')}</button>}
              </div>

              <div className="card p-5 text-sm grid gap-2">
                <p className="font-bold text-brand mb-1">{L('record')}</p>
                <RecordRow label={L('createdBy')} value={`${record.createdBy?.name ?? '—'} · ${f.date(record.createdAt)}`} />
                <RecordRow label={L('updatedBy')} value={`${record.updatedBy?.name ?? '—'} · ${f.date(record.updatedAt)}`} />
                <RecordRow label={L('entrySource')} value={`${t(`admin.entry.${form.entrySource === 'on_behalf' ? 'ADMIN_ON_BEHALF' : 'ADMIN'}`)}${form.entrySource === 'on_behalf' && form.onBehalfOf ? `: ${form.onBehalfOf}` : ''}`} />
                <RecordRow label={L('responsible')} value={record.responsibleUser ? `${record.responsibleUser.name} (${record.responsibleUser.email})` : L('ministry')} />
                <RecordRow label={L('verificationLabel')} value={`${t(`admin.verification.${record.verification}`)}${record.verifiedBy ? ` · ${record.verifiedBy.name}, ${f.date(record.verifiedAt!)}` : ''}`} />
                {record.verificationNote && <RecordRow label={L('note')} value={record.verificationNote} />}
                {record.publishedAt && <RecordRow label={L('publishedAt')} value={f.date(record.publishedAt)} />}
                {detail.listing && <RecordRow label={L('proposals')} value={String(detail.listing.proposalCount)} />}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ---- dialogs ---- */}
      {detail && <PublishDialog open={dialog === 'publish'} detail={detail} form={form} busy={busy} onClose={() => setDialog(null)}
        onConfirm={() => act(() => adminLands.publish(detail.land.id), L('published'))} />}
      {detail && <ReasonDialog open={dialog === 'unpublish' || dialog === 'archive'} kind={dialog === 'archive' ? 'archive' : 'unpublish'} busy={busy} error={errors.reason}
        onClose={() => setDialog(null)} onConfirm={reason => act(() => (dialog === 'archive' ? adminLands.archive(detail.land.id, reason) : adminLands.unpublish(detail.land.id, reason)), dialog === 'archive' ? L('archived') : L('unpublished'))} />}
      {detail && <ConfirmDialog open={dialog === 'restore'} title={L('restore')} text={L('restoreText')} confirmLabel={L('restore')} busy={busy}
        onClose={() => setDialog(null)} onConfirm={() => act(() => adminLands.restore(detail.land.id), L('restored'))} />}
      {detail && <ReassignDialog open={dialog === 'reassign'} current={detail.record.responsibleUser?.email ?? ''} busy={busy} error={errors.email}
        onClose={() => setDialog(null)} onConfirm={email => act(() => adminLands.reassign(detail.land.id, email), L('reassigned'))} />}
      {detail && <VerifyDialog open={dialog === 'verify'} current={detail.record.verification} busy={busy} errors={errors}
        onClose={() => setDialog(null)} onConfirm={(s, checked, note) => act(() => adminLands.verification(detail.land.id, s, checked, note), L('verificationSaved'))} />}
      {detail && typeof dialog === 'object' && dialog && 'removeDoc' in dialog && (
        <ConfirmDialog open danger title={L('removeDocTitle')} text={L('removeDocText')} confirmLabel={t('owner.props.delete')} busy={busy}
          onClose={() => setDialog(null)} onConfirm={() => act(() => adminLands.removeDocument(detail.land.id, dialog.removeDoc), L('docRemoved'))} />
      )}
      {detail && typeof dialog === 'object' && dialog && 'removePhoto' in dialog && (
        <ConfirmDialog open danger title={L('removePhoto')} text={L('removePhotoText')} confirmLabel={t('owner.props.delete')} busy={busy}
          onClose={() => setDialog(null)} onConfirm={() => act(() => adminLands.removePhoto(detail.land.id, dialog.removePhoto), L('photoRemoved'))} />
      )}
    </>
  );
};

const RecordRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3"><span className="text-muted shrink-0">{label}</span><span className="font-semibold text-right break-words min-w-0">{value}</span></div>
);

/** Review summary shown before publication. */
const PublishDialog: React.FC<{ open: boolean; detail: AdminLandDetail; form: FormState; busy: boolean; onClose: () => void; onConfirm: () => void }> = ({ open, detail, form, busy, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const L = (k: string) => t(`admin.form.${k}`);
  const rows: [string, string][] = [
    [L('title'), form.title],
    [L('landUse'), form.landUse ? t(`fieldTypes.${form.landUse}`) : '—'],
    [L('legalCategory'), form.legalCategory ? t(`admin.opt.${form.legalCategory}`) : '—'],
    [L('ownershipForm'), form.ownershipForm ? t(`admin.opt.${form.ownershipForm}`) : '—'],
    [L('cadastral'), form.cadastralNumber || (form.cadastralUnavailable ? L('cadastralNone') : '—')],
    [L('region'), [form.region ? t(`regions.${form.region}`) : '', form.district, form.settlement].filter(Boolean).join(' · ') || '—'],
    [L('area'), detail.fields.areaHectares ? t('land.ha', { n: detail.fields.areaHectares }) : '—'],
    [L('waterAccess'), form.waterAccess ? t(`admin.opt.${form.waterAccess}`) : '—'],
    [L('sDocuments'), String(detail.documents.length)],
    [L('investment'), detail.fields.estimatedInvestmentRequirement ? f.azn(detail.fields.estimatedInvestmentRequirement) : '—'],
    [L('verificationLabel'), t(`admin.verification.${detail.record.verification}`)],
  ];
  return (
    <Modal open={open} onClose={onClose} title={L('publishTitle')} description={L('publishText')} size="lg"
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>{t('form.cancel')}</button><button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>{busy ? t('form.loading') : L('publishConfirm')}</button></>}>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">{rows.map(([k, v]) => <div key={k}><dt className="text-muted text-xs font-semibold">{k}</dt><dd className="font-semibold break-words">{v}</dd></div>)}</dl>
      {detail.checks.flags.length > 0 && <p className="mt-4 text-sm rounded-xl bg-[#FBF6E9] px-3 py-2">{L('publishFlagsNote')}</p>}
      <p className="mt-4 text-xs text-muted">{t('admin.disclaimer')}</p>
    </Modal>
  );
};

const ReasonDialog: React.FC<{ open: boolean; kind: 'unpublish' | 'archive'; busy: boolean; error?: string; onClose: () => void; onConfirm: (reason: string) => void }> = ({ open, kind, busy, error, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const L = (k: string) => t(`admin.form.${k}`);
  return (
    <Modal open={open} onClose={onClose} title={L(kind)} description={L(kind === 'archive' ? 'archiveText' : 'unpublishText')}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>{t('form.cancel')}</button><button type="button" className={`btn ${kind === 'archive' ? 'btn-danger-outline' : 'btn-primary'}`} disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}>{busy ? t('form.loading') : L(kind)}</button></>}>
      <Field label={L('reason')} htmlFor="af-reason" error={error}><textarea id="af-reason" className="field min-h-24" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    </Modal>
  );
};

const ReassignDialog: React.FC<{ open: boolean; current: string; busy: boolean; error?: string; onClose: () => void; onConfirm: (email: string) => void }> = ({ open, current, busy, error, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState(current);
  useEffect(() => { if (open) setEmail(current); }, [open, current]);
  const L = (k: string) => t(`admin.form.${k}`);
  return (
    <Modal open={open} onClose={onClose} title={L('reassign')} description={L('reassignText')}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>{t('form.cancel')}</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => onConfirm(email.trim())}>{busy ? t('form.loading') : t('form.save')}</button></>}>
      <Field label={L('reassignEmail')} htmlFor="af-email" error={error} hint={L('reassignHint')} optional>
        <input id="af-email" className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
      </Field>
    </Modal>
  );
};

const VerifyDialog: React.FC<{ open: boolean; current: string; busy: boolean; errors: Record<string, string>; onClose: () => void; onConfirm: (s: 'VERIFIED' | 'EVIDENCE_PENDING', checked: boolean, note: string) => void }> = ({ open, current, busy, errors, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'VERIFIED' | 'EVIDENCE_PENDING'>('VERIFIED');
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setStatus(current === 'VERIFIED' ? 'EVIDENCE_PENDING' : 'VERIFIED'); setChecked(false); setNote(''); } }, [open, current]);
  const L = (k: string) => t(`admin.form.${k}`);
  return (
    <Modal open={open} onClose={onClose} title={L('verify')} description={L('verifyText')}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>{t('form.cancel')}</button><button type="button" className="btn btn-primary" disabled={busy || (status === 'VERIFIED' && !checked)} onClick={() => onConfirm(status, checked, note.trim())}>{busy ? t('form.loading') : t('form.save')}</button></>}>
      <fieldset className="grid gap-2">
        <legend className="field-label">{L('verificationLabel')}</legend>
        {(['VERIFIED', 'EVIDENCE_PENDING'] as const).map(s => (
          <label key={s} className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="radio" name="verify" checked={status === s} onChange={() => setStatus(s)} className="accent-[#1F4D2E]" />{t(`admin.verification.${s}`)}</label>
        ))}
      </fieldset>
      {status === 'VERIFIED' && (
        <label className="mt-4 flex items-start gap-2 text-sm font-semibold cursor-pointer rounded-xl bg-sage px-3 py-2">
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#1F4D2E]" />{L('evidenceChecked')}
        </label>
      )}
      {errors.evidenceChecked && <p className="field-error">{errors.evidenceChecked}</p>}
      <Field label={L('note')} htmlFor="af-note" error={errors.note} hint={L('noteHint')} optional className="mt-4">
        <textarea id="af-note" className="field min-h-24" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
};
