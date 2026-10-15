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

    public List<LandDocument> Documents { get; set; } = [];
}

/// <summary>Ownership document (JPG/PNG) stored privately.</summary>
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
}
