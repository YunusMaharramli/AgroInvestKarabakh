import React, { useState, useEffect } from 'react';
import { AgriculturalLand, Competition } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useFavorites } from '../context/FavoritesContext.js';
import { MapPin, Calendar, FileText, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Share2, Layers } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext.js';

interface OpportunityDetailPageProps {
  id: string;
  navigate: (route: string) => void;
}

export const OpportunityDetailPage: React.FC<OpportunityDetailPageProps> = ({ id, navigate }) => {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToCompare, isInCompare, removeFromCompare } = useComparison();
  const [land, setLand] = useState<(AgriculturalLand & { activeCompetition?: Competition; competitions?: Competition[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/lands/${id}`)
      .then(res => res.json())
      .then(data => {
        setLand(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse space-y-4 max-w-xl mx-auto">
          <div className="h-64 bg-slate-200 rounded-2xl" />
          <div className="h-8 bg-slate-200 rounded-md w-3/4 mx-auto" />
          <div className="h-4 bg-slate-200 rounded-md w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!land) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-slate-900">Torpaq sahəsi tapılmadı</h2>
        <p className="text-xs text-slate-500 mt-2">Axtardığınız torpaq sahəsi mövcud deyil və ya arxivləşdirilib.</p>
        <button
          onClick={() => navigate('/opportunities')}
          className="mt-6 px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-semibold"
        >
          Kataloqa qayıt
        </button>
      </div>
    );
  }

  const activeComp = land.activeCompetition;
  const inComp = isInCompare(land.id);

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation back bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/opportunities')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kataloqa qayıt</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(land.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-rose-600 shadow-2xs"
            >
              <span className={isFavorite(land.id) ? 'text-rose-600' : 'text-slate-400'}>♥</span>
              <span>{isFavorite(land.id) ? 'Seçilmişlərdən sil' : 'Seçilmişlərə əlavə et'}</span>
            </button>

            <button
              onClick={() => {
                if (inComp) removeFromCompare(land.id);
                else addToCompare(land);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-amber-700 shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{inComp ? 'Müqayisədən çıxar' : 'Müqayisə et'}</span>
            </button>
          </div>
        </div>

        {/* Hero split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Image and Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="relative h-80 sm:h-96 bg-slate-100">
                <img
                  src={land.imageUrl}
                  alt={land.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-6">
                {/* Zero-Pill Typography Metadata */}
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-2">
                  <span className="text-emerald-800 font-bold text-sm">{land.region}</span>
                  <span aria-hidden="true">·</span>
                  <span>{land.agricultureType}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-numbers">{land.areaHectares} hektar</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-medium">Status: {land.status === 'PUBLISHED' ? 'Dərc edilib' : 'Qaralama'}</span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {land.title}
                </h1>

                <p className="mt-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {land.description}
                </p>

                {/* Key Specifications Grid */}
                <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      İstifadə Təyinatı
                    </span>
                    <p className="font-semibold text-slate-900">{land.intendedUse}</p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Torpaq Qatı və Münbitlik
                    </span>
                    <p className="font-semibold text-slate-900">{land.soilQuality || 'Münbit şabalıdı qat'}</p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Suvarma və Su Təchizatı
                    </span>
                    <p className="font-semibold text-slate-900">{land.waterSupply || 'Mərkəzi suvarma kanalı'}</p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Coğrafi Koordinatlar
                    </span>
                    <p className="font-semibold text-slate-900 font-mono-numbers">
                      {land.latitude.toFixed(4)}° N, {land.longitude.toFixed(4)}° E
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Location Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Məkan və Coğrafi Mövqe</h3>
                <button
                  onClick={() => navigate('/map')}
                  className="text-xs text-emerald-800 font-semibold hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Xəritədə geniş bax</span>
                </button>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/60 text-xs text-emerald-950 flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{land.region} rayonu, kənd təsərrüfatı təyinatlı torpaq fondu</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Ərazi logistika magistralına və bərpa olunan elektrik qovşağına yaxın məsafədədir.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Competition & Apply Widget */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs sticky top-20">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <Calendar className="w-4 h-4 text-emerald-800" />
                <span>İnvestisiya Müsabiqəsi</span>
              </div>

              {activeComp ? (
                <>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeComp.title}
                  </h2>

                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Müsabiqə statusu:</span>
                      <span className="font-semibold text-emerald-700">Aktiv (Müraciət açıqdır)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Son müraciət tarixi:</span>
                      <span className="font-bold text-slate-900 font-mono-numbers">
                        {new Date(activeComp.applicationDeadline).toLocaleDateString('az-AZ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Minimal investisiya:</span>
                      <span className="font-extrabold text-emerald-900 font-mono-numbers">
                        {land.estimatedInvestmentRequirement.toLocaleString()} ₼
                      </span>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="mt-6">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Müsabiqədə İştirak Şərtləri
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-600">
                      {activeComp.eligibilityConditions.map((cond, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{cond}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Required Documents */}
                  <div className="mt-6">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Tələb Olunan Sənədlər
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {activeComp.requiredDocuments.map((doc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Primary Apply Action */}
                  <div className="mt-8 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => {
                        if (!user) {
                          navigate('/login');
                        } else {
                          navigate(`/applications/new/${activeComp.id}`);
                        }
                      }}
                      className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Elektron Müraciət Et</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    {!user && (
                      <p className="text-[11px] text-slate-400 text-center mt-2">
                        Müraciət etmək üçün sistemə daxil olmaq və ya qeydiyyat tələb olunur.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-6 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-900">Hazırda aktiv müsabiqə yoxdur</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Bu torpaq sahəsi üzrə hazırda açıq investisiya müsabiqəsi keçirilmir. Növbəti müsabiqə elan edildikdə müraciət qəbulu bərpa olunacaqdır.
                  </p>
                  <button
                    disabled
                    className="mt-6 w-full py-3 px-4 bg-slate-200 text-slate-400 font-semibold text-xs rounded-xl cursor-not-allowed"
                  >
                    Müraciət Qapalıdır
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
