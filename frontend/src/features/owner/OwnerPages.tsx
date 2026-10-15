import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import {
  BadgeCheck, CheckCircle2, Coins, Eye, FileText, Grid3x3, Inbox, LayoutList, MapPin, MoreHorizontal, Plus, Search, Sprout, Trash2, Trophy, Upload, Users, X, GripVertical,
} from 'lucide-react';
import { authService, landService, requestService, useCurrentUser, useDbValue, userById, ApiError } from '../../services/api';
import { useFormat, useLocalePath } from '../../app/i18n';
import { useLandName } from '../shared/landText';
import { TypeBadge } from '../shared/LandCard';
import { PageTitle, Avatar } from '../cabinet/CabinetShell';
import { ConfirmDialog, Drawer, useDismiss, useToast } from '../../components/ui/Overlay';
import { EmptyState, Field, Photo, ProgressBar, RequestBadge, SkeletonCard, StatCard, StatusBadge, Stepper, Tabs, Toggle, VerifiedBadge, Segmented } from '../../components/ui/Bits';
import { PinPicker } from '../../components/map/LandsMap';
import { CATEGORIES } from '../../data/categories';
import { REGIONS, regionByKey } from '../../data/regions';
import type { InvestmentModel, InvestmentRequest, Irrigation, Land, LandStatus, SoilType } from '../../types/agro';

function useLoading(ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const id = setTimeout(() => setLoading(false), ms); return () => clearTimeout(id); }, []);
  return loading;
}

/* ================= 3.1 Overview ================= */
export const OwnerOverview: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const me = useCurrentUser()!;
  const lands = useDbValue(() => landService.byOwner(me.id));
  const requests = useDbValue(() => requestService.forOwner(me.id));
  const loading = useLoading();
  const pending = requests.filter(r => r.status === 'pending');
  const selected = requests.filter(r => r.status === 'selected');
  const total = selected.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <PageTitle title={t('cabinet.welcome', { name: me.fullName.split(' ')[0] })} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('owner.kpi.listed')} value={String(lands.length)} icon={<Sprout className="w-5 h-5" />} />
        <StatCard label={t('owner.kpi.pending')} value={String(pending.length)} icon={<Inbox className="w-5 h-5" />} />
        <StatCard label={t('owner.kpi.approved')} value={String(selected.length)} icon={<Trophy className="w-5 h-5" />} />
        <StatCard label={t('owner.kpi.total')} value={f.compactAzn(total)} icon={<Coins className="w-5 h-5" />} accent />
      </div>
      <div className="grid xl:grid-cols-[1fr_340px] gap-6">
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-brand">{t('owner.recent')}</h2>
            <Link to={lp('/owner/requests')} className="text-sm font-bold text-leaf-dark hover:underline">{t('owner.viewAll')}</Link>
          </div>
          {loading ? <div className="grid gap-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-16" />)}</div>
            : requests.length === 0 ? <p className="text-muted py-6 text-center">{t('owner.noRequests')}</p>
            : <RequestList requests={requests.slice(0, 5)} compact />}
        </section>
        <section className="rounded-[1.25rem] bg-forest text-cream p-6 flex flex-col">
          <Sprout className="w-8 h-8 text-gold" aria-hidden="true" />
          <h2 className="font-display text-2xl mt-4">{t('owner.addCta')}</h2>
          <p className="text-cream/80 mt-2 flex-1">{t('owner.addCtaText')}</p>
          <Link to={lp('/owner/add-land')} className="btn btn-gold mt-6 self-start"><Plus className="w-4 h-4" />{t('owner.nav.add')}</Link>
        </section>
      </div>
    </>
  );
};

/* ================= 3.3 Investment requests (one-winner rule) ================= */
const RequestList: React.FC<{ requests: InvestmentRequest[]; compact?: boolean; onView?: (r: InvestmentRequest) => void }> = ({ requests, compact, onView }) => {
  const { t } = useTranslation();
  const f = useFormat();
  const name = useLandName();
  const [pick, setPick] = useState<InvestmentRequest | null>(null);
  return (
    <>
      <ul className="divide-y divide-line">
        {requests.map(r => {
          const inv = userById(r.investorId);
          const land = landService.get(r.landId);
          return (
            <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
              <Avatar name={inv?.fullName ?? '?'} size="sm" gold />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{inv?.fullName} {inv?.verified && <BadgeCheck className="inline w-4 h-4 text-gold-dark" aria-label={t('owner.req.verified')} />}</p>
                <p className="text-xs text-muted truncate">{name(land)} · {f.date(r.createdAt)}</p>
              </div>
              <p className="font-bold text-sm">{f.azn(r.amount)}</p>
              {r.status === 'pending' && land?.status === 'active'
                ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setPick(r)}><Trophy className="w-4 h-4" />{t('owner.req.select')}</button>
                : <RequestBadge status={r.status} />}
              {!compact && onView && <button type="button" className="btn btn-outline btn-sm" onClick={() => onView(r)}>{t('owner.req.view')}</button>}
            </li>
          );
        })}
      </ul>
      <SelectWinnerDialog request={pick} onClose={() => setPick(null)} />
    </>
  );
};

