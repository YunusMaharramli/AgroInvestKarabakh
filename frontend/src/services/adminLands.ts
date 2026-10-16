import { backend, BackendError } from './backend';
import { syncMinistryLands } from './ministryLands';

/* Admin land management: talks to /api/admin/lands on the real backend (admin-only on the server). */

export type AdminLandStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED' | 'PENDING_REVIEW' | 'DOCUMENTS_REQUESTED' | 'REJECTED';
export type Verification = 'ADMIN_ENTERED' | 'EVIDENCE_PENDING' | 'VERIFIED';
export type EntrySource = 'OWNER' | 'ADMIN' | 'ADMIN_ON_BEHALF';

export interface UserRef { id: string; name: string; email: string }
export interface LandIssue { code: string; field: string; message: string }

export interface AdminLandListItem {
  id: string; title: string; region: string; district: string | null; settlement: string | null; areaHectares: number; landUse: string;
  status: AdminLandStatus; verification: Verification; entrySource: EntrySource; listingStatus: string | null;
  cadastralNumber: string | null; cadastralUnavailable: boolean; createdBy: string | null; updatedBy: string | null;
  createdAt: string; updatedAt: string; publishedAt: string | null;
}

export interface AdminLandFields {
  title: string; description: string; region: string; district: string | null; settlement: string | null; areaHectares: number;
  latitude: number; longitude: number; boundary: { type: 'Polygon'; coordinates: number[][][] } | null; landUse: string; intendedUse: string;
  legalCategory: string | null; categoryConvertible: boolean | null; ownershipForm: string | null; hasEncumbrance: boolean | null;
  encumbrances: string | null; cadastralNumber: string | null; cadastralUnavailable: boolean; waterAccess: string | null;
  roadAccessType: string | null; roadDistanceKm: number | null; settlementDistanceKm: number | null; currentUse: string | null;
  soilQuality: string | null; waterSupply: string | null; attributes: Record<string, unknown>; details: Record<string, unknown>;
  estimatedInvestmentRequirement: number; adminNotes: string | null; entrySource: EntrySource; onBehalfOf: string | null;
  eligibilityConditions: string[]; requiredDocuments: string[]; applicationDeadline: string | null;
}

export interface AdminLandDetail {
  land: { id: string; photos: { id: string; url: string }[] };
  fields: AdminLandFields;
  record: {
    status: AdminLandStatus; verification: Verification; verifiedBy: UserRef | null; verifiedAt: string | null; verificationNote: string | null;
    createdBy: UserRef | null; createdAt: string; updatedBy: UserRef | null; updatedAt: string; publishedAt: string | null; archivedAt: string | null;
    responsibleUser: UserRef | null; ownershipType: 'PRIVATE' | 'STATE';
  };
  documents: { id: string; fileName: string; kind: string; contentType: string; sizeBytes: number; uploadedAt: string; url: string }[];
  listing: { id: string; status: string; proposalCount: number } | null;
  checks: { canPublish: boolean; blockers: LandIssue[]; flags: LandIssue[]; boundaryAreaHectares: number | null };
  audit: { id: string; action: string; details: string | null; actor: UserRef | null; at: string }[];
}

export interface LandUseInput { key: string; label: string; kind: 'NUMBER' | 'YES_NO' | 'CHOICE' | 'TEXT'; unit: string | null; options: string[] | null; required: boolean; min: number | null; max: number | null }
export interface LandUseType { number: number; key: string; name: string; needsConstruction: boolean; inputs: LandUseInput[] }
export interface AdminOptions {
  waterAccessOptions: string[]; documentKinds: string[]; legalCategories: string[]; ownershipForms: string[]; roadAccessTypes: string[];
  investmentRegions: string[]; details: LandUseInput[]; hectaresPerSot: number;
}

/** Error from an admin call, with per-field messages and publication blockers when the server sent them. */
export class AdminError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}, public blockers: LandIssue[] = []) { super(message); }
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  try {
    return await backend<T>(method, path, body);
  } catch (x) {
    if (x instanceof BackendError) {
      const fields = (x.data.fields && typeof x.data.fields === 'object' ? x.data.fields : {}) as Record<string, string>;
      const blockers = (Array.isArray(x.data.blockers) ? x.data.blockers : []) as LandIssue[];
      throw new AdminError(x.message, x.status, fields, blockers);
    }
    throw new AdminError('', 0);
  }
}

/** Status changes affect the public site: refresh the land lists afterwards. */
const andSync = async <T,>(p: Promise<T>) => { const r = await p; void syncMinistryLands(); return r; };

export const adminLands = {
  options: () => call<AdminOptions>('GET', '/admin/lands/options'),
  landUses: () => call<{ types: LandUseType[] }>('GET', '/land-uses'),
  list: (status: string, search: string, region = '', landUse = '', filters = '') =>
    call<AdminLandListItem[]>('GET', `/admin/lands?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&region=${encodeURIComponent(region)}&landUse=${encodeURIComponent(landUse)}${filters ? `&${filters}` : ''}`),
  get: (id: string) => call<AdminLandDetail>('GET', `/admin/lands/${encodeURIComponent(id)}`),
  create: (form: FormData) => call<AdminLandDetail>('POST', '/admin/lands', form),
  update: (id: string, form: FormData) => andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}`, form)),
  removeDocument: (id: string, docId: string) => andSync(call<AdminLandDetail>('DELETE', `/admin/lands/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`)),
  removePhoto: (id: string, photoId: string) => andSync(call<AdminLandDetail>('DELETE', `/admin/lands/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`)),
  publish: (id: string) => andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}/publish`)),
  unpublish: (id: string, reason: string) => andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}/unpublish`, { reason })),
  archive: (id: string, reason: string) => andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}/archive`, { reason })),
  restore: (id: string) => andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}/restore`)),
  reassign: (id: string, email: string) => andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}/reassign`, { email })),
  verification: (id: string, status: 'VERIFIED' | 'EVIDENCE_PENDING', evidenceChecked: boolean, note: string) =>
    andSync(call<AdminLandDetail>('POST', `/admin/lands/${encodeURIComponent(id)}/verification`, { status, evidenceChecked, note })),
};
