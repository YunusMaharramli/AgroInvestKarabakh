using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Opportunities;

/// <summary>Read side of opportunities: builds DTOs with proposal counts and the viewer's own proposal.</summary>
public sealed class OpportunityQueries(AppDbContext db, TimeProvider clock)
{
    public async Task<List<OpportunityDto>> ToDtosAsync(IReadOnlyList<InvestmentOpportunity> items, Viewer viewer, CancellationToken ct, bool includeLand = true)
    {
        if (items.Count == 0) return [];
        var ids = items.Select(o => o.Id).ToList();

        var counts = await db.Proposals.AsNoTracking()
            .Where(p => ids.Contains(p.OpportunityId))
            .GroupBy(p => p.OpportunityId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var mine = viewer.UserId is null
            ? new Dictionary<string, MyProposalSummary>()
            : await db.Proposals.AsNoTracking()
                .Where(p => ids.Contains(p.OpportunityId) && p.InvestorId == viewer.UserId)
                .ToDictionaryAsync(p => p.OpportunityId, p => new MyProposalSummary(p.Id, p.ReferenceNumber, p.Status), ct);

        var now = clock.GetUtcNow();
        return items.Select(o => OpportunityMapping.ToDto(
            o, o.Land!, viewer, counts.GetValueOrDefault(o.Id), mine.GetValueOrDefault(o.Id), now, includeLand)).ToList();
    }

    /// <summary>Public list: ACTIVE and CLOSED. Admins also see DRAFT. Owners see their own drafts via "my lands".</summary>
    public async Task<List<OpportunityDto>> ListAsync(Viewer viewer, string? status, string? region, CancellationToken ct)
    {
        var query = db.Opportunities.AsNoTracking().Include(o => o.Land).ThenInclude(l => l!.Photos).AsQueryable();
        if (!viewer.IsAdmin)
            query = query.Where(o => o.Land!.Status == LandStatus.Approved
                && o.Status != OpportunityStatus.Draft && o.Status != OpportunityStatus.Rejected);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OpportunityStatus>(status.Replace("_", ""), true, out var s))
            query = query.Where(o => o.Status == s);
        if (!string.IsNullOrWhiteSpace(region) && region != "all")
            query = query.Where(o => o.Land!.Region == region);
        var items = await query.OrderByDescending(o => o.Status == OpportunityStatus.Active).ThenByDescending(o => o.CreatedAt).ToListAsync(ct);
        return await ToDtosAsync(items, viewer, ct);
    }

    public async Task<OpportunityDto?> GetAsync(string id, Viewer viewer, CancellationToken ct)
    {
        var o = await db.Opportunities.AsNoTracking().Include(x => x.Land).ThenInclude(l => l!.Photos).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        if ((o.Land!.Status != LandStatus.Approved
                || o.Status is OpportunityStatus.Draft or OpportunityStatus.Rejected)
            && !viewer.IsAdmin && o.Land.OwnerId != viewer.UserId) return null;
        return (await ToDtosAsync([o], viewer, ct))[0];
    }
}
