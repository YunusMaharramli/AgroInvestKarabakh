using System.Text.Json;
using QarabagInvestmentPortal.Api.Features.Opportunities;

namespace QarabagInvestmentPortal.Api.Features.Lands;

public sealed record AdminUserRefDto(string Id, string Name, string Email);

/// <summary>Row of the admin land list.</summary>
public sealed record AdminLandListItemDto(
    string Id, string Title, string Region, string? District, string? Settlement, double AreaHectares, string LandUse,
    LandStatus Status, LandVerificationStatus Verification, LandEntrySource EntrySource, OpportunityStatus? ListingStatus,
    string? CadastralNumber, bool CadastralUnavailable, string? CreatedBy, string? UpdatedBy,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? PublishedAt);

/// <summary>Everything the admin form edits, in the same names the form sends.</summary>
public sealed record AdminLandFieldsDto(
    string Title, string Description, string Region, string? District, string? Settlement, double AreaHectares,
    double Latitude, double Longitude, JsonElement? Boundary, string LandUse, string IntendedUse, string? LegalCategory,
    bool? CategoryConvertible, string? OwnershipForm, bool? HasEncumbrance, string? Encumbrances, string? CadastralNumber,
    bool CadastralUnavailable, string? WaterAccess, string? RoadAccessType, double? RoadDistanceKm, double? SettlementDistanceKm,
    string? CurrentUse, string? SoilQuality, string? WaterSupply, JsonElement Attributes, JsonElement Details,
    decimal EstimatedInvestmentRequirement, string? AdminNotes, LandEntrySource EntrySource, string? OnBehalfOf,
    IReadOnlyList<string> EligibilityConditions, IReadOnlyList<string> RequiredDocuments, DateTimeOffset? ApplicationDeadline);

/// <summary>Record-keeping: status, verification, who created / edited / verified, responsible party.</summary>
public sealed record AdminLandRecordDto(
    LandStatus Status, LandVerificationStatus Verification, AdminUserRefDto? VerifiedBy, DateTimeOffset? VerifiedAt, string? VerificationNote,
    AdminUserRefDto? CreatedBy, DateTimeOffset CreatedAt, AdminUserRefDto? UpdatedBy, DateTimeOffset UpdatedAt,
    DateTimeOffset? PublishedAt, DateTimeOffset? ArchivedAt, AdminUserRefDto? ResponsibleUser, LandOwnershipType OwnershipType);

public sealed record AdminLandDocumentDto(string Id, string FileName, string Kind, string ContentType, long SizeBytes, DateTimeOffset UploadedAt, string Url);

public sealed record AdminLandAuditDto(string Id, string Action, string? Details, AdminUserRefDto? Actor, DateTimeOffset At);

public sealed record AdminLandDetailDto(
    LandDto Land, AdminLandFieldsDto Fields, AdminLandRecordDto Record, IReadOnlyList<AdminLandDocumentDto> Documents,
    OpportunityDto? Listing, LandPublicationCheck Checks, IReadOnlyList<AdminLandAuditDto> Audit);

public sealed record AdminLandReasonRequest(string? Reason);
public sealed record AdminLandReassignRequest(string? Email);
public sealed record AdminLandVerificationRequest(string? Status, bool EvidenceChecked, string? Note);
