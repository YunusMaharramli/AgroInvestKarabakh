/** Only two roles. A USER can list their own land and also invest in other people's land. */
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface EntrepreneurProfile {
  id: string;
  userId: string;
  companyName: string;
  taxIdentificationNumber: string;
  businessActivity: string;
  createdAt: string;
  updatedAt: string;
}

/** Another person as shown to the listing owner (e.g. an investor). */
export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Owner-submitted land is reviewed by an admin. Only APPROVED land has a public profile. */
export type LandStatus = 'PENDING_REVIEW' | 'DOCUMENTS_REQUESTED' | 'APPROVED' | 'REJECTED';
export type AgricultureType = 'Əkinçilik' | 'Heyvandarlıq' | 'Bağçılıq' | 'İstixana təsərrüfatı' | 'Arıçılıq';

export interface AgriculturalLand {
  id: string;
  title: string;
  region: string;
  description: string;
  areaHectares: number;
  agricultureType: AgricultureType;
  latitude: number;
  longitude: number;
  intendedUse: string;
  estimatedInvestmentRequirement: number;
  imageUrl: string;
  status: LandStatus;
  soilQuality?: string | null;
  waterSupply?: string | null;
  ownerId?: string | null;
  isOwnerListing?: boolean;
  /** True while the land has a published listing accepting proposals. */
  hasActiveOpportunity?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** DRAFT: land still under review. ACTIVE: published, accepting proposals. CLOSED: no new proposals. */
export type OpportunityStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
/** OWNER listings are managed by the land owner; ADMIN listings (older demo data) by administrators. */
export type OpportunitySource = 'OWNER' | 'ADMIN';

export interface MyProposalSummary {
  id: string;
  referenceNumber: string;
  status: ProposalStatus;
}

/** An investment opportunity (listing) for a piece of land. */
export interface InvestmentOpportunity {
  id: string;
  landId: string;
  title: string;
  description: string;
  eligibilityConditions: string[];
  requiredDocuments: string[];
  openingDate: string | null;
  applicationDeadline: string | null;
  status: OpportunityStatus;
  source: OpportunitySource;
  acceptingProposals: boolean;
  proposalDocumentsRequired: boolean;
  proposalCount: number;
  winnerProposalId: string | null;
  closedAt: string | null;
  /** Only filled for users who sent a proposal, the responsible party and admins. */
  contactPhone: string | null;
  isResponsibleParty: boolean;
  myProposal: MyProposalSummary | null;
  land?: AgriculturalLand | null;
  createdAt: string;
  updatedAt: string;
}

export interface LandDetail {
  land: AgriculturalLand;
  opportunities: InvestmentOpportunity[];
  activeOpportunity: InvestmentOpportunity | null;
}

export interface LandDocument {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
}

/** A land as its owner sees it ("Torpaqlarım"). */
export interface MyLand {
  land: AgriculturalLand;
  reviewNote: string | null;
  ownerNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  documents: LandDocument[];
  opportunity: InvestmentOpportunity | null;
}

/** A land submission in the admin review queue. */
export interface LandReview extends MyLand {
  owner: Person | null;
  ownerPhone: string | null;
}

export type ProposalStatus = 'OPEN' | 'SELECTED' | 'NOT_SELECTED';

export interface ProposalDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  url: string;
}

export interface ProposalHistoryEntry {
  id: string;
  newStatus: string;
  changedBy: string;
  comment: string;
  createdAt: string;
}

/** An investor's proposal for an investment opportunity. */
export interface Proposal {
  id: string;
  referenceNumber: string;
  userId: string;
  opportunityId: string;
  proposedInvestmentAmount: number;
  businessPlanSummary: string;
  estimatedImplementationPeriod: string;
  contactPhone: string;
  status: ProposalStatus;
  submittedAt: string;
  updatedAt: string;
  decidedAt: string | null;
  user: Person | null;
  opportunity: InvestmentOpportunity | null;
  land: AgriculturalLand | null;
  documents: ProposalDocument[];
  statusHistory: ProposalHistoryEntry[];
  canSelectWinner: boolean;
}

export interface Favorite {
  id: string;
  userId: string;
  landId: string;
  createdAt: string;
  land?: AgriculturalLand;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface IntegrationLog {
  id: string;
  integrationType: string;
  status: 'SUCCESS' | 'FAILED';
  requestPayload: any;
  responsePayload: any;
  createdAt: string;
}

export interface RecommendationRequest {
  region?: string;
  budget?: number;
  agricultureType?: string;
  minArea?: number;
  experienceLevel?: string;
}

export interface RecommendationResult {
  land: AgriculturalLand;
  opportunity: InvestmentOpportunity;
  matchScore: number;
  matchBreakdown: {
    locationScore: number;
    budgetScore: number;
    sectorScore: number;
    areaScore: number;
  };
  explanation: string;
  matchingFactors: string[];
  mismatches: string[];
}

export interface AnalyticsSummary {
  totalApplications: number;
  activeCompetitions: number;
  publishedLands: number;
  pendingLandReviews: number;
  openProposals: number;
  selectedProposals: number;
  notSelectedProposals: number;
  totalProposedInvestment: number;
  applicationsByRegion: { region: string; count: number; investment: number }[];
  applicationsBySector: { sector: string; count: number }[];
  applicationsByStatus: { status: string; label: string; count: number }[];
  timeline: { month: string; applications: number; investment: number }[];
}
