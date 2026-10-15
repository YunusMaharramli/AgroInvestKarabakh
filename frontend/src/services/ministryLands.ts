import { backend } from './backend';
import { mutate } from './db';
import { REGIONS } from '../data/regions';
import i18n from 'i18next';
import type { Irrigation, Land } from '../types/agro';

/** Public land as the backend returns it (GET /api/lands: only approved land). */
export interface BackendLand {
  id: string; title: string; region: string; description: string; areaHectares: number; agricultureType: string;
  latitude: number; longitude: number; intendedUse: string; estimatedInvestmentRequirement: number; imageUrl: string;
  ownerId: string | null; status: string; hasActiveOpportunity: boolean; createdAt: string;
  district: string | null; settlement: string | null; verification: 'ADMIN_ENTERED' | 'EVIDENCE_PENDING' | 'VERIFIED'; waterAccess: string | null;
  landUse: string; core: { boundary: unknown | null; roadAccessType: string | null }; photos: { id: string; url: string }[];
}

function regionKey(region: string): string {
  if (REGIONS.some(r => r.key === region)) return region;
  const lower = region.trim().toLocaleLowerCase('az');
  for (const lng of ['az', 'en', 'ru']) {
    const t = i18n.getFixedT(lng);
    const hit = REGIONS.find(r => t(`regions.${r.key}`).toLocaleLowerCase('az') === lower);
    if (hit) return hit.key;
  }
  return region;
}

const irrigationFrom = (water: string | null): Irrigation =>
  water === 'well' || water === 'canal' || water === 'drip' ? water : 'unknown';

export function toLand(b: BackendLand): Land {
  const amount = Number(b.estimatedInvestmentRequirement) || 0;
  return {
    id: b.id,
    ownerId: b.ownerId ?? 'ministry',
    title: b.title,
    fieldType: b.landUse || b.agricultureType,
    description: [b.description, b.intendedUse].filter(Boolean).join('\n\n'),
    region: regionKey(b.region),
    address: [b.settlement, b.district].filter(Boolean).join(', '),
    lat: b.latitude, lng: b.longitude, areaHa: b.areaHectares,
    // Legacy card requires numeric fields; source-backed cards never display or score these unknown values.
    soilType: 'unknown', fertilityPct: 0, irrigation: irrigationFrom(b.waterAccess), lastCrop: '',
    roadAccess: !!b.core?.roadAccessType && b.core.roadAccessType !== 'none', electricity: false, ownershipDoc: '',
    investmentMin: amount, investmentMax: amount, investmentModel: 'lease', expectedReturnPct: 0, durationMonths: 0,
    isSpecial: false,
    photos: b.photos?.length ? b.photos.map(p => p.url) : b.imageUrl ? [b.imageUrl] : [],
    documents: [], status: 'active', raisedAmount: 0, views: 0, ownerVerified: b.verification === 'VERIFIED',
    priceVolatility: 0, createdAt: b.createdAt,
    source: b.ownerId ? 'ownerPortal' : 'ministry', verification: b.verification, hasBoundary: !!b.core?.boundary,
  };
}

let running: Promise<void> | null = null;

/**
 * Brings the land published through the real backend (ministry / admin listings) into the site's land lists,
 * so investors see it next to the demo data. Runs at start-up and after an admin publishes or unpublishes.
 */
export function syncMinistryLands(): Promise<void> {
  running ??= (async () => {
    try {
      const rows = await backend<BackendLand[]>('GET', '/lands');
      const lands = rows.filter(r => r.hasActiveOpportunity).map(toLand);
      const incoming = new Set(lands.map(l => l.id));
      mutate(d => {
        d.lands = [...d.lands.filter(l => l.source !== 'ministry' &&
          !(l.source === 'ownerPortal' && (l.status === 'active' || incoming.has(l.id)))), ...lands];
      });
    } catch { /* backend not running: keep the demo data */ } finally {
      running = null;
    }
  })();
  return running;
}

export async function syncOwnerLands(ownerId: string): Promise<void> {
  const rows = await backend<{ land: BackendLand; opportunity: { status: string; winnerProposalId: string | null } | null }[]>('GET', '/my/lands');
  const lands = rows.map(r => {
    const land = toLand(r.land);
    land.ownerId = ownerId;
    land.source = 'ownerPortal';
    land.status = r.land.status === 'APPROVED'
      ? r.opportunity?.status === 'ACTIVE' ? 'active' : r.opportunity?.winnerProposalId ? 'funded' : 'closed'
      : r.land.status === 'DRAFT' ? 'draft' : r.land.status === 'ARCHIVED' ? 'closed' : 'underReview';
    return land;
  });
  mutate(d => { d.lands = [...d.lands.filter(l => l.source !== 'ownerPortal' || l.ownerId !== ownerId), ...lands]; });
}
