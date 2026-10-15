import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Heart, Inbox, Info, Landmark, MapPin, ShieldAlert, ShieldCheck, Star, X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { landService, requestService, useCurrentUser, useDbValue, ApiError, errorText } from '../../services/api';
import { scoreLand, WEIGHTS } from '../../services/scoring';
import { useFormat, useLocalePath } from '../../app/i18n';
import { useLandName } from './landText';
import { TypeBadge } from './LandCard';
import { Photo, ProgressBar, RiskBadge, ScoreGauge, VerifiedBadge, StatusBadge, Field, EmptyState } from '../../components/ui/Bits';
import { Modal, useToast } from '../../components/ui/Overlay';
import { SingleLandMap } from '../../components/map/LandsMap';
import { useCompare } from '../compare/CompareContext';
import type { InvestmentModel, Land } from '../../types/agro';

const Lightbox: React.FC<{ photos: string[]; index: number; onClose: () => void; alt: string }> = ({ photos, index, onClose, alt }) => {
  const { t } = useTranslation();
  const [i, setI] = useState(index);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI(x => (x + 1) % photos.length);
      if (e.key === 'ArrowLeft') setI(x => (x - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const big = photos[i].replace('-sm.jpg', '.jpg');
  return (
    <div className="fixed inset-0 z-[85] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={alt}>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white" aria-label={t('form.close')} autoFocus><X className="w-6 h-6" /></button>
      <button type="button" onClick={() => setI((i - 1 + photos.length) % photos.length)} className="absolute left-4 p-3 rounded-full bg-white/10 text-white" aria-label={t('investments.prev')}><ChevronLeft className="w-6 h-6" /></button>
      <img src={big} alt={`${alt} — ${i + 1}`} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
      <button type="button" onClick={() => setI((i + 1) % photos.length)} className="absolute right-4 p-3 rounded-full bg-white/10 text-white" aria-label={t('investments.next')}><ChevronRight className="w-6 h-6" /></button>
    </div>
  );
};

const InvestModal: React.FC<{ land: Land; open: boolean; onClose: () => void }> = ({ land, open, onClose }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const toast = useToast();
  const [amount, setAmount] = useState(String(land.investmentMin));
  const [model, setModel] = useState<InvestmentModel>(land.investmentModel);
  const me = useCurrentUser();
  const [duration, setDuration] = useState(String(land.durationMonths || 24));
  const [applicantType, setApplicantType] = useState('individual');
  const [applicantName, setApplicantName] = useState(me?.fullName ?? '');
  const [taxNumber, setTaxNumber] = useState('');
  const [contactPhone, setContactPhone] = useState(me?.phone ?? '');
  const [documents, setDocuments] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [projectCosts, setProjectCosts] = useState('');
  const [fundingGap, setFundingGap] = useState('');
  const [additionalFinancing, setAdditionalFinancing] = useState('');
  const [expectedRevenue, setExpectedRevenue] = useState('');
  const [expectedProduction, setExpectedProduction] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const a = Number(amount);
    if (!(a > 0)) er.amount = t('form.required');
    if (!(Number(duration) > 0)) er.duration = t('form.required');
    if (message.trim().length < 10) er.message = t('form.minLength', { n: 10 });
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await requestService.create({ landId: land.id, amount: a, investmentModel: model, durationMonths: Number(duration), message: message.trim(), applicantType, applicantName, taxNumber, contactPhone, documents,
        projectCosts: projectCosts ? Number(projectCosts) : null, fundingGap: fundingGap ? Number(fundingGap) : null,
        additionalFinancingRequested: additionalFinancing ? Number(additionalFinancing) : null, expectedAnnualRevenue: expectedRevenue ? Number(expectedRevenue) : null, expectedProduction });
      toast(t('investor.detail.sentToast'));
      onClose();
    } catch (x) {
      toast(errorText(t, x), 'error');
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('investor.detail.modalTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('competition.applicantType')} htmlFor="inv-type"><select id="inv-type" className="field" value={applicantType} onChange={e => setApplicantType(e.target.value)}><option value="individual">{t('competition.individual')}</option><option value="company">{t('competition.company')}</option></select></Field>
        <Field label={t('competition.applicantName')} htmlFor="inv-name"><input id="inv-name" className="field" value={applicantName} onChange={e => setApplicantName(e.target.value)} required minLength={3} maxLength={200} /></Field>
        <Field label={t('competition.taxNumber')} htmlFor="inv-tax"><input id="inv-tax" className="field" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} required={applicantType === 'company'} pattern="[0-9]{10}" maxLength={10} /></Field>
        <Field label={t('auth.phone')} htmlFor="inv-phone"><input id="inv-phone" className="field" value={contactPhone} onChange={e => setContactPhone(e.target.value)} required /></Field>
        <Field label={t('investor.detail.amount')} htmlFor="inv-amount" error={err.amount} hint={`${t('admin.form.investment')}: ${f.azn(land.investmentMin)}`}>
          <input id="inv-amount" className="field" type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={!!err.amount} data-autofocus />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('investor.detail.projectCosts')} htmlFor="inv-costs" optional><input id="inv-costs" className="field" type="number" min="0" step="0.01" value={projectCosts} onChange={e => setProjectCosts(e.target.value)} /></Field>
          <Field label={t('investor.detail.fundingGap')} htmlFor="inv-gap" optional><input id="inv-gap" className="field" type="number" min="0" step="0.01" value={fundingGap} onChange={e => setFundingGap(e.target.value)} /></Field>
          <Field label={t('investor.detail.additionalFinance')} htmlFor="inv-finance" optional><input id="inv-finance" className="field" type="number" min="0" step="0.01" value={additionalFinancing} onChange={e => setAdditionalFinancing(e.target.value)} /></Field>
          <Field label={t('investor.detail.expectedRevenue')} htmlFor="inv-revenue" optional><input id="inv-revenue" className="field" type="number" min="0" step="0.01" value={expectedRevenue} onChange={e => setExpectedRevenue(e.target.value)} /></Field>
        </div>
        <Field label={t('investor.detail.expectedProduction')} htmlFor="inv-production" optional><textarea id="inv-production" className="field min-h-20" maxLength={500} value={expectedProduction} onChange={e => setExpectedProduction(e.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('land.model')} htmlFor="inv-model">
            <select id="inv-model" className="field" value={model} onChange={e => setModel(e.target.value as InvestmentModel)}>
              {(['profitSharing', 'lease', 'jointVenture'] as const).map(m => <option key={m} value={m}>{t(`models.${m}`)}</option>)}
            </select>
          </Field>
          <Field label={t('owner.add.duration')} htmlFor="inv-dur" error={err.duration}>
            <input id="inv-dur" className="field" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
          </Field>
        </div>
        <Field label={t('investor.detail.message')} htmlFor="inv-msg" error={err.message}>
          <textarea id="inv-msg" className="field min-h-28" value={message} onChange={e => setMessage(e.target.value)} aria-invalid={!!err.message} />
        </Field>
        <Field label={t('competition.documents')} htmlFor="inv-documents" hint={land.requiredDocuments?.join(', ')}><input id="inv-documents" className="field" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" required={!!land.requiredDocuments?.length} onChange={e => setDocuments(Array.from(e.target.files ?? []))} /></Field>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('form.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('form.loading') : t('investor.detail.send')}</button>
        </div>
      </form>
    </Modal>
  );
};

/** Land detail (Part 2, 4.3). mode: public website, investor cabinet, or owner cabinet (owner-only stats). */
export const LandDetail: React.FC<{ mode: 'public' | 'investor' | 'owner' }> = ({ mode }) => {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const name = useLandName();
  const me = useCurrentUser();
  const land = useDbValue(() => landService.get(id));
  const myRequest = useDbValue(() => (me ? requestService.forLand(id).find(r => r.investorId === me.id) : undefined));
  const requestCount = useDbValue(() => requestService.forLand(id).length);
  const saved = useDbValue(() => (me ? landService.savedIds(me.id).includes(id) : false));
  const { has, toggle } = useCompare();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [invest, setInvest] = useState(false);
  const [why, setWhy] = useState(false);

  useEffect(() => { if (land && mode !== 'owner') landService.addView(land.id); }, [id]);
  const score = useMemo(() => (land ? scoreLand(land, me?.preferences ?? {}) : null), [land, me?.preferences]);

  // Owner pages only show the signed-in owner's own land; others' drafts and reviews are never visible.
  const hidden = mode === 'owner' ? land?.ownerId !== me?.id : (land?.status === 'draft' || land?.status === 'underReview');
  if (!land || !score || hidden) {
    return <div className="container-x py-20"><EmptyState title={t('land.notFound')} /></div>;
  }
  const title = name(land);
  const goal = land.investmentMax;
  const isOwn = me?.id === land.ownerId;
  const facts: [string, string][] = [
    [t('land.soil'), t(`soil.${land.soilType}`)], [t('land.irrigation'), t(`irrigationTypes.${land.irrigation}`)],
    [t('land.lastCrop'), t(`crops.${land.lastCrop}`, { defaultValue: land.lastCrop })], [t('land.road'), land.roadAccess ? t('form.yes') : t('form.no')],
    [t('land.electricity'), land.electricity ? t('form.yes') : t('form.no')], [t('land.duration'), land.durationMonths ? t('land.months', { n: land.durationMonths }) : '—'],
    [t('land.model'), t(`models.${land.investmentModel}`)], [t('land.return'), land.expectedReturnPct ? `${land.expectedReturnPct}%` : '—'], [t('land.area'), t('land.ha', { n: land.areaHa })],
  ];
  const ministry = land.source === 'ministry'
    ? ministryFacts(land, facts, t)
    : null;

  let cta: React.ReactNode;
  if (mode === 'owner' || isOwn) cta = <p className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-muted"><Info className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />{t('investor.detail.ownListing')}</p>;
  else if (land.status !== 'active' || !land.acceptingApplications || me?.isAdmin) cta = <p className="text-sm font-semibold text-muted">{t('investor.detail.notAccepting')}</p>;
  else if (myRequest) cta = <p className="text-sm font-semibold text-brand">{t('investor.detail.alreadySent')}</p>;
  else if (!me) cta = <Link to={lp('/login')} className="btn btn-primary w-full">{t('investor.detail.loginToInvest')}</Link>;
  else cta = <button type="button" className="btn btn-primary w-full" onClick={() => setInvest(true)}>{t('investor.detail.send')}</button>;

  const compact = (n: number) => new Intl.NumberFormat(f.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const fundedPct = Math.max(0, Math.min(100, Math.round((land.raisedAmount / Math.max(goal, 1)) * 100)));
  const box = (
    <div className="card p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('land.required')}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 font-sans text-[1.75rem] font-extrabold leading-tight text-brand tabular-nums">
          <span>{compact(land.investmentMin)}</span><span className="font-semibold text-muted" aria-hidden="true">–</span><span>{compact(land.investmentMax)}</span>
          <span className="text-base font-bold text-muted">AZN</span>
        </p>
      </div>
      <div className="rounded-xl bg-[#F7F5EF] p-4 text-sm">
        <p className="font-semibold">{t('competition.deadline')}: {land.applicationDeadline ? f.date(land.applicationDeadline) : '—'}</p>
        {land.eligibilityConditions?.map(c => <p key={c} className="mt-2 text-muted">{c}</p>)}
        {!!land.requiredDocuments?.length && <p className="mt-2 text-muted">{t('competition.documents')}: {land.requiredDocuments.join(', ')}</p>}
      </div>
      {cta}
      {mode !== 'owner' && (
        <div className="flex gap-2">
          {me && <button type="button" className="btn btn-outline btn-sm flex-1" aria-pressed={saved} onClick={() => landService.toggleSaved(me.id, land.id)}><Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />{saved ? t('land.saved') : t('land.save')}</button>}
          <button type="button" className="btn btn-outline btn-sm flex-1" aria-pressed={has(land.id)} onClick={() => toggle(land.id)}>{has(land.id) ? t('land.inCompare') : t('land.addCompare')}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className={mode === 'public' ? 'container-x py-10 lg:py-14' : ''}>
      {/* Gallery */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 h-[300px] sm:h-[440px] rounded-[1.5rem] overflow-hidden">
        {land.photos.slice(0, 5).map((p, i) => {
          const rest = Math.min(land.photos.length, 5) - 1;
          const span = i === 0 ? (rest === 0 ? 'col-span-4 row-span-2' : 'col-span-4 sm:col-span-2 row-span-2')
            : rest === 1 ? 'hidden sm:block col-span-2 row-span-2'
            : rest === 2 ? 'hidden sm:block row-span-2'
            : rest === 3 && i === 3 ? 'hidden sm:block col-span-2' : 'hidden sm:block';
          return (
            <button key={p + i} type="button" onClick={() => setLightbox(i)} aria-label={t('land.openPhoto', { n: i + 1 })} className={`relative overflow-hidden group ${span}`}>
              <Photo src={p} alt={i === 0 ? title : ''} eager={i === 0} className="w-full h-full transition duration-500 group-hover:scale-105" />
            </button>
          );
        })}
      </div>
      {lightbox !== null && <Lightbox photos={land.photos} index={lightbox} onClose={() => setLightbox(null)} alt={title} />}

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-8">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <TypeBadge type={land.fieldType} />
            {land.ownerVerified && <VerifiedBadge />}
            {land.isSpecial && <span className="inline-flex items-center gap-1 rounded-full bg-gold text-forest px-2.5 py-1 text-xs font-bold"><Star className="w-3 h-3" aria-hidden="true" />{t('land.special')}</span>}
            {mode === 'owner' && <StatusBadge status={land.status} />}
            {land.source === 'ministry' && <span className="inline-flex items-center gap-1 rounded-full bg-sage text-brand px-2.5 py-1 text-xs font-bold"><Landmark className="w-3 h-3" aria-hidden="true" />{t('ministry.badge')}</span>}
          </div>
          <h1 className="font-display text-4xl lg:text-5xl text-brand leading-tight">{title}</h1>
          <p className="text-muted mt-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" aria-hidden="true" />{t(`regions.${land.region}`)} · {t('land.ha', { n: land.areaHa })}</p>

          {mode === 'owner' && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="card p-4"><p className="text-xs text-muted font-semibold flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{t('owner.props.ownerStats')}</p><p className="font-bold mt-1">{t('land.views', { n: land.views })}</p></div>
              <div className="card p-4"><p className="text-xs text-muted font-semibold flex items-center gap-1"><Inbox className="w-3.5 h-3.5" />{t('owner.nav.requests')}</p><p className="font-bold mt-1">{t('land.requests', { n: requestCount })}</p></div>
            </div>
          )}

          {/* Three metrics, larger + "Why this score?" */}
          <div className="card p-6 mt-6">
            <div className="grid sm:grid-cols-3 gap-6 items-center">
              <div className="flex justify-center"><ScoreGauge value={score.suitability} size={96} /></div>
              <div className="flex justify-center"><RiskBadge level={score.risk} factors={score.riskFactors} size="lg" /></div>
              <ProgressBar label={t('land.fertility')} value={land.fertilityPct} />
            </div>
            <button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why} className="mt-5 text-sm font-bold text-leaf-dark flex items-center gap-1">
              {t('investor.detail.why')}<ChevronDown className={`w-4 h-4 transition ${why ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {why && (
              <ul className="mt-4 grid gap-3">
                {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map(k => (
                  <li key={k}>
                    <ProgressBar label={`${t(`investor.detail.factor.${k}`)} · ${t('investor.detail.weight', { w: WEIGHTS[k] * 100 })}`} value={score.breakdown[k] * 100} tone="brand" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:hidden mt-6">{box}</div>

          <section className="mt-8">
            <h2 className="font-display text-2xl text-brand mb-4">{t('land.keyFacts')}</h2>
            {ministry}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line rounded-2xl overflow-hidden border border-line">
              {(land.source === 'ministry' ? facts.filter(([k]) => ![t('land.soil'), t('land.lastCrop'), t('land.electricity'), t('land.model')].includes(k)) : facts).map(([k, v]) => <div key={k} className="bg-white p-4"><dt className="text-xs font-semibold text-muted">{k}</dt><dd className="font-bold mt-1">{v}</dd></div>)}
            </dl>
          </section>
          {land.description && <section className="mt-8"><h2 className="font-display text-2xl text-brand mb-3">{t('land.description')}</h2><p className="text-ink/80 leading-relaxed whitespace-pre-line">{land.description}</p></section>}
          <section className="mt-8">
            <h2 className="font-display text-2xl text-brand mb-4">{t('land.location')}</h2>
            <SingleLandMap land={land} />
          </section>
        </div>
        <aside className="hidden lg:block"><div className="sticky top-28">{box}</div></aside>
      </div>
      {invest && <InvestModal land={land} open={invest} onClose={() => setInvest(false)} />}
    </div>
  );
};

export const PublicLandPage: React.FC = () => <LandDetail mode="public" />;

/** Notice for ministry listings: verification status in plain words, and that the portal is not an official registry. */
function ministryFacts(land: Land, _facts: [string, string][], t: TFunction): React.ReactNode {
  const verified = land.verification === 'VERIFIED';
  return (
    <div className={`mb-4 rounded-2xl border p-4 text-sm flex gap-3 ${verified ? 'border-leaf/40 bg-sage' : 'border-gold/50 bg-[#FBF6E9]'}`}>
      {verified ? <ShieldCheck className="w-5 h-5 shrink-0 text-leaf-dark" aria-hidden="true" /> : <ShieldAlert className="w-5 h-5 shrink-0 text-gold-dark" aria-hidden="true" />}
      <div>
        <p className="font-bold text-ink">{t(`ministry.verification.${land.verification ?? 'EVIDENCE_PENDING'}`)}</p>
        <p className="text-muted mt-1">{t(verified ? 'ministry.verifiedText' : 'ministry.unverifiedText')}{land.hasBoundary ? ` ${t('ministry.boundaryNote')}` : ''}</p>
        <p className="text-muted mt-1 text-xs">{t('ministry.notRegistry')}</p>
      </div>
    </div>
  );
}
