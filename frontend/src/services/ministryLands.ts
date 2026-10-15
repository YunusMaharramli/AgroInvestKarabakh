import { backend } from './backend';
import { mutate } from './db';
import { REGIONS } from '../data/regions';
import { CATEGORIES } from '../data/categories';
import i18n from 'i18next';
import type { Irrigation, Land } from '../types/agro';

/** Public land as the backend returns it (GET /api/lands: only approved land). */
export interface BackendLand {
  id: string; title: string; region: string; description: string; areaHectares: number; agricultureType: string;
  latitude: number; longitude: number; intendedUse: string; estimatedInvestmentRequirement: number; imageUrl: string;
  ownerId: string | null; hasActiveOpportunity: boolean; createdAt: string;
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
  water === 'well' ? 'well' : water === 'rain_fed' || water === 'none_known' || !water ? 'none' : 'canal';

export function toLand(b: BackendLand): Land {
  const amount = Number(b.estimatedInvestmentRequirement) || 0;
  return {
    id: b.id,
    ownerId: b.ownerId ?? 'ministry',
    title: b.title,
    fieldType: CATEGORIES.some(c => c.key === b.landUse) ? b.landUse : 'crops',
    description: [b.description, b.intendedUse].filter(Boolean).join('\n\n'),
    region: regionKey(b.region),
    address: [b.settlement, b.district].filter(Boolean).join(', '),
    lat: b.latitude, lng: b.longitude, areaHa: b.areaHectares,
    // Fields the backend does not hold for these listings get neutral values; the UI shows "—" where it matters.
    soilType: 'chestnut', fertilityPct: 60, irrigation: irrigationFrom(b.waterAccess), lastCrop: '',
    roadAccess: !!b.core?.roadAccessType && b.core.roadAccessType !== 'none', electricity: false, ownershipDoc: 'extract',
    investmentMin: amount, investmentMax: amount, investmentModel: 'lease', expectedReturnPct: 0, durationMonths: 0,
    isSpecial: false,
    photos: b.photos?.length ? b.photos.map(p => p.url) : b.imageUrl ? [b.imageUrl] : [],
    documents: [], status: 'active', raisedAmount: 0, views: 0, ownerVerified: b.verification === 'VERIFIED',
    priceVolatility: 0.4, createdAt: b.createdAt,
    source: 'ministry', verification: b.verification, hasBoundary: !!b.core?.boundary,
  };
}

export interface BackendCompetition {
  id: string; landId: string; title: string; description: string;
  status: string; acceptingProposals: boolean; applicationDeadline: string | null;
  requiredDocuments: string[]; eligibilityConditions: string[]; land: BackendLand | null;
}
let running: Promise<void> | null = null;
export function syncMinistryLands(): Promise<void> {
  running ??= (async () => {
    try {
      const rows = await backend<BackendCompetition[]>('GET', '/opportunities');
      const lands = rows.filter(r => r.land && ['ACTIVE', 'CLOSED'].includes(r.status)).map(r => ({
        ...toLand(r.land!), title: r.title, description: r.description || r.land!.description,
        opportunityId: r.id, applicationDeadline: r.applicationDeadline,
        acceptingApplications: r.acceptingProposals, requiredDocuments: r.requiredDocuments,
        eligibilityConditions: r.eligibilityConditions,
        status: r.status === 'ACTIVE' ? 'active' as const : 'closed' as const,
      }));
      mutate(d => { d.lands = lands; });
    } finally { running = null; }
  })();
  return running;
}
