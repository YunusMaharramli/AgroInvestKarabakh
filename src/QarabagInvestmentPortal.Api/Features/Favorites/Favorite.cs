using QarabagInvestmentPortal.Api.Features.Lands;

namespace QarabagInvestmentPortal.Api.Features.Favorites;

public sealed class Favorite
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string LandId { get; set; } = string.Empty;
    public Land? Land { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
