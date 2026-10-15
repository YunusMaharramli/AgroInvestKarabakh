import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coins, Activity, Clock, Percent, SlidersHorizontal, List, Map as MapIcon, Heart, Search, X } from 'lucide-react';
import { landService, requestService, useCurrentUser, useDbValue } from '../../services/api';
import { LandSearchBar, matchesLandSearch } from '../shared/LandSearch';
import { scoreLand } from '../../services/scoring';
import { useFormat, useLocalePath } from '../../app/i18n';
import { useLandName } from '../shared/landText';
import { LandResultCard, TypeBadge } from '../shared/LandCard';
import { PageTitle } from '../cabinet/CabinetShell';
import { Chips, EmptyState, Photo, RangeSlider, RequestBadge, Segmented, SkeletonCard, StatCard, Tabs, Toggle } from '../../components/ui/Bits';
import { LandsMap } from '../../components/map/LandsMap';
import { CATEGORIES } from '../../data/categories';
import { REGIONS } from '../../data/regions';
import { useCompare } from '../compare/CompareContext';
import type { InvestmentRequest, Land, RiskTolerance, SearchFilters } from '../../types/agro';

/* ================= 4.1 Overview ================= */
export const InvestorOverview: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const me = useCurrentUser()!;
  const reqs = useDbValue(() => requestService.forInvestor(me.id));
  const lands = useDbValue(() => landService.publicLands());
  const [loading, setLoading] = useState(true);
  useEffect(() => { const id = setTimeout(() => setLoading(false), 450); return () => clearTimeout(id); }, []);
  const selected = reqs.filter(r => r.status === 'selected');
  const pending = reqs.filter(r => r.status === 'pending');
  const measured = selected.filter(r => !landService.get(r.landId)?.source);
  const avg = measured.length ? measured.reduce((s, r) => s + (landService.get(r.landId)?.expectedReturnPct ?? 0), 0) / measured.length : null;
  const recommended = useMemo(() => lands.filter(l => l.status === 'active' && l.ownerId !== me.id)
    .map(l => ({ land: l, score: scoreLand(l, me.preferences) })).sort((a, b) => b.score.suitability - a.score.suitability).slice(0, 3), [lands, me.preferences]);
  return (
    <>
      <PageTitle title={t('cabinet.welcome', { name: me.fullName.split(' ')[0] })} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatCard label={t('investor.kpi.invested')} value={f.compactAzn(selected.reduce((s, r) => s + r.amount, 0))} icon={<Coins className="w-5 h-5" />} accent />
        <StatCard label={t('investor.kpi.active')} value={String(selected.length)} icon={<Activity className="w-5 h-5" />} />
        <StatCard label={t('investor.kpi.pending')} value={String(pending.length)} icon={<Clock className="w-5 h-5" />} />
        <StatCard label={t('investor.kpi.avgReturn')} value={avg === null ? '—' : `${avg.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} accent />
      </div>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div><h2 className="font-display text-2xl text-brand">{t('investor.recommended')}</h2><p className="text-muted text-sm">{t('investor.recommendedText')}</p></div>
        <Link to={lp('/investor/search')} className="text-sm font-bold text-leaf-dark hover:underline whitespace-nowrap">{t('investor.nav.search')} →</Link>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? [0, 1, 2].map(i => <SkeletonCard key={i} rows={4} />) : recommended.map(({ land, score }) => <LandResultCard key={land.id} land={land} score={score} href={lp(`/investor/lands/${land.id}`)} />)}
      </div>
    </>
  );
};

/* ================= 4.2 Find land ================= */
type SortKey = 'best' | 'suitability' | 'risk' | 'fertility' | 'investment' | 'return';
const BUDGET_MAX = 1500000;

function defaultFilters(prefs: { budgetMin: number; budgetMax: number; fieldTypes: string[]; regions: string[]; riskTolerance: RiskTolerance }): SearchFilters {
  return {
    budgetMin: prefs.budgetMin || 0, budgetMax: prefs.budgetMax || BUDGET_MAX, fieldTypes: prefs.fieldTypes, regions: prefs.regions,
    areaMin: 0, areaMax: 600, durationMin: 0, durationMax: 120, minReturn: 0, riskTolerance: prefs.riskTolerance, irrigationOnly: false,
  };
}

export const InvestorSearch: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const me = useCurrentUser()!;
  const all = useDbValue(() => landService.publicLands().filter(l => l.status === 'active' && l.ownerId !== me.id));
  const [draft, setDraft] = useState<SearchFilters>(() => defaultFilters(me.preferences));
  const [filters, setFilters] = useState<SearchFilters>(draft);
  const [sort, setSort] = useState<SortKey>('best');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [shown, setShown] = useState(9);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState('');
  const [qType, setQType] = useState('');
  useEffect(() => { setLoading(true); const id = setTimeout(() => setLoading(false), 450); return () => clearTimeout(id); }, [filters]);

  const results = useMemo(() => {
    const rows = all.filter(l => matchesLandSearch(l, q, qType) &&
      l.investmentMax >= filters.budgetMin && l.investmentMin <= filters.budgetMax &&
      (!filters.fieldTypes.length || filters.fieldTypes.includes(l.fieldType)) &&
      (!filters.regions.length || filters.regions.includes(l.region)) &&
      l.areaHa >= filters.areaMin && l.areaHa <= filters.areaMax &&
      (l.source ? filters.durationMin === 0 : l.durationMonths >= filters.durationMin && l.durationMonths <= filters.durationMax) &&
      (l.source ? filters.minReturn === 0 && !filters.irrigationOnly : l.expectedReturnPct >= filters.minReturn && (!filters.irrigationOnly || l.irrigation !== 'none')),
    ).map(l => ({ land: l, score: scoreLand(l, filters) }));
    const by: Record<SortKey, (a: typeof rows[0], b: typeof rows[0]) => number> = {
      best: (a, b) => b.score.suitability - a.score.suitability || a.score.riskValue - b.score.riskValue,
      suitability: (a, b) => b.score.suitability - a.score.suitability,
      risk: (a, b) => a.score.riskValue - b.score.riskValue,
      fertility: (a, b) => b.land.fertilityPct - a.land.fertilityPct,
      investment: (a, b) => a.land.investmentMin - b.land.investmentMin,
      return: (a, b) => b.land.expectedReturnPct - a.land.expectedReturnPct,
    };
    return rows.sort(by[sort]);
  }, [all, filters, sort, q, qType]);

  const apply = () => { setFilters(draft); setShown(9); setSheet(false); };
  const reset = () => { const d = defaultFilters({ budgetMin: 0, budgetMax: 0, fieldTypes: [], regions: [], riskTolerance: 'medium' }); setDraft(d); setFilters(d); };
  const D = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setDraft(x => ({ ...x, [k]: v }));

  const panel = (
    <div className="grid gap-6">
      <div>
        <p className="field-label">{t('investor.search.budget')}</p>
        <RangeSlider label={t('investor.search.budget')} min={0} max={BUDGET_MAX} step={10000} value={[draft.budgetMin, draft.budgetMax]} onChange={([a, b]) => setDraft(x => ({ ...x, budgetMin: a, budgetMax: b }))} format={f.compactAzn} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input className="field" type="number" aria-label={`${t('investor.search.budget')} ${t('investor.search.min')}`} value={draft.budgetMin} onChange={e => D('budgetMin', Math.min(Number(e.target.value), draft.budgetMax))} />
          <input className="field" type="number" aria-label={`${t('investor.search.budget')} ${t('investor.search.max')}`} value={draft.budgetMax} onChange={e => D('budgetMax', Math.max(Number(e.target.value), draft.budgetMin))} />
        </div>
      </div>
      <div><p className="field-label">{t('investor.search.types')}</p><Chips label={t('investor.search.types')} options={CATEGORIES.map(c => ({ value: c.key, label: t(`fieldTypes.${c.key}`) }))} selected={draft.fieldTypes} onChange={v => D('fieldTypes', v)} limit={8} /></div>
      <div>
        <p className="field-label">{t('investor.search.regions')}</p>
        <select className="field" aria-label={t('investor.search.regions')} value="" onChange={e => { if (e.target.value && !draft.regions.includes(e.target.value)) D('regions', [...draft.regions, e.target.value]); }}>
          <option value="">{draft.regions.length ? `+ ${t('investor.search.regions')}` : t('investor.search.anyRegion')}</option>
          {REGIONS.filter(r => !draft.regions.includes(r.key)).map(r => <option key={r.key} value={r.key}>{t(`regions.${r.key}`)}</option>)}
        </select>
        {draft.regions.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{draft.regions.map(r => <button key={r} type="button" onClick={() => D('regions', draft.regions.filter(x => x !== r))} className="inline-flex items-center gap-1 rounded-full bg-brand text-white px-3 py-1 text-xs font-bold" aria-label={`${t('form.remove')}: ${t(`regions.${r}`)}`}>{t(`regions.${r}`)}<X className="w-3 h-3" /></button>)}</div>}
      </div>
      <div><p className="field-label">{t('investor.search.area')}</p><RangeSlider label={t('investor.search.area')} min={0} max={600} step={5} value={[draft.areaMin, draft.areaMax]} onChange={([a, b]) => setDraft(x => ({ ...x, areaMin: a, areaMax: b }))} format={n => t('land.ha', { n })} /></div>
      <div><p className="field-label">{t('investor.search.duration')}</p><RangeSlider label={t('investor.search.duration')} min={0} max={120} step={6} value={[draft.durationMin, draft.durationMax]} onChange={([a, b]) => setDraft(x => ({ ...x, durationMin: a, durationMax: b }))} format={n => t('land.months', { n })} /></div>
      <div>
        <label htmlFor="s-minret" className="field-label">{t('investor.search.minReturn')}: <span className="text-brand">{draft.minReturn}%</span></label>
        <input id="s-minret" type="range" min={0} max={25} value={draft.minReturn} onChange={e => D('minReturn', Number(e.target.value))} className="w-full accent-[#1F4D2E]" />
      </div>
      <div><p className="field-label">{t('investor.search.risk')}</p><Segmented label={t('investor.search.risk')} value={draft.riskTolerance} onChange={v => D('riskTolerance', v)} options={(['low', 'medium', 'high'] as const).map(r => ({ value: r, label: t(`risk.${r}`) }))} /></div>
      <Toggle id="s-irr" checked={draft.irrigationOnly} onChange={v => D('irrigationOnly', v)} label={t('investor.search.irrigation')} />
      <div className="flex gap-3 sticky bottom-0 bg-white pt-3 pb-1">
        <button type="button" className="btn btn-primary flex-1" onClick={apply}><Search className="w-4 h-4" />{t('form.search')}</button>
        <button type="button" className="btn btn-outline" onClick={reset}>{t('form.reset')}</button>
      </div>
    </div>
  );

  return (
    <>
      <PageTitle title={t('investor.search.title')} />
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <aside className="hidden lg:block card p-5 sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto" aria-label={t('investor.search.filters')}>
          <h2 className="font-display text-xl text-brand mb-5">{t('investor.search.filters')}</h2>{panel}
        </aside>
        <div className="min-w-0">
          <LandSearchBar value={q} onChange={v => { setQ(v); setShown(9); }} type={qType} onTypeChange={v => { setQType(v); setShown(9); }} className="mb-4" />
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <button type="button" className="lg:hidden btn btn-outline btn-sm" onClick={() => setSheet(true)}><SlidersHorizontal className="w-4 h-4" />{t('investor.search.showFilters')}</button>
            <p className="font-bold" aria-live="polite">{t('investor.search.found', { count: results.length })}</p>
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><span className="text-muted font-semibold hidden sm:inline">{t('investor.search.sort')}</span>
                <select className="field !w-auto !min-h-10 !py-1.5" value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label={t('investor.search.sort')}>
                  {(['best', 'suitability', 'risk', 'fertility', 'investment', 'return'] as SortKey[]).map(s => <option key={s} value={s}>{t(`investor.search.sorts.${s}`)}</option>)}
                </select>
              </label>
              <div className="inline-flex rounded-full bg-sand p-1" role="group" aria-label={t('map.mapView')}>
                <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`p-2 rounded-full ${view === 'list' ? 'bg-white shadow text-brand' : 'text-muted'}`} aria-label={t('map.listView')}><List className="w-4 h-4" /></button>
                <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')} className={`p-2 rounded-full ${view === 'map' ? 'bg-white shadow text-brand' : 'text-muted'}`} aria-label={t('map.mapView')}><MapIcon className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
          {loading ? <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-5">{[0, 1, 2, 3].map(i => <SkeletonCard key={i} rows={4} />)}</div>
            : results.length === 0 ? <EmptyState title={t('investor.search.empty')} action={<button type="button" className="btn btn-outline" onClick={reset}>{t('form.reset')}</button>} />
            : view === 'map' ? <LandsMap lands={results.map(r => r.land)} height="h-[620px]" detailHref={l => lp(`/investor/lands/${l.id}`)} />
            : (
              <>
                <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {results.slice(0, shown).map(({ land, score }) => <LandResultCard key={land.id} land={land} score={score} href={lp(`/investor/lands/${land.id}`)} />)}
                </div>
                {shown < results.length && <div className="text-center mt-8"><button type="button" className="btn btn-outline px-8" onClick={() => setShown(s => s + 9)}>{t('investor.search.loadMore')}</button></div>}
              </>
            )}
        </div>
      </div>
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-[70] bg-forest/50" onMouseDown={e => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div role="dialog" aria-modal="true" aria-label={t('investor.search.filters')} className="absolute bottom-0 inset-x-0 max-h-[88svh] overflow-y-auto rounded-t-3xl bg-white p-5">
            <div className="flex items-center justify-between mb-4"><h2 className="font-display text-xl text-brand">{t('investor.search.filters')}</h2><button type="button" onClick={() => setSheet(false)} className="p-2 rounded-full hover:bg-sand" aria-label={t('form.close')} autoFocus><X className="w-5 h-5" /></button></div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
};

/* ================= 4.4 My investments ================= */
export const InvestorInvestments: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const name = useLandName();
  const me = useCurrentUser()!;
  const reqs = useDbValue(() => requestService.forInvestor(me.id));
  const [tab, setTab] = useState<InvestmentRequest['status']>('pending');
  const steps = t('investor.inv.timeline', { returnObjects: true }) as unknown as string[];
  const rows = reqs.filter(r => r.status === tab);
  const count = (s: InvestmentRequest['status']) => reqs.filter(r => r.status === s).length;
  return (
    <>
      <PageTitle title={t('investor.inv.title')} />
      <Tabs label={t('investor.inv.title')} value={tab} onChange={setTab} tabs={[
        { id: 'pending', label: t('investor.inv.pending'), count: count('pending') },
        { id: 'selected', label: t('investor.inv.selected'), count: count('selected') },
        { id: 'notSelected', label: t('investor.inv.notSelected'), count: count('notSelected') },
        { id: 'rejected', label: t('reqStatus.rejected'), count: count('rejected') },
        { id: 'cancelled', label: t('reqStatus.cancelled'), count: count('cancelled') },
      ]} />
      <div className="mt-6">
        {rows.length === 0 ? <EmptyState title={t('investor.inv.empty')} action={<Link to={lp('/investor/search')} className="btn btn-primary">{t('investor.inv.emptyCta')}</Link>} /> : (
          <ul className="grid gap-4">
            {rows.map(r => {
              const land = landService.get(r.landId);
              const stage = r.status !== 'pending' ? 2 : r.viewedByOwner ? 1 : 0;
              return (
                <li key={r.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                  <Photo src={land?.photos[0]} alt="" className="w-full sm:w-36 h-32 sm:h-28 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-display text-xl text-brand leading-snug"><Link to={lp(`/investor/lands/${r.landId}`)} className="hover:underline">{name(land)}</Link></h2>
                        <p className="text-sm text-muted">{f.azn(r.amount)}{!r.source && ` · ${t(`models.${r.investmentModel}`)}`} · {f.date(r.createdAt)}</p>
                      </div>
                      <RequestBadge status={r.status} />
                    </div>
                    <ol className="flex items-center gap-2 mt-4" aria-label={t('investor.inv.title')}>
                      {steps.map((s, i) => (
                        <li key={s} className="flex items-center gap-2 text-xs font-semibold" aria-current={i === stage ? 'step' : undefined}>
                          <span className={`w-6 h-6 rounded-full grid place-items-center text-[0.7rem] ${i <= stage ? (i === 2 && r.status === 'notSelected' ? 'bg-danger text-white' : 'bg-brand text-white') : 'bg-sand text-muted'}`}>{i < stage || (i === 2 && stage === 2) ? '✓' : i + 1}</span>
                          <span className={i <= stage ? 'text-ink' : 'text-muted'}>{i === 2 && r.status !== 'pending' ? t(`reqStatus.${r.status}`) : s}</span>
                          {i < steps.length - 1 && <span className={`w-6 sm:w-10 h-0.5 ${i < stage ? 'bg-brand' : 'bg-line'}`} aria-hidden="true" />}
                        </li>
                      ))}
                    </ol>
                    {r.status === 'notSelected' && <p className="mt-3 text-sm rounded-xl bg-[#F6E1DF] text-[#8E1F17] px-3 py-2">{t('investor.inv.otherSelected')}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};

/* ================= 4.5 Saved lands ================= */
export const InvestorSaved: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const f = useFormat();
  const name = useLandName();
  const me = useCurrentUser()!;
  const ids = useDbValue(() => landService.savedIds(me.id));
  const { has, toggle } = useCompare();
  const lands = ids.map(id => landService.get(id)).filter(Boolean) as Land[];
  return (
    <>
      <PageTitle title={t('investor.saved.title')} />
      {lands.length === 0 ? <EmptyState title={t('investor.saved.empty')} icon={<Heart className="w-7 h-7" />} action={<Link to={lp('/investor/search')} className="btn btn-primary">{t('investor.inv.emptyCta')}</Link>} /> : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {lands.map(l => (
            <li key={l.id} className="card overflow-hidden flex flex-col">
              <Link to={lp(`/investor/lands/${l.id}`)}><Photo src={l.photos[0]} alt={name(l)} className="w-full aspect-[16/10]" /></Link>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <TypeBadge type={l.fieldType} />
                <h2 className="font-display text-xl text-brand"><Link to={lp(`/investor/lands/${l.id}`)} className="hover:underline">{name(l)}</Link></h2>
                <p className="text-sm text-muted">{l.source ? f.compactAzn(l.investmentMin) : `${f.compactAzn(l.investmentMin)} – ${f.compactAzn(l.investmentMax)} · ${l.expectedReturnPct}%`}</p>
                <div className="mt-auto flex gap-2 pt-2">
                  <button type="button" className="btn btn-outline btn-sm flex-1" onClick={() => landService.toggleSaved(me.id, l.id)}>{t('form.remove')}</button>
                  <button type="button" className="btn btn-outline btn-sm flex-1" aria-pressed={has(l.id)} onClick={() => toggle(l.id)}>{has(l.id) ? t('land.inCompare') : t('land.addCompare')}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

