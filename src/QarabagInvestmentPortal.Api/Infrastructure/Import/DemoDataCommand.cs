using System.Globalization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Primitives;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Infrastructure.Import;

/// <summary>Local, repeatable fixture: 25 demo lands, 5 synthetic investors, 25 proposals.</summary>
internal static class DemoDataCommand
{
    private static readonly int[] ActiveOpportunityNumbers = [6, 8, 9, 11, 12, 14, 17, 18, 20];

    public static async Task<int> RunAsync(WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
            throw new InvalidOperationException("Demo data may only be seeded in Development.");
        var password = app.Configuration["DemoData:Password"];
        if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
            throw new InvalidOperationException("Set DemoData:Password in local user secrets before seeding.");

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        var now = scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow();
        var landSeeder = scope.ServiceProvider.GetRequiredService<DemoLandSeeder>();
        var landResult = await landSeeder.SeedAsync(CancellationToken.None, 25);
        var investorsCreated = await SeedInvestorsAsync(db, password, now);
        var proposalsCreated = await SeedProposalsAsync(db, scope.ServiceProvider.GetRequiredService<ProposalService>(), now);

        Console.WriteLine($"Demo data ready: {landResult.LandsCreated} new lands, {investorsCreated} new synthetic investors, {proposalsCreated} new applications. Expected fixture: 25 lands and 25 applications.");
        return 0;
    }

    private static async Task<int> SeedInvestorsAsync(AppDbContext db, string password, DateTimeOffset now)
    {
        var ids = Enumerable.Range(1, 5).Select(i => $"demo-investor-{i:00}").ToArray();
        var emails = Enumerable.Range(1, 5).Select(i => $"demo.investor.{i:00}@agroinvest.local").ToArray();
        var existing = await db.Users.Where(u => ids.Contains(u.Id) || emails.Contains(u.Email)).ToListAsync();
        if (existing.Any(u => !Enumerable.Range(0, 5).Any(i => u.Id == ids[i] && u.Email == emails[i]) || u.Role != UserRole.User))
            throw new InvalidOperationException("A demo investor ID or email is used by another account. No investor accounts were changed.");

        var names = new[] { ("Aysel", "Demo"), ("Agro", "Demo"), ("Leyla", "Demo"), ("Orchard", "Demo"), ("Murad", "Demo") };
        var types = new[] { ApplicantType.Individual, ApplicantType.LegalEntity, ApplicantType.ForeignIndividual, ApplicantType.ForeignEntity, ApplicantType.Individual };
        var created = 0;
        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        for (var i = 0; i < 5; i++)
        {
            if (existing.Any(u => u.Id == ids[i])) continue;
            var company = types[i] is ApplicantType.LegalEntity or ApplicantType.ForeignEntity;
            var profile = new UserProfile
            {
                Id = $"demo-profile-{i + 1:00}", UserId = ids[i],
                CompanyName = company ? $"[DEMO] {(i == 1 ? "Agro" : "Orchard")} Ventures" : string.Empty,
                TaxIdentificationNumber = company ? $"99000000{i + 1:00}" : string.Empty,
                BusinessActivity = company ? "Synthetic agricultural project planning" : string.Empty,
                ForeignTaxNumber = types[i] == ApplicantType.ForeignEntity ? "DEMO-FOREIGN-TAX-04" : null,
                Country = types[i] == ApplicantType.ForeignEntity ? "GE" : null,
                MaritalStatus = company ? null : MaritalStatus.Single,
                IncomeLast6Months = company ? null : 42_000m + i * 4_000m,
                HasCredit = company ? null : false,
                HasFixedIncome = company ? null : true,
                FixedMonthlyIncome = company ? null : 7_000m + i * 500m,
                MinimumFunds = 60_000m + i * 25_000m,
                CreatedAt = now.AddDays(-200), UpdatedAt = now.AddDays(-200),
            };
            db.Users.Add(new User
            {
                Id = ids[i], FirstName = names[i].Item1, LastName = names[i].Item2,
                Email = emails[i], Phone = $"+994 50 555 00 {i + 1:00}", Role = UserRole.User,
                ApplicantType = types[i], OnboardingCompletedAt = now.AddDays(-199),
                EmailConfirmedAt = now.AddDays(-199), PasswordHash = hash,
                CreatedAt = now.AddDays(-200), UpdatedAt = now.AddDays(-199), Profile = profile,
            });
            created++;
        }
        if (created > 0) await db.SaveChangesAsync();
        return created;
    }

