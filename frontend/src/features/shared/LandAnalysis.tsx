import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, ChevronDown, ChevronUp, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import type { AppUser, Land } from '../../types/agro';
import { BackendError, backend } from '../../services/backend';

type Scenario = { startupCost: [number, number]; annualCost: [number, number]; revenue: [number, number]; profit: [number, number]; breakEven: string };
type Report = { createdAt: string; areaHa: number; overallAssessment: string; recommendedUses: { name: string; suitability: string; rationale: string }[]; risks: { category: string; detail: string; mitigation: string }[]; actionPlan: string[]; conservative: Scenario; expected: Scenario; optimistic: Scenario; missingData: string[] };

const storageKey = (userId: string, landId: string) => `agromatch:land-analysis:v3:${userId}:${landId}`;
const money = (n: number) => new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(n) + ' AZN';

export const LandAnalysis: React.FC<{ land: Land; user: AppUser | null; selectedAreaHa?: number }> = ({ land, user, selectedAreaHa }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const area = selectedAreaHa && selectedAreaHa > 0 ? selectedAreaHa : land.areaHa;
  useEffect(() => {
    if (!user) return;
    try { const raw = localStorage.getItem(storageKey(user.id, land.id)); if (raw) setReport(JSON.parse(raw) as Report); }
    catch { setError(t('analysis.loadError')); }
  }, [user?.id, land.id]);
  const analyze = async () => {
    if (!user) return;
    setBusy(true); setError(''); setOpen(true);
    try {
      const next = await backend<Omit<Report, 'areaHa'>>('POST', '/ai/land-analysis', {
        landId: land.id, title: land.title ?? t(`fieldTypes.${land.fieldType}`), region: t(`regions.${land.region}`),
        areaHa: land.areaHa, selectedAreaHa: selectedAreaHa ?? null,
        permittedPurpose: null, description: land.description ?? null,
        agricultureType: t(`fieldTypes.${land.fieldType}`),
        soil: t(`soil.${land.soilType}`), fertilityPct: land.fertilityPct, water: t(`irrigationTypes.${land.irrigation}`),
        roadAccess: land.roadAccess, electricity: land.electricity,
        askingPrice: null, investmentMin: land.investmentMin, investmentMax: land.investmentMax,
        availableDocumentNames: land.documents?.map(d => d.name) ?? [],
        criteria: { budgetMin: user.preferences.budgetMin, budgetMax: user.preferences.budgetMax, riskTolerance: user.preferences.riskTolerance, preferredUses: user.preferences.fieldTypes, preferredRegions: user.preferences.regions },
        language: i18n.language,
      });
      const saved: Report = { ...next, areaHa: area };
      localStorage.setItem(storageKey(user.id, land.id), JSON.stringify(saved));
      setReport(saved);
    } catch (x) {
      setError(x instanceof BackendError && x.status === 404
        ? t('analysis.endpointMissing')
        : x instanceof Error && x.message ? x.message : t('analysis.error'));
    }
    finally { setBusy(false); }
  };
  const scenarioLine = (label: string, item: Scenario) => <div key={label} className="rounded-xl border border-line p-4"><h4 className="font-bold text-brand">{label}</h4><dl className="mt-2 grid sm:grid-cols-2 gap-2 text-sm"><div><dt className="text-muted">{t('analysis.startup')}</dt><dd className="font-semibold">{money(item.startupCost[0])} – {money(item.startupCost[1])}</dd></div><div><dt className="text-muted">{t('analysis.annualCosts')}</dt><dd className="font-semibold">{money(item.annualCost[0])} – {money(item.annualCost[1])}</dd></div><div><dt className="text-muted">{t('analysis.revenue')}</dt><dd className="font-semibold">{money(item.revenue[0])} – {money(item.revenue[1])}</dd></div><div><dt className="text-muted">{t('analysis.profit')}</dt><dd className="font-semibold">{money(item.profit[0])} – {money(item.profit[1])}</dd></div><div><dt className="text-muted">{t('analysis.breakEven')}</dt><dd className="font-semibold">{item.breakEven}</dd></div></dl></div>;
  return <section className="mt-8 rounded-2xl border border-leaf/30 bg-white p-5 sm:p-6 shadow-[var(--shadow-soft)]">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-sage p-2.5 text-brand"><BrainCircuit className="h-5 w-5" /></span><div><h2 className="font-display text-2xl text-brand">{t('analysis.title')}</h2><p className="text-sm text-muted">{t('analysis.subtitle')}</p></div></div>
      {user ? <button type="button" className="btn btn-primary" onClick={() => void analyze()} disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : report ? <RefreshCw className="mr-2 h-4 w-4" /> : <BrainCircuit className="mr-2 h-4 w-4" />}{busy ? t('analysis.loading') : t('analysis.run')}</button> : <p className="text-sm text-muted">{t('analysis.signIn')}</p>}</div>
    {selectedAreaHa && <p className="mt-3 rounded-lg bg-sage px-3 py-2 text-sm text-brand">{t('analysis.selectedArea', { area: selectedAreaHa.toLocaleString() })}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {open && busy && <div className="mt-5 flex items-center gap-3 rounded-xl bg-sage/60 p-5 text-sm text-brand"><LoaderCircle className="h-5 w-5 animate-spin" />{t('analysis.loadingDetail')}</div>}
    {open && report && !busy && <div className="mt-5 grid gap-5">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gold/30 px-3 py-1 text-xs font-bold text-forest">{t('analysis.illustrative')}</span><span className="text-xs text-muted">{t('analysis.basedOn', { area: report.areaHa.toLocaleString() })} · {new Date(report.createdAt).toLocaleDateString()}</span></div>
      <p className="rounded-xl bg-sage/60 p-4 text-sm leading-relaxed">{report.overallAssessment}</p>
      <div className="grid lg:grid-cols-2 gap-5"><section><h3 className="font-bold text-brand">{t('analysis.uses')}</h3><ol className="mt-2 list-decimal pl-5 text-sm space-y-3">{report.recommendedUses.map((x,i) => <li key={i}><strong>{x.name}</strong> · {x.suitability}<p className="text-muted">{x.rationale}</p></li>)}</ol></section><section><h3 className="font-bold text-brand">{t('analysis.risks')}</h3><ul className="mt-2 list-disc pl-5 text-sm space-y-3">{report.risks.map((x,i) => <li key={i}><strong>{x.category}:</strong> {x.detail}<p className="text-muted">{x.mitigation}</p></li>)}</ul></section></div>
      <section><h3 className="font-bold text-brand">{t('analysis.financial')}</h3><p className="mt-1 text-xs text-muted">{t('analysis.assumptions')}</p><div className="mt-3 grid lg:grid-cols-3 gap-3">{scenarioLine(t('analysis.conservative'), report.conservative)}{scenarioLine(t('analysis.expected'), report.expected)}{scenarioLine(t('analysis.optimistic'), report.optimistic)}</div></section>
      <div className="grid lg:grid-cols-2 gap-5"><section><h3 className="font-bold text-brand">{t('analysis.actions')}</h3><ol className="mt-2 list-decimal pl-5 text-sm space-y-2">{report.actionPlan.map((x,i) => <li key={i}>{x}</li>)}</ol></section><section><h3 className="flex items-center gap-2 font-bold text-brand"><TriangleAlert className="h-4 w-4" />{t('analysis.missing')}</h3><ul className="mt-2 list-disc pl-5 text-sm space-y-2">{report.missingData.map((x,i) => <li key={i}>{x}</li>)}</ul></section></div>
      <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">{t('analysis.disclaimer')}</p>
    </div>}
    {open && report && <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand" onClick={() => setOpen(false)}>{t('analysis.collapse')}<ChevronUp className="h-4 w-4" /></button>}
    {!open && report && <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand" onClick={() => setOpen(true)}>{t('analysis.viewSaved')}<ChevronDown className="h-4 w-4" /></button>}
  </section>;
};
