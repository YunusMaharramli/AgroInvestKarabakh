using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Admin;

public sealed record RegionStat(string Region, int Count, decimal Investment);
public sealed record SectorStat(string Sector, int Count);
public sealed record StatusStat(string Status, string Label, int Count);
public sealed record TimelinePoint(string Month, int Applications, decimal Investment);

/// <summary>Field names kept from the old dashboard ("applications" = proposals) so the charts keep working.</summary>
public sealed record AnalyticsDto(
    int TotalApplications, int ActiveCompetitions, int PublishedLands, int PendingLandReviews,
    int OpenProposals, int SelectedProposals, int NotSelectedProposals, decimal TotalProposedInvestment,
    IReadOnlyList<RegionStat> ApplicationsByRegion, IReadOnlyList<SectorStat> ApplicationsBySector,
    IReadOnlyList<StatusStat> ApplicationsByStatus, IReadOnlyList<TimelinePoint> Timeline);

public sealed record IntegrationLogDto(string Id, string IntegrationType, string Status, JsonNode? RequestPayload, JsonNode? ResponsePayload, DateTimeOffset CreatedAt)
{
    public static IntegrationLogDto From(IntegrationLog l) =>
        new(l.Id, l.IntegrationType, l.Status, JsonNode.Parse(l.RequestPayload), JsonNode.Parse(l.ResponsePayload), l.CreatedAt);
}

public sealed record EktisSyncResponse(string Message, IntegrationLogDto Log, JsonNode? Response);

public static class AdminEndpoints
{
    private static readonly string[] MonthsAz = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

    public static RouteGroupBuilder MapAdminEndpoints(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin").RequireAuthorization(Policies.Admin);

        admin.MapGet("/analytics", async (AppDbContext db, CancellationToken ct) =>
        {
            var proposals = await db.Proposals.AsNoTracking()
                .Where(p => p.Opportunity!.Source == OpportunitySource.Admin)
                .Select(p => new { p.Status, p.ProposedInvestmentAmount, p.SubmittedAt, p.Opportunity!.Land!.Region, p.Opportunity.Land.AgricultureType })
                .ToListAsync(ct);

            var timeline = proposals
                .GroupBy(p => new { p.SubmittedAt.Year, p.SubmittedAt.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .TakeLast(6)
                .Select(g => new TimelinePoint($"{MonthsAz[g.Key.Month - 1]} {g.Key.Year}", g.Count(), g.Sum(x => x.ProposedInvestmentAmount)))
                .ToList();

            return Results.Ok(new AnalyticsDto(
                TotalApplications: proposals.Count,
                ActiveCompetitions: await db.Opportunities.CountAsync(o => o.Source == OpportunitySource.Admin && o.Status == OpportunityStatus.Active, ct),
                PublishedLands: await db.Lands.CountAsync(l => l.Status == LandStatus.Approved && l.EntrySource != LandEntrySource.Owner, ct),
                PendingLandReviews: 0,
                OpenProposals: proposals.Count(p => ProposalService.IsPending(p.Status)),
                SelectedProposals: proposals.Count(p => p.Status == ProposalStatus.Selected),
                NotSelectedProposals: proposals.Count(p => p.Status == ProposalStatus.NotSelected),
                TotalProposedInvestment: proposals.Sum(p => p.ProposedInvestmentAmount),
                ApplicationsByRegion: proposals.GroupBy(p => p.Region).Select(g => new RegionStat(g.Key, g.Count(), g.Sum(x => x.ProposedInvestmentAmount))).ToList(),
                ApplicationsBySector: proposals.GroupBy(p => p.AgricultureType).Select(g => new SectorStat(g.Key, g.Count())).ToList(),
                ApplicationsByStatus:
                [
                    new StatusStat("OPEN", "Qəbul edilib", proposals.Count(p => p.Status == ProposalStatus.Open)),
                    new StatusStat("UNDER_REVIEW", "Baxılır", proposals.Count(p => p.Status == ProposalStatus.UnderReview)),
                    new StatusStat("INFORMATION_REQUESTED", "Əlavə məlumat tələb olunur", proposals.Count(p => p.Status == ProposalStatus.InformationRequested)),
                    new StatusStat("SELECTED", "Qalib seçilib", proposals.Count(p => p.Status == ProposalStatus.Selected)),
                    new StatusStat("NOT_SELECTED", "Seçilməyib", proposals.Count(p => p.Status == ProposalStatus.NotSelected)),
                    new StatusStat("REJECTED", "Rədd edilib", proposals.Count(p => p.Status == ProposalStatus.Rejected)),
                    new StatusStat("CANCELLED", "Elan bağlanıb", proposals.Count(p => p.Status == ProposalStatus.Cancelled)),
                ],
                Timeline: timeline));
        });

        admin.MapGet("/integrations/ektis/export", async (EktisIntegrationService service, CancellationToken ct) =>
            Results.Ok(await service.ExportAsync(ct)));
        admin.MapPost("/integrations/ektis/sync", async (EktisIntegrationService service, CancellationToken ct) =>
            Results.Ok(await service.SimulateAsync(ct)));

        admin.MapGet("/integrations/ektis/logs", async (AppDbContext db, CancellationToken ct) =>
        {
            var logs = await db.IntegrationLogs.AsNoTracking().OrderByDescending(l => l.CreatedAt).Take(100).ToListAsync(ct);
            return Results.Ok(logs.Select(IntegrationLogDto.From));
        });

        return api;
    }
}
