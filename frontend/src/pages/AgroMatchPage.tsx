import React, { useState, useRef } from 'react';
import { RecommendationResult } from '../types/index.js';
import { Check, AlertCircle, ArrowRight, RotateCcw, Search, Phone } from 'lucide-react';
import { landImage, formatManat } from '../lib/landImages.js';
import { HELP_LINE } from '../components/Header.js';

interface AgroMatchPageProps {
  navigate: (route: string) => void;
}

type Choice = { value: string; label: string; hint?: string };

const REGIONS: Choice[] = [
  { value: '', label: 'Fərq etməz' },
  ...['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl', 'Qubadlı', 'Xocavənd', 'Kəlbəcər', 'Laçın'].map(r => ({ value: r, label: r })),
];

const SECTORS: Choice[] = [
  { value: 'Əkinçilik', label: 'Əkinçilik', hint: 'buğda, arpa, tərəvəz' },
  { value: 'Bağçılıq', label: 'Bağçılıq', hint: 'nar, üzüm, meyvə' },
  { value: 'İstixana təsərrüfatı', label: 'İstixana', hint: 'pomidor, xiyar' },
  { value: 'Heyvandarlıq', label: 'Heyvandarlıq', hint: 'mal-qara, qoyun' },
  { value: 'Arıçılıq', label: 'Arıçılıq', hint: 'bal' },
  { value: '', label: 'Fərq etməz' },
];

/** Budget in plain ranges instead of a slider; the top of each range is sent as the budget. */
const BUDGETS: (Choice & { amount: number })[] = [
  { value: 'b1', label: '200 000 ₼-dək', amount: 200000 },
  { value: 'b2', label: '200 000 – 500 000 ₼', amount: 500000 },
  { value: 'b3', label: '500 000 – 1 milyon ₼', amount: 1000000 },
  { value: 'b4', label: '1 milyon ₼-dan çox', amount: 2000000 },
];

const AREAS: (Choice & { amount: number })[] = [
  { value: 'a1', label: 'Kiçik', hint: '50 hektara qədər', amount: 10 },
  { value: 'a2', label: 'Orta', hint: '50 – 200 hektar', amount: 50 },
  { value: 'a3', label: 'Böyük', hint: '200 hektardan çox', amount: 200 },
];

const EXPERIENCE: Choice[] = [
  { value: 'Yeni başlayan / Startap', label: 'Yeni başlayıram' },
  { value: '1-3 il fərdi fermer təcrübəsi', label: '1–3 il' },
  { value: '3-5 il aqrar təcrübə', label: '3–5 il' },
  { value: '5 ildən çox / İri aqropark', label: '5 ildən çox' },
];