    private static async Task<int> SeedProposalsAsync(AppDbContext db, ProposalService service, DateTimeOffset now)
    {
        var investorIds = Enumerable.Range(1, 5).Select(i => $"demo-investor-{i:00}").ToArray();
        var investors = await db.Users.Include(u => u.Profile).Where(u => investorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        var opportunityIds = ActiveOpportunityNumbers.Select(n => $"demo-opp-{n:00}").ToArray();
        var opportunities = await db.Opportunities.Include(o => o.Land).Where(o => opportunityIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id);
        if (investors.Count != 5 || opportunities.Count != ActiveOpportunityNumbers.Length || opportunities.Values.Any(o => o.Source != OpportunitySource.Admin))
            throw new InvalidOperationException("Demo investors or opportunities are missing; no applications were submitted.");

        var created = 0;
        var newIds = new List<(int Index, string Id)>();
        var fixtureIds = new Dictionary<int, string>();
        for (var i = 0; i < 25; i++)
        {
            var opportunityId = $"demo-opp-{ActiveOpportunityNumbers[i % ActiveOpportunityNumbers.Length]:00}";
            var investor = investors[$"demo-investor-{((i / ActiveOpportunityNumbers.Length + i % ActiveOpportunityNumbers.Length) % 5) + 1:00}"];
            var marker = $"DEMO DATA ONLY. Fixture {i + 1:00}.";
            var existing = await db.Proposals.AsNoTracking()
                .FirstOrDefaultAsync(p => p.OpportunityId == opportunityId && p.InvestorId == investor.Id);
            if (existing is not null)
            {
                if (!existing.BusinessPlanSummary.StartsWith(marker, StringComparison.Ordinal))
                    throw new InvalidOperationException($"An investor already applied to {opportunityId}; fixture {i + 1:00} was not changed.");
                fixtureIds[i] = existing.Id;
                continue;
            }

            var opp = opportunities[opportunityId];
            var company = investor.ApplicantType is ApplicantType.LegalEntity or ApplicantType.ForeignEntity;
            var offered = opp.Land!.EstimatedInvestmentRequirement + (i % 4 == 0 ? -9_000m : 12_000m + i * 1_750m);
            var fields = new Dictionary<string, StringValues>
            {
                ["opportunityId"] = opportunityId,
                ["proposedInvestmentAmount"] = Math.Max(10_000m, offered).ToString(CultureInfo.InvariantCulture),
                ["applicantType"] = company ? "company" : "individual",
                ["applicantName"] = company ? investor.Profile!.CompanyName : investor.FullName,
                ["taxNumber"] = company ? investor.Profile!.TaxIdentificationNumber : string.Empty,
                ["businessPlanSummary"] = $"{marker} Synthetic plan for {opp.Title}; crop production, employment and irrigation assumptions are illustrative.",
                ["estimatedImplementationPeriod"] = $"{12 + (i % 4) * 6} months",
                ["projectCosts"] = i % 7 == 0 ? string.Empty : (55_000m + i * 4_500m).ToString(CultureInfo.InvariantCulture),
                ["fundingGap"] = (i % 3 == 0 ? 8_000m + i * 250m : 0m).ToString(CultureInfo.InvariantCulture),
                ["additionalFinancingRequested"] = (i % 3 == 0 ? 10_000m + i * 300m : 0m).ToString(CultureInfo.InvariantCulture),
                ["expectedAnnualRevenue"] = i % 6 == 0 ? string.Empty : (68_000m + i * 7_000m).ToString(CultureInfo.InvariantCulture),
                ["expectedProduction"] = "DEMO: projected agricultural output for portal review",
                ["contactPhone"] = investor.Phone!,
            };
            var result = await service.SubmitAsync(new Viewer(investor.Id, false), new FormCollection(fields), CancellationToken.None);
            if (!result.Ok) throw new InvalidOperationException($"Demo application {i + 1:00} failed: {result.Error}");
            fixtureIds[i] = result.Value!.Id;
            newIds.Add((i, result.Value.Id));
            created++;
        }

        if (newIds.Count > 0)
        {
            var ids = newIds.Select(x => x.Id).ToArray();
            var proposals = await db.Proposals.Include(p => p.History).Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
            foreach (var (index, id) in newIds)
            {
                var submitted = now.AddDays(-((index * 11) % 165));
                proposals[id].SubmittedAt = submitted;
                var history = proposals[id].History.FirstOrDefault(h => h.Status == "SUBMITTED");
                if (history is not null) history.CreatedAt = submitted;
            }
            await db.SaveChangesAsync();
        }

        var adminId = await db.Users.AsNoTracking().Where(u => u.Role == UserRole.Admin).OrderBy(u => u.CreatedAt).Select(u => u.Id).FirstAsync();
        var admin = new Viewer(adminId, true);
        foreach (var index in new[] { 4, 8, 14 })
        {
            if (await db.Proposals.AnyAsync(p => p.Id == fixtureIds[index] && p.Status == ProposalStatus.Open))
                Require((await service.ReviewAsync(fixtureIds[index], new ReviewApplicationRequest(ProposalStatus.UnderReview, "DEMO: reviewing proposal"), admin, CancellationToken.None)).Ok, "review");
        }
        foreach (var index in new[] { 5, 15 })
        {
            if (await db.Proposals.AnyAsync(p => p.Id == fixtureIds[index] && p.Status == ProposalStatus.Open))
                Require((await service.ReviewAsync(fixtureIds[index], new ReviewApplicationRequest(ProposalStatus.InformationRequested, "DEMO: provide more project details"), admin, CancellationToken.None)).Ok, "information request");
        }
        if (await db.Proposals.AnyAsync(p => p.Id == fixtureIds[6] && p.Status == ProposalStatus.Open))
            Require((await service.RejectAsync(fixtureIds[6], "DEMO: illustrative rejected application", admin, CancellationToken.None)).Ok, "rejection");
        if (await db.Opportunities.AnyAsync(o => o.Id == "demo-opp-06" && o.Status == OpportunityStatus.Active && o.WinnerProposalId == null))
            Require((await service.SelectWinnerAsync("demo-opp-06", fixtureIds[0], admin, CancellationToken.None)).Ok, "winner selection");
        if (await db.Opportunities.AnyAsync(o => o.Id == "demo-opp-08" && o.Status == OpportunityStatus.Active))
            Require((await service.SetStatusAsync("demo-opp-08", OpportunityStatus.Closed, "DEMO: illustrative closed competition", admin, CancellationToken.None)).Ok, "competition closure");
        return created;
    }

    private static void Require(bool ok, string step)
    {
        if (!ok) throw new InvalidOperationException($"Demo {step} failed; rerun the idempotent seed command after checking the database.");
    }
}