const SelectWinnerDialog: React.FC<{ request: InvestmentRequest | null; onClose: () => void }> = ({ request, onClose }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!request) return null;
  const inv = userById(request.investorId);
  const others = requestService.forLand(request.landId).filter(r => r.status === 'pending' && r.id !== request.id).length;
  return (
    <ConfirmDialog open title={t('owner.req.selectTitle', { name: inv?.fullName })} text={t('owner.req.selectText', { n: others })} confirmLabel={t('owner.req.select')} busy={busy}
      onClose={onClose} onConfirm={async () => {
        setBusy(true);
        try { await requestService.selectWinner(request.id); toast(t('owner.req.selectedToast', { name: inv?.fullName })); onClose(); }
        catch (x) { toast(t(x instanceof ApiError ? x.code : 'form.error'), 'error'); }
        finally { setBusy(false); }
      }} />
  );
};

export const OwnerRequests: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const name = useLandName();
  const me = useCurrentUser()!;
  const all = useDbValue(() => requestService.forOwner(me.id));
  const lands = useDbValue(() => landService.byOwner(me.id));
  const loading = useLoading();
  const [tab, setTab] = useState<InvestmentRequest['status']>('pending');
  const [q, setQ] = useState('');
  const [prop, setProp] = useState('');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<InvestmentRequest | null>(null);
  const [pick, setPick] = useState<InvestmentRequest | null>(null);
  const PER = 8;
  const counts = { pending: 0, selected: 0, notSelected: 0 } as Record<InvestmentRequest['status'], number>;
  all.forEach(r => counts[r.status]++);
  const rows = all.filter(r => r.status === tab && (!prop || r.landId === prop) && (!q || `${userById(r.investorId)?.fullName} ${name(landService.get(r.landId))}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (sort === 'amount' ? b.amount - a.amount : b.createdAt.localeCompare(a.createdAt)));
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const shown = rows.slice((page - 1) * PER, page * PER);
  useEffect(() => setPage(1), [tab, q, prop, sort]);
  useEffect(() => { if (view && !view.viewedByOwner) requestService.markViewed(view.id); }, [view?.id]);

  const actions = (r: InvestmentRequest) => (
    <div className="flex flex-col gap-2 items-stretch justify-end min-w-[9.5rem]">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setView(r)}>{t('owner.req.view')}</button>
      {r.status === 'pending' && landService.get(r.landId)?.status === 'active' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setPick(r)}><Trophy className="w-4 h-4" />{t('owner.req.select')}</button>}
    </div>
  );

  return (
    <>
      <PageTitle title={t('owner.req.title')} />
      <Tabs label={t('owner.req.title')} value={tab} onChange={setTab} tabs={[
        { id: 'pending', label: t('reqStatus.pending'), count: counts.pending },
        { id: 'selected', label: t('reqStatus.selected'), count: counts.selected },
        { id: 'notSelected', label: t('reqStatus.notSelected'), count: counts.notSelected },
      ]} />
      <div className="flex flex-col md:flex-row gap-3 my-5">
        <label className="relative flex-1"><span className="sr-only">{t('owner.req.search')}</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input className="field pl-9" placeholder={t('owner.req.search')} value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <select className="field md:!w-64" aria-label={t('owner.req.property')} value={prop} onChange={e => setProp(e.target.value)}>
          <option value="">{t('owner.req.allProps')}</option>
          {lands.map(l => <option key={l.id} value={l.id}>{name(l)}</option>)}
        </select>
        <select className="field md:!w-52" aria-label={t('investor.search.sort')} value={sort} onChange={e => setSort(e.target.value as 'date' | 'amount')}>
          <option value="date">{t('owner.req.sortDate')}</option><option value="amount">{t('owner.req.sortAmount')}</option>
        </select>
      </div>

      {loading ? <div className="grid gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-16" />)}</div> : shown.length === 0 ? <EmptyState title={t('owner.req.empty')} icon={<Inbox className="w-7 h-7" />} /> : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sage/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>{['investor', 'property', 'amount', 'model', 'duration', 'date', 'statusCol', 'actions'].map(c => (
                  <th key={c} scope="col" className={`px-3 py-3 font-bold ${c === 'actions' ? 'text-right' : ''} ${c === 'duration' || c === 'model' ? 'hidden xl:table-cell' : ''}`}>{c === 'model' ? t('land.model') : c === 'duration' ? t('land.duration') : t(`owner.req.${c}`)}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map(r => {
                  const inv = userById(r.investorId);
                  return (
                    <tr key={r.id} className={r.viewedByOwner ? '' : 'bg-[#FBF6E8]/60'}>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={inv?.fullName ?? '?'} size="sm" gold /><span className="font-semibold">{inv?.fullName}</span>{inv?.verified && <BadgeCheck className="w-4 h-4 text-gold-dark" aria-label={t('owner.req.verified')} />}</div></td>
                      <td className="px-4 py-3 max-w-56 truncate">{name(landService.get(r.landId))}</td>
                      <td className="px-4 py-3 font-bold whitespace-nowrap">{f.azn(r.amount)}</td>
                      <td className="px-3 py-3 hidden xl:table-cell">{t(`models.${r.investmentModel}`)}</td>
                      <td className="px-3 py-3 whitespace-nowrap hidden xl:table-cell">{t('land.months', { n: r.durationMonths })}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{f.date(r.createdAt)}</td>
                      <td className="px-4 py-3"><RequestBadge status={r.status} /></td>
                      <td className="px-4 py-3">{actions(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="md:hidden grid gap-3">
            {shown.map(r => {
              const inv = userById(r.investorId);
              return (
                <li key={r.id} className="card p-4">
                  <div className="flex items-center gap-3"><Avatar name={inv?.fullName ?? '?'} size="sm" gold /><div className="flex-1 min-w-0"><p className="font-semibold truncate">{inv?.fullName}</p><p className="text-xs text-muted truncate">{name(landService.get(r.landId))}</p></div><RequestBadge status={r.status} /></div>
                  <p className="mt-3 text-sm"><strong>{f.azn(r.amount)}</strong> · {t(`models.${r.investmentModel}`)} · {t('land.months', { n: r.durationMonths })}</p>
                  <div className="mt-3">{actions(r)}</div>
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button type="button" className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('form.back')}</button>
              <span className="text-sm font-semibold">{t('owner.req.page', { n: page, total: pages })}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>{t('form.next')}</button>
            </div>
          )}
        </>
      )}

      <Drawer open={!!view} onClose={() => setView(null)} title={t('owner.req.view')}
        footer={view && view.status === 'pending' && landService.get(view.landId)?.status === 'active' ? <button type="button" className="btn btn-primary" onClick={() => { setPick(view); setView(null); }}><Trophy className="w-4 h-4" />{t('owner.req.select')}</button> : undefined}>
        {view && (() => {
          const inv = userById(view.investorId);
          const land = landService.get(view.landId);
          return (
            <div className="grid gap-6">
              <section>
                <h3 className="eyebrow mb-3">{t('owner.req.profile')}</h3>
                <div className="flex items-center gap-3"><Avatar name={inv?.fullName ?? '?'} gold /><div><p className="font-bold">{inv?.fullName}</p><p className="text-sm text-muted">{inv?.investorType ? t(`auth.${inv.investorType}`) : ''}{inv?.companyName ? ` · ${inv.companyName}` : ''}</p></div></div>
                <div className="mt-3 flex gap-2">{inv?.verified && <VerifiedBadge label={t('settings.verifiedInvestor')} />}<RequestBadge status={view.status} /></div>
              </section>
              <section>
                <h3 className="eyebrow mb-3">{t('owner.req.offered')}</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="card p-3"><dt className="text-muted text-xs">{t('owner.req.amount')}</dt><dd className="font-bold">{f.azn(view.amount)}</dd></div>
                  <div className="card p-3"><dt className="text-muted text-xs">{t('land.model')}</dt><dd className="font-bold">{t(`models.${view.investmentModel}`)}</dd></div>
                  <div className="card p-3"><dt className="text-muted text-xs">{t('land.duration')}</dt><dd className="font-bold">{t('land.months', { n: view.durationMonths })}</dd></div>
                  <div className="card p-3"><dt className="text-muted text-xs">{t('owner.req.date')}</dt><dd className="font-bold">{f.date(view.createdAt)}</dd></div>
                </dl>
              </section>
              <section>
                <h3 className="eyebrow mb-3">{t('owner.req.message')}</h3>
                <p className="rounded-2xl bg-white border border-line p-4 italic">“{view.message.startsWith('requestMessages.') ? t(view.message) : view.message}”</p>
              </section>
              {land && (
                <section>
                  <h3 className="eyebrow mb-3">{t('owner.req.property')}</h3>
                  <div className="flex gap-3 items-center"><Photo src={land.photos[0]} alt="" className="w-20 h-16 rounded-xl" /><div><p className="font-bold">{name(land)}</p><p className="text-sm text-muted">{t('land.ha', { n: land.areaHa })} · {f.compactAzn(land.investmentMin)}–{f.compactAzn(land.investmentMax)}</p></div></div>
                </section>
              )}
            </div>
          );
        })()}
      </Drawer>
      <SelectWinnerDialog request={pick} onClose={() => setPick(null)} />
    </>
  );
};

/* ================= 3.4 My properties ================= */
const PropertyMenu: React.FC<{ land: Land; title: string }> = ({ land, title }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const item = 'flex items-center gap-2 w-full px-4 py-2 text-sm font-semibold hover:bg-sage text-left';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t('owner.props.actions', { title })} className="w-9 h-9 rounded-full bg-white/95 grid place-items-center shadow hover:bg-sand"><MoreHorizontal className="w-5 h-5" /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white border border-line shadow-[var(--shadow-lift)] py-1 z-20">
          <button role="menuitem" type="button" className={item} onClick={() => navigate(lp(`/owner/properties/${land.id}`))}><Eye className="w-4 h-4" />{t('owner.props.view')}</button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); toast(t('owner.props.editSoon'), 'info'); }}><FileText className="w-4 h-4" />{t('owner.props.edit')}</button>
          {(land.status === 'active' || land.status === 'paused') && (
            <button role="menuitem" type="button" className={item} onClick={async () => { setOpen(false); const p = land.status === 'active'; await landService.setStatus(land.id, p ? 'paused' : 'active'); toast(t(p ? 'owner.props.paused' : 'owner.props.resumed')); }}>
              {land.status === 'active' ? t('owner.props.pause') : t('owner.props.resume')}
            </button>
          )}
          <button role="menuitem" type="button" className={`${item} text-danger`} onClick={() => { setOpen(false); setDel(true); }}><Trash2 className="w-4 h-4" />{t('owner.props.delete')}</button>
        </div>
      )}
      <ConfirmDialog open={del} danger title={t('owner.props.deleteTitle')} text={t('owner.props.deleteText')} confirmLabel={t('owner.props.delete')} onClose={() => setDel(false)}
        onConfirm={async () => { await landService.remove(land.id); setDel(false); toast(t('owner.props.deleted')); }} />
    </div>
  );
};

export const OwnerProperties: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const name = useLandName();
  const me = useCurrentUser()!;
  const lands = useDbValue(() => landService.byOwner(me.id));
  const reqs = useDbValue(() => requestService.forOwner(me.id));
  const loading = useLoading();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [status, setStatus] = useState<LandStatus | ''>('');
  const [type, setType] = useState('');
  const shown = lands.filter(l => (!status || l.status === status) && (!type || l.fieldType === type));
  const types = Array.from(new Set(lands.map(l => l.fieldType)));
  return (
    <>
      <PageTitle title={t('owner.nav.properties')} actions={<Link to={lp('/owner/add-land')} className="btn btn-primary"><Plus className="w-4 h-4" />{t('owner.nav.add')}</Link>} />
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <select className="field !w-auto" aria-label={t('owner.props.allStatuses')} value={status} onChange={e => setStatus(e.target.value as LandStatus | '')}>
          <option value="">{t('owner.props.allStatuses')}</option>
          {(['draft', 'underReview', 'active', 'funded', 'paused', 'closed'] as LandStatus[]).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <select className="field !w-auto" aria-label={t('owner.props.allTypes')} value={type} onChange={e => setType(e.target.value)}>
          <option value="">{t('owner.props.allTypes')}</option>
          {types.map(x => <option key={x} value={x}>{t(`fieldTypes.${x}`)}</option>)}
        </select>
        <div className="ml-auto inline-flex rounded-full bg-sand p-1" role="group" aria-label={t('owner.props.grid')}>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} className={`p-2 rounded-full ${view === 'grid' ? 'bg-white shadow text-brand' : 'text-muted'}`} aria-label={t('owner.props.grid')}><Grid3x3 className="w-4 h-4" /></button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`p-2 rounded-full ${view === 'list' ? 'bg-white shadow text-brand' : 'text-muted'}`} aria-label={t('owner.props.list')}><LayoutList className="w-4 h-4" /></button>
        </div>
      </div>
      {loading ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{[0, 1, 2].map(i => <SkeletonCard key={i} />)}</div>
        : shown.length === 0 ? <EmptyState title={t('owner.props.empty')} action={<Link to={lp('/owner/add-land')} className="btn btn-primary mt-2"><Plus className="w-4 h-4" />{t('owner.nav.add')}</Link>} />
        : (
          <ul className={view === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-5' : 'grid gap-4'}>
            {shown.map(l => {
              const title = name(l);
              const goal = l.investmentMax;
              const reqCount = reqs.filter(r => r.landId === l.id).length;
              return (
                <li key={l.id} className={`card overflow-hidden ${view === 'list' ? 'flex flex-col sm:flex-row' : 'flex flex-col'}`}>
                  <div className={`relative ${view === 'list' ? 'sm:w-64 shrink-0' : ''}`}>
                    <Link to={lp(`/owner/properties/${l.id}`)} tabIndex={-1} aria-hidden="true"><Photo src={l.photos[0]} alt="" className={`w-full ${view === 'list' ? 'h-44 sm:h-full' : 'aspect-[16/10]'}`} /></Link>
                    <div className="absolute top-3 left-3"><StatusBadge status={l.status} /></div>
                    <div className="absolute top-3 right-3"><PropertyMenu land={l} title={title} /></div>
                  </div>
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <TypeBadge type={l.fieldType} />
                    <h2 className="font-display text-xl text-brand leading-snug"><Link to={lp(`/owner/properties/${l.id}`)} className="hover:underline">{title}</Link></h2>
                    <p className="text-sm text-muted flex items-center gap-1"><MapPin className="w-4 h-4" aria-hidden="true" />{t(`regions.${l.region}`)} · {t('land.ha', { n: l.areaHa })}</p>
                    <ProgressBar label={t('land.funding')} value={(l.raisedAmount / goal) * 100} tone="gold" showValue={t('land.raisedOf', { raised: f.compactAzn(l.raisedAmount), goal: f.compactAzn(goal) })} />
                    <p className="text-xs text-muted flex gap-4 mt-auto pt-2"><span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" aria-hidden="true" />{t('land.views', { n: l.views })}</span><span className="flex items-center gap-1"><Inbox className="w-3.5 h-3.5" aria-hidden="true" />{t('land.requests', { n: reqCount })}</span></p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </>
  );
};

/* ================= 3.2 Add land wizard ================= */
interface PhotoItem { id: string; url: string; name: string }
type Draft = {
  title: string; fieldType: string; description: string; region: string; address: string; pin: { lat: number; lng: number } | null; areaHa: string;
  soilType: SoilType | ''; fertilityPct: number; irrigation: Irrigation | ''; lastCrop: string; roadAccess: boolean; electricity: boolean; ownershipDoc: string;
  investmentMin: string; investmentMax: string; investmentModel: InvestmentModel | ''; expectedReturnPct: string; durationMonths: string; isSpecial: boolean;
  photos: PhotoItem[]; documents: { name: string; size: number }[];
};
const EMPTY: Draft = {
  title: '', fieldType: '', description: '', region: '', address: '', pin: null, areaHa: '', soilType: '', fertilityPct: 70, irrigation: '', lastCrop: '', roadAccess: true, electricity: true, ownershipDoc: 'extract',
  investmentMin: '', investmentMax: '', investmentModel: '', expectedReturnPct: '', durationMonths: '', isSpecial: false, photos: [], documents: [],
};
const DRAFT_KEY = 'agroinvest_add_land_draft';

export const AddLandWizard: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const toast = useToast();
  const name = useLandName();
  const [d, setD] = useState<Draft>(() => { try { const s = localStorage.getItem(DRAFT_KEY); return s ? { ...EMPTY, ...JSON.parse(s), photos: [] } : EMPTY; } catch { return EMPTY; } });
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const steps = t('owner.add.steps', { returnObjects: true }) as unknown as string[];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const MAX_DESC = 600;

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    const req = (k: keyof Draft) => { if (d[k] === '' || d[k] === null) e[k] = t('form.required'); };
    if (s === 0) { req('fieldType'); if (d.description.trim().length < 20) e.description = t('form.minLength', { n: 20 }); }
    if (s === 1) { req('region'); req('address'); if (!d.pin) e.pin = t('owner.add.errPin'); if (!(Number(d.areaHa) > 0)) e.areaHa = t('form.required'); }
    if (s === 2) { req('soilType'); req('irrigation'); req('lastCrop'); }
    if (s === 3) {
      req('investmentModel');
      if (!(Number(d.investmentMin) > 0)) e.investmentMin = t('form.required');
      if (!(Number(d.investmentMax) > 0)) e.investmentMax = t('form.required');
      else if (Number(d.investmentMin) >= Number(d.investmentMax)) e.investmentMax = t('owner.add.errMin');
      if (!(Number(d.expectedReturnPct) > 0)) e.expectedReturnPct = t('form.required');
      if (!(Number(d.durationMonths) > 0)) e.durationMonths = t('form.required');
    }
    if (s === 4 && d.photos.length === 0) e.photos = t('owner.add.errPhotos');
    setErr(e);
    return Object.keys(e).length === 0;
  };
  const next = () => { if (validate(step)) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const saveDraft = () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, photos: [] })); } catch { /* ignore */ }
    toast(t('owner.add.draftSaved'));
  };
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter(x => x.type.startsWith('image/'));
    if (d.photos.length + imgs.length > 10) toast(t('owner.add.tooMany'), 'error');
    const items = imgs.slice(0, 10 - d.photos.length).map(file => ({ id: `${file.name}-${file.size}-${Math.random()}`, url: URL.createObjectURL(file), name: file.name }));
    set('photos', [...d.photos, ...items]);
  };
  const move = (from: number, to: number) => {
    const arr = [...d.photos];
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
    set('photos', arr);
  };
  const submit = async () => {
    setBusy(true);
    const r = regionByKey(d.region);
    await landService.create({
      ownerId: authService.currentUser()!.id, title: d.title.trim() || undefined, fieldType: d.fieldType, description: d.description.trim(), region: d.region, address: d.address,
      lat: d.pin?.lat ?? r?.lat ?? 40, lng: d.pin?.lng ?? r?.lng ?? 47, areaHa: Number(d.areaHa), soilType: d.soilType as SoilType, fertilityPct: d.fertilityPct, irrigation: d.irrigation as Irrigation,
      lastCrop: d.lastCrop, roadAccess: d.roadAccess, electricity: d.electricity, ownershipDoc: d.ownershipDoc, investmentMin: Number(d.investmentMin), investmentMax: Number(d.investmentMax),
      investmentModel: d.investmentModel as InvestmentModel, expectedReturnPct: Number(d.expectedReturnPct), durationMonths: Number(d.durationMonths), isSpecial: d.isSpecial,
      // Mock: blob URLs only live for this tab — the real API will store the uploaded files.
      photos: d.photos.map(p => p.url), documents: d.documents, status: 'underReview',
    }, false);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setBusy(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="card p-10 max-w-2xl mx-auto text-center" role="status">
        <CheckCircle2 className="w-16 h-16 text-leaf mx-auto" aria-hidden="true" />
        <h1 className="font-display text-3xl text-brand mt-4">{t('owner.add.successTitle')}</h1>
        <p className="text-muted mt-3">{t('owner.add.successText')}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link to={lp('/owner/properties')} className="btn btn-primary">{t('owner.add.toProperties')}</Link>
          <button type="button" className="btn btn-outline" onClick={() => { setD(EMPTY); setStep(0); setDone(false); }}>{t('owner.add.addAnother')}</button>
        </div>
      </div>
    );
  }

  const sel = (k: keyof Draft, options: { value: string; label: string }[], label: string) => (
    <Field label={label} htmlFor={`al-${k}`} error={err[k]}>
      <select id={`al-${k}`} className="field" value={String(d[k])} onChange={e => set(k, e.target.value as never)} aria-invalid={!!err[k]}>
        <option value="">{t('owner.add.choose')}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
  const num = (k: keyof Draft, label: string, suffix?: string) => (
    <Field label={label} htmlFor={`al-${k}`} error={err[k]}>
      <div className="relative"><input id={`al-${k}`} className="field" type="number" inputMode="decimal" min={0} value={String(d[k])} onChange={e => set(k, e.target.value as never)} aria-invalid={!!err[k]} />{suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}</div>
    </Field>
  );
  const yn = (k: 'roadAccess' | 'electricity', label: string) => (
    <fieldset><legend className="field-label">{label}</legend>
      <Segmented label={label} value={d[k] ? 'y' : 'n'} onChange={v => set(k, v === 'y')} options={[{ value: 'y', label: t('form.yes') }, { value: 'n', label: t('form.no') }]} />
    </fieldset>
  );

  const reviewRows: [number, [string, string][]][] = [
    [0, [[t('owner.add.listingTitle'), d.title || name({ fieldType: d.fieldType || 'crops', region: d.region || 'aghdam' })], [t('owner.add.fieldType'), d.fieldType ? t(`fieldTypes.${d.fieldType}`) : '—'], [t('owner.add.description'), d.description || '—']]],
    [1, [[t('owner.add.region'), d.region ? t(`regions.${d.region}`) : '—'], [t('owner.add.address'), d.address || '—'], [t('owner.add.pin'), d.pin ? `${d.pin.lat}, ${d.pin.lng}` : '—'], [t('owner.add.area'), d.areaHa ? t('land.ha', { n: d.areaHa }) : '—']]],
    [2, [[t('owner.add.soil'), d.soilType ? t(`soil.${d.soilType}`) : '—'], [t('owner.add.fertility'), `${d.fertilityPct}%`], [t('owner.add.irrigation'), d.irrigation ? t(`irrigationTypes.${d.irrigation}`) : '—'], [t('owner.add.lastCrop'), d.lastCrop || '—'], [t('owner.add.road'), d.roadAccess ? t('form.yes') : t('form.no')], [t('owner.add.electricity'), d.electricity ? t('form.yes') : t('form.no')], [t('owner.add.ownershipDoc'), t(`owner.add.docTypes.${d.ownershipDoc}`)]]],
    [3, [[t('land.required'), d.investmentMin && d.investmentMax ? `${f.azn(Number(d.investmentMin))} – ${f.azn(Number(d.investmentMax))}` : '—'], [t('owner.add.model'), d.investmentModel ? t(`models.${d.investmentModel}`) : '—'], [t('owner.add.return'), d.expectedReturnPct ? `${d.expectedReturnPct}%` : '—'], [t('owner.add.duration'), d.durationMonths ? t('land.months', { n: d.durationMonths }) : '—'], [t('owner.add.special'), d.isSpecial ? t('form.yes') : t('form.no')]]],
    [4, [[t('owner.add.photos'), String(d.photos.length)], [t('owner.add.docs'), d.documents.map(x => x.name).join(', ') || '—']]],
  ];

  return (
    <>
      <PageTitle title={t('owner.add.title')} />
      <div className="card p-4 sm:p-5 mb-6"><Stepper steps={steps} current={step} onStep={setStep} /><p className="md:hidden text-sm font-semibold mt-3">{steps[step]}</p></div>
      <div className="card p-6 sm:p-8">
        <h2 className="font-display text-2xl text-brand mb-6">{steps[step]}</h2>
        {step === 0 && (
          <div className="grid gap-5">
            <Field label={t('owner.add.listingTitle')} htmlFor="al-title" hint={t('owner.add.listingTitleHint')} optional><input id="al-title" className="field" value={d.title} onChange={e => set('title', e.target.value)} maxLength={120} /></Field>
            {sel('fieldType', CATEGORIES.map(c => ({ value: c.key, label: t(`fieldTypes.${c.key}`) })), t('owner.add.fieldType'))}
            <Field label={t('owner.add.description')} htmlFor="al-description" error={err.description} hint={t('owner.add.chars', { n: d.description.length, max: MAX_DESC })}>
              <textarea id="al-description" className="field min-h-32" maxLength={MAX_DESC} value={d.description} onChange={e => set('description', e.target.value)} aria-invalid={!!err.description} />
            </Field>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-5">
            <div className="grid sm:grid-cols-2 gap-5">
              {sel('region', REGIONS.map(r => ({ value: r.key, label: t(`regions.${r.key}`) })), t('owner.add.region'))}
              <Field label={t('owner.add.address')} htmlFor="al-address" error={err.address}><input id="al-address" className="field" value={d.address} onChange={e => set('address', e.target.value)} aria-invalid={!!err.address} /></Field>
            </div>
            <div><p className="field-label">{t('owner.add.pin')}</p><PinPicker value={d.pin} onChange={v => set('pin', v)} center={regionByKey(d.region) ?? undefined} error={err.pin} /></div>
            <div className="sm:w-1/2">{num('areaHa', t('owner.add.area'), 'ha')}</div>
          </div>
        )}
        {step === 2 && (
          <div className="grid sm:grid-cols-2 gap-5">
            {sel('soilType', (['chernozem', 'chestnut', 'alluvial', 'grayBrown', 'mountainMeadow', 'sandyLoam'] as const).map(s => ({ value: s, label: t(`soil.${s}`) })), t('owner.add.soil'))}
            <Field label={t('owner.add.fertility')} htmlFor="al-fert">
              <div className="flex items-center gap-4">
                <input id="al-fert" type="range" min={0} max={100} value={d.fertilityPct} onChange={e => set('fertilityPct', Number(e.target.value))} className="flex-1 accent-[#1F4D2E]" aria-valuetext={`${d.fertilityPct}%`} />
                <input type="number" min={0} max={100} value={d.fertilityPct} onChange={e => set('fertilityPct', Math.max(0, Math.min(100, Number(e.target.value))))} className="field !w-24" aria-label={t('owner.add.fertility')} />
              </div>
            </Field>
            {sel('irrigation', (['none', 'canal', 'well', 'drip'] as const).map(s => ({ value: s, label: t(`irrigationTypes.${s}`) })), t('owner.add.irrigation'))}
            <Field label={t('owner.add.lastCrop')} htmlFor="al-lastCrop" error={err.lastCrop}><input id="al-lastCrop" className="field" value={d.lastCrop} onChange={e => set('lastCrop', e.target.value)} aria-invalid={!!err.lastCrop} /></Field>
            {yn('roadAccess', t('owner.add.road'))}
            {yn('electricity', t('owner.add.electricity'))}
            <Field label={t('owner.add.ownershipDoc')} htmlFor="al-doc">
              <select id="al-doc" className="field" value={d.ownershipDoc} onChange={e => set('ownershipDoc', e.target.value)}>
                {['extract', 'cadastre', 'lease'].map(x => <option key={x} value={x}>{t(`owner.add.docTypes.${x}`)}</option>)}
              </select>
            </Field>
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-5">
            <div className="grid sm:grid-cols-2 gap-5">{num('investmentMin', t('owner.add.invMin'), 'AZN')}{num('investmentMax', t('owner.add.invMax'), 'AZN')}</div>
            <div className="grid sm:grid-cols-3 gap-5">
              {sel('investmentModel', (['profitSharing', 'lease', 'jointVenture'] as const).map(m => ({ value: m, label: t(`models.${m}`) })), t('owner.add.model'))}
              {num('expectedReturnPct', t('owner.add.return'), '%')}
              {num('durationMonths', t('owner.add.duration'))}
            </div>
            <div className="rounded-2xl bg-[#FBF6E8] border border-gold/40 p-5">
              <Toggle id="al-special" checked={d.isSpecial} onChange={v => set('isSpecial', v)} label={t('owner.add.special')} />
              <p className="text-sm text-muted mt-2">{t('owner.add.specialNote')}</p>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-8">
            <div>
              <p className="field-label">{t('owner.add.photos')}</p>
              <label className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer hover:border-leaf ${err.photos ? 'border-danger' : 'border-[#CFC8B6]'} bg-white`}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}>
                <Upload className="w-8 h-8 text-leaf" aria-hidden="true" />
                <span className="font-semibold">{t('owner.add.dropOrClick')}</span>
                <span className="text-sm text-muted">{t('owner.add.photosHint')}</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} />
              </label>
              {err.photos && <p className="field-error" role="alert">{err.photos}</p>}
              {d.photos.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
                  {d.photos.map((p, i) => (
                    <li key={p.id} draggable onDragStart={() => setDragIdx(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                      className={`relative rounded-xl overflow-hidden border-2 ${i === 0 ? 'border-gold' : 'border-transparent'} bg-white`}>
                      <img src={p.url} alt={p.name} className="w-full aspect-square object-cover" />
                      <span className="absolute top-1.5 left-1.5 p-1 rounded bg-white/90 cursor-grab" aria-hidden="true"><GripVertical className="w-3.5 h-3.5" /></span>
                      <button type="button" onClick={() => set('photos', d.photos.filter(x => x.id !== p.id))} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 grid place-items-center" aria-label={`${t('form.remove')}: ${p.name}`}><X className="w-4 h-4" /></button>
                      {i === 0 ? <span className="absolute bottom-1.5 left-1.5 rounded-full bg-gold text-forest px-2 py-0.5 text-[0.65rem] font-bold">{t('owner.add.cover')}</span>
                        : <button type="button" onClick={() => move(i, 0)} className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[0.65rem] font-bold">{t('owner.add.makeCover')}</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="field-label">{t('owner.add.docs')}</p>
              <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#CFC8B6] bg-white p-5 cursor-pointer hover:border-leaf">
                <FileText className="w-6 h-6 text-leaf" aria-hidden="true" /><span><span className="font-semibold block">{t('owner.add.dropOrClick')}</span><span className="text-sm text-muted">{t('owner.add.docsHint')}</span></span>
                <input type="file" accept="application/pdf" multiple className="sr-only" onChange={e => { const fs = Array.from(e.target.files ?? []); set('documents', [...d.documents, ...fs.map(x => ({ name: x.name, size: x.size }))]); e.target.value = ''; }} />
              </label>
              {d.documents.length > 0 && <ul className="mt-3 grid gap-2">{d.documents.map((x, i) => <li key={x.name + i} className="flex items-center gap-2 text-sm"><FileText className="w-4 h-4 text-muted" />{x.name}<button type="button" className="ml-auto text-danger text-xs font-bold" onClick={() => set('documents', d.documents.filter((_, k) => k !== i))}>{t('form.remove')}</button></li>)}</ul>}
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="grid gap-5">
            <p className="text-muted">{t('owner.add.review')}</p>
            {reviewRows.map(([s, rows]) => (
              <section key={s} className="rounded-2xl border border-line bg-white">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line"><h3 className="font-bold">{steps[s]}</h3><button type="button" className="text-sm font-bold text-leaf-dark hover:underline" onClick={() => setStep(s)}>{t('form.edit')}</button></div>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 p-5 text-sm">{rows.map(([k, v]) => <div key={k}><dt className="text-muted text-xs font-semibold">{k}</dt><dd className="font-semibold break-words">{v}</dd></div>)}</dl>
              </section>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-8 pt-6 border-t border-line">
          {step > 0 && <button type="button" className="btn btn-outline" onClick={() => setStep(s => s - 1)}>{t('form.back')}</button>}
          <button type="button" className="text-sm font-bold text-muted hover:text-ink underline" onClick={saveDraft}>{t('owner.add.draft')}</button>
          <div className="ml-auto">
            {step < 5 ? <button type="button" className="btn btn-primary" onClick={next}>{t('form.next')}</button>
              : <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? t('form.loading') : t('owner.add.submit')}</button>}
          </div>
        </div>
      </div>
    </>
  );
};

/* ================= 3.5 Insights ================= */
const INSIGHT_BASE: { type: string; investors: number; amount: number }[] = [
  { type: 'orchards', investors: 46, amount: 6.1e6 }, { type: 'crops', investors: 41, amount: 7.4e6 }, { type: 'greenhouse', investors: 33, amount: 5.2e6 },
  { type: 'livestock', investors: 27, amount: 3.3e6 }, { type: 'nursery', investors: 18, amount: 1.4e6 }, { type: 'processing', investors: 15, amount: 4.6e6 },
  { type: 'agrotourism', investors: 12, amount: 2.2e6 }, { type: 'beekeeping', investors: 9, amount: 0.6e6 }, { type: 'renewable', investors: 7, amount: 3.9e6 },
];
const REGION_BASE: [string, number][] = [['aghdam', 5.4e6], ['fuzuli', 4.1e6], ['zangilan', 3.6e6], ['barda', 2.9e6], ['guba', 2.2e6]];
const SPEED: Record<string, number> = { orchards: 34, crops: 41, greenhouse: 29, livestock: 52, nursery: 38, beekeeping: 60, pasture: 66, mixed: 45, processing: 48 };

export const OwnerInsights: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const me = useCurrentUser()!;
  const lands = useDbValue(() => landService.byOwner(me.id));
  const [metric, setMetric] = useState<'investors' | 'amount'>('investors');
  const [range, setRange] = useState<'r30' | 'r6' | 'r12'>('r12');
  const factor = range === 'r30' ? 0.12 : range === 'r6' ? 0.55 : 1;
  const data = useMemo(() => INSIGHT_BASE.map(x => ({ name: t(`fieldTypes.${x.type}`), value: Math.round((metric === 'investors' ? x.investors : x.amount) * factor) }))
    .sort((a, b) => b.value - a.value), [metric, factor, t]);
  const myTypes = Array.from(new Set(lands.map(l => l.fieldType)));
  const avg = Math.round(Object.values(SPEED).reduce((a, b) => a + b, 0) / Object.values(SPEED).length);
  return (
    <>
      <PageTitle title={t('owner.insights.title')} subtitle={t('owner.insights.mockNote')} />
      <section className="card p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between mb-6">
          <h2 className="font-display text-2xl text-brand">{t('owner.insights.attract')}</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="sm:w-80"><Segmented label={t('owner.insights.attract')} value={metric} onChange={setMetric} options={[{ value: 'investors', label: t('owner.insights.byInvestors') }, { value: 'amount', label: t('owner.insights.byAmount') }]} /></div>
            <select className="field !w-auto" aria-label={t('owner.insights.range')} value={range} onChange={e => setRange(e.target.value as 'r30' | 'r6' | 'r12')}>
              <option value="r30">{t('owner.insights.r30')}</option><option value="r6">{t('owner.insights.r6')}</option><option value="r12">{t('owner.insights.r12')}</option>
            </select>
          </div>
        </div>
        <div className="h-[420px]" role="img" aria-label={t('owner.insights.attract')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#E2DDD0" />
              <XAxis type="number" tickFormatter={v => (metric === 'amount' ? f.compactAzn(v) : String(v))} stroke="#5F6B63" fontSize={12} />
              <YAxis type="category" dataKey="name" width={190} stroke="#5F6B63" fontSize={12} />
              <Tooltip formatter={(v) => [metric === 'amount' ? f.azn(Number(v)) : String(v), metric === 'amount' ? t('owner.insights.amount') : t('owner.insights.investors')]} cursor={{ fill: '#E8EFE4' }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>{data.map((_, i) => <Cell key={i} fill={i === 0 ? '#1F4D2E' : i < 3 ? '#5E8C3A' : '#9DBB82'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-display text-2xl text-brand mb-5">{t('owner.insights.topRegions')}</h2>
          <ol className="grid gap-4">
            {REGION_BASE.map(([r, v], i) => (
              <li key={r}><ProgressBar label={`${i + 1}. ${t(`regions.${r}`)}`} value={(v / REGION_BASE[0][1]) * 100} tone={i === 0 ? 'gold' : 'leaf'} showValue={f.compactAzn(v * factor)} /></li>
            ))}
          </ol>
        </section>
        <section className="card p-6">
          <h2 className="font-display text-2xl text-brand">{t('owner.insights.vsMarket')}</h2>
          <p className="text-muted text-sm mb-5">{t('owner.insights.vsMarketText')}</p>
          {myTypes.length === 0 ? <p className="text-muted">{t('owner.props.empty')}</p> : (
            <ul className="grid gap-4">
              {myTypes.map(type => {
                const mine = Math.max(12, (SPEED[type] ?? avg) - 6);
                return (
                  <li key={type}>
                    <p className="text-sm font-bold mb-1">{t(`fieldTypes.${type}`)}</p>
                    <div className="grid gap-1 text-xs">
                      <div className="flex items-center gap-2"><span className="w-28 text-muted">{t('owner.insights.yours')}</span><span className="h-2.5 rounded-full bg-brand" style={{ width: `${mine}%` }} /><span className="font-bold">{mine} {t('owner.insights.days')}</span></div>
                      <div className="flex items-center gap-2"><span className="w-28 text-muted">{t('owner.insights.market')}</span><span className="h-2.5 rounded-full bg-gold" style={{ width: `${SPEED[type] ?? avg}%` }} /><span className="font-bold">{SPEED[type] ?? avg} {t('owner.insights.days')}</span></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};
