import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APIProvider, Map, Marker, InfoWindow, MapMouseEvent } from '@vis.gl/react-google-maps';
import { MapPin, MousePointerClick } from 'lucide-react';
import { CATEGORY_GROUPS, CategoryGroup, categoryByKey, groupColor } from '../../data/categories';
import { useLocalePath } from '../../app/i18n';
import type { Land } from '../../types/agro';
import { useLandName } from '../../features/shared/landText';

/** Key comes from frontend/.env: GOOGLE_MAPS_API_KEY=... (never hard-coded). */
export const MAPS_KEY: string = (import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined) ?? '';

export const AZ_CENTER = { lat: 40.15, lng: 47.4 };

/** Soft green map style matching the AGROInvest palette. */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#eef1e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4b5a50' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#faf8f3' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9bfa5' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e3ecd9' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d3e3c4' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e9dfc9' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bcd5d0' }] },
];

export const markerIcon = (color: string, special = false): string =>
  'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 1C8.2 1 1 8 1 16.7 1 28.5 17 43 17 43s16-14.5 16-26.3C33 8 25.8 1 17 1z" fill="${color}" stroke="${special ? '#C9A54C' : '#ffffff'}" stroke-width="${special ? 3 : 2}"/><circle cx="17" cy="16.5" r="6" fill="#ffffff"/></svg>`,
  );

