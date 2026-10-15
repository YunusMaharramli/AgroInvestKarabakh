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
  verified: boolean;
  preferences: UserPreferences;
  investorType?: 'individual' | 'company';
  companyName?: string;
  region?: string;
  plotsCount?: number;
  language?: string;
  notify?: { email: boolean; sms: boolean; push: boolean };
}

export type Irrigation = 'none' | 'canal' | 'well' | 'drip';
export type InvestmentModel = 'profitSharing' | 'lease' | 'jointVenture';
export type LandStatus = 'draft' | 'underReview' | 'active' | 'funded' | 'closed' | 'paused';
export type SoilType = 'chernozem' | 'chestnut' | 'alluvial' | 'grayBrown' | 'mountainMeadow' | 'sandyLoam';

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
}

/**
 * One-winner rule (decided with the client): the landowner selects ONE investor per listing;
 * the listing closes and all other pending requests become "notSelected".
 */
export type RequestStatus = 'pending' | 'selected' | 'notSelected';

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
