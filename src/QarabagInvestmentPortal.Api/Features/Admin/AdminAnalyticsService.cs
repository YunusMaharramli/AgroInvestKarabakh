using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Admin;

public sealed record AnalyticsFilter(DateOnly? From, DateOnly? To, string? Region, string? Activity, string? CompetitionId)
{
    public bool IsValid => (From is null || To is null || From <= To)
        && (Region is null || AdminLandRules.InvestmentRegions.Contains(Region))
        && (Activity is null || Activity == "unknown" || LandUseCatalog.All.Any(x => x.Key == Activity))
        && (CompetitionId is null || CompetitionId.Length is > 0 and <= 100)
        && To != DateOnly.MaxValue;

    public DateTimeOffset? Start => From is { } d ? new DateTimeOffset(d.Year, d.Month, d.Day, 0, 0, 0, TimeSpan.Zero) : null;
    public DateTimeOffset? EndExclusive => To is { } d ? new DateTimeOffset(d.AddDays(1).Year, d.AddDays(1).Month, d.AddDays(1).Day, 0, 0, 0, TimeSpan.Zero) : null;
}

public sealed record AnalyticsProposal(ProposalStatus Status, decimal Amount, DateTimeOffset SubmittedAt, string Region, string Activity);
public sealed record AnalyticsLand(LandStatus Status);

public static class AnalyticsProjection
{
    public static AnalyticsDto Build(IReadOnlyList<AnalyticsProposal> proposals, IReadOnlyList<AnalyticsLand> lands,
        int activeCompetitions, IReadOnlyList<CompetitionOption> competitions)
    {
        var timeline = proposals.GroupBy(p => new { p.SubmittedAt.Year, p.SubmittedAt.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new TimelinePoint($"{g.Key.Year:D4}-{g.Key.Month:D2}", g.Count(), g.Sum(x => x.Amount))).ToList();
        var statusOrder = new[] { ProposalStatus.Open, ProposalStatus.UnderReview, ProposalStatus.InformationRequested,
            ProposalStatus.Selected, ProposalStatus.NotSelected, ProposalStatus.Rejected, ProposalStatus.Cancelled };
        var pipeline = new LandPipelineStat(lands.Count(l => l.Status == LandStatus.Draft),
            lands.Count(l => l.Status == LandStatus.Approved), lands.Count(l => l.Status == LandStatus.Archived));
        return new AnalyticsDto(proposals.Count, activeCompetitions, pipeline.Published, 0,
            proposals.Count(p => ProposalService.IsPending(p.Status)), proposals.Count(p => p.Status == ProposalStatus.Selected),
            proposals.Count(p => p.Status == ProposalStatus.NotSelected), proposals.Sum(p => p.Amount),
            proposals.GroupBy(p => p.Region).OrderByDescending(g => g.Count())
                .Select(g => new RegionStat(g.Key, g.Count(), g.Sum(x => x.Amount))).ToList(),
            proposals.GroupBy(p => string.IsNullOrEmpty(p.Activity) ? "unknown" : p.Activity).OrderByDescending(g => g.Count())
                .Select(g => new SectorStat(g.Key, g.Count())).ToList(),
            statusOrder.Select(s => new StatusStat(System.Text.Json.JsonNamingPolicy.SnakeCaseUpper.ConvertName(s.ToString()), s.ToString(),
                proposals.Count(p => p.Status == s))).ToList(), timeline, pipeline, competitions);
    }
}

public sealed class AdminAnalyticsService(AppDbContext db, TimeProvider clock)
{
    public async Task<AnalyticsDto?> GetAsync(AnalyticsFilter f, CancellationToken ct)
    {
        if (!f.IsValid) return null;
        if (f.CompetitionId is not null && !await db.Opportunities.AnyAsync(o => o.Id == f.CompetitionId && o.Source == OpportunitySource.Admin, ct)) return null;

        var proposals = db.Proposals.AsNoTracking().Where(p => p.Opportunity!.Source == OpportunitySource.Admin);
        var lands = db.Lands.AsNoTracking().Where(l => l.OwnerId == null || l.EntrySource != LandEntrySource.Owner);
        var competitions = db.Opportunities.AsNoTracking().Where(o => o.Source == OpportunitySource.Admin);
        if (f.Region is { } region)
        {
            proposals = proposals.Where(p => p.Opportunity!.Land!.Region == region);
            lands = lands.Where(l => l.Region == region);
            competitions = competitions.Where(o => o.Land!.Region == region);
        }
        if (f.Activity is { } activity)
        {
            if (activity == "unknown")
            {
                proposals = proposals.Where(p => p.Opportunity!.Land!.LandUse == "");
                lands = lands.Where(l => l.LandUse == "");
                competitions = competitions.Where(o => o.Land!.LandUse == "");
            }
            else
            {
                proposals = proposals.Where(p => p.Opportunity!.Land!.LandUse == activity);
                lands = lands.Where(l => l.LandUse == activity);
                competitions = competitions.Where(o => o.Land!.LandUse == activity);
            }
        }
        if (f.CompetitionId is { } id)
        {
            proposals = proposals.Where(p => p.OpportunityId == id);
            lands = lands.Where(l => l.Id == db.Opportunities.Where(o => o.Id == id).Select(o => o.LandId).FirstOrDefault());
            competitions = competitions.Where(o => o.Id == id);
        }
        if (f.Start is { } start)
        {
            proposals = proposals.Where(p => p.SubmittedAt >= start);
            lands = lands.Where(l => l.CreatedAt >= start);
            competitions = competitions.Where(o => o.CreatedAt >= start);
        }
        if (f.EndExclusive is { } end)
        {
            proposals = proposals.Where(p => p.SubmittedAt < end);
            lands = lands.Where(l => l.CreatedAt < end);
            competitions = competitions.Where(o => o.CreatedAt < end);
        }
        var proposalRows = await proposals.Select(p => new AnalyticsProposal(p.Status, p.ProposedInvestmentAmount,
            p.SubmittedAt, p.Opportunity!.Land!.Region, p.Opportunity.Land.LandUse)).ToListAsync(ct);
        var landRows = await lands.Select(l => new AnalyticsLand(l.Status)).ToListAsync(ct);
        var now = clock.GetUtcNow();
        var activeCount = await competitions.CountAsync(o => o.Status == OpportunityStatus.Active &&
            (o.OpeningDate == null || o.OpeningDate <= now) && (o.ApplicationDeadline == null || o.ApplicationDeadline >= now), ct);
        // Filter options remain available when charts are empty or filtered.
        var options = await db.Opportunities.AsNoTracking().Where(o => o.Source == OpportunitySource.Admin)
            .OrderBy(o => o.Title).Select(o => new CompetitionOption(o.Id, o.Title)).ToListAsync(ct);
        return AnalyticsProjection.Build(proposalRows, landRows, activeCount, options);
    }
}
