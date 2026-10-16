import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APIProvider, Map, Marker, InfoWindow, MapMouseEvent, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';
import { Check, MapPin, MousePointerClick, PenLine, Trash2, Undo2 } from 'lucide-react';
import { CATEGORY_GROUPS, CategoryGroup, categoryByKey, groupColor } from '../../data/categories';
import { useFormat, useLocalePath } from '../../app/i18n';
import type { Land } from '../../types/agro';
import { useLandName } from '../../features/shared/landText';
import { isSimplePolygon, polygonContainedByRing, type BoundaryPath } from './polygonGeometry';

export type { BoundaryPath } from './polygonGeometry';

/** Key comes from a local frontend env file: never hard-coded or committed. */
export const MAPS_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)
  ?? (import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined)
  ?? '';

/** Google built-in selector supports road, satellite, hybrid, and terrain views. */
const MAP_TYPE_CONTROL_OPTIONS: google.maps.MapTypeControlOptions = {
  mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
  style: 2 as google.maps.MapTypeControlStyle,
};

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
const parcelZoom = (areaHa: number): number => areaHa >= 20 ? 15 : areaHa >= 5 ? 16 : 17;

/** Fit the overview to the available parcels, including locations outside Qarabağ. */
const FitLandBounds: React.FC<{ lands: Land[] }> = ({ lands }) => {
  const map = useMap();
  const loaded = useApiIsLoaded();
  useEffect(() => {
    if (!map || !loaded || lands.length === 0) return;
    if (lands.length === 1) {
      map.setCenter({ lat: lands[0].lat, lng: lands[0].lng });
      map.setZoom(parcelZoom(lands[0].areaHa));
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    lands.forEach(land => bounds.extend({ lat: land.lat, lng: land.lng }));
    map.fitBounds(bounds, 48);
  }, [map, loaded, lands]);
  return null;
};

/** Markers need the Google Maps script (google.maps.Size), so they render only after it has loaded. */
const LandMarkers: React.FC<{ lands: Land[]; title: (l: Land) => string; onSelect: (l: Land) => void; clickable?: boolean }> = ({ lands, title, onSelect, clickable = true }) => {
  const loaded = useApiIsLoaded();
  const map = useMap();
  if (!loaded) return null;
  const size = new google.maps.Size(30, 40);
  return <>{lands.map(l => (
    <Marker key={l.id} position={{ lat: l.lat, lng: l.lng }} title={title(l)} clickable={clickable} onClick={() => {
      map?.panTo({ lat: l.lat, lng: l.lng });
      map?.setZoom(parcelZoom(l.areaHa));
      onSelect(l);
    }}
      icon={{ url: markerIcon(groupColor(l.fieldType), l.isSpecial), scaledSize: size }} />
  ))}</>;
};

export const LandsMap: React.FC<{ lands: Land[]; height?: string; detailHref?: (l: Land) => string; showFilters?: boolean; allowAreaSelection?: boolean }> = ({ lands, height = 'h-[520px]', detailHref, showFilters = true, allowAreaSelection = false }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const name = useLandName();
  const f = useFormat();
  const [hidden, setHidden] = useState<CategoryGroup[]>([]);
  const [active, setActive] = useState<Land | null>(null);
  const [wheel, setWheel] = useState(false);
  const [drawingArea, setDrawingArea] = useState(false);
  const [selectionPath, setSelectionPath] = useState<BoundaryPath>([]);
  const [selectionResult, setSelectionResult] = useState<{ land: Land; areaHa: number; amount: number } | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const href = detailHref ?? ((l: Land) => lp(`/lands/${l.id}`));
  const visible = useMemo(() => lands.filter(l => !hidden.includes(categoryByKey(l.fieldType)?.group ?? 'crops')), [lands, hidden]);
  const presentGroups = CATEGORY_GROUPS.filter(g => lands.some(l => categoryByKey(l.fieldType)?.group === g.key));
  const onMapClick = (event: MapMouseEvent) => {
    if (!drawingArea || !event.detail.latLng) return;
    const { lat, lng } = event.detail.latLng;
    setSelectionPath(path => [...path, [+lng.toFixed(6), +lat.toFixed(6)]]);
    setSelectionError('');
  };
  const startAreaSelection = () => {
    setSelectionPath([]);
    setSelectionResult(null);
    setSelectionError('');
    setDrawingArea(true);
  };
  const finishAreaSelection = () => {
    if (selectionPath.length < 3) {
      setSelectionError('map.selectionNeedPoints');
      return;
    }
    if (!isSimplePolygon(selectionPath)) {
      setSelectionError('map.selectionOutsideParcel');
      return;
    }
    const areaHa = polygonAreaHa(selectionPath);
    const land = visible
      .filter(l => l.status === 'active' && l.areaHa > 0 && l.boundary?.coordinates?.[0])
      .filter(l => {
        const ring = l.boundary!.coordinates[0] as BoundaryPath;
        return areaHa <= l.areaHa * 1.005 && polygonContainedByRing(selectionPath, ring);
      })
      .sort((a, b) => a.areaHa - b.areaHa)[0];
    if (!land) {
      setSelectionError('map.selectionOutsideParcel');
      return;
    }
    const amount = (land.investmentMin / land.areaHa) * areaHa;
    setSelectionResult({ land, areaHa, amount });
    setDrawingArea(false);
    setSelectionError('');
  };

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
      {allowAreaSelection && MAPS_KEY && (
        <div className="mb-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {drawingArea ? (
              <>
                <span className="text-sm font-semibold text-brand flex-1 min-w-48">{t('map.selectAreaHint')}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={finishAreaSelection} disabled={selectionPath.length < 3}>
                  <Check className="w-4 h-4" aria-hidden="true" />{t('map.finishArea')}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectionPath(path => path.slice(0, -1))} disabled={!selectionPath.length}>
                  <Undo2 className="w-4 h-4" aria-hidden="true" />{t('map.undo')}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSelectionPath([]); setSelectionResult(null); setSelectionError(''); }} disabled={!selectionPath.length && !selectionResult}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />{t('map.clearSelection')}
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted flex-1 min-w-48">{t('map.selectAreaIntro')}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={startAreaSelection}>
                  <PenLine className="w-4 h-4" aria-hidden="true" />{t(selectionResult ? 'map.redrawArea' : 'map.drawArea')}
                </button>
              </>
            )}
          </div>
          {selectionPath.length > 0 && drawingArea && <p className="mt-2 text-xs text-muted">{t('map.boundary', { n: selectionPath.length, ha: polygonAreaHa(selectionPath).toFixed(2) })}</p>}
          {selectionError && <p className="field-error mt-2" role="alert">{t(selectionError)}</p>}
        </div>
      )}
      {!MAPS_KEY ? <NoKeyFallback lands={visible} onSelectHref={href} /> : (
        <div className={`relative ${height} rounded-[1.5rem] overflow-hidden border border-line shadow-[var(--shadow-soft)]`} onClick={() => setWheel(true)}>
          <APIProvider apiKey={MAPS_KEY}>
            <Map defaultCenter={AZ_CENTER} defaultZoom={7} styles={MAP_STYLE} scrollwheel={wheel} gestureHandling={wheel ? 'greedy' : 'cooperative'}
              zoomControl streetViewControl={false} mapTypeControl mapTypeControlOptions={MAP_TYPE_CONTROL_OPTIONS} fullscreenControl={false} clickableIcons={false}
              onClick={drawingArea ? onMapClick : undefined} draggableCursor={drawingArea ? 'crosshair' : undefined} disableDoubleClickZoom={drawingArea}>
              <FitLandBounds lands={visible} />
              {visible.filter(l => (l.status === 'active' || l.status === 'closed') && l.boundary?.coordinates?.[0]).map(l => {
                const color = groupColor(l.fieldType);
                return <BoundaryShape key={l.id} path={l.boundary!.coordinates[0] as BoundaryPath} showVertices={false} strokeColor={color} fillColor={color} fillOpacity={l.status === 'active' ? 0.2 : 0.1} />;
              })}
              {selectionPath.length > 0 && <BoundaryShape path={selectionPath} strokeColor="#D99A24" fillColor="#F2C14E" fillOpacity={0.28} />}
              <LandMarkers lands={visible} title={name} onSelect={setActive} clickable={!drawingArea} />
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
          {drawingArea && (
            <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 text-white text-xs font-semibold px-3 py-1.5">
              {t('map.selectAreaHint')}
            </span>
          )}
          {!wheel && !drawingArea && (
            <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 text-white text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5" aria-hidden="true" />{t('map.clickToZoom')}
            </span>
          )}
        </div>
      )}
      {allowAreaSelection && selectionResult && (
        <section className="mt-4 rounded-2xl border border-[#D9C99F] bg-[#FBF8EF] p-5" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('map.selectedLand')}</p>
              <h3 className="mt-1 font-display text-xl text-brand">{name(selectionResult.land)}</h3>
              <p className="text-sm text-muted mt-1">{t(`fieldTypes.${selectionResult.land.fieldType}`)} · {t(`regions.${selectionResult.land.region}`)}</p>
            </div>
            <Link to={href(selectionResult.land)} className="btn btn-primary btn-sm">{t('map.details')} →</Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-muted">{t('map.selectedArea')}</p><p className="font-bold text-brand mt-1">{t('land.ha', { n: f.num(selectionResult.areaHa, 2) })}</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-muted">{t('map.remainingArea')}</p><p className="font-bold text-brand mt-1">{t('land.ha', { n: f.num(Math.max(0, selectionResult.land.areaHa - selectionResult.areaHa), 2) })}</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-muted">{t('map.estimatedInvestment')}</p><p className="font-bold text-brand mt-1">{f.azn(selectionResult.amount)}</p></div>
          </div>
          <p className="text-xs text-muted mt-3">{t('map.investmentEstimateNote')}</p>
        </section>
      )}
    </div>
  );
};

