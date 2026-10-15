import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Heart, Inbox, Info, Landmark, MapPin, ShieldAlert, ShieldCheck, Star, X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { landService, requestService, useCurrentUser, useDbValue, ApiError } from '../../services/api';
import { scoreLand, WEIGHTS } from '../../services/scoring';
import { useFormat, useLocalePath } from '../../app/i18n';
import { useLandName } from './landText';
import { TypeBadge } from './LandCard';
import { Photo, ProgressBar, RiskBadge, ScoreGauge, VerifiedBadge, StatusBadge, Field, EmptyState } from '../../components/ui/Bits';
import { Modal, useToast } from '../../components/ui/Overlay';
import { SingleLandMap } from '../../components/map/LandsMap';
import { useCompare } from '../compare/CompareContext';
import type { InvestmentModel, Land } from '../../types/agro';
import { backend } from '../../services/backend';

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
  const [duration, setDuration] = useState(String(land.durationMonths));
  const [message, setMessage] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [requiresDocuments, setRequiresDocuments] = useState(false);
  useEffect(() => {
    if (!open || !land.source) return;
    void backend<{ activeOpportunity: { proposalDocumentsRequired: boolean } | null }>('GET', `/lands/${land.id}`)
      .then(d => setRequiresDocuments(!!d.activeOpportunity?.proposalDocumentsRequired)).catch(() => undefined);
  }, [open, land.id, land.source]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const a = Number(amount);
    if (land.source ? !(a > 0) : !(a >= land.investmentMin && a <= land.investmentMax)) er.amount = land.source ? t('form.required') : t('investor.detail.between', { min: f.azn(land.investmentMin), max: f.azn(land.investmentMax) });
    if (!(Number(duration) > 0)) er.duration = t('form.required');
    if (message.trim().length < 10) er.message = t('form.minLength', { n: 10 });
    if (requiresDocuments && documents.length === 0) er.documents = 'Bu elan üçün ən azı bir sənəd əlavə edin.';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await requestService.create({ landId: land.id, amount: a, investmentModel: model, durationMonths: Number(duration), message: message.trim(), documents });
      toast(t('investor.detail.sentToast'));
      onClose();
    } catch (x) {
      toast(t(x instanceof ApiError ? x.code : 'form.error'), 'error');
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('investor.detail.modalTitle')}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Field label={t('investor.detail.amount')} htmlFor="inv-amount" error={err.amount} hint={land.source ? `${t('land.required')}: ${f.azn(land.investmentMin)}` : t('investor.detail.between', { min: f.azn(land.investmentMin), max: f.azn(land.investmentMax) })}>
          <input id="inv-amount" className="field" type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={!!err.amount} data-autofocus />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          {!land.source && <Field label={t('land.model')} htmlFor="inv-model">
            <select id="inv-model" className="field" value={model} onChange={e => setModel(e.target.value as InvestmentModel)}>
              {(['profitSharing', 'lease', 'jointVenture'] as const).map(m => <option key={m} value={m}>{t(`models.${m}`)}</option>)}
            </select>
          </Field>}
          <Field label={t('owner.add.duration')} htmlFor="inv-dur" error={err.duration}>
            <input id="inv-dur" className="field" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
          </Field>
        </div>
        <Field label={t('investor.detail.message')} htmlFor="inv-msg" error={err.message}>
          <textarea id="inv-msg" className="field min-h-28" value={message} onChange={e => setMessage(e.target.value)} aria-invalid={!!err.message} />
        </Field>
        {land.source && <Field label="Təklif sənədləri" htmlFor="inv-docs" error={err.documents} optional={!requiresDocuments}>
          <input id="inv-docs" className="field" type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={e => setDocuments(Array.from(e.target.files ?? []))} />
        </Field>}
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
  const [contactPhone, setContactPhone] = useState<string | null>(null);

  useEffect(() => {
    setContactPhone(null);
    if (!land?.source || !myRequest) return;
    void backend<{ opportunities: { contactPhone: string | null; myProposal: { id: string } | null }[] }>('GET', `/lands/${land.id}`)
      .then(d => setContactPhone(d.opportunities.find(o => o.myProposal?.id === myRequest.id)?.contactPhone ?? null))
      .catch(() => undefined);
  }, [land?.id, land?.source, myRequest?.id]);

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
  const ministry = land.source === 'ministry' ? ministryFacts(land, facts, t)
    : land.source === 'ownerPortal' ? <p className="mb-4 text-sm text-muted">Bu elanın torpaq məlumatları sahibkar tərəfindən təqdim edilib və dərcdən əvvəl nazirlik tərəfindən yoxlanılıb. Göstərilməyən göstəricilər barədə məlumat yoxdur.</p> : null;

  let cta: React.ReactNode;
  if (mode === 'owner' || isOwn) cta = <p className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-muted"><Info className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />{t('investor.detail.ownListing')}</p>;
  else if (land.status !== 'active') cta = <p className="text-sm font-semibold text-muted">{t('investor.detail.notAccepting')}</p>;
  else if (myRequest) cta = <div className="text-sm font-semibold text-brand"><p>{t('investor.detail.alreadySent')}</p>{contactPhone && <p className="mt-2">Əlaqə nömrəsi: {contactPhone}</p>}</div>;
  else if (!me) cta = <Link to={lp('/login')} className="btn btn-primary w-full">{t('investor.detail.loginToInvest')}</Link>;
  else cta = <button type="button" className="btn btn-primary w-full" onClick={() => setInvest(true)}>{t('investor.detail.send')}</button>;

  const compact = (n: number) => new Intl.NumberFormat(f.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const fundedPct = Math.max(0, Math.min(100, Math.round((land.raisedAmount / Math.max(goal, 1)) * 100)));
  const box = (
    <div className="card p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('land.required')}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 font-sans text-[1.75rem] font-extrabold leading-tight text-brand tabular-nums">
          <span>{compact(land.investmentMin)}</span>{!land.source && <><span className="font-semibold text-muted" aria-hidden="true">–</span><span>{compact(land.investmentMax)}</span></>}
          <span className="text-base font-bold text-muted">AZN</span>
        </p>
      </div>
      {!land.source && <div className="rounded-xl bg-[#F7F5EF] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{t('land.fundingProgress')}</span>
          <span className="text-sm font-extrabold text-brand tabular-nums">{fundedPct}%</span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-[#E6E0D0] overflow-hidden" role="progressbar" aria-label={t('land.fundingProgress')}
          aria-valuenow={fundedPct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={t('land.raisedOf', { raised: f.compactAzn(land.raisedAmount), goal: f.compactAzn(goal) })}>
          <div className="h-full rounded-full bg-gold" style={{ width: `${fundedPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between gap-3 text-xs text-muted tabular-nums">
          <span>{t('land.raised', { amount: f.compactAzn(land.raisedAmount) })}</span>
          <span>{t('land.goal', { amount: f.compactAzn(goal) })}</span>
        </div>
      </div>}
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
            {!land.source && land.ownerVerified && <VerifiedBadge />}
            {land.isSpecial && <span className="inline-flex items-center gap-1 rounded-full bg-gold text-forest px-2.5 py-1 text-xs font-bold"><Star className="w-3 h-3" aria-hidden="true" />{t('land.special')}</span>}
            {mode === 'owner' && <StatusBadge status={land.status} />}
            {land.source === 'ministry' && <span className="inline-flex items-center gap-1 rounded-full bg-sage text-brand px-2.5 py-1 text-xs font-bold"><Landmark className="w-3 h-3" aria-hidden="true" />{t('ministry.badge')}</span>}
          </div>
          <h1 className="font-display text-4xl lg:text-5xl text-brand leading-tight">{title}</h1>
          <p className="text-muted mt-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" aria-hidden="true" />{t(`regions.${land.region}`)} · {t('land.ha', { n: land.areaHa })}</p>

          {mode === 'owner' && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {!land.source && <div className="card p-4"><p className="text-xs text-muted font-semibold flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{t('owner.props.ownerStats')}</p><p className="font-bold mt-1">{t('land.views', { n: land.views })}</p></div>}
              <div className="card p-4"><p className="text-xs text-muted font-semibold flex items-center gap-1"><Inbox className="w-3.5 h-3.5" />{t('owner.nav.requests')}</p><p className="font-bold mt-1">{t('land.requests', { n: requestCount })}</p></div>
            </div>
          )}

          {/* Three metrics, larger + "Why this score?" */}
          {!score.unavailable && <div className="card p-6 mt-6">
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
          </div>}

          <div className="lg:hidden mt-6">{box}</div>

          <section className="mt-8">
            <h2 className="font-display text-2xl text-brand mb-4">{t('land.keyFacts')}</h2>
            {ministry}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line rounded-2xl overflow-hidden border border-line">
              {(land.source ? facts.filter(([k]) => k === t('land.area')) : facts).map(([k, v]) => <div key={k} className="bg-white p-4"><dt className="text-xs font-semibold text-muted">{k}</dt><dd className="font-bold mt-1">{v}</dd></div>)}
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
