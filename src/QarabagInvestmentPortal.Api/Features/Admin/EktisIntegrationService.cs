using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using System.Text.Json;

namespace QarabagInvestmentPortal.Api.Features.Admin;

public sealed record EktisEntrepreneur(string Id, string Name, string Type, string? TaxNumber);
public sealed record EktisFarmArea(string Id, string Region, string Activity, double AreaHectares, double Latitude, double Longitude);
public sealed record EktisCompetition(string Id, string FarmAreaId, string Title, string Status, DateTimeOffset? OpeningDate, DateTimeOffset? ApplicationDeadline);
public sealed record EktisApplication(string Id, string ReferenceNumber, string CompetitionId, string EntrepreneurId, decimal InvestmentAmount, string BusinessPlan, string Status, DateTimeOffset SubmittedAt);
public sealed record EktisExport(string SchemaVersion, string Mode, DateTimeOffset GeneratedAt, IReadOnlyList<EktisEntrepreneur> Entrepreneurs, IReadOnlyList<EktisFarmArea> FarmAreas, IReadOnlyList<EktisCompetition> Competitions, IReadOnlyList<EktisApplication> Applications);
public sealed record EktisSimulationResult(string Mode, string Receipt, int FarmAreas, int Competitions, int Applications, string Message);

/// <summary>Versioned integration boundary. This implementation never calls a government system.</summary>
public sealed class EktisIntegrationService(AppDbContext db, TimeProvider clock)
{
    public async Task<EktisExport> ExportAsync(CancellationToken ct)
    {
        var applications = await db.Proposals.AsNoTracking().Where(p => p.Opportunity!.Source == OpportunitySource.Admin).OrderBy(p => p.SubmittedAt).ToListAsync(ct);
        var competitions = await db.Opportunities.AsNoTracking().Where(o => o.Source == OpportunitySource.Admin).OrderBy(o => o.Id).ToListAsync(ct);
        var farmIds = competitions.Select(o => o.LandId).Distinct().ToList();
        var farms = await db.Lands.AsNoTracking().Where(l => farmIds.Contains(l.Id)).OrderBy(l => l.Id).Select(l => new EktisFarmArea(l.Id, l.Region, l.LandUse, l.AreaHectares, l.Latitude, l.Longitude)).ToListAsync(ct);
        return new("1.0", "SIMULATION", clock.GetUtcNow(),
            applications.GroupBy(p => p.InvestorId).Select(g => g.OrderByDescending(p => p.SubmittedAt).First()).Select(p => new EktisEntrepreneur(p.InvestorId, p.ApplicantName, p.ApplicantType, p.TaxNumber)).ToList(), farms,
            competitions.Select(o => new EktisCompetition(o.Id, o.LandId, o.Title, o.Status.ToString(), o.OpeningDate, o.ApplicationDeadline)).ToList(),
            applications.Select(p => new EktisApplication(p.Id, p.ReferenceNumber, p.OpportunityId, p.InvestorId, p.ProposedInvestmentAmount, p.BusinessPlanSummary, p.Status.ToString(), p.SubmittedAt)).ToList());
    }

    public async Task<EktisSimulationResult> SimulateAsync(CancellationToken ct)
    {
        var payload = await ExportAsync(ct);
        var result = new EktisSimulationResult("SIMULATION", Guid.NewGuid().ToString("N"), payload.FarmAreas.Count, payload.Competitions.Count, payload.Applications.Count,
            "Sınaq tamamlandı. Real EKTİS sisteminə məlumat göndərilməyib.");
        db.IntegrationLogs.Add(new IntegrationLog {
            Id = "log-" + Guid.NewGuid().ToString("N"), IntegrationType = "EKTIS_SIMULATION", Status = "SIMULATED",
            RequestPayload = JsonSerializer.Serialize(new { payload.SchemaVersion, FarmAreas = payload.FarmAreas.Count, Applications = payload.Applications.Count }),
            ResponsePayload = JsonSerializer.Serialize(result), CreatedAt = clock.GetUtcNow()
        });
        await db.SaveChangesAsync(ct);
        return result;
    }
}
