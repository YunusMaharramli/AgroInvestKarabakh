import React, { useState, useEffect, useMemo } from 'react';
import { AgriculturalLand, Competition } from '../types/index.js';
import { Search, Map as MapIcon, ArrowRight, ChevronDown, Heart, MessageCircle, Phone } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext.js';
import { PHOTOS, landImage, formatManat } from '../lib/landImages.js';
import { HELP_LINE } from '../components/Header.js';

interface HomePageProps {
  navigate: (route: string) => void;
}

const REGIONS = ['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl', 'Qubadlı', 'Xocavənd', 'Kəlbəcər', 'Laçın'];

const SECTORS: { type: string; title: string; text: string; img: string }[] = [
  { type: 'Əkinçilik', title: 'Əkinçilik', text: 'Buğda, arpa, qarğıdalı və toxumçuluq', img: PHOTOS.crops },
  { type: 'Bağçılıq', title: 'Bağçılıq', text: 'Nar, qoz, badam və üzüm bağları', img: PHOTOS.orchard },
  { type: 'İstixana təsərrüfatı', title: 'İstixana', text: 'Müasir hidroponik istixanalar', img: PHOTOS.greenhouse },
  { type: 'Heyvandarlıq', title: 'Heyvandarlıq', text: 'Dağ otlaqları və ferma kompleksləri', img: PHOTOS.livestock },
  { type: 'Arıçılıq', title: 'Arıçılıq', text: 'Dağ balı və arı ailələri', img: PHOTOS.bees },
];

const STEPS: { title: string; text: string }[] = [
  { title: 'Qeydiyyat', text: 'Portalda sahibkar və ya şirkət kimi qeydiyyatdan keçin.' },
  { title: 'Sahəni seçin', text: 'Siyahıdan və ya xəritədən sizə uyğun torpağı tapın.' },
  { title: 'Təklifinizi yazın', text: 'Sərmayə məbləğini və icra müddətini qeyd edin.' },
  { title: 'Sənədləri yükləyin', text: 'Biznes plan və bank zəmanətini PDF kimi əlavə edin.' },
  { title: 'Göndərin', text: 'Təsdiq edin və müraciət kodunuzu dərhal alın.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Müsabiqədə kimlər iştirak edə bilər?',
    a: 'Azərbaycan Respublikasında qeydiyyatdan keçmiş hüquqi şəxslər və fərdi sahibkarlar iştirak edə bilər. Hər müsabiqənin öz tələbləri (maliyyə zəmanəti, təcrübə və s.) müsabiqə səhifəsində açıq yazılır.',
  },
  {
    q: 'Müraciətimin vəziyyətini necə yoxlaya bilərəm?',
    a: 'Müraciəti göndərdikdən dərhal sonra sizə AGRO-2026-XXXX formatında müraciət nömrəsi verilir. Şəxsi kabinetinizdəki "Müraciətlərim" bölməsində hər mərhələni və ekspert qeydlərini görə bilərsiniz.',
  },
  {
    q: 'Torpaq ayrıldıqdan sonra dövlət dəstəyi varmı?',
    a: 'Bəli. Qarabağ və Şərqi Zəngəzurda fəaliyyət göstərən sahibkarlar üçün vergi və gömrük güzəştləri, texnika və damcılı suvarma subsidiyaları, güzəştli kreditlər nəzərdə tutulur.',
  },
  {
    q: '"Mənə uyğun sahə" necə işləyir?',
    a: 'Bir neçə suala cavab verirsiniz (rayon, büdcə, fəaliyyət növü, sahə ölçüsü). Sistem bunlara əsasən sizə ən yaxın torpaq sahələrini faizlə göstərir. Bu, köməkçi tövsiyədir və müsabiqədə qalibiyyətə zəmanət vermir.',
  },
];

const selectClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-base focus:border-brand-700';