/** Big tap-friendly radio buttons. */
const ChoiceGroup: React.FC<{
  name: string;
  legend: string;
  step: number;
  choices: Choice[];
  value: string;
  onChange: (v: string) => void;
  cols?: string;
}> = ({ name, legend, step, choices, value, onChange, cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }) => (
  <fieldset className="pt-7 first:pt-0 border-t border-line first:border-t-0">
    <legend className="font-display font-extrabold text-xl sm:text-2xl text-brand-900 mb-4 flex items-center gap-3">
      <span className="w-10 h-10 rounded-full bg-brand-700 text-white flex items-center justify-center text-lg shrink-0" aria-hidden="true">{step}</span>
      {legend}
    </legend>
    <div className={`grid gap-3 ${cols}`}>
      {choices.map(c => {
        const checked = value === c.value;
        const id = `${name}-${c.value || 'any'}`;
        return (
          <label
            key={id}
            htmlFor={id}
            className={`min-h-14 px-4 py-3 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-colors ${
              checked ? 'border-brand-700 bg-brand-50' : 'border-line bg-white hover:border-brand-900'
            }`}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={c.value}
              checked={checked}
              onChange={() => onChange(c.value)}
              className="w-6 h-6 accent-[#1F6B3C] shrink-0"
            />
            <span>
              <span className="block font-bold text-lg leading-tight">{c.label}</span>
              {c.hint && <span className="block text-[0.95rem] text-muted">{c.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

function matchWords(score: number): { text: string; cls: string } {
  if (score >= 80) return { text: 'Çox uyğundur', cls: 'bg-brand-700 text-white' };
  if (score >= 60) return { text: 'Uyğundur', cls: 'bg-brand-100 text-brand-900' };
  return { text: 'Qismən uyğundur', cls: 'bg-gold-100 text-gold-900' };
}

export const AgroMatchPage: React.FC<AgroMatchPageProps> = ({ navigate }) => {
  const [region, setRegion] = useState('');
  const [budget, setBudget] = useState('b3');
  const [agricultureType, setAgricultureType] = useState('Əkinçilik');
  const [area, setArea] = useState('a2');
  const [experienceLevel, setExperienceLevel] = useState('1-3 il fərdi fermer təcrübəsi');

  const [results, setResults] = useState<RecommendationResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: region || undefined,
          budget: BUDGETS.find(b => b.value === budget)?.amount,
          agricultureType: agricultureType || undefined,
          minArea: AREAS.find(a => a.value === area)?.amount,
          experienceLevel,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Recommendation fetch error:', err);
      setError('Hesablamaq alınmadı. Bir az sonra yenidən cəhd edin.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResults(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-cream pb-16" ref={topRef}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav aria-label="Səhifə yolu" className="text-[0.95rem] text-muted mb-3">
          <button type="button" onClick={() => navigate('/')} className="underline underline-offset-4 text-brand-900">Ana səhifə</button>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">Mənə uyğun sahə</span>
        </nav>

        <div className="max-w-3xl mb-7">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">
            {results ? 'Sizə uyğun sahələr' : 'Mənə uyğun sahəni tapın'}
          </h1>
          <p className="text-lg text-[#3E4F45] mt-2">
            {results
              ? 'Cavablarınıza ən uyğun sahələr yuxarıda göstərilir.'
              : '5 sadə suala cavab verin — sizə ən uyğun torpaq sahələrini göstərək. Bu, təxminən 1 dəqiqə çəkir.'}
          </p>
        </div>

        {!results ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-line p-5 sm:p-8 flex flex-col gap-7">
            <ChoiceGroup step={1} name="sector" legend="Nə ilə məşğul olmaq istəyirsiniz?" choices={SECTORS} value={agricultureType} onChange={setAgricultureType} />
            <ChoiceGroup step={2} name="region" legend="Hansı rayonda?" choices={REGIONS} value={region} onChange={setRegion} cols="grid-cols-2 sm:grid-cols-3" />
            <ChoiceGroup step={3} name="budget" legend="Nə qədər sərmayə qoya bilərsiniz?" choices={BUDGETS} value={budget} onChange={setBudget} cols="grid-cols-1 sm:grid-cols-2" />
            <ChoiceGroup step={4} name="area" legend="Necə böyük sahə lazımdır?" choices={AREAS} value={area} onChange={setArea} />
            <ChoiceGroup step={5} name="exp" legend="Kənd təsərrüfatında təcrübəniz?" choices={EXPERIENCE} value={experienceLevel} onChange={setExperienceLevel} cols="grid-cols-2 lg:grid-cols-4" />

            {error && (
              <div role="alert" className="p-4 rounded-xl bg-[#FCEBE8] border-2 border-[#C0392B] text-[#7A1F14] text-base flex gap-3">
                <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="pt-6 border-t border-line">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto min-h-16 px-10 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-display font-extrabold text-xl flex items-center justify-center gap-3"
              >
                <Search className="w-6 h-6" aria-hidden="true" />
                {loading ? 'Axtarılır…' : 'Uyğun sahələri göstər'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-line p-5">
              <p className="text-lg" role="status">
                <strong className="font-extrabold text-brand-900 text-xl">{results.length}</strong> sahə tapıldı. Ən uyğunu birinci göstərilir.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="min-h-14 px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold flex items-center gap-2 hover:bg-cream"
              >
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
                Cavabları dəyişin
              </button>
            </div>

            {results.length === 0 && (
              <div className="text-center py-12 px-6 bg-white rounded-3xl border border-line">
                <p className="font-display font-extrabold text-2xl text-brand-900">Uyğun sahə tapılmadı</p>
                <p className="text-lg text-muted mt-2">Rayon üçün “Fərq etməz” seçin və ya büdcəni dəyişin.</p>
              </div>
            )}

            <ol className="flex flex-col gap-6">
              {results.map((res, index) => {
                const words = matchWords(res.matchScore);
                return (
                  <li key={res.land.id} className={`bg-white rounded-3xl overflow-hidden border-2 ${index === 0 ? 'border-gold-500' : 'border-line'}`}>
                    <div className="grid md:grid-cols-[16rem_1fr]">
                      <div className="relative">
                        <img src={landImage(res.land)} alt="" className="w-full h-48 md:h-full object-cover" />
                        {index === 0 && (
                          <span className="absolute top-3 left-3 bg-gold-500 text-ink font-display font-extrabold text-sm px-3 py-1.5 rounded-full shadow">
                            Ən uyğun
                          </span>
                        )}
                      </div>
                      <div className="p-5 sm:p-6 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`font-display font-extrabold text-base px-4 py-1.5 rounded-full ${words.cls}`}>{words.text}</span>
                          <span className="text-base text-muted">uyğunluq: <strong className="text-ink">{res.matchScore}%</strong></span>
                        </div>
                        <div
                          className="h-3 rounded-full bg-sand overflow-hidden"
                          role="img"
                          aria-label={`Uyğunluq ${res.matchScore} faiz`}
                        >
                          <div className="h-full bg-brand-700 rounded-full" style={{ width: `${Math.min(100, Math.max(0, res.matchScore))}%` }} />
                        </div>
                        <div>
                          <p className="text-base text-[#3E4F45]">{res.land.region} · {res.land.agricultureType}</p>
                          <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900 mt-1">{res.land.title}</h2>
                        </div>
                        <dl className="grid grid-cols-2 gap-3 py-3 border-y border-line">
                          <div>
                            <dt className="text-sm text-muted">Sahə</dt>
                            <dd className="font-extrabold text-xl">{res.land.areaHectares} ha</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-muted">Minimal sərmayə</dt>
                            <dd className="font-extrabold text-xl">{formatManat(res.land.estimatedInvestmentRequirement)}</dd>
                          </div>
                        </dl>

                        {(res.matchingFactors.length > 0 || res.mismatches.length > 0) && (
                          <ul className="flex flex-col gap-1.5 text-base">
                            {res.matchingFactors.map((mf, i) => (
                              <li key={`m${i}`} className="flex items-start gap-2 text-brand-900">
                                <Check className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                                <span><span className="sr-only">Uyğundur: </span>{mf}</span>
                              </li>
                            ))}
                            {res.mismatches.map((mm, i) => (
                              <li key={`x${i}`} className="flex items-start gap-2 text-gold-900">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                                <span><span className="sr-only">Diqqət: </span>{mm}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <button
                          type="button"
                          onClick={() => navigate(`/opportunities/${res.land.id}`)}
                          className="min-h-14 px-6 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2 sm:self-start"
                        >
                          Ətraflı baxın və müraciət edin
                          <ArrowRight className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="p-5 bg-sand rounded-2xl text-base text-[#3E4F45]">
              <strong className="text-ink">Qeyd:</strong> Uyğunluq faizi yalnız sizin cavablarınıza əsaslanır. Bu, müsabiqədə qalib gələcəyinizə zəmanət deyil.
              Sualınız varsa, zəng edin: <strong className="text-ink whitespace-nowrap"><Phone className="inline w-4 h-4" aria-hidden="true" /> {HELP_LINE}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
