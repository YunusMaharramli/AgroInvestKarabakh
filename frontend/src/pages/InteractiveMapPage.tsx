import React, { useState, useEffect, useRef } from 'react';
import { AgriculturalLand } from '../types/index.js';
import { ArrowRight, List, MapPin, RotateCcw } from 'lucide-react';
import { landImage, formatManat } from '../lib/landImages.js';

interface InteractiveMapPageProps {
  navigate: (route: string) => void;
}

const REGIONS = ['Ağdam', 'Füzuli', 'Zəngilan', 'Cəbrayıl', 'Qubadlı', 'Xocavənd', 'Kəlbəcər', 'Laçın'];

/** One clear colour per farming type, explained in the legend. */
const TYPES: { value: string; label: string; color: string }[] = [
  { value: 'Əkinçilik', label: 'Əkinçilik', color: '#B7791F' },
  { value: 'Bağçılıq', label: 'Bağçılıq', color: '#1F6B3C' },
  { value: 'İstixana təsərrüfatı', label: 'İstixana', color: '#2B6CB0' },
  { value: 'Heyvandarlıq', label: 'Heyvandarlıq', color: '#8E2A1F' },
  { value: 'Arıçılıq', label: 'Arıçılıq', color: '#6B46C1' },
];
const colorFor = (type: string) => TYPES.find(t => t.value === type)?.color ?? '#14472A';

const fieldClass =
  'w-full min-h-[3.25rem] px-4 rounded-xl border-2 border-[#9AA89E] bg-white text-ink text-base focus:border-brand-700';

const KARABAKH_CENTER: [number, number] = [39.75, 46.75];