/** Area of a lat/lng polygon on the sphere, in hectares. */
export function polygonAreaHa(path: BoundaryPath): number {
  if (path.length < 3) return 0;
  const R = 6378137, rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < path.length; i++) {
    const [lng1, lat1] = path[i];
    const [lng2, lat2] = path[(i + 1) % path.length];
    sum += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((sum * R * R) / 2) / 10000;
}

/** Centre of a boundary (average of its corners) — used as the pin when only a boundary is drawn. */
export function boundaryCentre(path: BoundaryPath): { lat: number; lng: number } {
  const lat = path.reduce((a, p) => a + p[1], 0) / path.length;
  const lng = path.reduce((a, p) => a + p[0], 0) / path.length;
  return { lat: +lat.toFixed(5), lng: +lng.toFixed(5) };
}

const VERTEX_ICON = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5" fill="#ffffff" stroke="#1F4D2E" stroke-width="2.5"/></svg>');

/** Draws the boundary polygon. Not clickable, so map clicks keep adding corners. */
const BoundaryShape: React.FC<{ path: BoundaryPath; showVertices?: boolean; strokeColor?: string; fillColor?: string; fillOpacity?: number }> = ({ path, showVertices = true, strokeColor = '#1F4D2E', fillColor = '#4C8C4A', fillOpacity = 0.22 }) => {
  const map = useMap();
  const loaded = useApiIsLoaded();
  const shape = useRef<google.maps.Polygon | null>(null);
  useEffect(() => {
    if (!map || !loaded) return;
    const p = new google.maps.Polygon({ map, clickable: false, strokeColor, strokeWeight: 2, fillColor, fillOpacity });
    shape.current = p;
    return () => { p.setMap(null); shape.current = null; };
  }, [map, loaded, strokeColor, fillColor, fillOpacity]);
  useEffect(() => { shape.current?.setPath(path.map(([lng, lat]) => ({ lat, lng }))); }, [path, map, loaded]);
  if (!loaded) return null;
  return showVertices ? <>{path.map(([lng, lat], i) => <Marker key={i} position={{ lat, lng }} clickable={false} icon={{ url: VERTEX_ICON, anchor: new google.maps.Point(7, 7) }} />)}</> : null;
};

