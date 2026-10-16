using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Admin;

public sealed record RegionStat(string Region, int Count, decimal Investment);
public sealed record SectorStat(string Sector, int Count);
public sealed record StatusStat(string Status, string Label, int Count);
public sealed record TimelinePoint(string Month, int Applications, decimal Investment);
public sealed record LandPipelineStat(int Draft, int Published, int Archived);
public sealed record CompetitionOption(string Id, string Title);

/// <summary>Field names kept from the old dashboard ("applications" = proposals) so the charts keep working.</summary>
public sealed record AnalyticsDto(
    int TotalApplications, int ActiveCompetitions, int PublishedLands, int PendingLandReviews,
    int OpenProposals, int SelectedProposals, int NotSelectedProposals, decimal TotalProposedInvestment,
    IReadOnlyList<RegionStat> ApplicationsByRegion, IReadOnlyList<SectorStat> ApplicationsBySector,
    IReadOnlyList<StatusStat> ApplicationsByStatus, IReadOnlyList<TimelinePoint> Timeline,
    LandPipelineStat LandPipeline, IReadOnlyList<CompetitionOption> Competitions);

public sealed record IntegrationLogDto(string Id, string IntegrationType, string Status, JsonNode? RequestPayload, JsonNode? ResponsePayload, DateTimeOffset CreatedAt)
{
    public static IntegrationLogDto From(IntegrationLog l) =>
        new(l.Id, l.IntegrationType, l.Status, JsonNode.Parse(l.RequestPayload), JsonNode.Parse(l.ResponsePayload), l.CreatedAt);
}

public sealed record EktisSyncResponse(string Message, IntegrationLogDto Log, JsonNode? Response);
public sealed record SetInvestorVerificationRequest(bool IsVerified);

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin").RequireAuthorization(Policies.Admin);

        admin.MapGet("/lands/{landId}/proposal-analysis", async (string landId, ProposalAnalysisService service, CancellationToken ct) =>
            await service.AnalyzeAsync(landId, ct) is { } analysis ? Results.Ok(analysis) : Results.NotFound());

        admin.MapGet("/investors", async (string? search, int? page, InvestorDirectoryService service, CancellationToken ct) =>
            Results.Ok(await service.ListAsync(search, page ?? 1, ct)));

        admin.MapPatch("/investors/{userId}/verification", async (string userId, SetInvestorVerificationRequest req, InvestorDirectoryService service, CancellationToken ct) =>
        {
            var updated = await service.SetVerificationAsync(userId, req.IsVerified, ct);
            return updated is null ? Results.NotFound() : Results.Ok(updated);
        });

        admin.MapGet("/analytics", async (DateOnly? from, DateOnly? to, string? region, string? activity,
            string? competitionId, AdminAnalyticsService service, CancellationToken ct) =>
        {
            var result = await service.GetAsync(new AnalyticsFilter(from, to, region, activity, competitionId), ct);
            return result is null ? Results.BadRequest(new { error = "Invalid analytics filters." }) : Results.Ok(result);
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
