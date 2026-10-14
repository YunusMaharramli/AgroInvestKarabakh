import React, { useState } from 'react';
import { RecommendationResult } from '../types/index.js';
import { Sparkles, Check, AlertCircle, ArrowRight, RotateCcw, ThumbsUp, DollarSign, MapPin, Layers } from 'lucide-react';

interface AgroMatchPageProps {
  navigate: (route: string) => void;
}

export const AgroMatchPage: React.FC<AgroMatchPageProps> = ({ navigate }) => {
  const [region, setRegion] = useState('');
  const [budget, setBudget] = useState(500000);
  const [agricultureType, setAgricultureType] = useState('Əkinçilik');
  const [minArea, setMinArea] = useState(100);
  const [experienceLevel, setExperienceLevel] = useState('3-5 il aqrar təcrübə');

  const [results, setResults] = useState<RecommendationResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: region === 'all' ? undefined : region,
          budget,
          agricultureType: agricultureType === 'all' ? undefined : agricultureType,
          minArea,
          experienceLevel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error('Recommendation fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResults(null);
    setRegion('');
    setBudget(500000);
    setAgricultureType('Əkinçilik');
    setMinArea(100);
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Ağıllı Uyğunluq Mühərriki</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            AgroMatch Tövsiyə Sistemi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            İnvestisiya büdcənizi, üstünlük verdiyiniz regionu və aqrar istiqamətinizi qeyd edin. Sistem şəffaf çəkili qiymətləndirmə ilə profilinizə ən uyğun müsabiqələri tapsın.
          </p>
        </div>

        {!results ? (
          /* Questionnaire Form */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Question 1: Region */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  1. Üstünlük verdiyiniz rayon və ya məkan
                </label>
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="">İstənilən Qarabağ rayonu (Məhdudiyyətsiz)</option>
                  <option value="Ağdam">Ağdam rayonu</option>
                  <option value="Füzuli">Füzuli rayonu</option>
                  <option value="Zəngilan">Zəngilan rayonu</option>
                  <option value="Cəbrayıl">Cəbrayıl rayonu</option>
                  <option value="Qubadlı">Qubadlı rayonu</option>
                  <option value="Xocavənd">Xocavənd rayonu</option>
                  <option value="Kəlbəcər">Kəlbəcər rayonu</option>
                  <option value="Laçın">Laçın rayonu</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">Çəki dərəcəsi: 35%</span>
              </div>

              {/* Question 2: Budget */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Planlaşdırılan investisiya büdcəsi (AZN)
                  </label>
                  <span className="text-xs font-bold text-emerald-800 font-mono-numbers bg-emerald-50 px-2 py-0.5 rounded">
                    {budget.toLocaleString()} AZN
                  </span>
                </div>
                <input
                  type="range"
                  min="100000"
                  max="1500000"
                  step="50000"
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  className="w-full accent-emerald-800 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>100,000 AZN</span>
                  <span>750,000 AZN</span>
                  <span>1,500,000+ AZN</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Çəki dərəcəsi: 30%</span>
              </div>

              {/* Question 3: Sector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  3. Maraqlandığınız kənd təsərrüfatı sektoru
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    'Əkinçilik',
                    'Bağçılıq',
                    'İstixana təsərrüfatı',
                    'Heyvandarlıq',
                    'Arıçılıq',
                  ].map(sec => (
                    <button
                      type="button"
                      key={sec}
                      onClick={() => setAgricultureType(sec)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                        agricultureType === sec
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">Çəki dərəcəsi: 20%</span>
              </div>

              {/* Question 4: Area */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    4. Tələb olunan minimal torpaq sahəsi (hektar)
                  </label>
                  <span className="text-xs font-bold text-slate-900 font-mono-numbers">
                    {minArea} ha
                  </span>
                </div>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={minArea}
                  onChange={e => setMinArea(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Çəki dərəcəsi: 15%</span>
              </div>

              {/* Question 5: Experience */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  5. Aqrar investisiya və idarəetmə təcrübəniz
                </label>
                <select
                  value={experienceLevel}
                  onChange={e => setExperienceLevel(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="Yeni başlayan / Startap">Yeni başlayan / Aqrar startap</option>
                  <option value="1-3 il fərdi fermer təcrübəsi">1-3 il fərdi fermer təcrübəsi</option>
                  <option value="3-5 il aqrar təcrübə">3-5 il təsdiq olunmuş aqrar şirkət təcrübəsi</option>
                  <option value="5 ildən çox / İri aqropark">5 ildən çox / İri aqropark və holdinq</option>
                </select>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <span>Alqoritm hesablayır...</span>
                  ) : (
                    <>
                      <span>Uyğunluğu Hesabla</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Results View */
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  AgroMatch Nəticələri: <span className="text-emerald-800">{results.length} uyğun müsabiqə</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Nəticələr 4 parametrin çəkili formuluna əsasən sıralanmışdır
                </p>
              </div>
              <button
                onClick={resetForm}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Yenidən sına</span>
              </button>
            </div>

            {/* Results cards */}
            <div className="space-y-4">
              {results.map((res, index) => (
                <div
                  key={res.land.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-emerald-300 transition-colors p-5 sm:p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-bold text-emerald-800">{res.land.region}</span>
                        <span aria-hidden="true">·</span>
                        <span>{res.land.agricultureType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-numbers">{res.land.areaHectares} ha</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{res.land.title}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{res.explanation}</p>
                    </div>

                    {/* Match Score Badge */}
                    <div className="flex flex-col items-center justify-center p-3.5 bg-emerald-50 rounded-xl border border-emerald-200/60 shrink-0 min-w-[110px]">
                      <span className="text-2xl font-black text-emerald-800 font-mono-numbers">
                        {res.matchScore}%
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                        Uyğunluq
                      </span>
                    </div>
                  </div>

                  {/* Factor Breakdown */}
                  <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Məkan (35%)</span>
                      <strong className="text-slate-800 font-mono-numbers">{res.matchBreakdown.locationScore}%</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Büdcə (30%)</span>
                      <strong className="text-slate-800 font-mono-numbers">{res.matchBreakdown.budgetScore}%</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Sektor (20%)</span>
                      <strong className="text-slate-800 font-mono-numbers">{res.matchBreakdown.sectorScore}%</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Sahə (15%)</span>
                      <strong className="text-slate-800 font-mono-numbers">{res.matchBreakdown.areaScore}%</strong>
                    </div>
                  </div>

                  {/* Factors list */}
                  <div className="mt-4 space-y-1 text-xs">
                    {res.matchingFactors.map((mf, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-emerald-700">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{mf}</span>
                      </div>
                    ))}
                    {res.mismatches.map((mm, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{mm}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tələb olunan minimal sərmayə</span>
                      <span className="text-xs font-bold text-slate-900 font-mono-numbers">
                        {res.land.estimatedInvestmentRequirement.toLocaleString()} AZN
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/opportunities/${res.land.id}`)}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        İmkanı Aç və Müraciət Et
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-slate-100 rounded-xl text-slate-500 text-[11px] leading-relaxed">
              <strong>Xəbərdarlıq:</strong> AgroMatch sistemi tərəfindən hesablanan uyğunluq faizi sahibkarın subyektiv seçimləri ilə mövcud elanlar arasındakı uyğunluğu ifadə edir. Bu faiz müsabiqə komissiyasının rəsmi qərarı, qalibiyyət və ya gələcək maliyyə gəlirliliyinə rəsmi zəmanət deyil.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
