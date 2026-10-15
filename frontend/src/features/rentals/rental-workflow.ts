export type ApplicantType = 'INDIVIDUAL' | 'LEGAL_ENTITY' | 'FOREIGN_APPLICANT';
export type ForeignKind = 'INDIVIDUAL' | 'LEGAL_ENTITY';
export type AppStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ADDITIONAL_INFORMATION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface ApplicantIdentity {
  applicantType: ApplicantType;
  foreignKind: ForeignKind | null;
}

export interface DocumentRequirement {
  applicantScope: string;
  kind: string;
  label: string;
  isRequired: boolean;
}

export function isForeignIndividual(type: ApplicantType, kind: ForeignKind | null) {
  return type === 'FOREIGN_APPLICANT' && kind === 'INDIVIDUAL';
}

export function isEntity(type: ApplicantType, kind: ForeignKind | null) {
  return type === 'LEGAL_ENTITY' || (type === 'FOREIGN_APPLICANT' && kind === 'LEGAL_ENTITY');
}

export function scopeMatches(scope: string, applicant: ApplicantIdentity | null) {
  const normalized = scope.trim().toUpperCase();
  if (normalized === 'ALL') return true;
  if (!applicant) return false;
  if (normalized === 'INDIVIDUAL') return applicant.applicantType === 'INDIVIDUAL';
  if (normalized === 'LEGAL_ENTITY') return applicant.applicantType === 'LEGAL_ENTITY';
  if (normalized === 'FOREIGN_INDIVIDUAL') return isForeignIndividual(applicant.applicantType, applicant.foreignKind);
  if (normalized === 'FOREIGN_LEGAL_ENTITY') return applicant.applicantType === 'FOREIGN_APPLICANT' && applicant.foreignKind === 'LEGAL_ENTITY';
  return false;
}

/** A subtype-specific rule takes precedence over ALL when both define the same document kind. */
export function requirementsForApplicant(requirements: DocumentRequirement[], applicant: ApplicantIdentity | null) {
  const matching = requirements.filter(requirement => scopeMatches(requirement.applicantScope, applicant));
  const byKind = new Map<string, DocumentRequirement>();
  for (const requirement of matching) {
    const key = requirement.kind.trim().toLowerCase();
    const previous = byKind.get(key);
    if (!previous || (previous.applicantScope.toUpperCase() === 'ALL' && requirement.applicantScope.toUpperCase() !== 'ALL')) {
      byKind.set(key, requirement);
    }
  }
  return [...byKind.values()];
}

export function missingRequiredDocuments(requirements: DocumentRequirement[], selectedKinds: string[]) {
  const uploaded = new Set(selectedKinds.map(kind => kind.toLowerCase()));
  return requirements.filter(requirement => requirement.isRequired && !uploaded.has(requirement.kind.toLowerCase()));
}

export type AdminApplicationAction = 'start-review' | 'request-information' | 'approve' | 'reject' | 'finalize-lease';

export function canAdminApplicationAction(status: AppStatus, action: AdminApplicationAction) {
  if (action === 'start-review') return status === 'SUBMITTED';
  if (action === 'request-information' || action === 'approve' || action === 'reject') return status === 'UNDER_REVIEW';
  if (action === 'finalize-lease') return status === 'APPROVED';
  return false;
}

export function parseDocumentRequirements(text: string): DocumentRequirement[] {
  return text.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const [scope = 'ALL', kind = '', label = '', requirement = 'required'] = line.split('|');
    return {
      applicantScope: scope.trim().toUpperCase(),
      kind: kind.trim(),
      label: label.trim(),
      isRequired: requirement.trim().toLowerCase() !== 'optional',
    };
  });
}
