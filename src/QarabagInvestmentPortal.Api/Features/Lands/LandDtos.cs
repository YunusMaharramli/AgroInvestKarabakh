using System.Text.Json;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>
/// Public land profile. Same fields the frontend has always used (AgriculturalLand), plus owner info,
/// the land-use type, the common core data, the type-specific inputs, photos and the deal-breaker check.
/// </summary>
public sealed record LandDto(
    string Id, string Title, string Region, string Description, double AreaHectares, string AgricultureType,
    double Latitude, double Longitude, string IntendedUse, decimal EstimatedInvestmentRequirement, string ImageUrl,
    LandStatus Status, string? SoilQuality, string? WaterSupply, string? OwnerId, bool IsOwnerListing,
    bool HasActiveOpportunity, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    LandOwnershipType OwnershipType,
    string? District, string? Settlement, LandVerificationStatus Verification, string? WaterAccess,
    string LandUse, LandCoreDto Core, JsonElement Attributes, IReadOnlyList<LandPhotoDto> Photos, SuitabilityResult Suitability)
{
    public static LandDto From(Land l, bool hasActiveOpportunity = false)
    {
        var photos = l.Photos.OrderBy(p => p.SortOrder).Select(p => LandPhotoDto.From(l.Id, p)).ToList();
        var image = string.IsNullOrWhiteSpace(l.ImageUrl) && photos.Count > 0 ? photos[0].Url : l.ImageUrl;
        return new(
            l.Id, l.Title, l.Region, l.Description, l.AreaHectares, l.AgricultureType, l.Latitude, l.Longitude,
            l.IntendedUse, l.EstimatedInvestmentRequirement, image, l.Status, l.SoilQuality, l.WaterSupply,
            l.OwnerId, l.OwnerId is not null, hasActiveOpportunity, l.CreatedAt, l.UpdatedAt, l.OwnershipType,
            l.District, l.Settlement, l.Verification, l.WaterAccess,
            (LandUseCatalog.Find(l.LandUse) ?? LandUseCatalog.Find(l.AgricultureType))?.Key ?? l.LandUse,
            LandCoreDto.From(l), ToJson(l.Attributes), photos, LandSuitability.Evaluate(l));
    }

    private static JsonElement ToJson(string? json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            using var empty = JsonDocument.Parse("{}");
            return empty.RootElement.Clone();
        }
    }
}

/// <summary>Common core data (required for all 25 types; may be partly empty on older lands).</summary>
public sealed record LandCoreDto(
    string? CadastralNumber, string? LegalCategory, bool? CategoryConvertible, string? OwnershipForm,
    bool? HasEncumbrance, string? Encumbrances, JsonElement? Boundary, string? RoadAccessType,
    double? RoadDistanceKm, double? SettlementDistanceKm, string? CurrentUse)
{
    public static LandCoreDto From(Land l)
    {
        JsonElement? boundary = null;
        if (!string.IsNullOrWhiteSpace(l.BoundaryGeoJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(l.BoundaryGeoJson);
                boundary = doc.RootElement.Clone();
            }
            catch (JsonException) { boundary = null; }
        }
        return new(l.CadastralNumber, l.LegalCategory, l.CategoryConvertible, l.OwnershipForm, l.HasEncumbrance,
            l.Encumbrances, boundary, l.RoadAccessType, l.RoadDistanceKm, l.SettlementDistanceKm, l.CurrentUse);
    }
}

public sealed record LandPhotoDto(string Id, string Url)
{
    public static LandPhotoDto From(string landId, LandPhoto p) => new(p.Id, $"/api/lands/{landId}/photos/{p.Id}");
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
