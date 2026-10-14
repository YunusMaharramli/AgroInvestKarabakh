export type UserRole = 'ENTREPRENEUR' | 'ADMIN';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  passwordHash?: string;
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

export type LandStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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
  soilQuality?: string;
  waterSupply?: string;
  createdAt: string;
  updatedAt: string;
}

export type CompetitionStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export interface Competition {
  id: string;
  landId: string;
  title: string;
  description: string;
  eligibilityConditions: string[];
  requiredDocuments: string[];
  openingDate: string;
  applicationDeadline: string;
  status: CompetitionStatus;
  createdAt: string;
  updatedAt: string;
  land?: AgriculturalLand;
}

export type ApplicationStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'ADDITIONAL_INFORMATION_REQUIRED' | 'DECIDED';
export type DecisionOutcome = 'NONE' | 'APPROVED' | 'REJECTED';

export interface Application {
  id: string;
  referenceNumber: string; // e.g. AGRO-2026-0001
  userId: string;
  competitionId: string;
  proposedInvestmentAmount: number;
  businessPlanSummary: string;
  estimatedImplementationPeriod: string; // e.g. "24 ay"
  status: ApplicationStatus;
  decisionOutcome: DecisionOutcome;
  adminDecisionNote?: string;
  submittedAt: string;
  updatedAt: string;
  user?: User;
  competition?: Competition;
  land?: AgriculturalLand;
  documents?: ApplicationDocument[];
  statusHistory?: ApplicationStatusHistory[];
  infoRequests?: AdditionalInformationRequest[];
}

export interface ApplicationStatusHistory {
  id: string;
  applicationId: string;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  changedBy: string;
  comment: string;
  createdAt: string;
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  fileData?: string; // Base64 data for demonstration downloads
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

export interface AdditionalInformationRequest {
  id: string;
  applicationId: string;
  requestedBy: string;
  message: string;
  response?: string;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
  respondedAt?: string;
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
  competition?: Competition;
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
  underReviewApplications: number;
  decidedApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalProposedInvestment: number;
  averageProcessingDays: number;
  applicationsByRegion: { region: string; count: number; investment: number }[];
  applicationsBySector: { sector: string; count: number }[];
  applicationsByStatus: { status: string; label: string; count: number }[];
  timeline: { month: string; applications: number; investment: number }[];
}
