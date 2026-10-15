import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Trophy, X } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { landService, useCurrentUser, useDbValue } from '../../services/api';
import { landRisk, scoreLand } from '../../services/scoring';
import { useFormat, useLocalePath } from '../../app/i18n';
import { useLandName } from '../shared/landText';
import { TypeBadge } from '../shared/LandCard';
import { PageTitle } from '../cabinet/CabinetShell';
import { EmptyState, Photo } from '../../components/ui/Bits';
import { useCompare } from './CompareContext';
import type { Land } from '../../types/agro';

type Better = 'high' | 'low' | null;
interface Row { key: string; label: string; a: string; b: string; va?: number; vb?: number; better: Better; reason?: string }

const LandPicker: React.FC<{ label: string; exclude?: string; onPick: (id: string) => void }> = ({ label, exclude, onPick }) => {
  const { t } = useTranslation();
  const name = useLandName();
  const lands = useDbValue(() => landService.publicLands());
  const [q, setQ] = useState('');
  const list = lands.filter(l => l.id !== exclude && name(l).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="card p-5 h-full">
      <p className="font-display text-xl text-brand mb-3">{label}</p>
      <input className="field" placeholder={t('compare.searchLand')} value={q} onChange={e => setQ(e.target.value)} aria-label={label} />
      <ul className="mt-3 grid gap-1 max-h-72 overflow-y-auto">
        {list.map(l => (
          <li key={l.id}><button type="button" onClick={() => onPick(l.id)} className="w-full text-left flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sage">
            <Photo src={l.photos[0]} alt="" className="w-12 h-10 rounded-lg shrink-0" /><span className="text-sm font-semibold">{name(l)}</span>
          </button></li>
        ))}
      </ul>
    </div>
  );
};

