import React, { useState, useEffect, useRef } from 'react';
import { AgriculturalLand } from '../types/index.js';
import { MapPin, Filter, ArrowRight, Layers, Compass, Eye } from 'lucide-react';

interface InteractiveMapPageProps {
  navigate: (route: string) => void;
}

export const InteractiveMapPage: React.FC<InteractiveMapPageProps> = ({ navigate }) => {
  const [lands, setLands] = useState<AgriculturalLand[]>([]);
  const [selectedLand, setSelectedLand] = useState<AgriculturalLand | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedSector, setSelectedSector] = useState('all');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    fetch('/api/lands')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLands(data);
          if (data.length > 0) {
            setSelectedLand(data[0]);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || leafletMapRef.current) return;

      try {
        const L = (await import('leaflet')).default;

        // Centered around Karabakh coordinates (approx 39.75, 46.75)
        const map = L.map(mapContainerRef.current, {
          center: [39.75, 46.75],
          zoom: 9,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap əməkdaşları',
          maxZoom: 18,
        }).addTo(map);

        leafletMapRef.current = map;
        renderMarkers(L, map, lands);
      } catch (err) {
        console.error('Leaflet initialization failed:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update markers when filters or lands change
  useEffect(() => {
    if (!leafletMapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      renderMarkers(L, leafletMapRef.current, filteredLands);
    });
  }, [lands, selectedRegion, selectedSector]);

  const renderMarkers = (L: any, map: any, items: AgriculturalLand[]) => {
    // Clear existing
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    items.forEach(land => {
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color: #166534; color: #fde047; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); cursor: pointer;">
          ${land.region.slice(0, 2)}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([land.latitude, land.longitude], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        setSelectedLand(land);
        map.setView([land.latitude, land.longitude], 11, { animate: true });
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; min-width: 180px;">
          <strong style="color: #166534;">${land.title}</strong><br/>
          <span style="color: #64748b;">${land.region} · ${land.agricultureType}</span><br/>
          <strong>${land.areaHectares} ha</strong>
        </div>
      `);

      markersRef.current.push(marker);
    });
  };

  const filteredLands = lands.filter(l => {
    if (selectedRegion !== 'all' && l.region !== selectedRegion) return false;
    if (selectedSector !== 'all' && l.agricultureType !== selectedSector) return false;
    return true;
  });

  const handleSelectLand = (land: AgriculturalLand) => {
    setSelectedLand(land);
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([land.latitude, land.longitude], 12, { animate: true });
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-slate-100">
      {/* Sidebar with Filters and Lands list */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-lg">
        {/* Filter controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">İnteraktiv Aqro Xəritə</h2>
            <span className="text-xs text-slate-500 font-mono-numbers">{filteredLands.length} sahə</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Region</label>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-700"
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
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kateqoriya</label>
              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-700"
              >
                <option value="all">Bütün Sektorlar</option>
                <option value="Əkinçilik">Əkinçilik</option>
                <option value="Bağçılıq">Bağçılıq</option>
                <option value="İstixana təsərrüfatı">İstixana</option>
                <option value="Heyvandarlıq">Heyvandarlıq</option>
                <option value="Arıçılıq">Arıçılıq</option>
              </select>
            </div>
          </div>
        </div>

        {/* List of lands */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredLands.map(land => {
            const isSelected = selectedLand?.id === land.id;
            return (
              <div
                key={land.id}
                onClick={() => handleSelectLand(land)}
                className={`p-3.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-emerald-50 border-l-4 border-l-emerald-800' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold text-emerald-800">{land.region}</span>
                  <span className="font-mono-numbers">{land.areaHectares} ha</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{land.title}</h4>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{land.intendedUse}</p>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{land.agricultureType}</span>
                  <span className="font-bold text-slate-900 font-mono-numbers">
                    {land.estimatedInvestmentRequirement ? `${land.estimatedInvestmentRequirement.toLocaleString()} ₼` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Land Quick Summary Footer Card */}
        {selectedLand && (
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Seçilmiş Torpaq Sahəsi
                </span>
                <h3 className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-1">{selectedLand.title}</h3>
                <span className="text-[11px] text-slate-500 font-mono-numbers">{selectedLand.areaHectares} hektar · {selectedLand.region}</span>
              </div>
              <button
                onClick={() => navigate(`/opportunities/${selectedLand.id}`)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Ətraflı bax
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map View Area */}
      <div className="flex-1 relative h-full">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Legend Overlay */}
        <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-1.5 hidden sm:block">
          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">Xəritə Məlumatı</span>
          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
            <span className="w-3 h-3 rounded-full bg-emerald-800" />
            <span>Qarabağ torpaq massivləri</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
            Markerə klikləyərək sahəni seçin
          </div>
        </div>
      </div>
    </div>
  );
};