export const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [searchRegion, setSearchRegion] = useState('all');
  const [searchSector, setSearchSector] = useState('all');
  const [searchMinArea, setSearchMinArea] = useState('');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    fetch('/api/lands')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setLands(data); })
      .catch(console.error);

    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCompetitions(data); })
      .catch(console.error);
  }, []);

  const countByType = useMemo(() => {
    const m: Record<string, number> = {};
    lands.forEach(l => { m[l.agricultureType] = (m[l.agricultureType] ?? 0) + 1; });
    return m;
  }, [lands]);

  const activeCompetitions = competitions.filter(c => c.status === 'ACTIVE').length;
  const totalInvestment = lands.reduce((sum, l) => sum + (l.estimatedInvestmentRequirement || 0), 0);
  const regionCount = new Set(lands.map(l => l.region)).size;
  const featured = lands.slice(0, 3);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchRegion !== 'all') params.set('region', searchRegion);
    if (searchSector !== 'all') params.set('sector', searchSector);
    if (searchMinArea) params.set('minArea', searchMinArea);
    navigate(`/opportunities?${params.toString()}`);
  };

  return (
    <div className="bg-cream">
      {/* 1. HERO */}
      <section aria-labelledby="hero-title" className="relative">
        <img
          src={PHOTOS.hero}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_60%]"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-36 sm:pt-24 sm:pb-44">
          <div className="max-w-2xl bg-[rgba(11,36,22,0.84)] rounded-3xl p-7 sm:p-11 text-white">
            <p className="font-display font-bold text-sm tracking-[0.14em] uppercase text-gold-400 mb-3">
              Qarabağ və Şərqi Zəngəzur
            </p>
            <h1 id="hero-title" className="font-display font-extrabold text-[2rem] sm:text-5xl leading-[1.12] tracking-tight">
              Qarabağın torpağına sərmayə yatırın
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[#EEF3EF]">
              Münbit torpaq sahələrini tapın, şərtləri asanlıqla müqayisə edin və müsabiqəyə bir yerdən, onlayn müraciət edin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/opportunities')}
                className="inline-flex items-center gap-3 min-h-14 px-7 rounded-2xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-extrabold text-base transition-colors"
              >
                Torpaq sahələrinə baxın
                <ArrowRight className="w-6 h-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="inline-flex items-center gap-3 min-h-14 px-6 rounded-2xl border-2 border-white text-white hover:bg-white/10 font-display font-bold text-base transition-colors"
              >
                <MapIcon className="w-6 h-6" aria-hidden="true" />
                Xəritədə axtarın
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SIMPLE SEARCH */}
      <section aria-labelledby="search-title" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24">
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white rounded-3xl shadow-[0_18px_50px_rgba(20,71,42,0.16)] p-6 sm:p-9"
        >
          <h2 id="search-title" className="font-display font-extrabold text-2xl text-brand-900 mb-5">
            Sizə uyğun torpaq sahəsini tapın
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="home-region" className="font-bold">1. Rayon</label>
              <select id="home-region" value={searchRegion} onChange={e => setSearchRegion(e.target.value)} className={selectClass}>
                <option value="all">Bütün rayonlar</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="home-sector" className="font-bold">2. Fəaliyyət növü</label>
              <select id="home-sector" value={searchSector} onChange={e => setSearchSector(e.target.value)} className={selectClass}>
                <option value="all">Bütün növlər</option>
                {SECTORS.map(s => <option key={s.type} value={s.type}>{s.title}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="home-area" className="font-bold">3. Sahənin ölçüsü</label>
              <select id="home-area" value={searchMinArea} onChange={e => setSearchMinArea(e.target.value)} className={selectClass}>
                <option value="">İstənilən ölçü</option>
                <option value="50">50 hektardan çox</option>
                <option value="100">100 hektardan çox</option>
                <option value="200">200 hektardan çox</option>
              </select>
            </div>
            <button
              type="submit"
              className="min-h-[3.25rem] rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-lg flex items-center justify-center gap-3 transition-colors"
            >
              <Search className="w-6 h-6" aria-hidden="true" />
              Axtar
            </button>
          </div>
        </form>
      </section>

      {/* 3. HOW IT WORKS */}
      <section aria-labelledby="steps-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <p className="font-display font-bold text-sm tracking-[0.14em] uppercase text-gold-800 mb-2">Sadə addımlar</p>
            <h2 id="steps-title" className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">
              Müraciət 5 addımdan ibarətdir
            </h2>
          </div>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-white border border-line rounded-2xl p-6 flex flex-col gap-3">
              <span aria-hidden="true" className="w-13 h-13 rounded-full bg-brand-900 text-gold-400 font-display font-extrabold text-xl flex items-center justify-center">
                {i + 1}
              </span>
              <h3 className="font-display font-bold text-lg text-brand-900">
                <span className="sr-only">Addım {i + 1}: </span>{s.title}
              </h3>
              <p className="text-[0.95rem] text-[#3E4F45]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. SECTORS */}
      <section aria-labelledby="sectors-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="font-display font-bold text-sm tracking-[0.14em] uppercase text-gold-800 mb-2">Fəaliyyət növləri</p>
        <h2 id="sectors-title" className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900 mb-9">
          Nə ilə məşğul olmaq istəyirsiniz?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {SECTORS.map(s => (
            <button
              key={s.type}
              type="button"
              onClick={() => navigate(`/opportunities?sector=${encodeURIComponent(s.type)}`)}
              className="group text-left bg-white rounded-2xl overflow-hidden border border-line hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col"
            >
              <img src={s.img} alt="" className="w-full h-44 object-cover" />
              <span className="p-5 flex flex-col gap-1.5 flex-1">
                <span className="font-display font-extrabold text-xl text-brand-900">{s.title}</span>
                <span className="text-[0.95rem] text-[#3E4F45]">{s.text}</span>
                <span className="mt-auto pt-2 font-bold text-brand-700 flex items-center gap-2">
                  {countByType[s.type] ?? 0} sahə
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 5. FEATURED LANDS */}
      <section aria-labelledby="lands-title" className="bg-sand mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-9">
            <div>
              <p className="font-display font-bold text-sm tracking-[0.14em] uppercase text-gold-800 mb-2">Aktiv müsabiqələr</p>
              <h2 id="lands-title" className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">
                Seçilmiş torpaq sahələri
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/opportunities')}
              className="inline-flex items-center min-h-14 px-6 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white transition-colors"
            >
              Bütün sahələr ({lands.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map(land => {
              const fav = isFavorite(land.id);
              return (
                <article key={land.id} className="bg-white rounded-3xl overflow-hidden flex flex-col">
                  <div className="relative">
                    <img src={landImage(land)} alt="" className="w-full h-56 object-cover" />
                    <button
                      type="button"
                      onClick={() => toggleFavorite(land.id)}
                      aria-pressed={fav}
                      className="absolute top-3 right-3 flex items-center gap-2 min-h-11 px-3 rounded-xl bg-white/95 text-sm font-bold text-ink shadow"
                    >
                      <Heart className={`w-5 h-5 ${fav ? 'fill-[#C0392B] text-[#C0392B]' : 'text-ink'}`} aria-hidden="true" />
                      {fav ? 'Yadda saxlanıb' : 'Yadda saxla'}
                    </button>
                  </div>
                  <div className="p-6 flex flex-col gap-4 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-brand-50 text-brand-900 font-bold text-sm px-3 py-1 rounded-full">{land.region}</span>
                      <span className="bg-gold-100 text-gold-900 font-bold text-sm px-3 py-1 rounded-full">{land.agricultureType}</span>
                    </div>
                    <h3 className="font-display font-extrabold text-xl leading-snug text-brand-900">{land.title}</h3>
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
                    <button
                      type="button"
                      onClick={() => navigate(`/opportunities/${land.id}`)}
                      className="mt-auto min-h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold text-base transition-colors"
                    >
                      Ətraflı baxın
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. NUMBERS (computed from live data) */}
      <section aria-label="Portal rəqəmlərlə" className="bg-brand-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
          {[
            { value: String(lands.length || '—'), label: 'dərc olunmuş torpaq sahəsi' },
            { value: String(activeCompetitions || '—'), label: 'aktiv investisiya müsabiqəsi' },
            { value: String(regionCount || '—'), label: 'Qarabağ rayonu əhatə olunur' },
            { value: totalInvestment ? `${(totalInvestment / 1_000_000).toFixed(1).replace('.', ',')} mln ₼` : '—', label: 'gözlənilən sərmayə həcmi' },
          ].map(s => (
            <div key={s.label} className="flex flex-col gap-1 pl-5 border-l-4 border-gold-500">
              <span className="font-display font-extrabold text-4xl leading-tight text-gold-400">{s.value}</span>
              <span className="text-base text-[#E3ECE5]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 7. MATCH PROMO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="bg-white border border-line rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <p className="font-display font-bold text-sm tracking-[0.14em] uppercase text-gold-800 mb-2">Mənə uyğun sahə</p>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-brand-900">
              Hansı torpağın sizə uyğun olduğunu bilmirsiniz?
            </h2>
            <p className="text-lg text-[#3E4F45] mt-3">
              Bir neçə sadə suala cavab verin: büdcəniz, rayon və fəaliyyət növü. Sizə ən uyğun sahələri dərhal göstərəcəyik.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/agromatch')}
            className="shrink-0 min-h-14 px-7 rounded-2xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-extrabold text-base transition-colors"
          >
            Suallara başlayın
          </button>
        </div>
      </section>

      {/* 8. FAQ */}
      <section aria-labelledby="faq-title" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <h2 id="faq-title" className="font-display font-extrabold text-3xl sm:text-4xl text-brand-900 mb-8">
          Tez-tez verilən suallar
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const open = faqOpen === index;
            return (
              <div key={faq.q} className="bg-white rounded-2xl border border-line overflow-hidden">
                <h3>
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={`faq-${index}`}
                    className="w-full text-left min-h-16 px-6 py-4 flex items-center justify-between gap-4 font-display font-bold text-lg text-brand-900 hover:bg-cream"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-7 h-7 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </h3>
                {open && (
                  <div id={`faq-${index}`} className="px-6 pb-6 text-[1.05rem] text-[#3E4F45] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. HELP */}
      <section aria-labelledby="help-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-line rounded-3xl p-8 sm:p-10 flex flex-col gap-4">
            <h2 id="help-title" className="font-display font-extrabold text-2xl sm:text-3xl text-brand-900">Sualınız var? Biz kömək edirik</h2>
            <p className="text-lg text-[#3E4F45]">
              AgroKöməkçi suallarınıza dərhal cavab verir: hansı sənədlər lazımdır, müraciət necə edilir, müraciətiniz hansı mərhələdədir.
            </p>
            <p className="flex items-center gap-3 font-bold text-brand-900 mt-2">
              <MessageCircle className="w-6 h-6" aria-hidden="true" />
              Ekranın sağ aşağı küncündəki düyməni basın.
            </p>
          </div>
          <div className="bg-gold-100 rounded-3xl p-8 sm:p-10 flex flex-col gap-3">
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-brand-900">Zəng etməyi üstün tutursunuz?</h2>
            <p className="text-lg text-[#3E3A2A]">Məsləhətçimiz sizə telefonla addım-addım kömək edəcək. Müraciəti birlikdə doldura bilərik.</p>
            <p className="flex items-center gap-3 font-display font-extrabold text-3xl text-brand-900 mt-2">
              <Phone className="w-8 h-8" aria-hidden="true" />
              {HELP_LINE}
            </p>
            <p className="text-base text-[#3E3A2A]">Bazar ertəsi – Cümə, 09:00–18:00</p>
          </div>
        </div>
      </section>
    </div>
  );
};