const NoKeyFallback: React.FC<{ lands: Land[]; onSelectHref: (l: Land) => string }> = ({ lands, onSelectHref }) => {
  const { t } = useTranslation();
  const name = useLandName();
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[#CFC8B6] bg-white p-6">
      <p className="font-display text-xl text-brand flex items-center gap-2"><MapPin className="w-5 h-5" aria-hidden="true" />{t('map.noKey')}</p>
      <p className="text-muted text-sm mt-1 mb-4">{t('map.noKeyText')}</p>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
        {lands.map(l => (
          <li key={l.id}>
            <Link to={onSelectHref(l)} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-sage text-sm">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: groupColor(l.fieldType) }} aria-hidden="true" />
              <span className="font-semibold truncate">{name(l)}</span>
              <span className="text-muted text-xs ml-auto">{l.lat.toFixed(2)}, {l.lng.toFixed(2)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 5.4 Investment map: colour-coded markers, legend, filter chips, info window, scroll zoom only after a click. */
export const LandsMap: React.FC<{ lands: Land[]; height?: string; detailHref?: (l: Land) => string; showFilters?: boolean }> = ({ lands, height = 'h-[520px]', detailHref, showFilters = true }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const name = useLandName();
  const [hidden, setHidden] = useState<CategoryGroup[]>([]);
  const [active, setActive] = useState<Land | null>(null);
  const [wheel, setWheel] = useState(false);
  const href = detailHref ?? ((l: Land) => lp(`/lands/${l.id}`));
  const visible = useMemo(() => lands.filter(l => !hidden.includes(categoryByKey(l.fieldType)?.group ?? 'crops')), [lands, hidden]);
  const presentGroups = CATEGORY_GROUPS.filter(g => lands.some(l => categoryByKey(l.fieldType)?.group === g.key));

  return (
    <div>
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label={t('map.legend')}>
          <span className="text-sm font-bold text-muted mr-1">{t('map.legend')}:</span>
          {presentGroups.map(g => {
            const on = !hidden.includes(g.key);
            return (
              <button key={g.key} type="button" aria-pressed={on} title={t('map.show', { group: t(`groups.${g.key}`) })}
                onClick={() => setHidden(h => on ? [...h, g.key] : h.filter(x => x !== g.key))}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? 'bg-white border-line text-ink' : 'bg-transparent border-dashed border-[#CFC8B6] text-muted line-through'}`}>
                <span className="w-3 h-3 rounded-full" style={{ background: g.color, opacity: on ? 1 : 0.35 }} aria-hidden="true" />{t(`groups.${g.key}`)}
              </button>
            );
          })}
        </div>
      )}
      {!MAPS_KEY ? <NoKeyFallback lands={visible} onSelectHref={href} /> : (
        <div className={`relative ${height} rounded-[1.5rem] overflow-hidden border border-line shadow-[var(--shadow-soft)]`} onClick={() => setWheel(true)}>
          <APIProvider apiKey={MAPS_KEY}>
            <Map defaultCenter={AZ_CENTER} defaultZoom={7} styles={MAP_STYLE} scrollwheel={wheel} gestureHandling={wheel ? 'greedy' : 'cooperative'}
              zoomControl streetViewControl={false} mapTypeControl={false} fullscreenControl={false} clickableIcons={false}>
              {visible.map(l => (
                <Marker key={l.id} position={{ lat: l.lat, lng: l.lng }} title={name(l)} onClick={() => setActive(l)}
                  icon={{ url: markerIcon(groupColor(l.fieldType), l.isSpecial), scaledSize: new google.maps.Size(30, 40) }} />
              ))}
              {active && (
                <InfoWindow position={{ lat: active.lat, lng: active.lng }} onCloseClick={() => setActive(null)} pixelOffset={[0, -38]}>
                  <div className="font-sans min-w-48 max-w-60">
                    <p className="font-bold text-brand text-sm">{name(active)}</p>
                    <p className="text-xs text-muted mt-1">{t(`fieldTypes.${active.fieldType}`)} · {t(`regions.${active.region}`)}</p>
                    <Link to={href(active)} className="inline-block mt-2 text-xs font-bold text-leaf-dark underline">{t('map.details')} →</Link>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
          {!wheel && (
            <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 text-white text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5" aria-hidden="true" />{t('map.clickToZoom')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/** Add Land: click the map to drop a pin. Without a key, latitude / longitude can be typed in. */
export const PinPicker: React.FC<{ value: { lat: number; lng: number } | null; onChange: (v: { lat: number; lng: number }) => void; center?: { lat: number; lng: number }; error?: string }> = ({ value, onChange, center, error }) => {
  const { t } = useTranslation();
  const [wheel, setWheel] = useState(false);
  if (!MAPS_KEY) {
    return (
      <div className="rounded-2xl border border-dashed border-[#CFC8B6] bg-white p-4">
        <p className="text-sm font-semibold text-brand">{t('map.noKey')}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="text-sm">Lat<input className="field mt-1" type="number" step="0.0001" value={value?.lat ?? ''} onChange={e => onChange({ lat: +e.target.value, lng: value?.lng ?? AZ_CENTER.lng })} /></label>
          <label className="text-sm">Lng<input className="field mt-1" type="number" step="0.0001" value={value?.lng ?? ''} onChange={e => onChange({ lat: value?.lat ?? AZ_CENTER.lat, lng: +e.target.value })} /></label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div>
      <p className="field-hint mb-2">{t('map.pinHint')}</p>
      <div className={`h-80 rounded-2xl overflow-hidden border ${error ? 'border-danger' : 'border-line'}`} onClick={() => setWheel(true)}>
        <APIProvider apiKey={MAPS_KEY}>
          <Map key={center ? `${center.lat},${center.lng}` : 'az'} defaultCenter={center ?? AZ_CENTER} defaultZoom={center ? 10 : 7} styles={MAP_STYLE}
            scrollwheel={wheel} streetViewControl={false} mapTypeControl={false} fullscreenControl={false} clickableIcons={false}
            onClick={(e: MapMouseEvent) => { const ll = e.detail.latLng; if (ll) onChange({ lat: +ll.lat.toFixed(5), lng: +ll.lng.toFixed(5) }); }}>
            {value && <Marker position={value} icon={markerIcon('#1F4D2E')} />}
          </Map>
        </APIProvider>
      </div>
      <p className="text-sm mt-2 font-semibold" aria-live="polite">{value ? t('map.pinned', { lat: value.lat, lng: value.lng }) : ''}</p>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
};

/** Single marker map for detail pages. */
export const SingleLandMap: React.FC<{ land: Land }> = ({ land }) => {
  const { t } = useTranslation();
  if (!MAPS_KEY) {
    return <div className="rounded-2xl bg-sage p-5 text-sm"><MapPin className="inline w-4 h-4 mr-1 text-brand" aria-hidden="true" />{t(`regions.${land.region}`)} · {land.lat}, {land.lng}<p className="text-muted text-xs mt-1">{t('map.noKey')}</p></div>;
  }
  return (
    <div className="h-72 rounded-2xl overflow-hidden border border-line">
      <APIProvider apiKey={MAPS_KEY}>
        <Map defaultCenter={{ lat: land.lat, lng: land.lng }} defaultZoom={11} styles={MAP_STYLE} gestureHandling="cooperative" streetViewControl={false} mapTypeControl={false}>
          <Marker position={{ lat: land.lat, lng: land.lng }} icon={markerIcon(groupColor(land.fieldType), land.isSpecial)} />
        </Map>
      </APIProvider>
    </div>
  );
};
