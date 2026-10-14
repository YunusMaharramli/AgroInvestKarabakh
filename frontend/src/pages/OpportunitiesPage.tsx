import React, { useState, useEffect } from 'react';
import { AgriculturalLand } from '../types/index.js';
import { useFavorites } from '../context/FavoritesContext.js';
import { useComparison } from '../context/ComparisonContext.js';
import { Search, Filter, Layers, ArrowUpDown, Check, RefreshCw } from 'lucide-react';

interface OpportunitiesPageProps {
  navigate: (route: string) => void;
  initialQuery?: string;
}

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ navigate, initialQuery }) => {
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [agricultureType, setAgricultureType] = useState('all');
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'area-desc' | 'investment-asc' | 'investment-desc'>('default');

  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToCompare, removeFromCompare, isInCompare, compareLands } = useComparison();

  const fetchLands = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (region !== 'all') params.set('region', region);
      if (agricultureType !== 'all') params.set('agricultureType', agricultureType);
      if (minArea) params.set('minArea', minArea);
      if (maxArea) params.set('maxArea', maxArea);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/lands?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLands(data);
      }
    } catch (e) {
      console.error('Failed to load lands:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Parse query params if available from URL or props
    if (initialQuery) {
      const q = new URLSearchParams(initialQuery);
      if (q.get('region')) setRegion(q.get('region')!);
      if (q.get('sector')) setAgricultureType(q.get('sector')!);
      if (q.get('minArea')) setMinArea(q.get('minArea')!);
    }
  }, [initialQuery]);

  useEffect(() => {
    fetchLands();
  }, [region, agricultureType, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLands();
  };

  const handleResetFilters = () => {
    setSearch('');
    setRegion('all');
    setAgricultureType('all');
    setMinArea('');
    setMaxArea('');
    setSortBy('default');
  };

  // Sort lands client-side for immediate responsiveness
  const sortedLands = [...lands].sort((a, b) => {
    if (sortBy === 'area-desc') return b.areaHectares - a.areaHectares;
    if (sortBy === 'investment-asc') return a.estimatedInvestmentRequirement - b.estimatedInvestmentRequirement;
    if (sortBy === 'investment-desc') return b.estimatedInvestmentRequirement - a.estimatedInvestmentRequirement;
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <button onClick={() => navigate('/')} className="hover:text-slate-800">Ana səhifə</button>
              <span aria-hidden="true">/</span>
              <span className="text-slate-800 font-medium">İnvestisiya imkanları</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Qarabağ Aqrar Torpaq Fondu Kataloqu
            </h1>
          </div>

          {compareLands.length > 0 && (
            <button
              onClick={() => navigate('/compare')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-lg shadow-xs flex items-center gap-2 self-start sm:self-auto"
            >
              <Layers className="w-4 h-4" />
              <span>Müqayisə et ({compareLands.length}/3)</span>
            </button>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-8 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Açar Sözlə Axtarış
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Torpağın adı, təyinatı..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Region
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="all">Bütün Regionlar</option>
                <option value="Ağdam">Ağdam</option>
                <option value="Füzuli">Füzuli</option>
                <option value="Zəngilan">Zəngilan</option>
                <option value="Cəbrayıl">Cəbrayıl</option>
                <option value="Qubadlı">Qubadlı</option>
                <option value="Xocavənd">Xocavənd</option>
                <option value="Kəlbəcər">Kəlbəcər</option>
                <option value="Laçın">Laçın</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Aqrar Fəaliyyət
              </label>
              <select
                value={agricultureType}
                onChange={e => setAgricultureType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="all">Bütün İstiqamətlər</option>
                <option value="Əkinçilik">Əkinçilik</option>
                <option value="Bağçılıq">Bağçılıq</option>
                <option value="İstixana təsərrüfatı">İstixana təsərrüfatı</option>
                <option value="Heyvandarlıq">Heyvandarlıq</option>
                <option value="Arıçılıq">Arıçılıq</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Sıralama
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="default">İlkin düzülüş</option>
                <option value="area-desc">Sahə (Böyükdən kiçiyə)</option>
                <option value="investment-asc">İnvestisiya (Aşağıdan yuxarıya)</option>
                <option value="investment-desc">İnvestisiya (Yuxarıdan aşağıya)</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs py-2 px-3 rounded-lg transition-colors shadow-2xs"
              >
                Axtar
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Sıfırla"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Results Metadata Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-6">
          <div>
            <span>Tapılan sahələr:</span> <strong className="text-slate-900 font-mono-numbers">{sortedLands.length}</strong> ədəd
          </div>
          <div className="flex items-center gap-2">
            <span>Müqayisə üçün ən çox 3 sahə seçə bilərsiniz</span>
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : sortedLands.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-700">Seçilmiş filtrlər üzrə heç bir torpaq sahəsi tapılmadı.</p>
            <p className="text-xs text-slate-400 mt-1">Zəhmət olmasa digər region və ya parametrləri yoxlayın.</p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 transition-colors"
            >
              Bütün sahələri göstər
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedLands.map(land => {
              const inComp = isInCompare(land.id);
              return (
                <div
                  key={land.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between group"
                >
                  <div>
                    {/* Image Header with Favorite Button */}
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <img
                        src={land.imageUrl}
                        alt={land.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={() => toggleFavorite(land.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-600 hover:text-rose-600 transition-colors shadow-xs"
                      >
                        <span className={`text-base leading-none ${isFavorite(land.id) ? 'text-rose-600' : 'text-slate-400'}`}>♥</span>
                      </button>
                    </div>

                    <div className="p-4">
                      {/* Zero-Pill Typography Metadata */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1.5">
                        <span className="text-emerald-800 font-semibold">{land.region}</span>
                        <span aria-hidden="true">·</span>
                        <span>{land.agricultureType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-numbers">{land.areaHectares} ha</span>
                      </div>

                      <h3
                        onClick={() => navigate(`/opportunities/${land.id}`)}
                        className="text-base font-bold text-slate-900 group-hover:text-emerald-800 cursor-pointer transition-colors line-clamp-1"
                      >
                        {land.title}
                      </h3>

                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                        {land.description}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Torpaq keyfiyyəti</span>
                          <span className="text-slate-700 font-medium truncate block">{land.soilQuality || 'Münbit şabalıdı'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Minimal İnvestisiya</span>
                          <span className="text-slate-900 font-bold font-mono-numbers">
                            {land.estimatedInvestmentRequirement.toLocaleString()} ₼
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      {/* Compare toggle */}
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={inComp}
                          onChange={() => {
                            if (inComp) removeFromCompare(land.id);
                            else addToCompare(land);
                          }}
                          className="rounded text-emerald-800 focus:ring-emerald-700"
                        />
                        <span className="text-[11px]">Müqayisə et</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/opportunities/${land.id}`)}
                          className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Ətraflı bax
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
