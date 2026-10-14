import React, { useState, useEffect } from 'react';
import { AgriculturalLand } from '../types/index.js';
import { useFavorites } from '../context/FavoritesContext.js';
import { useComparison } from '../context/ComparisonContext.js';
import { Search, Layers, RotateCcw, Heart, Check, Map as MapIcon, ArrowRight } from 'lucide-react';
import { landImage, formatManat } from '../lib/landImages.js';

interface OpportunitiesPageProps {
  navigate: (route: string) => void;
  initialQuery?: string;
}

const REGIONS = ['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl', 'Qubadlı', 'Xocavənd', 'Kəlbəcər', 'Laçın'];
const TYPES: { value: string; label: string }[] = [
  { value: 'Əkinçilik', label: 'Əkinçilik' },
  { value: 'Bağçılıq', label: 'Bağçılıq' },
  { value: 'İstixana təsərrüfatı', label: 'İstixana' },
  { value: 'Heyvandarlıq', label: 'Heyvandarlıq' },
  { value: 'Arıçılıq', label: 'Arıçılıq' },
];

/** Area choices in plain words instead of two number boxes. */
const AREAS: { value: string; label: string; min: string; max: string }[] = [
  { value: 'any', label: 'İstənilən ölçü', min: '', max: '' },
  { value: 'small', label: '50 hektara qədər', min: '', max: '50' },
  { value: 'medium', label: '50 – 200 hektar', min: '50', max: '200' },
  { value: 'large', label: '200 hektardan çox', min: '200', max: '' },
];

function areaFromMin(min: string | null): string {
  const n = Number(min);
  if (!min || Number.isNaN(n)) return 'any';
  if (n >= 200) return 'large';
  return 'medium';
}

type SortKey = 'default' | 'area-desc' | 'investment-asc' | 'investment-desc';

const fieldClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-base focus:border-brand-700';

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ navigate, initialQuery }) => {
  const initial = new URLSearchParams(initialQuery || '');
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initial.get('search') || '');
  const [region, setRegion] = useState(initial.get('region') || 'all');
  const [agricultureType, setAgricultureType] = useState(initial.get('sector') || 'all');
  const [area, setArea] = useState(areaFromMin(initial.get('minArea')));
  const [sortBy, setSortBy] = useState<SortKey>('default');

  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToCompare, removeFromCompare, isInCompare, compareLands } = useComparison();

  const fetchLands = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const a = AREAS.find(x => x.value === area) ?? AREAS[0];
      if (region !== 'all') params.set('region', region);
      if (agricultureType !== 'all') params.set('agricultureType', agricultureType);
      if (a.min) params.set('minArea', a.min);
      if (a.max) params.set('maxArea', a.max);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/lands?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLands(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load lands:', e);
    } finally {
      setLoading(false);
    }
  };

  // Dropdowns apply immediately; the text search applies on "Axtar"
  useEffect(() => {
    fetchLands();
  }, [region, agricultureType, area]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLands();
  };

  const handleResetFilters = () => {
    setSearch('');
    setRegion('all');
    setAgricultureType('all');
    setArea('any');
    setSortBy('default');
  };

  const filtersActive = search !== '' || region !== 'all' || agricultureType !== 'all' || area !== 'any';

  const sortedLands = [...lands].sort((a, b) => {
    if (sortBy === 'area-desc') return b.areaHectares - a.areaHectares;
    if (sortBy === 'investment-asc') return a.estimatedInvestmentRequirement - b.estimatedInvestmentRequirement;
    if (sortBy === 'investment-desc') return b.estimatedInvestmentRequirement - a.estimatedInvestmentRequirement;
    return 0;
  });

  return (
    <div className="bg-cream pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav aria-label="Səhifə yolu" className="text-[0.95rem] text-muted mb-3">
          <button type="button" onClick={() => navigate('/')} className="underline underline-offset-4 text-brand-900">Ana səhifə</button>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">İnvestisiya imkanları</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div className="max-w-3xl">
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">İnvestisiya imkanları</h1>
            <p className="text-lg text-[#3E4F45] mt-2">
              Torpaq sahiblərinin və dövlətin investor axtardığı kənd təsərrüfatı torpaqları. Rayon və fəaliyyət növünü seçin, sizə uyğun sahələri görün.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/map')}
            className="inline-flex items-center gap-2 min-h-14 px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white"
          >
            <MapIcon className="w-6 h-6" aria-hidden="true" />
            Xəritədə göstər
          </button>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearchSubmit} className="bg-white rounded-3xl border border-line p-5 sm:p-7 mb-6" aria-label="Axtarış və filtrlər">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="f-region" className="font-bold">Rayon</label>
              <select id="f-region" value={region} onChange={e => setRegion(e.target.value)} className={fieldClass}>
                <option value="all">Bütün rayonlar</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="f-type" className="font-bold">Fəaliyyət növü</label>
              <select id="f-type" value={agricultureType} onChange={e => setAgricultureType(e.target.value)} className={fieldClass}>
                <option value="all">Bütün növlər</option>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="f-area" className="font-bold">Sahənin ölçüsü</label>
              <select id="f-area" value={area} onChange={e => setArea(e.target.value)} className={fieldClass}>
                {AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="f-sort" className="font-bold">Necə düzülsün?</label>
              <select id="f-sort" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className={fieldClass}>
                <option value="default">Adi qaydada</option>
                <option value="investment-asc">Ən ucuzdan bahaya</option>
                <option value="investment-desc">Ən bahadan ucuza</option>
                <option value="area-desc">Ən böyük sahə əvvəl</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex flex-col gap-2 flex-1">
              <label htmlFor="f-search" className="font-bold">Adla axtarış <span className="font-normal text-muted">(istəyə görə)</span></label>
              <input
                id="f-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Məsələn: nar, buğda, istixana"
                className={fieldClass}
              />
            </div>
            <button
              type="submit"
              className="min-h-[3.25rem] px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg flex items-center justify-center gap-3"
            >
              <Search className="w-6 h-6" aria-hidden="true" />
              Axtar
            </button>
            {filtersActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[3.25rem] px-5 rounded-xl border-2 border-line text-brand-900 font-display font-bold flex items-center justify-center gap-2 hover:border-brand-900"
              >
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
                Filtrləri təmizlə
              </button>
            )}
          </div>
        </form>

        <p className="text-lg mb-6" role="status" aria-live="polite">
          {loading ? 'Axtarılır…' : <><strong className="font-extrabold text-brand-900">{sortedLands.length}</strong> sahə tapıldı</>}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-[30rem] bg-white rounded-3xl border border-line animate-pulse" />
            ))}
          </div>
        ) : sortedLands.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white rounded-3xl border border-line">
            <p className="font-display font-extrabold text-2xl text-brand-900">Bu seçimlərə uyğun sahə tapılmadı</p>
            <p className="text-lg text-muted mt-2">Başqa rayon və ya fəaliyyət növü seçin, ya da bütün sahələrə baxın.</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-6 min-h-14 px-7 rounded-xl bg-brand-700 text-white font-display font-bold hover:bg-brand-800"
            >
              Bütün sahələri göstər
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedLands.map(land => {
              const inComp = isInCompare(land.id);
              const fav = isFavorite(land.id);
              const compareFull = !inComp && compareLands.length >= 3;
              return (
                <li key={land.id} className="bg-white rounded-3xl overflow-hidden border border-line flex flex-col">
                  <div className="relative">
                    <img src={landImage(land)} alt="" className="w-full h-52 object-cover" />
                    <button
                      type="button"
                      onClick={() => toggleFavorite(land.id)}
                      aria-pressed={fav}
                      aria-label={`${land.title}: ${fav ? 'yadda saxlanılıb' : 'yadda saxla'}`}
                      className="absolute top-3 right-3 flex items-center gap-2 min-h-11 px-3 rounded-xl bg-white/95 text-sm font-bold text-ink shadow"
                    >
                      <Heart className={`w-5 h-5 ${fav ? 'fill-[#C0392B] text-[#C0392B]' : ''}`} aria-hidden="true" />
                      {fav ? 'Saxlanıb' : 'Yadda saxla'}
                    </button>
                  </div>
                  <div className="p-6 flex flex-col gap-4 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-brand-50 text-brand-900 font-bold text-sm px-3 py-1 rounded-full">{land.region}</span>
                      <span className="bg-gold-100 text-gold-900 font-bold text-sm px-3 py-1 rounded-full">{land.agricultureType}</span>
                      {land.hasActiveOpportunity ? (
                        <span className="bg-brand-700 text-white font-bold text-sm px-3 py-1 rounded-full">Təklif qəbul edilir</span>
                      ) : (
                        <span className="bg-sand text-muted font-bold text-sm px-3 py-1 rounded-full">Hazırda açıq elan yoxdur</span>
                      )}
                    </div>
                    <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900">{land.title}</h2>
                    <p className="text-[0.98rem] text-[#3E4F45] line-clamp-3">{land.description}</p>
                    <dl className="grid grid-cols-2 gap-3 py-4 border-y border-line">
                      <div>
                        <dt className="text-sm text-muted">Sahə</dt>
                        <dd className="font-extrabold text-xl">{land.areaHectares} ha</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted">Minimal sərmayə</dt>
                        <dd className="font-extrabold text-xl">{formatManat(land.estimatedInvestmentRequirement)}</dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/opportunities/${land.id}`)}
                        className="min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold text-base flex items-center justify-center gap-2"
                      >
                        Ətraflı baxın
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => (inComp ? removeFromCompare(land.id) : addToCompare(land))}
                        aria-pressed={inComp}
                        disabled={compareFull}
                        className={`min-h-12 rounded-xl border-2 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          inComp ? 'bg-gold-100 border-gold-500 text-gold-900' : 'border-line text-brand-900 hover:border-brand-900'
                        }`}
                      >
                        {inComp ? <Check className="w-5 h-5" aria-hidden="true" /> : <Layers className="w-5 h-5" aria-hidden="true" />}
                        {inComp ? 'Müqayisəyə əlavə olunub' : compareFull ? 'Ən çox 3 sahə müqayisə olunur' : 'Müqayisəyə əlavə et'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Compare bar: always visible once something is selected */}
      {compareLands.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-brand-950 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 pr-24 sm:pr-28">
            <p className="text-base">
              <strong className="text-gold-400 text-xl">{compareLands.length}</strong> sahə müqayisə üçün seçilib <span className="text-[#C9D8CE]">(ən çox 3)</span>
            </p>
            <button
              type="button"
              onClick={() => navigate('/compare')}
              className="min-h-12 px-6 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-extrabold flex items-center gap-2"
            >
              <Layers className="w-5 h-5" aria-hidden="true" />
              Müqayisə edin
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
