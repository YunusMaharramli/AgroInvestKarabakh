using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Features.Rentals;

public enum RentalPropertyType { Land, BusinessProperty }
public enum RentalOwnerCategory { Private, Municipal, State }
public enum RentalProcedure { Direct, Auction, Tender, InvestmentCompetition, ExternalProcedure, LegalReviewRequired }
public enum RentalListingStatus { Draft, Published, Withdrawn, Archived }
public enum ApplicantType { Individual, LegalEntity, ForeignApplicant }
public enum ForeignApplicantKind { Individual, LegalEntity }
public enum RentalApplicationStatus { Draft, Submitted, UnderReview, AdditionalInformationRequired, Approved, Rejected, Withdrawn }

/// <summary>Admin-managed offer. Publishing is a marketplace action and does not itself establish leasing authority.</summary>
public sealed class RentalListing
{
    public string Id { get; set; } = string.Empty;
    public RentalPropertyType PropertyType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public RentalOwnerCategory OwnerCategory { get; set; }
    public string LegalDesignation { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Area { get; set; }
    public string AreaUnit { get; set; } = "ha";
    public string PermittedUse { get; set; } = string.Empty;
    public decimal RentAmount { get; set; }
    public string Currency { get; set; } = "AZN";
    public string PaymentPeriod { get; set; } = "month";
    public int? MinimumLeaseMonths { get; set; }
    public int? MaximumLeaseMonths { get; set; }
    public decimal? DepositAmount { get; set; }
    public string AdditionalCharges { get; set; } = string.Empty;
    public string Infrastructure { get; set; } = string.Empty;
    public string[] PhotoUrls { get; set; } = [];
    public string AuthorityBasis { get; set; } = string.Empty;
    public string AuthorityReference { get; set; } = string.Empty;
    public bool AuthorityReviewed { get; set; }
    public RentalProcedure Procedure { get; set; } = RentalProcedure.LegalReviewRequired;
    public string ProcedureReference { get; set; } = string.Empty;
    public string ProcedureNotes { get; set; } = string.Empty;
    public string EligibilityRules { get; set; } = string.Empty;
    public RentalListingStatus Status { get; set; } = RentalListingStatus.Draft;
    public string? WithdrawalReason { get; set; }
    public string CreatedById { get; set; } = string.Empty;
    public string UpdatedById { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public List<RentalDocumentRequirement> DocumentRequirements { get; set; } = [];
    public List<RentalListingDocument> Documents { get; set; } = [];
}

/// <summary>Applicant-type and listing-specific document rule; the scope is a platform configuration.</summary>
public sealed class RentalDocumentRequirement
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string ApplicantScope { get; set; } = "ALL";
    public string Kind { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool IsRequired { get; set; } = true;
}

public sealed class RentalListingDocument
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string UploadedById { get; set; } = string.Empty;
    public DateTimeOffset UploadedAt { get; set; }
}

/// <summary>One applicant profile per account. Applicant classification never changes the USER/ADMIN auth role.</summary>
public sealed class RentalApplicantProfile
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public ApplicantType ApplicantType { get; set; }
    public ForeignApplicantKind? ForeignKind { get; set; }
    public string FullLegalName { get; set; } = string.Empty;
    public string Citizenship { get; set; } = string.Empty;
    public string CountryOfResidence { get; set; } = string.Empty;
    public string ResidenceAddress { get; set; } = string.Empty;
    public string IdDocumentType { get; set; } = string.Empty;
    public string IdDocumentNumber { get; set; } = string.Empty;
    public string Fin { get; set; } = string.Empty;
    public string LegalName { get; set; } = string.Empty;
    public string LegalForm { get; set; } = string.Empty;
    public string CountryOfIncorporation { get; set; } = string.Empty;
    public string RegistrationIdentifier { get; set; } = string.Empty;
    public string TaxIdentifier { get; set; } = string.Empty;
    public string RegisteredAddress { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactAddress { get; set; } = string.Empty;
    public string RepresentativeName { get; set; } = string.Empty;
    public string RepresentativePosition { get; set; } = string.Empty;
    public string AuthorityToAct { get; set; } = string.Empty;
    public DateTimeOffset ConsentGrantedAt { get; set; }
    public string ConsentVersion { get; set; } = "rental-profile-v1";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class RentalApplication
{
    public string Id { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public RentalListing? Listing { get; set; }
    public string ApplicantUserId { get; set; } = string.Empty;
    public string ApplicantProfileId { get; set; } = string.Empty;
    public RentalApplicationStatus Status { get; set; } = RentalApplicationStatus.Draft;
    public string IntendedUse { get; set; } = string.Empty;
    public int? ProposedLeaseMonths { get; set; }
    public string Message { get; set; } = string.Empty;
    public string AdditionalInformationResponse { get; set; } = string.Empty;
    /// <summary>Immutable-at-submit JSON snapshot of profile data; contains sensitive data and is never returned publicly.</summary>
    public string? ApplicantSnapshot { get; set; }
    public string? DecisionReason { get; set; }
    public string? DecidedById { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public List<RentalApplicationDocument> Documents { get; set; } = [];
}

public sealed class RentalApplicationDocument
{
    public string Id { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public DateTimeOffset UploadedAt { get; set; }
}

public sealed class RentalApplicationHistory
{
    public string Id { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;
    public RentalApplicationStatus Status { get; set; }
    public string ActorId { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class RentalLease
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;
    public string AgreementReference { get; set; } = string.Empty;
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public DateTimeOffset FinalizedAt { get; set; }
    public string FinalizedById { get; set; } = string.Empty;
    public DateTimeOffset? EndedAt { get; set; }
}

/// <summary>Audit data intentionally contains actor/action/object references, never identifiers or document contents.</summary>
public sealed class RentalAuditEntry
{
    public string Id { get; set; } = string.Empty;
    public string ActorId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string ObjectType { get; set; } = string.Empty;
    public string ObjectId { get; set; } = string.Empty;
    public DateTimeOffset At { get; set; }
}
