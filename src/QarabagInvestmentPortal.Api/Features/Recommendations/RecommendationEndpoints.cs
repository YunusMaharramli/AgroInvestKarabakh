using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Recommendations;

public sealed record RecommendationRequest(string? Region, decimal? Budget, string? AgricultureType, double? MinArea, string? ExperienceLevel);
public sealed record MatchBreakdown(int LocationScore, int BudgetScore, int SectorScore, int AreaScore);
public sealed record RecommendationResult(
    LandDto Land, OpportunityDto Opportunity, int MatchScore, MatchBreakdown MatchBreakdown, string Explanation,
    IReadOnlyList<string> MatchingFactors, IReadOnlyList<string> Mismatches);

/// <summary>"Mənə uyğun sahə": same weighted score as before (region 35%, budget 30%, sector 20%, area 15%).</summary>
public static class RecommendationEndpoints
{
    public static RouteGroupBuilder MapRecommendationEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/recommendations", async (RecommendationRequest req, ClaimsPrincipal user, AppDbContext db, OpportunityQueries queries, CancellationToken ct) =>
        {
            var active = await db.Opportunities.AsNoTracking().Include(o => o.Land)
                .Where(o => o.Status == OpportunityStatus.Active && o.Land!.Status == LandStatus.Approved)
                .ToListAsync(ct);
            var dtos = await queries.ToDtosAsync(active, new Viewer(user.UserId(), user.IsAdmin()), ct, includeLand: false);

            var results = active.Zip(dtos, (o, dto) => Score(o.Land!, dto, req))
                .OrderByDescending(r => r.MatchScore)
                .ToList();
            return Results.Ok(results);
        });
        return api;
    }

    internal static RecommendationResult Score(Land land, OpportunityDto opportunity, RecommendationRequest req)
    {
        var matching = new List<string>();
        var mismatches = new List<string>();

        int location;
        if (string.IsNullOrWhiteSpace(req.Region)) location = 70;
        else if (land.Region.Equals(req.Region, StringComparison.OrdinalIgnoreCase)) { location = 100; matching.Add($"Rayon uyğundur: {land.Region}"); }
        else { location = 20; mismatches.Add($"Başqa rayondadır: {land.Region}"); }

        int sector;
        if (string.IsNullOrWhiteSpace(req.AgricultureType)) sector = 70;
        else if (land.AgricultureType.Equals(req.AgricultureType, StringComparison.OrdinalIgnoreCase)) { sector = 100; matching.Add($"Fəaliyyət növü uyğundur: {land.AgricultureType}"); }
        else { sector = 15; mismatches.Add($"Fəaliyyət növü fərqlidir: {land.AgricultureType}"); }

        var budget = 70;
        if (req.Budget is > 0)
        {
            var ratio = (double)(req.Budget.Value / Math.Max(1m, land.EstimatedInvestmentRequirement));
            budget = ratio is >= .9 and <= 1.5 ? 100 : ratio is >= .7 and < .9 ? 75 : ratio > 1.5 ? 85 : 30;
            if (ratio >= .9) matching.Add("Büdcəniz kifayətdir");
            else mismatches.Add("Büdcəniz tələb olunan sərmayədən azdır");
        }

        var area = 70;
        if (req.MinArea is > 0)
        {
            var ratio = land.AreaHectares / req.MinArea.Value;
            area = ratio is >= .8 and <= 2.5 ? 100 : ratio > 2.5 ? 70 : 35;
            if (ratio >= .8) matching.Add("Sahənin ölçüsü uyğundur");
            else mismatches.Add("Sahə istədiyinizdən kiçikdir");
        }

        var score = (int)Math.Round(location * .35 + budget * .30 + sector * .20 + area * .15);
        var explanation = score >= 80 ? "Bu layihə parametrlərinizlə yüksək səviyyədə uzlaşır."
            : score >= 60 ? "Layihə əsas parametrlərinizlə uyğunluq təşkil edir."
            : "Layihənin bəzi şərtləri profilinizdən fərqlənir.";
        return new RecommendationResult(LandDto.From(land, true), opportunity, score,
            new MatchBreakdown(location, budget, sector, area), explanation, matching, mismatches);
    }
}
