/** Mock data model (Part 2, section 7). Shapes are ready to be served by the real API later. */

export type CabinetRole = 'landowner' | 'investor';
export type RiskTolerance = 'low' | 'medium' | 'high';

export interface UserPreferences {
  budgetMin: number;
  budgetMax: number;
  fieldTypes: string[];
  regions: string[];
  riskTolerance: RiskTolerance;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar: string | null;
  roles: CabinetRole[];
  /** Ministry administrator (from the backend account role). Admin pages are also checked on the server. */
  isAdmin?: boolean;
  verified: boolean;
  preferences: UserPreferences;
  investorType?: 'individual' | 'company';
  companyName?: string;
  region?: string;
  plotsCount?: number;
  language?: string;
  notify?: { email: boolean; sms: boolean; push: boolean };
}

export type Irrigation = 'none' | 'canal' | 'well' | 'drip' | 'unknown';
export type InvestmentModel = 'profitSharing' | 'lease' | 'jointVenture';
export type LandStatus = 'draft' | 'underReview' | 'active' | 'funded' | 'closed' | 'paused';
export type SoilType = 'chernozem' | 'chestnut' | 'alluvial' | 'grayBrown' | 'mountainMeadow' | 'sandyLoam' | 'unknown';

export interface Land {
  id: string;
  ownerId: string;
  /** Optional custom title written by the owner; otherwise built from field type + region in the UI language. */
  title?: string;
  fieldType: string;
  description?: string;
  region: string;
  address: string;
  lat: number;
  lng: number;
  areaHa: number;
  soilType: SoilType;
  fertilityPct: number;
  irrigation: Irrigation;
  lastCrop: string;
  roadAccess: boolean;
  electricity: boolean;
  ownershipDoc: string;
  investmentMin: number;
  investmentMax: number;
  investmentModel: InvestmentModel;
  expectedReturnPct: number;
  durationMonths: number;
  isSpecial: boolean;
  photos: string[];
  documents: { name: string; size: number }[];
  status: LandStatus;
  raisedAmount: number;
  views: number;
  ownerVerified: boolean;
  priceVolatility: number; // 0..1, used by the mock risk score
  createdAt: string;
  winnerRequestId?: string | null;
  /** Real API listing; unlike demo rows, unspecified agricultural facts are unknown. */
  source?: 'ministry' | 'ownerPortal';
  /** Backend verification status: entering data or uploading a file never makes a land "VERIFIED". */
  verification?: 'ADMIN_ENTERED' | 'EVIDENCE_PENDING' | 'VERIFIED';
  hasBoundary?: boolean;
}

/** Ministry decisions are authoritative for real proposals. */
export type RequestStatus = 'pending' | 'selected' | 'notSelected' | 'rejected' | 'cancelled';

export interface InvestmentRequest {
  id: string;
  landId: string;
  investorId: string;
  amount: number;
  investmentModel: InvestmentModel;
  durationMonths: number;
  message: string;
  status: RequestStatus;
  viewedByOwner: boolean;
  createdAt: string;
  updatedAt: string;
  source?: 'portal';
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'request' | 'decision' | 'review' | 'system';
  /** Translation key + values, so notifications follow the UI language. */
  textKey: string;
  values?: Record<string, string | number>;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface FeaturedProject {
  id: string;
  fieldType: string;
  region: string;
  image: string;
  amountRaised: number;
  year: number;
  link: string;
}

export interface SearchFilters {
  budgetMin: number;
  budgetMax: number;
  fieldTypes: string[];
  regions: string[];
  areaMin: number;
  areaMax: number;
  durationMin: number;
  durationMax: number;
  minReturn: number;
  riskTolerance: RiskTolerance;
  irrigationOnly: boolean;
}
