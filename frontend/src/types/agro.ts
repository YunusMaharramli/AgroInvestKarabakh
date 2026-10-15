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

/** Investor (applicant) type chosen at sign-up. Profile data only: it is not a permission role. */
export type ApplicantType = 'INDIVIDUAL' | 'LEGAL_ENTITY' | 'FOREIGN_INDIVIDUAL' | 'FOREIGN_ENTITY';

/** Investor profile as the backend sends it (fields of the applicant's type are filled). */
export interface InvestorProfile {
  companyName: string; taxIdentificationNumber: string; businessActivity: string;
  foreignTaxNumber: string | null; country: string | null; activityStatus: string | null; activityStartDate: string | null;
  ceoName: string | null; address: string | null; maritalStatus: 'SINGLE' | 'MARRIED' | null; incomeLast6Months: number | null;
  residencyStatus: string | null; incomeSource: string | null; hasCredit: boolean | null; monthlyCreditPayment: number | null;
  hasFixedIncome: boolean | null; fixedMonthlyIncome: number | null; minimumFunds: number | null;
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
  /** Investor type from sign-up (null/undefined for admins and older accounts). */
  applicantType?: ApplicantType | null;
  /** True until the applicant has sent the additional sign-up information. */
  needsOnboarding?: boolean;
  investorProfile?: InvestorProfile | null;
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
  opportunityId?: string;
  applicationDeadline?: string | null;
  acceptingApplications?: boolean;
  requiredDocuments?: string[];
  eligibilityConditions?: string[];
  winnerRequestId?: string | null;
  /** Land published by the ministry through the real backend (admin land management). */
  source?: 'ministry';
  /** Backend verification status: entering data or uploading a file never makes a land "VERIFIED". */
  verification?: 'ADMIN_ENTERED' | 'EVIDENCE_PENDING' | 'VERIFIED';
  hasBoundary?: boolean;
  boundary?: { type: 'Polygon'; coordinates: number[][][] } | null;
}

/**
 * One-winner rule (decided with the client): the landowner selects ONE investor per listing;
 * the listing closes and all other pending requests become "notSelected".
 */
export type RequestStatus = 'pending' | 'underReview' | 'informationRequested' | 'selected' | 'notSelected' | 'rejected' | 'cancelled';

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
  referenceNumber?: string;
  opportunityId?: string;
  applicantType?: string;
  applicantName?: string;
  taxNumber?: string | null;
  history?: { id: string; newStatus: string; changedBy: string; comment: string; createdAt: string }[];
  documents?: { id: string; fileName: string; url: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'request' | 'decision' | 'review' | 'system';
  /** Translation key + values, so notifications follow the UI language. */
  textKey: string;
  title?: string;
  message?: string;
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