export const InteractiveMapPage: React.FC<InteractiveMapPageProps> = ({ navigate }) => {
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedLand, setSelectedLand] = useState<AgriculturalLand | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedSector, setSelectedSector] = useState('all');
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/lands')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setLands(data); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapContainerRef.current || mapRef.current) return;
      try {
        const L = (await import('leaflet')).default;
        if (cancelled || !mapContainerRef.current) return;
        const map = L.map(mapContainerRef.current, { center: KARABAKH_CENTER, zoom: 9, scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 18,
        }).addTo(map);
        leafletRef.current = L;
        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error('Leaflet initialization failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const filteredLands = lands.filter(l => {
    if (selectedRegion !== 'all' && l.region !== selectedRegion) return false;
    if (selectedSector !== 'all' && l.agricultureType !== selectedSector) return false;
    return true;
  });

  // Draw the pins whenever the map, data, filters or selection change
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    filteredLands.forEach(land => {
      const selected = selectedLand?.id === land.id;
      const size = selected ? 48 : 36;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colorFor(land.agricultureType)};border:${selected ? 5 : 3}px solid ${selected ? '#E2A62B' : '#fff'};box-shadow:0 4px 10px rgba(0,0,0,.35);"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });
      const marker = L.marker([land.latitude, land.longitude], {
        icon,
        title: land.title,
        alt: land.title,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
      }).addTo(map);
      marker.on('click', () => selectLand(land, false));
      markersRef.current.push(marker);
    });

    // Fit the visible pins when the filter changes (not when a pin is picked)
  }, [mapReady, lands, selectedRegion, selectedSector, selectedLand]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || filteredLands.length === 0) return;
    const L = leafletRef.current;
    const bounds = L.latLngBounds(filteredLands.map(l => [l.latitude, l.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    // If the selected plot is hidden by the filter, clear it
    if (selectedLand && !filteredLands.some(l => l.id === selectedLand.id)) setSelectedLand(null);
  }, [mapReady, lands, selectedRegion, selectedSector]);

  const selectLand = (land: AgriculturalLand, fromList: boolean) => {
    setSelectedLand(land);
    mapRef.current?.setView([land.latitude, land.longitude], 11, { animate: true });
    if (fromList) {
      mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // On phones the card sits under the map; bring it into view
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  };

  const resetFilters = () => {
    setSelectedRegion('all');
    setSelectedSector('all');
    setSelectedLand(null);
  };

  const filtersActive = selectedRegion !== 'all' || selectedSector !== 'all';

  return (
    <div className="bg-cream pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav aria-label="Səhifə yolu" className="text-[0.95rem] text-muted mb-3">
          <button type="button" onClick={() => navigate('/')} className="underline underline-offset-4 text-brand-900">Ana səhifə</button>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">Xəritə</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="max-w-3xl">
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-brand-900">Sahələr xəritədə</h1>
            <p className="text-lg text-[#3E4F45] mt-2">
              Xəritədəki nişana basın — sahə haqqında qısa məlumat aşağıda görünəcək.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/opportunities')}
            className="inline-flex items-center gap-2 min-h-14 px-5 rounded-xl border-2 border-brand-900 text-brand-900 font-display font-bold hover:bg-white"
          >
            <List className="w-6 h-6" aria-hidden="true" />
            Siyahı şəklində bax
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl border border-line p-5 sm:p-6 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-5 items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="m-region" className="font-bold">Rayon</label>
              <select id="m-region" value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className={fieldClass}>
                <option value="all">Bütün rayonlar</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="m-type" className="font-bold">Fəaliyyət növü</label>
              <select id="m-type" value={selectedSector} onChange={e => setSelectedSector(e.target.value)} className={fieldClass}>
                <option value="all">Bütün növlər</option>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[3.25rem] px-5 rounded-xl border-2 border-line text-brand-900 font-display font-bold flex items-center justify-center gap-2 hover:border-brand-900"
              >
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
                Hamısını göstər
              </button>
            )}
          </div>
          <p className="text-lg mt-4" role="status" aria-live="polite">
            {loading ? 'Yüklənir…' : <>Xəritədə <strong className="font-extrabold text-brand-900">{filteredLands.length}</strong> sahə göstərilir</>}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_24rem] gap-5 items-start">
          {/* Map + legend + selected card */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-3xl overflow-hidden border border-line bg-sand">
              <div
                ref={mapContainerRef}
                className="w-full h-[60vh] min-h-[22rem] z-0"
                role="region"
                aria-label="Torpaq sahələrinin xəritəsi"
              />
              {loadError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center text-lg">
                  Sahələri yükləmək alınmadı. Səhifəni yeniləyin.
                </div>
              )}
            </div>

            {/* Legend: colours explained in words */}
            <div className="bg-white rounded-2xl border border-line p-4">
              <p className="font-bold mb-2">Nişanların rəngi nə deməkdir?</p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {TYPES.map(t => (
                  <li key={t.value} className="flex items-center gap-2 text-base">
                    <span className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ background: t.color }} aria-hidden="true" />
                    {t.label}
                  </li>
                ))}
              </ul>
              <p className="text-[0.95rem] text-muted mt-2">Xəritəni böyütmək üçün sağ yuxarıdakı “+” və “−” düymələrindən istifadə edin.</p>
            </div>

            <div ref={cardRef} aria-live="polite">
              {selectedLand ? (
                <div className="bg-white rounded-3xl border-2 border-gold-500 overflow-hidden grid sm:grid-cols-[14rem_1fr]">
                  <img src={landImage(selectedLand)} alt="" className="w-full h-44 sm:h-full object-cover" />
                  <div className="p-5 sm:p-6 flex flex-col gap-3">
                    <p className="text-sm font-bold text-gold-900 uppercase tracking-wide">Seçdiyiniz sahə</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-brand-50 text-brand-900 font-bold text-sm px-3 py-1 rounded-full">{selectedLand.region}</span>
                      <span className="bg-gold-100 text-gold-900 font-bold text-sm px-3 py-1 rounded-full">{selectedLand.agricultureType}</span>
                    </div>
                    <h2 className="font-display font-extrabold text-xl leading-snug text-brand-900">{selectedLand.title}</h2>
                    <dl className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-sm text-muted">Sahə</dt>
                        <dd className="font-extrabold text-xl">{selectedLand.areaHectares} ha</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted">Minimal sərmayə</dt>
                        <dd className="font-extrabold text-xl">{formatManat(selectedLand.estimatedInvestmentRequirement)}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => navigate(`/opportunities/${selectedLand.id}`)}
                      className="mt-1 min-h-14 px-6 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-display font-bold flex items-center justify-center gap-2 sm:self-start"
                    >
                      Ətraflı baxın
                      <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border-2 border-dashed border-line p-6 text-center text-lg text-muted flex items-center justify-center gap-2">
                  <MapPin className="w-6 h-6" aria-hidden="true" />
                  Sahə seçilməyib. Xəritədə nişana və ya siyahıda sahəyə basın.
                </div>
              )}
            </div>
          </div>

          {/* List: the same plots as buttons (works without the map) */}
          <section aria-labelledby="map-list-title" className="bg-white rounded-3xl border border-line overflow-hidden">
            <h2 id="map-list-title" className="font-display font-extrabold text-xl text-brand-900 px-5 pt-5 pb-3">Sahələrin siyahısı</h2>
            <ul className="lg:max-h-[calc(60vh+10rem)] lg:overflow-y-auto divide-y divide-line">
              {filteredLands.map(land => {
                const isSelected = selectedLand?.id === land.id;
                return (
                  <li key={land.id}>
                    <button
                      type="button"
                      onClick={() => selectLand(land, true)}
                      aria-pressed={isSelected}
                      className={`w-full text-left px-5 py-4 flex gap-3 items-start ${isSelected ? 'bg-gold-100' : 'hover:bg-cream'}`}
                    >
                      <span
                        className="mt-1.5 w-4 h-4 rounded-full shrink-0 border-2 border-white shadow"
                        style={{ background: colorFor(land.agricultureType) }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-lg leading-snug text-ink">{land.title}</span>
                        <span className="block text-base text-[#3E4F45]">
                          {land.region} · {land.areaHectares} ha · {formatManat(land.estimatedInvestmentRequirement)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!loading && filteredLands.length === 0 && (
                <li className="px-5 py-6 text-lg text-muted">Bu seçimlərə uyğun sahə yoxdur.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
