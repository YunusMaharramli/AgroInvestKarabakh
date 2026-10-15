using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>
/// Review state of a land submitted by its owner. Only APPROVED land has a public profile.
/// Lands imported from the old JSON file are APPROVED and have no owner (managed by admins).
/// </summary>
public enum LandStatus
{
    PendingReview,
    DocumentsRequested,
    Approved,
    Rejected,

    /// <summary>Admin-entered land that is not published yet (incomplete or waiting for checks).</summary>
    Draft,

    /// <summary>Taken out of use by an admin. Kept for the record; never public.</summary>
    Archived,
}

/// <summary>Who put the land into the portal.</summary>
public enum LandEntrySource
{
    /// <summary>Submitted by the landowner through the owner cabinet.</summary>
    Owner,

    /// <summary>Entered directly by a ministry administrator.</summary>
    Admin,

    /// <summary>Entered by an administrator on behalf of another party (named in <see cref="Land.OnBehalfOf"/>).</summary>
    AdminOnBehalf,
}

/// <summary>
/// How far the land's legal evidence has been checked. Entering data or uploading a file never makes it VERIFIED:
/// an administrator must check the evidence and confirm it explicitly. This is the portal's own check,
/// not an official registry confirmation.
/// </summary>
public enum LandVerificationStatus
{
    AdminEntered,
    EvidencePending,
    Verified,
}

public enum LandOwnershipType
{
    Private,
    State,
}

public sealed class Land
{
    public string Id { get; set; } = string.Empty;

    /// <summary>Null for legacy admin-managed lands.</summary>
    public string? OwnerId { get; set; }
    public User? Owner { get; set; }
    public LandOwnershipType OwnershipType { get; set; } = LandOwnershipType.Private;

    public string Title { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double AreaHectares { get; set; }
    public string AgricultureType { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string IntendedUse { get; set; } = string.Empty;
    public decimal EstimatedInvestmentRequirement { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? SoilQuality { get; set; }
    public string? WaterSupply { get; set; }

    // ---- Land use (one of the 25 types in LandUseCatalog). AgricultureType keeps the Azerbaijani name for display.

    /// <summary>Catalog key, e.g. "crops", "greenhouse", "renewable". Empty for very old rows not yet mapped.</summary>
    public string LandUse { get; set; } = string.Empty;

    // ---- Common core (all 25 types). Optional when submitting; missing values are reported by LandSuitability.
    public string? CadastralNumber { get; set; }

    /// <summary>Legal land category (təyinat): agricultural, settlement, industrial_transport, protected, forest, water, reserve.</summary>
    public string? LegalCategory { get; set; }

    /// <summary>Whether the category can be changed (needed for construction uses on agricultural land).</summary>
    public bool? CategoryConvertible { get; set; }

    /// <summary>private, municipal or state.</summary>
    public string? OwnershipForm { get; set; }
    public bool? HasEncumbrance { get; set; }

    /// <summary>Mortgage, lease, servitude… in the owner's words.</summary>
    public string? Encumbrances { get; set; }

    /// <summary>Boundary as a GeoJSON Polygon ([lng, lat] points), stored as jsonb.</summary>
    public string? BoundaryGeoJson { get; set; }

    /// <summary>asphalt, gravel, dirt or none.</summary>
    public string? RoadAccessType { get; set; }
    public double? RoadDistanceKm { get; set; }
    public double? SettlementDistanceKm { get; set; }
    public string? CurrentUse { get; set; }

    /// <summary>Type-specific inputs (see LandUseCatalog), stored as a jsonb object.</summary>
    public string Attributes { get; set; } = "{}";

    public LandStatus Status { get; set; } = LandStatus.PendingReview;

    /// <summary>Last message from the admin (documents requested / reason for rejection).</summary>
    public string? ReviewNote { get; set; }

    /// <summary>Last message from the owner when they sent more documents.</summary>
    public string? OwnerNote { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewedById { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // ---- Location details and admin record-keeping (admin land management).
    public string? District { get; set; }
    public string? Settlement { get; set; }

    /// <summary>True when the admin states the cadastral number is not available (needs manual review before publication).</summary>
    public bool CadastralUnavailable { get; set; }

    /// <summary>Water availability: see <see cref="AdminLandRules.WaterAccessOptions"/> (e.g. rain_fed, none_known).</summary>
    public string? WaterAccess { get; set; }

    /// <summary>Optional general details (soil, utilities, roads, buildings, fencing, storage, slope, climate, flood risk ...), jsonb.</summary>
    public string Details { get; set; } = "{}";

    public string? AdminNotes { get; set; }
    public LandEntrySource EntrySource { get; set; } = LandEntrySource.Owner;
    public string? OnBehalfOf { get; set; }
    public string? CreatedById { get; set; }
    public string? UpdatedById { get; set; }

    /// <summary>User who answers investor inquiries for an admin listing. Null = the ministry (admins).</summary>
    public string? ResponsibleUserId { get; set; }

    public LandVerificationStatus Verification { get; set; } = LandVerificationStatus.EvidencePending;
    public string? VerifiedById { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public string? VerificationNote { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }

    /// <summary>Sent by the admin form to make a double-clicked "save" create only one land.</summary>
    public string? ClientRequestId { get; set; }

    public List<LandDocument> Documents { get; set; } = [];
    public List<LandPhoto> Photos { get; set; } = [];
}

/// <summary>One change to a land, for the admin audit trail.</summary>
public sealed class LandAuditEntry
{
    public string Id { get; set; } = string.Empty;
    public string LandId { get; set; } = string.Empty;
    public string ActorId { get; set; } = string.Empty;

    /// <summary>created, updated, published, unpublished, archived, restored, reassigned, verification, document_added, document_removed, photo_added, photo_removed.</summary>
    public string Action { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTimeOffset At { get; set; }
}

/// <summary>Public photo of the land (JPG/PNG). Visible to everyone once the land is approved.</summary>
public sealed class LandPhoto
{
    public string Id { get; set; } = string.Empty;
    public string LandId { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}

/// <summary>Land document (ownership, lease, authorization, analysis ...) stored privately.</summary>
public sealed class LandDocument
{
    public string Id { get; set; } = string.Empty;
    public string LandId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string UploadedById { get; set; } = string.Empty;
    public DateTimeOffset UploadedAt { get; set; }

    /// <summary>ownership, lease, authorization, soil_analysis, water_analysis, other (see AdminLandRules.DocumentKinds).</summary>
    public string Kind { get; set; } = "ownership";
}