interface PinPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
  error?: string;
  /** Optional boundary drawing: corners in [lng, lat] order. */
  boundary?: BoundaryPath;
  onBoundaryChange?: (path: BoundaryPath) => void;
  /** Called with the drawn area (ha) when the owner chooses to use it as the land area. */
  onUseArea?: (ha: number) => void;
}

/** Add Land: drop a pin or draw the land boundary on the map. Without a key, latitude / longitude can be typed in. */
export const PinPicker: React.FC<PinPickerProps> = ({ value, onChange, center, error, boundary = [], onBoundaryChange, onUseArea }) => {
  const { t } = useTranslation();
  const [wheel, setWheel] = useState(false);
  const [mode, setMode] = useState<'pin' | 'draw'>(boundary.length ? 'draw' : 'pin');
  const canDraw = !!onBoundaryChange;
  const areaHa = polygonAreaHa(boundary);

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

  const onMapClick = (e: MapMouseEvent) => {
    const ll = e.detail.latLng;
    if (!ll) return;
    const lat = +ll.lat.toFixed(6), lng = +ll.lng.toFixed(6);
    if (mode === 'draw' && onBoundaryChange) {
      const next: BoundaryPath = [...boundary, [lng, lat]];
      onBoundaryChange(next);
      // The pin follows the boundary until the owner places it by hand.
      if (next.length >= 3) onChange(boundaryCentre(next));
    } else {
      onChange({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) });
    }
  };

  const tab = (m: 'pin' | 'draw', icon: React.ReactNode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${mode === m ? 'bg-brand text-white shadow-sm' : 'text-ink hover:bg-white'}`}>
      {icon}{label}
    </button>
  );

  return (
    <div>
      {canDraw && (
        <div role="tablist" className="inline-flex gap-1 rounded-full border border-line bg-[#F3F1EA] p-1 mb-3">
          {tab('pin', <MapPin className="w-4 h-4" aria-hidden="true" />, t('map.modePin'))}
          {tab('draw', <PenLine className="w-4 h-4" aria-hidden="true" />, t('map.modeDraw'))}
        </div>
      )}
      <p className="field-hint mb-2">{mode === 'draw' ? t('map.drawHint') : t('map.pinHint')}</p>
      <div className={`h-80 rounded-2xl overflow-hidden border ${error ? 'border-danger' : 'border-line'} ${mode === 'draw' ? 'cursor-crosshair' : ''}`} onClick={() => setWheel(true)}>
        <APIProvider apiKey={MAPS_KEY}>
          <Map key={center ? `${center.lat},${center.lng}` : 'az'} defaultCenter={value ?? center ?? AZ_CENTER} defaultZoom={value ? 14 : center ? 10 : 7} mapTypeId="hybrid"
            scrollwheel={wheel} streetViewControl={false} mapTypeControl mapTypeControlOptions={MAP_TYPE_CONTROL_OPTIONS} fullscreenControl={false} clickableIcons={false}
            draggableCursor={mode === 'draw' ? 'crosshair' : undefined} disableDoubleClickZoom={mode === 'draw'} onClick={onMapClick}>
            {boundary.length > 0 && <BoundaryShape path={boundary} />}
            {value && <Marker position={value} icon={markerIcon('#1F4D2E')} clickable={false} />}
          </Map>
        </APIProvider>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
        {/* Note: i18next reserves "lng" for the language, so the longitude is passed as "lon". */}
        <p className="text-sm font-semibold" aria-live="polite">{value ? t('map.pinned', { lat: value.lat, lon: value.lng }) : ''}</p>
        {canDraw && boundary.length > 0 && (
          <>
            <p className="text-sm text-muted" aria-live="polite">{t('map.boundary', { n: boundary.length, ha: areaHa.toFixed(2) })}</p>
            <div className="flex flex-wrap gap-2 ml-auto">
              {onUseArea && boundary.length >= 3 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onUseArea(+areaHa.toFixed(2))}>{t('map.useArea')}</button>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onBoundaryChange!(boundary.slice(0, -1))}><Undo2 className="w-4 h-4" aria-hidden="true" />{t('map.undo')}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onBoundaryChange!([])}><Trash2 className="w-4 h-4" aria-hidden="true" />{t('map.clear')}</button>
            </div>
          </>
        )}
      </div>
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
        <Map defaultCenter={{ lat: land.lat, lng: land.lng }} defaultZoom={land.boundary?.coordinates?.[0] ? parcelZoom(land.areaHa) : 11} styles={MAP_STYLE} gestureHandling="cooperative" streetViewControl={false} mapTypeControl mapTypeControlOptions={MAP_TYPE_CONTROL_OPTIONS}>
          {(land.status === 'active' || land.status === 'closed') && land.boundary?.coordinates?.[0] && <BoundaryShape path={land.boundary.coordinates[0] as BoundaryPath} showVertices={false} strokeColor={groupColor(land.fieldType)} fillColor={groupColor(land.fieldType)} />}
          <Marker position={{ lat: land.lat, lng: land.lng }} icon={markerIcon(groupColor(land.fieldType), land.isSpecial)} />
        </Map>
      </APIProvider>
    </div>
  );
};