export const ComparePage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const lp = useLocalePath();
  const name = useLandName();
  const me = useCurrentUser()!;
  const { ids, set } = useCompare();
  const [a, b] = [ids[0] ? landService.get(ids[0]) : undefined, ids[1] ? landService.get(ids[1]) : undefined];
  const setSlot = (slot: 0 | 1, id: string | null) => {
    const next = [...ids];
    if (id) next[slot] = id; else next.splice(slot, 1);
    set(next.filter(Boolean).slice(0, 2));
  };

  const rows = useMemo<Row[]>(() => {
    if (!a || !b) return [];
    const sa = scoreLand(a, me.preferences), sb = scoreLand(b, me.preferences);
    const yn = (x: boolean) => (x ? t('form.yes') : t('form.no'));
    const water = (l: Land) => ({ none: 0, canal: 1, well: 2, drip: 3 })[l.irrigation];
    const riskNum = { low: 0, medium: 1, high: 2 };
    return [
      { key: 'region', label: t('land.region'), a: t(`regions.${a.region}`), b: t(`regions.${b.region}`), better: null },
      { key: 'type', label: t('land.fieldType'), a: t(`fieldTypes.${a.fieldType}`), b: t(`fieldTypes.${b.fieldType}`), better: null },
      { key: 'area', label: t('land.area'), a: t('land.ha', { n: a.areaHa }), b: t('land.ha', { n: b.areaHa }), va: a.areaHa, vb: b.areaHa, better: 'high' },
      { key: 'investment', label: t('land.required'), a: f.azn(a.investmentMin), b: f.azn(b.investmentMin), va: a.investmentMin, vb: b.investmentMin, better: 'low', reason: 'investment' },
      { key: 'return', label: t('land.return'), a: `${a.expectedReturnPct}%`, b: `${b.expectedReturnPct}%`, va: a.expectedReturnPct, vb: b.expectedReturnPct, better: 'high', reason: 'return' },
      { key: 'duration', label: t('land.duration'), a: t('land.months', { n: a.durationMonths }), b: t('land.months', { n: b.durationMonths }), better: null },
      { key: 'model', label: t('land.model'), a: t(`models.${a.investmentModel}`), b: t(`models.${b.investmentModel}`), better: null },
      { key: 'suitability', label: t('land.suitability'), a: String(sa.suitability), b: String(sb.suitability), va: sa.suitability, vb: sb.suitability, better: 'high', reason: 'suitability' },
      { key: 'risk', label: t('land.risk'), a: t(`risk.${sa.risk}`), b: t(`risk.${sb.risk}`), va: riskNum[sa.risk], vb: riskNum[sb.risk], better: 'low', reason: 'risk' },
      { key: 'fertility', label: t('land.fertility'), a: `${a.fertilityPct}%`, b: `${b.fertilityPct}%`, va: a.fertilityPct, vb: b.fertilityPct, better: 'high', reason: 'fertility' },
      { key: 'soil', label: t('land.soil'), a: t(`soil.${a.soilType}`), b: t(`soil.${b.soilType}`), better: null },
      { key: 'irrigation', label: t('land.irrigation'), a: t(`irrigationTypes.${a.irrigation}`), b: t(`irrigationTypes.${b.irrigation}`), va: water(a), vb: water(b), better: 'high' },
      { key: 'road', label: t('land.road'), a: yn(a.roadAccess), b: yn(b.roadAccess), va: +a.roadAccess, vb: +b.roadAccess, better: 'high' },
      { key: 'electricity', label: t('land.electricity'), a: yn(a.electricity), b: yn(b.electricity), va: +a.electricity, vb: +b.electricity, better: 'high' },
      { key: 'verified', label: t('land.ownerVerified'), a: yn(a.ownerVerified), b: yn(b.ownerVerified), va: +a.ownerVerified, vb: +b.ownerVerified, better: 'high' },
      { key: 'funding', label: t('land.fundingProgress'), a: `${Math.round((a.raisedAmount / a.investmentMax) * 100)}%`, b: `${Math.round((b.raisedAmount / b.investmentMax) * 100)}%`, better: null },
    ];
  }, [a, b, me.preferences, t]);

  const winner = (r: Row): 'a' | 'b' | null => {
    if (!r.better || r.va === undefined || r.vb === undefined || r.va === r.vb) return null;
    return (r.better === 'high' ? r.va > r.vb : r.va < r.vb) ? 'a' : 'b';
  };
  const scored = rows.filter(r => r.better);
  const winsA = scored.filter(r => winner(r) === 'a').length, winsB = scored.filter(r => winner(r) === 'b').length;
  const lead = winsA === winsB ? null : winsA > winsB ? 'a' : 'b';
  const leadLand = lead === 'a' ? a : b;
  const reasons = rows.filter(r => r.reason && winner(r) === lead).slice(0, 3).map(r => t(`compare.reasons.${r.reason}`));

  const radar = useMemo(() => {
    if (!a || !b) return [];
    const axis = (l: Land) => {
      const s = scoreLand(l, me.preferences);
      return {
        fertility: l.fertilityPct, suitability: s.suitability, return: Math.min(100, (l.expectedReturnPct / 25) * 100),
        lowRisk: Math.round((1 - landRisk(l).value) * 100), water: ({ none: 10, canal: 55, well: 70, drip: 100 })[l.irrigation],
        affordability: Math.round(100 - Math.min(100, (l.investmentMin / 1000000) * 100)),
      };
    };
    const xa = axis(a), xb = axis(b);
    return (Object.keys(xa) as (keyof typeof xa)[]).map(k => ({ axis: t(`compare.axes.${k}`), A: xa[k], B: xb[k] }));
  }, [a, b, me.preferences, t]);

  const header = (l: Land | undefined, slot: 0 | 1) => l ? (
    <div className="card overflow-hidden">
      <Photo src={l.photos[0]} alt={name(l)} className="w-full aspect-[16/9]" />
      <div className="p-5">
        <p className="eyebrow mb-1">{slot === 0 ? 'A' : 'B'}</p>
        <h2 className="font-display text-xl text-brand leading-snug">{name(l)}</h2>
        <div className="mt-2 flex flex-wrap gap-2"><TypeBadge type={l.fieldType} /><span className="text-sm text-muted">{t(`regions.${l.region}`)}</span></div>
        <div className="flex gap-2 mt-4">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSlot(slot, null)}><X className="w-4 h-4" />{t('compare.remove')}</button>
        </div>
      </div>
    </div>
  ) : <LandPicker label={slot === 0 ? t('compare.selectA') : t('compare.selectB')} exclude={ids[slot === 0 ? 1 : 0]} onPick={id => setSlot(slot, id)} />;

  return (
    <>
      <PageTitle title={t('compare.title')} subtitle={t('compare.subtitle')} />
      {a && b && (
        <div className="rounded-[1.25rem] bg-forest text-cream p-6 mb-6 flex gap-4 items-start" role="status">
          <Trophy className="w-8 h-8 text-gold shrink-0" aria-hidden="true" />
          <div>
            <p className="font-display text-2xl">{lead ? t('compare.verdict', { land: name(leadLand), n: Math.max(winsA, winsB), total: scored.length }) : t('compare.tie')}</p>
            {lead && reasons.length > 0 && <p className="text-cream/80 mt-1">{t('compare.verdictText', { land: name(leadLand), reasons: reasons.join(', ') })}</p>}
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch mb-8">
        {header(a, 0)}
        <div className="flex md:flex-col items-center justify-center">
          <button type="button" disabled={!a || !b} onClick={() => set([ids[1], ids[0]])} className="w-12 h-12 rounded-full bg-white border border-line shadow grid place-items-center disabled:opacity-40 hover:bg-sage" aria-label={t('compare.swap')}><ArrowLeftRight className="w-5 h-5" /></button>
        </div>
        {header(b, 1)}
      </div>
      {!(a && b) ? <EmptyState title={t('compare.empty')} /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-sage/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr><th scope="col" className="px-4 py-3 sticky left-0 bg-[#EEF2EA]">{t('compare.parameter')}</th><th scope="col" className="px-4 py-3">A</th><th scope="col" className="px-4 py-3">B</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(r => {
                  const w = winner(r);
                  const cell = (side: 'a' | 'b') => (
                    <td className={`px-4 py-3 font-semibold ${w === side ? 'bg-[#E3F1E1]' : ''}`}>
                      {side === 'a' ? r.a : r.b}{w === side && <span className="ml-2 rounded-full bg-brand text-white px-2 py-0.5 text-[0.65rem] font-bold">{t('compare.better')}</span>}
                    </td>
                  );
                  return <tr key={r.key}><th scope="row" className="px-4 py-3 text-left font-semibold text-muted sticky left-0 bg-white">{r.label}</th>{cell('a')}{cell('b')}</tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <section className="card p-6">
              <h2 className="font-display text-2xl text-brand mb-2">{t('compare.radar')}</h2>
              <div className="h-80" role="img" aria-label={t('compare.radar')}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar} outerRadius="72%">
                    <PolarGrid stroke="#E2DDD0" />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: '#5F6B63' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name={`A · ${name(a)}`} dataKey="A" stroke="#1F4D2E" fill="#1F4D2E" fillOpacity={0.25} />
                    <Radar name={`B · ${name(b)}`} dataKey="B" stroke="#C9A54C" fill="#C9A54C" fillOpacity={0.3} />
                    <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="grid sm:grid-cols-2 gap-4 content-start">
              {[a, b].map((l, i) => (
                <div key={l.id} className="card p-5 flex flex-col gap-3">
                  <p className="eyebrow">{i === 0 ? 'A' : 'B'}</p>
                  <p className="font-bold">{name(l)}</p>
                  <Link to={lp(`/investor/lands/${l.id}`)} className="btn btn-outline btn-sm">{t('land.viewDetails')}</Link>
                  <Link to={lp(`/investor/lands/${l.id}`)} className="btn btn-primary btn-sm">{t('investor.detail.send')}</Link>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
};
