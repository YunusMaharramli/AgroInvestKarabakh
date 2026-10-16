import { useTranslation } from 'react-i18next';
import { useFormat } from '../../app/i18n';

export interface ProposalAnalysis {
  recommendedProposalId: string | null;
  reasons: { proposalId: string; text: string }[];
  risks: { proposalId: string; text: string }[];
  missingDocumentsOrData: { proposalId: string; items: string[] }[];
  comparison: {
    proposalId: string; alias: string; proposedInvestment: number; meetsInvestmentRequirement: boolean;
    documentCount: number; requiredDocumentCount: number; eligibilityConditionCount: number; fundingGap: number | null;
    additionalFinancingRequested: number | null;
    profitProjection: { pessimistic: number | null; base: number | null; optimistic: number | null; probability: string };
  }[];
  modelVersion: string; generatedAt: string; status: string;
}

export function AdminProposalAnalysisResult({ analysis }: { analysis: ProposalAnalysis }) {
  const { t } = useTranslation();
  const f = useFormat();
  const missingLabel = (item: string) => item.startsWith('Required documents')
    ? `${t('admin.panel.analysis.documents')} ${item.slice('Required documents'.length)}`
    : item === 'Expected annual revenue' ? t('admin.panel.analysis.expectedRevenue')
    : item === 'Project costs' ? t('admin.panel.analysis.projectCosts')
    : item === 'Eligibility conditions need manual verification' ? t('admin.panel.analysis.eligibility') : item;

  return <section id="ai-analysis-result" className="card p-5 mb-6" aria-live="polite">
    <h2 className="font-display text-xl text-brand mb-3">{t('admin.panel.analysis.title')}</h2>
    <p className="text-xs text-muted mb-3">{analysis.modelVersion} · {f.date(analysis.generatedAt)}</p>
    {analysis.status === 'providerUnavailable' && <p className="text-sm text-muted mb-3">{t('admin.panel.analysis.unavailable')}</p>}
    {analysis.status === 'insufficientData' && <p className="text-sm text-muted mb-3">{t('admin.panel.analysis.insufficient')}</p>}
    {analysis.status === 'inputLimit' && <p className="text-sm text-muted mb-3">{t('admin.panel.analysis.inputLimit')}</p>}
    {analysis.comparison.length > 0 && <>
    <p className="font-semibold mb-3">{t('admin.panel.analysis.suggestion')}: {analysis.recommendedProposalId ? analysis.comparison.find(c => c.proposalId === analysis.recommendedProposalId)?.alias : t('admin.panel.analysis.noSuggestion')}</p>
    {(['reasons', 'risks'] as const).map(key => <div key={key} className="mb-3"><h3 className="font-semibold">{t(`admin.panel.analysis.${key}`)}</h3><ul className="list-disc pl-5 text-sm">{analysis[key].map((item, i) => <li key={i}>{analysis.comparison.find(c => c.proposalId === item.proposalId)?.alias}: {item.text}</li>)}</ul></div>)}
    <h3 className="font-semibold mb-2">{t('admin.panel.analysis.comparison')}</h3>
    <p className="text-sm text-muted mb-3">{t('admin.panel.analysis.scenarioNote')}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-line">
      <th className="p-2">{t('admin.panel.analysis.proposal')}</th><th className="p-2">{t('competition.proposedInvestment')}</th>
      <th className="p-2">{t('admin.panel.analysis.meetsRequirement')}</th><th className="p-2">{t('admin.panel.analysis.documents')}</th>
      <th className="p-2">{t('admin.panel.analysis.eligibility')}</th><th className="p-2">{t('admin.panel.analysis.fundingGap')}</th>
      <th className="p-2">{t('admin.panel.analysis.additionalFinance')}</th><th className="p-2">{t('admin.panel.analysis.pessimistic')}</th>
      <th className="p-2">{t('admin.panel.analysis.base')}</th><th className="p-2">{t('admin.panel.analysis.optimistic')}</th>
      <th className="p-2">{t('admin.panel.analysis.probability')}</th><th className="p-2">{t('admin.panel.analysis.missing')}</th>
    </tr></thead><tbody>{analysis.comparison.map(c => <tr key={c.proposalId} className="border-b border-line">
      <th className="p-2">{c.alias}</th><td className="p-2">{f.azn(c.proposedInvestment)}</td>
      <td className="p-2">{t(c.meetsInvestmentRequirement ? 'form.yes' : 'form.no')}</td><td className="p-2">{c.documentCount}/{c.requiredDocumentCount}</td>
      <td className="p-2">{c.eligibilityConditionCount}</td><td className="p-2">{c.fundingGap == null ? '—' : f.azn(c.fundingGap)}</td>
      <td className="p-2">{c.additionalFinancingRequested == null ? '—' : f.azn(c.additionalFinancingRequested)}</td>
      {(['pessimistic', 'base', 'optimistic'] as const).map(k => <td className="p-2" key={k}>{c.profitProjection[k] == null ? t('admin.panel.analysis.insufficientValue') : f.azn(c.profitProjection[k]!)}</td>)}
      <td className="p-2">{c.profitProjection.probability === 'Insufficient data' ? t('admin.panel.analysis.insufficientValue') : c.profitProjection.probability}</td>
      <td className="p-2">{analysis.missingDocumentsOrData.find(m => m.proposalId === c.proposalId)?.items.map(missingLabel).join(', ') || '—'}</td>
    </tr>)}</tbody></table></div>
    </>}
  </section>;
}
