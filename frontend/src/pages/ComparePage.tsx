import React from 'react';
import { useComparison } from '../context/ComparisonContext.js';
import { Layers, X, ArrowLeft, Plus, ArrowRight, Trash2 } from 'lucide-react';
import { AgriculturalLand } from '../types/index.js';
import { landImage, formatManat } from '../lib/landImages.js';

interface ComparePageProps {
  navigate: (route: string) => void;
}

type Row = { label: string; value: (l: AgriculturalLand) => React.ReactNode; strong?: boolean };

const ROWS: Row[] = [
  { label: 'Rayon', value: l => l.region, strong: true },
  { label: 'Fəaliyyət növü', value: l => l.agricultureType },
  { label: 'Sahə', value: l => `${l.areaHectares} hektar`, strong: true },
  { label: 'Minimal sərmayə', value: l => formatManat(l.estimatedInvestmentRequirement), strong: true },
  { label: 'Torpağın keyfiyyəti', value: l => l.soilQuality || 'Məlumat yoxdur' },
  { label: 'Su təminatı', value: l => l.waterSupply || 'Məlumat yoxdur' },
  { label: 'Nə üçün istifadə olunur', value: l => l.intendedUse },
];

export const ComparePage: React.FC<ComparePageProps> = ({ navigate }) => {
  const { compareLands, removeFromCompare, clearCompare } = useComparison();

  // Point out the cheapest and the biggest plot in plain words
  const cheapestId =
    compareLands.length > 1
      ? [...compareLands].sort((a, b) => a.estimatedInvestmentRequirement - b.estimatedInvestmentRequirement)[0].id
      : null;
  const biggestId =
    compareLands.length > 1 ? [...compareLands].sort((a, b) => b.areaHectares - a.areaHectares)[0].id : null;

  const Badges: React.FC<{ land: AgriculturalLand }> = ({ land }) => (
    <div className="flex flex-wrap gap-2 min-h-[1.75rem]">
      {land.id === cheapestId && (
        <span className="bg-gold-100 text-gold-900 font-bold text-sm px-3 py-1 rounded-full">Ən az sərmayə</span>
      )}
      {land.id === biggestId && (
        <span className="bg-brand-50 text-brand-900 font-bold text-sm px-3 py-1 rounded-full">Ən böyük sahə</span>
      )}
    </div>
  );

  const Breadcrumb = (
    <nav aria-label="Səhifə yolu" className="text-[0.95rem] text-muted mb-3">
      <button type="button" onClick={() => navigate('/')} className="underline underline-offset-4 text-brand-900">Ana səhifə</button>
      <span aria-hidden="true"> › </span>
      <button type="button" onClick={() => navigate('/opportunities')} className="underline underline-offset-4 text-brand-900">Torpaq sahələri</button>
      <span aria-hidden="true"> › </span>
      <span aria-current="page">Müqayisə</span>
    </nav>
  );

  if (compareLands.length === 0) {
    return (
      <div className="bg-cream py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {Breadcrumb}
          <div className="bg-white rounded-3xl border border-line p-8 sm:p-12 text-center">
            <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-5 text-brand-700">
              <Layers className="w-10 h-10" aria-hidden="true" />
            </div>
            <h1 className="font-display font-extrabold text-3xl text-brand-900">Hələ heç bir sahə seçməmisiniz</h1>
            <p className="text-lg text-[#3E4F45] mt-3">
              Sahələri yan-yana görmək üçün siyahıda <strong>“Müqayisəyə əlavə et”</strong> düyməsini basın. Ən çox 3 sahə seçmək olar.
            </p>
            <button
              type="button"
              onClick={() => navigate('/opportunities')}
              className="mt-7 min-h-14 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold text-lg inline-flex items-center gap-2"
            >
              Torpaq sahələrinə baxın
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream py-8 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {Breadcrumb}

        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div className="max-w-3xl">
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">Sahələri müqayisə edin</h1>
            <p className="text-lg text-[#3E4F45] mt-2">
              Seçdiyiniz <strong>{compareLands.length}</strong> sahə yan-yana göstərilir (ən çox 3).
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/opportunities')}
              className="inline-flex items-center gap-2 min-h-14 px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white"
            >
              {compareLands.length < 3 ? <Plus className="w-5 h-5" aria-hidden="true" /> : <ArrowLeft className="w-5 h-5" aria-hidden="true" />}
              {compareLands.length < 3 ? 'Daha bir sahə əlavə et' : 'Siyahıya qayıt'}
            </button>
            <button
              type="button"
              onClick={clearCompare}
              className="inline-flex items-center gap-2 min-h-14 px-5 rounded-xl border-2 border-line text-[#8E2A1F] font-display font-bold hover:border-[#8E2A1F] bg-white"
            >
              <Trash2 className="w-5 h-5" aria-hidden="true" />
              Hamısını sil
            </button>
          </div>
        </div>

        {/* Wide screens: table */}
        <div className="hidden md:block bg-white rounded-3xl border border-line overflow-hidden">
          <table className="w-full text-left border-collapse table-fixed">
            <caption className="sr-only">Seçilmiş torpaq sahələrinin müqayisəsi</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="p-5 w-56 align-bottom text-base font-bold text-muted">Göstərici</th>
                {compareLands.map(land => (
                  <th key={land.id} scope="col" className="p-5 align-top font-normal">
                    <img src={landImage(land)} alt="" className="w-full h-40 object-cover rounded-2xl mb-4" />
                    <Badges land={land} />
                    <p className="font-display font-extrabold text-xl leading-snug text-brand-900 mt-2">{land.title}</p>
                    <button
                      type="button"
                      onClick={() => removeFromCompare(land.id)}
                      className="mt-3 inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border-2 border-line text-sm font-bold text-ink hover:border-[#8E2A1F] hover:text-[#8E2A1F]"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      Müqayisədən çıxar
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-cream/60' : ''}>
                  <th scope="row" className="p-5 text-base font-bold text-ink align-top">{row.label}</th>
                  {compareLands.map(land => (
                    <td key={land.id} className={`p-5 align-top text-lg ${row.strong ? 'font-extrabold text-ink' : 'text-[#3E4F45]'}`}>
                      {row.value(land)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-5" />
                {compareLands.map(land => (
                  <td key={land.id} className="p-5">
                    <button
                      type="button"
                      onClick={() => navigate(`/opportunities/${land.id}`)}
                      className="w-full min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2"
                    >
                      Ətraflı və müraciət
                      <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Phones: one card per plot, same rows */}
        <ul className="md:hidden flex flex-col gap-6">
          {compareLands.map(land => (
            <li key={land.id} className="bg-white rounded-3xl border border-line overflow-hidden">
              <img src={landImage(land)} alt="" className="w-full h-44 object-cover" />
              <div className="p-5">
                <Badges land={land} />
                <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900 mt-2">{land.title}</h2>
                <dl className="mt-4 divide-y divide-line border-y border-line">
                  {ROWS.map(row => (
                    <div key={row.label} className="py-3">
                      <dt className="text-sm text-muted">{row.label}</dt>
                      <dd className={`text-lg ${row.strong ? 'font-extrabold' : ''}`}>{row.value(land)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/opportunities/${land.id}`)}
                    className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2"
                  >
                    Ətraflı və müraciət
                    <ArrowRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCompare(land.id)}
                    className="min-h-12 rounded-xl border-2 border-line font-display font-bold text-ink flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                    Müqayisədən çıxar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
