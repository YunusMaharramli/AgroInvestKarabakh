using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>Public land profile. Same fields the frontend has always used (AgriculturalLand), plus owner info.</summary>
public sealed record LandDto(
    string Id, string Title, string Region, string Description, double AreaHectares, string AgricultureType,
    double Latitude, double Longitude, string IntendedUse, decimal EstimatedInvestmentRequirement, string ImageUrl,
    LandStatus Status, string? SoilQuality, string? WaterSupply, string? OwnerId, bool IsOwnerListing,
    bool HasActiveOpportunity, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    LandOwnershipType OwnershipType)
{
    public static LandDto From(Land l, bool hasActiveOpportunity = false) => new(
        l.Id, l.Title, l.Region, l.Description, l.AreaHectares, l.AgricultureType, l.Latitude, l.Longitude,
        l.IntendedUse, l.EstimatedInvestmentRequirement, l.ImageUrl, l.Status, l.SoilQuality, l.WaterSupply,
        l.OwnerId, l.OwnerId is not null, hasActiveOpportunity, l.CreatedAt, l.UpdatedAt, l.OwnershipType);
}

public sealed record LandDetailDto(LandDto Land, IReadOnlyList<OpportunityDto> Opportunities, OpportunityDto? ActiveOpportunity);

public sealed record LandDocumentDto(string Id, string FileName, string ContentType, long SizeBytes, DateTimeOffset UploadedAt, string Url)
{
    public static LandDocumentDto From(LandDocument d) =>
        new(d.Id, d.FileName, d.ContentType, d.SizeBytes, d.UploadedAt, $"/api/documents/lands/{d.Id}");
}

/// <summary>A land as its owner sees it in "Torpaqlarım".</summary>
public sealed record MyLandDto(
    LandDto Land, string? ReviewNote, string? OwnerNote, DateTimeOffset? SubmittedAt, DateTimeOffset? ReviewedAt,
    IReadOnlyList<LandDocumentDto> Documents, OpportunityDto? Opportunity);

/// <summary>A land submission as an admin sees it in the review queue.</summary>
public sealed record LandReviewDto(
    LandDto Land, PersonDto? Owner, string? OwnerPhone, string? ReviewNote, string? OwnerNote,
    DateTimeOffset? SubmittedAt, DateTimeOffset? ReviewedAt, IReadOnlyList<LandDocumentDto> Documents, OpportunityDto? Opportunity);

public sealed record ReviewMessageRequest(string? Message);
