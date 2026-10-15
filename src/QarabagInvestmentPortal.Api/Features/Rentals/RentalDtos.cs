namespace QarabagInvestmentPortal.Api.Features.Rentals;

public sealed record ApplicantProfileInput(
    ApplicantType ApplicantType,
    ForeignApplicantKind? ForeignKind,
    string? FullLegalName,
    string? Citizenship,
    string? CountryOfResidence,
    string? ResidenceAddress,
    string? IdDocumentType,
    string? IdDocumentNumber,
    string? Fin,
    string? LegalName,
    string? LegalForm,
    string? CountryOfIncorporation,
    string? RegistrationIdentifier,
    string? TaxIdentifier,
    string? RegisteredAddress,
    string? ContactPhone,
    string? ContactEmail,
    string? ContactAddress,
    string? RepresentativeName,
    string? RepresentativePosition,
    string? AuthorityToAct,
    bool ConsentToProcess);

public sealed record RentalRequirementInput(string ApplicantScope, string Kind, string Label, bool IsRequired = true);

public sealed record RentalListingInput(
    RentalPropertyType PropertyType,
    string Title,
    string Description,
    RentalOwnerCategory OwnerCategory,
    string LegalDesignation,
    string Region,
    string Address,
    decimal Area,
    string AreaUnit,
    string PermittedUse,
    decimal RentAmount,
    string Currency,
    string PaymentPeriod,
    int? MinimumLeaseMonths,
    int? MaximumLeaseMonths,
    decimal? DepositAmount,
    string? AdditionalCharges,
    string? Infrastructure,
    string[]? PhotoUrls,
    string AuthorityBasis,
    string AuthorityReference,
    bool AuthorityReviewed,
    RentalProcedure Procedure,
    string? ProcedureReference,
    string? ProcedureNotes,
    string? EligibilityRules,
    IReadOnlyList<RentalRequirementInput>? DocumentRequirements);

public sealed record RentalApplicationDraftInput(string ListingId, string IntendedUse, int? ProposedLeaseMonths, string? Message);
public sealed record RentalDecisionInput(string? Reason);
public sealed record FinalizeLeaseInput(string AgreementReference, DateTimeOffset StartsAt, DateTimeOffset EndsAt);

public sealed record RentalRequirementDto(string ApplicantScope, string Kind, string Label, bool IsRequired);
public sealed record RentalListingDocumentDto(string Id, string Kind, string FileName, DateTimeOffset UploadedAt, string Url);

public sealed record RentalListingDto(
    string Id,
    RentalPropertyType PropertyType,
    string Title,
    string Description,
    RentalOwnerCategory OwnerCategory,
    string LegalDesignation,
    string Region,
    string Address,
    decimal Area,
    string AreaUnit,
    string PermittedUse,
    decimal RentAmount,
    string Currency,
    string PaymentPeriod,
    int? MinimumLeaseMonths,
    int? MaximumLeaseMonths,
    decimal? DepositAmount,
    string AdditionalCharges,
    string Infrastructure,
    IReadOnlyList<string> PhotoUrls,
    RentalProcedure Procedure,
    string ProcedureReference,
    string ProcedureNotes,
    string EligibilityRules,
    RentalListingStatus Status,
    bool IsAvailable,
    IReadOnlyList<RentalRequirementDto> DocumentRequirements,
    IReadOnlyList<RentalListingDocumentDto>? Documents,
    string? AuthorityBasis,
    string? AuthorityReference,
    bool? AuthorityReviewed,
    DateTimeOffset UpdatedAt);

public sealed record ApplicantProfileDto(
    string Id,
    ApplicantType ApplicantType,
    ForeignApplicantKind? ForeignKind,
    string FullLegalName,
    string Citizenship,
    string CountryOfResidence,
    string ResidenceAddress,
    string IdDocumentType,
    string IdDocumentNumber,
    string Fin,
    string LegalName,
    string LegalForm,
    string CountryOfIncorporation,
    string RegistrationIdentifier,
    string TaxIdentifier,
    string RegisteredAddress,
    string ContactPhone,
    string ContactEmail,
    string ContactAddress,
    string RepresentativeName,
    string RepresentativePosition,
    string AuthorityToAct,
    DateTimeOffset ConsentGrantedAt,
    DateTimeOffset UpdatedAt)
{
    public static ApplicantProfileDto From(RentalApplicantProfile p) => new(
        p.Id, p.ApplicantType, p.ForeignKind, p.FullLegalName, p.Citizenship, p.CountryOfResidence, p.ResidenceAddress,
        p.IdDocumentType, p.IdDocumentNumber, p.Fin, p.LegalName, p.LegalForm, p.CountryOfIncorporation,
        p.RegistrationIdentifier, p.TaxIdentifier, p.RegisteredAddress, p.ContactPhone, p.ContactEmail,
        p.ContactAddress, p.RepresentativeName, p.RepresentativePosition, p.AuthorityToAct, p.ConsentGrantedAt, p.UpdatedAt);
}

public sealed record RentalApplicationHistoryDto(string Status, string Comment, DateTimeOffset CreatedAt);
public sealed record RentalApplicationDocumentDto(string Id, string Kind, string FileName, DateTimeOffset UploadedAt, string Url);

public sealed record RentalApplicationDto(
    string Id,
    string ReferenceNumber,
    string ListingId,
    string ListingTitle,
    RentalApplicationStatus Status,
    string IntendedUse,
    int? ProposedLeaseMonths,
    string Message,
    string AdditionalInformationResponse,
    string? DecisionReason,
    DateTimeOffset CreatedAt,
    DateTimeOffset? SubmittedAt,
    IReadOnlyList<RentalApplicationHistoryDto> History,
    IReadOnlyList<RentalApplicationDocumentDto> Documents,
    IReadOnlyList<RentalRequirementDto> Requirements,
    ApplicantProfileDto? ApplicantProfile,
    string? ApplicantSnapshot);

public sealed record RentalLeaseDto(string Id, string ListingId, string ApplicationId, string AgreementReference, DateTimeOffset StartsAt, DateTimeOffset EndsAt, DateTimeOffset FinalizedAt, DateTimeOffset? EndedAt);
public sealed record PrivateRentalDocument(string StorageKey, string ContentType, string FileName);
