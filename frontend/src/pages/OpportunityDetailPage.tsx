import React, { useState, useEffect } from 'react';
import { AgriculturalLand, Competition } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useFavorites } from '../context/FavoritesContext.js';
import { useComparison } from '../context/ComparisonContext.js';
import {
  MapPin, FileCheck, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Share2, Layers, Heart, Printer,
  Ruler, Sprout, Mountain, Droplets, Clock, Phone, Map as MapIcon, MessageCircle,
} from 'lucide-react';
import { landImage, formatManat, formatDateAz, PHOTOS } from '../lib/landImages.js';
import { HELP_LINE } from '../components/Header.js';

interface OpportunityDetailPageProps {
  id: string;
  navigate: (route: string) => void;
}

function daysLeft(deadline: string): number {
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const secondaryBtn =
  'min-h-[3.25rem] px-3 rounded-xl border-2 border-brand-900 bg-white text-brand-900 font-display font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors';

export const OpportunityDetailPage: React.FC<OpportunityDetailPageProps> = ({ id, navigate }) => {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToCompare, isInCompare, removeFromCompare } = useComparison();
  const [land, setLand] = useState<(AgriculturalLand & { activeCompetition?: Competition; competitions?: Competition[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/lands/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setLand(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16" aria-busy="true">
        <p className="sr-only">Yüklənir…</p>
        <div className="animate-pulse space-y-4 max-w-3xl">
          <div className="h-10 bg-line rounded-xl w-2/3" />
          <div className="h-96 bg-line rounded-3xl" />
          <div className="h-6 bg-line rounded-lg w-1/2" />
        </div>
      </div>
    );
  }

  if (!land) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display font-extrabold text-2xl text-brand-900">Torpaq sahəsi tapılmadı</h1>
        <p className="text-lg text-muted mt-3">Axtardığınız torpaq sahəsi mövcud deyil və ya arxivləşdirilib.</p>
        <button
          type="button"
          onClick={() => navigate('/opportunities')}
          className="mt-8 min-h-14 px-7 rounded-xl bg-brand-700 text-white font-display font-bold"
        >
          Bütün torpaq sahələrinə qayıt
        </button>
      </div>
    );
  }

  const activeComp = land.activeCompetition;
  const inComp = isInCompare(land.id);
  const fav = isFavorite(land.id);

  const facts: { label: string; value: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'Sahənin ölçüsü', value: `${land.areaHectares} hektar`, Icon: Ruler },
    { label: 'Yerləşdiyi yer', value: `${land.region} rayonu`, Icon: MapPin },
    { label: 'Nə üçün nəzərdə tutulub', value: land.intendedUse, Icon: Sprout },
    { label: 'Torpağın keyfiyyəti', value: land.soilQuality || 'Məlumat verilməyib', Icon: Mountain },
    { label: 'Su təminatı', value: land.waterSupply || 'Məlumat verilməyib', Icon: Droplets },
    { label: 'Koordinatlar', value: `${land.latitude.toFixed(4)}° N, ${land.longitude.toFixed(4)}° E`, Icon: MapIcon },
  ];

  const handleApply = () => {
    if (!activeComp) return;
    if (!user) navigate(`/login?next=${encodeURIComponent(`/applications/new/${activeComp.id}`)}`);
    else navigate(`/applications/new/${activeComp.id}`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: land.title, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 3000); }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-6">
        {/* Back + breadcrumb */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/opportunities')}
            className="inline-flex items-center gap-2 min-h-[3.25rem] px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
            Geri qayıt
          </button>
          <nav aria-label="Səhifə yolu" className="text-[0.95rem] text-muted">
            <button type="button" onClick={() => navigate('/')} className="underline underline-offset-4 text-brand-900">Ana səhifə</button>
            <span aria-hidden="true"> › </span>
            <button type="button" onClick={() => navigate('/opportunities')} className="underline underline-offset-4 text-brand-900">Torpaq sahələri</button>
            <span aria-hidden="true"> › </span>
            <span aria-current="page">{land.title}</span>
          </nav>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-brand-50 text-brand-900 font-bold text-sm px-4 py-1.5 rounded-full">{land.region} rayonu</span>
          <span className="bg-gold-100 text-gold-900 font-bold text-sm px-4 py-1.5 rounded-full">{land.agricultureType}</span>
          {activeComp && (
            <span className="bg-brand-700 text-white font-bold text-sm px-4 py-1.5 rounded-full">Müraciət qəbul edilir</span>
          )}
        </div>
        <h1 className="font-display font-extrabold text-3xl sm:text-[2.6rem] leading-[1.15] text-brand-900 max-w-4xl">
          {land.title}
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT */}
        <div className="lg:col-span-2 flex flex-col gap-8 min-w-0">
          <div className="grid grid-cols-3 gap-3">
            <img
              src={landImage(land)}
              alt={`${land.title} — ${land.agricultureType.toLowerCase()} sahəsi`}
              className="col-span-3 w-full h-72 sm:h-[26rem] object-cover rounded-3xl"
            />
            <img src={PHOTOS.hero} alt="" className="w-full h-28 sm:h-32 object-cover rounded-2xl" />
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="relative h-28 sm:h-32 rounded-2xl bg-[#E6EEDF] bg-[linear-gradient(#D4E1CC_1px,transparent_1px),linear-gradient(90deg,#D4E1CC_1px,transparent_1px)] bg-[size:40px_40px] flex items-center justify-center hover:ring-4 hover:ring-brand-100"
            >
              <MapPin className="w-10 h-10 text-[#C0392B]" aria-hidden="true" />
              <span className="absolute bottom-2 left-3 text-sm font-bold text-brand-900">Xəritədə bax</span>
            </button>
            <div className="h-28 sm:h-32 rounded-2xl bg-white border-2 border-dashed border-[#9AA89E] flex items-center justify-center text-center px-2 text-sm font-bold text-muted">
              Sahənin real şəkilləri tezliklə
            </div>
          </div>

          <section aria-labelledby="facts-title" className="bg-white border border-line rounded-3xl p-6 sm:p-8">
            <h2 id="facts-title" className="font-display font-extrabold text-2xl text-brand-900 mb-4">Əsas məlumatlar</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {facts.map(({ label, value, Icon }) => (
                <div key={label} className="flex gap-4 items-start py-4 border-b border-[#EFE8D6]">
                  <span aria-hidden="true" className="shrink-0 w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-brand-700" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[0.92rem] text-muted">{label}</dt>
                    <dd className="font-bold text-[1.05rem] leading-snug mt-0.5">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="about-title" className="flex flex-col gap-3">
            <h2 id="about-title" className="font-display font-extrabold text-2xl text-brand-900">Sahə haqqında</h2>
            <p className="text-[1.1rem] leading-relaxed max-w-3xl">{land.description}</p>
          </section>

          {activeComp && activeComp.eligibilityConditions?.length > 0 && (
            <section aria-labelledby="cond-title" className="flex flex-col gap-4">
              <h2 id="cond-title" className="font-display font-extrabold text-2xl text-brand-900">Kimlər müraciət edə bilər?</h2>
              <ul className="flex flex-col gap-3">
                {activeComp.eligibilityConditions.map((c, i) => (
                  <li key={i} className="flex gap-3 items-start bg-white border border-line rounded-2xl p-4">
                    <CheckCircle className="w-6 h-6 text-brand-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-[1.02rem]">{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="fit-title" className="bg-brand-900 text-white rounded-3xl p-7 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="max-w-xl">
              <h2 id="fit-title" className="font-display font-extrabold text-xl sm:text-2xl">Bu sahə sizə uyğundurmu?</h2>
              <p className="text-[#E3ECE5] mt-1">Bir neçə sadə suala cavab verin, uyğunluq faizini dərhal görün.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/agromatch')}
              className="shrink-0 min-h-14 px-6 rounded-2xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-extrabold"
            >
              Uyğunluğu yoxlayın
            </button>
          </section>
        </div>

        {/* RIGHT: action panel */}
        <aside aria-labelledby="apply-title" className="lg:sticky lg:top-28 bg-white border border-line rounded-3xl p-6 sm:p-7 flex flex-col gap-5 shadow-[0_18px_50px_rgba(20,71,42,0.10)]">
          <div>
            <p className="text-[0.95rem] text-muted">Minimal sərmayə</p>
            <p className="font-display font-extrabold text-4xl leading-tight text-brand-900">
              {formatManat(land.estimatedInvestmentRequirement)}
            </p>
          </div>

          {activeComp ? (
            <>
              <div className="bg-gold-100 rounded-2xl p-4 flex gap-3 items-start">
                <Clock className="w-6 h-6 text-gold-900 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p id="apply-title" className="font-bold text-[#3E3A2A]">Müraciət üçün son tarix</p>
                  <p className="text-[#3E3A2A]">
                    {formatDateAz(activeComp.applicationDeadline)}
                    {' · '}<strong>{daysLeft(activeComp.applicationDeadline)} gün qalıb</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApply}
                className="min-h-16 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-display font-extrabold text-xl flex items-center justify-center gap-3 transition-colors"
              >
                Müraciət edin
                <ArrowRight className="w-6 h-6" aria-hidden="true" />
              </button>
              <p className="-mt-2 text-sm text-muted text-center">
                {user ? 'Təxminən 15 dəqiqə çəkir.' : 'Müraciət üçün əvvəlcə kabinetə daxil olmalısınız.'}
              </p>
            </>
          ) : (
            <div className="bg-gold-100 rounded-2xl p-5 flex gap-3 items-start">
              <AlertCircle className="w-6 h-6 text-gold-900 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p id="apply-title" className="font-bold text-[#3E3A2A]">Hazırda aktiv müsabiqə yoxdur</p>
                <p className="text-[#3E3A2A] text-[0.95rem] mt-1">
                  Yeni müsabiqə elan edildikdə müraciət qəbulu açılacaq. Sahəni yadda saxlayın ki, unutmayasınız.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => toggleFavorite(land.id)} aria-pressed={fav} className={secondaryBtn}>
              <Heart className={`w-5 h-5 ${fav ? 'fill-[#C0392B] text-[#C0392B]' : ''}`} aria-hidden="true" />
              {fav ? 'Saxlanıb' : 'Yadda saxla'}
            </button>
            <button
              type="button"
              onClick={() => (inComp ? removeFromCompare(land.id) : addToCompare(land))}
              aria-pressed={inComp}
              className={secondaryBtn}
            >
              <Layers className="w-5 h-5" aria-hidden="true" />
              {inComp ? 'Çıxar' : 'Müqayisə et'}
            </button>
            <button type="button" onClick={() => window.print()} className={secondaryBtn}>
              <Printer className="w-5 h-5" aria-hidden="true" />
              Çap et
            </button>
            <button type="button" onClick={handleShare} className={secondaryBtn}>
              <Share2 className="w-5 h-5" aria-hidden="true" />
              {shared ? 'Kopyalandı' : 'Paylaş'}
            </button>
          </div>

          <div className="border-t border-[#EFE8D6] pt-5 flex flex-col gap-1.5">
            <p className="font-bold">Sualınız var?</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('agro:ask', { detail: `“${land.title}” sahəsi haqqında qısa məlumat verin: kimə uyğundur və necə müraciət edim?` }))}
              className="my-2 min-h-14 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              Bu sahə haqqında köməkçidən soruşun
            </button>
            <p className="text-[0.95rem] text-[#3E4F45]">Və ya məsləhətçiyə zəng edin:</p>
            <p className="flex items-center gap-2 font-display font-extrabold text-xl text-brand-900">
              <Phone className="w-6 h-6 text-brand-700" aria-hidden="true" />
              {HELP_LINE}
            </p>
          </div>
        </aside>
      </div>

      {activeComp && activeComp.requiredDocuments?.length > 0 && (
        <section aria-labelledby="docs-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <h2 id="docs-title" className="font-display font-extrabold text-2xl sm:text-3xl text-brand-900 mb-5">
            Müraciət üçün lazım olan sənədlər
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeComp.requiredDocuments.map((doc, i) => (
              <li key={i} className="bg-white border border-line rounded-2xl p-5 flex gap-3 items-start">
                <FileCheck className="w-7 h-7 text-brand-700 shrink-0" aria-hidden="true" />
                <span className="font-semibold text-[1.02rem]">{doc}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
