import React, { useState, useEffect } from 'react';
import { AgriculturalLand, Competition } from '../types/index.js';
import { Search, MapPin, ArrowRight, ChevronDown, CheckCircle2, TrendingUp, Sparkles, Filter, Calendar, Sprout } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext.js';

interface HomePageProps {
  navigate: (route: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  const [featuredLands, setFeaturedLands] = useState<AgriculturalLand[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [searchRegion, setSearchRegion] = useState('all');
  const [searchSector, setSearchSector] = useState('all');
  const [searchMinArea, setSearchMinArea] = useState('');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    fetch('/api/lands')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setFeaturedLands(data.slice(0, 4));
        }
      })
      .catch(console.error);

    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCompetitions(data);
        }
      })
      .catch(console.error);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchRegion !== 'all') params.set('region', searchRegion);
    if (searchSector !== 'all') params.set('sector', searchSector);
    if (searchMinArea) params.set('minArea', searchMinArea);
    navigate(`/opportunities?${params.toString()}`);
  };

  const faqs = [
    {
      q: 'Müsabiqədə kimlər iştirak edə bilər?',
      a: 'Azərbaycan Respublikasında qeydiyyatdan keçmiş hüquqi şəxslər və fərdi sahibkarlar kənd təsərrüfatı müsabiqələrində iştirak etmək hüququna malikdirlər. Hər bir müsabiqənin spesifik tələbləri (maliyyə zəmanəti, aqrotexniki təcrübə və s.) müsabiqə səhifəsində açıq göstərilir.',
    },
    {
      q: 'Müraciətimin statusunu necə yoxlaya bilərəm?',
      a: 'Elektron ərizənizi göndərdikdən dərhal sonra sistem sizə AGRO-2026-XXXX formatında unikal müraciət nömrəsi təqdim edir. Şəxsi kabinetinizdəki "Müraciətlərim" bölməsindən addım-addım status tarixçəsini və ekspert qeydlərini real vaxt rejimində izləyə bilərsiniz.',
    },
    {
      q: 'Torpaq sahəsi ayrıldıqdan sonra dövlət dəstəyi nəzərdə tutulurmu?',
      a: 'Bəli. Qarabağ və Şərqi Zəngəzur iqtisadi rayonlarında fəaliyyət göstərən sahibkarlar üçün vergi və gömrük güzəştləri, kənd təsərrüfatı texnikası və damcılı suvarma subsidiyaları, eləcə də güzəştli kredit xətləri nəzərdə tutulur.',
    },
    {
      q: 'AgroMatch tövsiyə sistemi nə dərəcədə etibarlıdır?',
      a: 'AgroMatch şəffaf riyazi meyarlar (məkan 35%, büdcə 30%, sektor 20%, sahə 15%) əsasında sizin imkanlarınıza ən yaxın torpaq sahələrini seçir. Bu sistem qərar qəbuluna köməkçi xarakter daşıyır və rəsmi müsabiqə qalibiyyətinə avtomatik zəmanət vermir.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        {/* Background Image with Measured Scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/hero_karabakh_agriculture_1791976991286.jpg"
            alt="Qarabağ kənd təsərrüfatı mənzərəsi"
            className="w-full h-full object-cover object-center opacity-40 scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-slate-900/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 lg:pt-28 lg:pb-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-900/70 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-semibold mb-6 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Qarabağ və Şərqi Zəngəzur Aqrar İnvestisiya Portalı</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white text-balance leading-tight">
              Qarabağın gələcəyinə <span className="text-amber-400">sərmayə</span> yatırın
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl text-balance">
              Qarabağda kənd təsərrüfatı investisiya imkanlarını kəşf edin, münbit torpaq sahələrini seçin və rəsmi müsabiqə müraciətlərinizi vahid elektron platformadan idarə edin.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/opportunities')}
                className="px-6 py-3.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-xl shadow-lg hover:shadow-emerald-700/30 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <span>İnvestisiya imkanlarını kəşf et</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/map')}
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <MapPin className="w-4 h-4 text-amber-300" />
                <span>İnteraktiv xəritəyə bax</span>
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="mt-14 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/30 text-slate-800">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Region
                </label>
                <select
                  value={searchRegion}
                  onChange={e => setSearchRegion(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="all">Bütün regionlar</option>
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
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Aqrar Kateqoriya
                </label>
                <select
                  value={searchSector}
                  onChange={e => setSearchSector(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="all">Bütün istiqamətlər</option>
                  <option value="Əkinçilik">Əkinçilik (Taxıl, dənli bitkilər)</option>
                  <option value="Bağçılıq">Bağçılıq (Nar, qoz, zeytun)</option>
                  <option value="İstixana təsərrüfatı">İstixana təsərrüfatı</option>
                  <option value="Heyvandarlıq">Heyvandarlıq</option>
                  <option value="Arıçılıq">Arıçılıq</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Minimal Sahə (ha)
                </label>
                <input
                  type="number"
                  placeholder="Məs: 50"
                  value={searchMinArea}
                  onChange={e => setSearchMinArea(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Search className="w-4 h-4" />
                  <span>Axtar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 2. REAL-TIME STATS STRIP */}
      <section className="bg-white border-b border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="border-r border-slate-100 last:border-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-numbers">12+</span>
              <p className="text-xs text-slate-500 mt-1">Dərc olunmuş torpaq massivi</p>
            </div>
            <div className="border-r border-slate-100 last:border-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-800 font-mono-numbers">5</span>
              <p className="text-xs text-slate-500 mt-1">Aktiv investisiya müsabiqəsi</p>
            </div>
            <div className="border-r border-slate-100 last:border-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-numbers">8</span>
              <p className="text-xs text-slate-500 mt-1">Əhatə olunan Qarabağ rayonu</p>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono-numbers">6.2M ₼</span>
              <p className="text-xs text-slate-500 mt-1">Gözlənilən aqro-sərmayə portfeli</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURED OPPORTUNITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Seçilmiş İnvestisiya Sahələri</h2>
            <p className="text-xs text-slate-500 mt-1">
              Qarabağda ən yüksək aqrar iqtisadi potensiala malik aktiv torpaq sahələri
            </p>
          </div>
          <button
            onClick={() => navigate('/opportunities')}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Bütün sahələrə bax ({featuredLands.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredLands.map(land => (
            <div
              key={land.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group"
            >
              <div className="relative h-44 overflow-hidden bg-slate-100">
                <img
                  src={land.imageUrl}
                  alt={land.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => toggleFavorite(land.id)}
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-600 hover:text-rose-600 transition-colors shadow-xs"
                  title="Seçilmişlərə əlavə et"
                >
                  <span className={`text-base leading-none ${isFavorite(land.id) ? 'text-rose-600' : 'text-slate-400'}`}>♥</span>
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  {/* Zero-Pill Typography Metadata */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
                    <span className="text-emerald-800 font-semibold">{land.region}</span>
                    <span aria-hidden="true">·</span>
                    <span>{land.agricultureType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-numbers">{land.areaHectares} ha</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-1">
                    {land.title}
                  </h3>

                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {land.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Minimal İnvestisiya</span>
                    <span className="text-xs font-bold text-slate-900 font-mono-numbers">
                      {land.estimatedInvestmentRequirement ? `${land.estimatedInvestmentRequirement.toLocaleString()} ₼` : 'Təyin edilir'}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/opportunities/${land.id}`)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-800 hover:text-white text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Ətraflı
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AGRICULTURAL CATEGORIES (BENTO GRID) */}
      <section className="bg-slate-50 border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Aqrar İxtisaslaşma Sektorları</h2>
            <p className="text-xs text-slate-500 mt-2">
              Qarabağın torpaq-iqlim xüsusiyyətlərinə uyğunlaşdırılmış strateji kənd təsərrüfatı istiqamətləri
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              onClick={() => navigate('/opportunities?sector=Əkinçilik')}
              className="md:col-span-2 relative h-72 rounded-2xl overflow-hidden cursor-pointer group shadow-xs border border-slate-200"
            >
              <img
                src="/src/assets/images/category_crop_farming_1791976992217.jpg"
                alt="Əkinçilik"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-6 flex flex-col justify-end text-white">
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Ağdam · Cəbrayıl · Füzuli</span>
                <h3 className="text-xl font-bold mt-1">Dənli Bitkilər və Toxumçuluq (Əkinçilik)</h3>
                <p className="text-xs text-slate-200 mt-1 max-w-lg">
                  Geniş düzənliklərdə müasir kombayn və pivot suvarma ilə buğda, arpa və qarğıdalı əkini.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/opportunities?sector=Bağçılıq')}
              className="relative h-72 rounded-2xl overflow-hidden cursor-pointer group shadow-xs border border-slate-200"
            >
              <img
                src="/src/assets/images/category_orchard_horticulture_1791976992718.jpg"
                alt="Bağçılıq"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-6 flex flex-col justify-end text-white">
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Zəngilan · Xocavənd</span>
                <h3 className="text-lg font-bold mt-1">İntensiv Bağçılıq</h3>
                <p className="text-xs text-slate-200 mt-1">
                  İxrac yönümlü nar, badam, qoz və tarixi yerli üzüm plantasiyaları.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/opportunities?sector=İstixana təsərrüfatı')}
              className="relative h-64 rounded-2xl overflow-hidden cursor-pointer group shadow-xs border border-slate-200"
            >
              <img
                src="/src/assets/images/category_modern_greenhouse_1791976991572.jpg"
                alt="İstixana"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-6 flex flex-col justify-end text-white">
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Füzuli Aqropark</span>
                <h3 className="text-lg font-bold mt-1">Hidroponik İstixanalar</h3>
                <p className="text-xs text-slate-200 mt-1">
                  Avtomatlaşdırılmış iqlim nəzarətli ekoloji təmiz tərəvəzçilik.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/opportunities?sector=Heyvandarlıq')}
              className="relative h-64 rounded-2xl overflow-hidden cursor-pointer group shadow-xs border border-slate-200"
            >
              <img
                src="/src/assets/images/hero_karabakh_agriculture_1791976991286.jpg"
                alt="Heyvandarlıq"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-6 flex flex-col justify-end text-white">
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Kəlbəcər · Laçın · Cəbrayıl</span>
                <h3 className="text-lg font-bold mt-1">Cins Heyvandarlıq</h3>
                <p className="text-xs text-slate-200 mt-1">
                  Alp çəmənlərində südlük və ətlik ferma kompleksləri.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/opportunities?sector=Arıçılıq')}
              className="relative h-64 rounded-2xl overflow-hidden cursor-pointer group shadow-xs border border-slate-200"
            >
              <img
                src="/src/assets/images/category_orchard_horticulture_1791976992718.jpg"
                alt="Arıçılıq"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-6 flex flex-col justify-end text-white">
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Qubadlı · Kəlbəcər</span>
                <h3 className="text-lg font-bold mt-1">Dağ Arıçılığı Klasteri</h3>
                <p className="text-xs text-slate-200 mt-1">
                  Qoruq vadilərində təbii dağ balı və arı məhsulları istehsalı.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS (4 STEPS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Müsabiqə Prosesi Necə İşləyir?</h2>
          <p className="text-xs text-slate-500 mt-1">
            İnvestisiyadan reallaşmaya qədər 4 şəffaf rəqəmsal addım
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-2xl font-black text-emerald-800 font-mono-numbers">01</span>
              <h3 className="text-sm font-bold text-slate-900 mt-3">İmkanı Seçin</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Region, sahə ölçüsü və aqrar kateqoriya üzrə filtrasiya edərək uyğun torpaq sahəsi ilə tanış olun.
              </p>
            </div>
            <span className="text-[11px] text-slate-400 mt-4 block">Kataloq və Xəritə</span>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-2xl font-black text-emerald-800 font-mono-numbers">02</span>
              <h3 className="text-sm font-bold text-slate-900 mt-3">Qeydiyyatdan Keçin</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Şəxsi sahibkar kabineti açaraq hüquqi şəxs və ya fərdi sahibkar profilinizi təsdiq edin.
              </p>
            </div>
            <span className="text-[11px] text-slate-400 mt-4 block">Təhlükəsiz Şəxsi Kabinet</span>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-2xl font-black text-emerald-800 font-mono-numbers">03</span>
              <h3 className="text-sm font-bold text-slate-900 mt-3">Elektron Müraciət Edin</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Biznes planınızı və investisiya təklifinizi sistemə yükləyərək rəsmi müraciət nömrəsi əldə edin.
              </p>
            </div>
            <span className="text-[11px] text-slate-400 mt-4 block">AGRO-2026 Kodu</span>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-2xl font-black text-emerald-800 font-mono-numbers">04</span>
              <h3 className="text-sm font-bold text-slate-900 mt-3">Müraciəti İzləyin</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Ekspert rəylərini, əlavə sənəd sorğularını və yekun müsabiqə qərarını onlayn müşahidə edin.
              </p>
            </div>
            <span className="text-[11px] text-slate-400 mt-4 block">Real Vaxt İzləmə</span>
          </div>
        </div>
      </section>

      {/* 6. AGROMATCH PROMO BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 rounded-2xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="max-w-xl">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Ağıllı Uyğunluq Alqoritmi</span>
            <h3 className="text-2xl sm:text-3xl font-bold mt-2">
              Büdcənizə və profilinizə ən uyğun torpağı tapın
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100 mt-3 leading-relaxed">
              AgroMatch sual-cavab formasını 2 dəqiqə ərzində cavablandırın, investisiya həcminizə və təcrübənizə ən yüksək faizlə uyğun gələn torpaqları dərhal kəşf edin.
            </p>
          </div>

          <button
            onClick={() => navigate('/agromatch')}
            className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-sm rounded-xl shadow-md transition-colors whitespace-nowrap shrink-0"
          >
            AgroMatch Sorğusuna Başla
          </button>
        </div>
      </section>

      {/* 7. FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tez-tez Verilən Suallar</h2>
          <p className="text-xs text-slate-500 mt-1">İnvestisiya müsabiqələri üzrə əsas suallara aydın cavablar</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                className="w-full text-left p-4.5 flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-900 hover:text-emerald-800 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen === index ? 'rotate-180 text-emerald-800' : ''}`} />
              </button>
              {faqOpen === index && (
                <div className="px-4.5 pb-4.5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
