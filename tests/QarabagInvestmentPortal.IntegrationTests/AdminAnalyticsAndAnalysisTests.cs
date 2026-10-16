using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.IntegrationTests;

[Collection(PortalCollection.Name)]
public sealed class AdminAnalyticsAndAnalysisTests(PortalFactory factory)
{
    [Fact]
    public async Task Filters_apply_to_all_analytics_and_analysis_never_changes_decisions()
    {
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var landId = "land-stats-" + suffix;
        var opportunityId = "opp-stats-" + suffix;
        var proposalId = "prop-stats-" + suffix;
        var oldOpportunityId = "opp-old-" + suffix;
        var oldProposalId = "prop-old-" + suffix;
        var when = new DateTimeOffset(2026, 2, 12, 12, 0, 0, TimeSpan.Zero);
        await using (var db = factory.NewDbContext())
        {
            db.Users.Add(new User { Id = "usr-stats-" + suffix, FirstName = "Private", LastName = "Investor",
                Email = suffix + "@example.test", Role = UserRole.User, PasswordHash = "unused", CreatedAt = when, UpdatedAt = when });
            db.Lands.Add(new Land { Id = landId, Title = "Statistics land", Region = "aghdam", LandUse = "crops",
                EntrySource = LandEntrySource.Admin, Status = LandStatus.Approved, CreatedAt = when, UpdatedAt = when,
                EstimatedInvestmentRequirement = 100m });
            db.Opportunities.Add(new InvestmentOpportunity { Id = opportunityId, LandId = landId, Source = OpportunitySource.Admin,
                Status = OpportunityStatus.Active, Title = "Statistics competition", RequiredDocuments = ["Business plan"],
                CreatedAt = when, UpdatedAt = when });
            db.Opportunities.Add(new InvestmentOpportunity { Id = oldOpportunityId, LandId = landId, Source = OpportunitySource.Admin,
                Status = OpportunityStatus.Closed, Title = "Older competition", RequiredDocuments = ["Budget"],
                CreatedAt = when.AddMonths(-1), UpdatedAt = when.AddMonths(-1) });
            db.Proposals.Add(new Proposal { Id = proposalId, OpportunityId = opportunityId, InvestorId = "usr-stats-" + suffix,
                ReferenceNumber = "AGRO-STATS-" + suffix, ApplicantName = "Private Investor", ContactPhone = "+994501234567",
                ProposedInvestmentAmount = 150m, ProjectCosts = 50m, ExpectedAnnualRevenue = 100m,
                BusinessPlanSummary = "Private plan", Status = ProposalStatus.Open, SubmittedAt = when, UpdatedAt = when });
            db.Proposals.Add(new Proposal { Id = oldProposalId, OpportunityId = oldOpportunityId, InvestorId = "usr-stats-" + suffix,
                ReferenceNumber = "AGRO-OLD-" + suffix, ApplicantName = "Private Investor", ContactPhone = "+994501234567",
                ProposedInvestmentAmount = 120m, ProjectCosts = 40m, ExpectedAnnualRevenue = 90m,
                BusinessPlanSummary = "Earlier private plan", Status = ProposalStatus.Open,
                SubmittedAt = when.AddMonths(-1), UpdatedAt = when.AddMonths(-1) });
            await db.SaveChangesAsync();
        }

        using var admin = await factory.AdminAsync();
        var path = $"/api/admin/analytics?from=2026-02-01&to=2026-02-28&region=aghdam&activity=crops&competitionId={opportunityId}";
        var response = await admin.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stats = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, stats.GetProperty("totalApplications").GetInt32());
        Assert.Equal(150m, stats.GetProperty("totalProposedInvestment").GetDecimal());
        Assert.Equal(1, stats.GetProperty("publishedLands").GetInt32());
        Assert.Equal(1, stats.GetProperty("activeCompetitions").GetInt32());
        Assert.Equal(1, stats.GetProperty("landPipeline").GetProperty("published").GetInt32());
        Assert.Equal("2026-02", stats.GetProperty("timeline")[0].GetProperty("month").GetString());
        var later = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/analytics?from=2026-03-01&competitionId={opportunityId}");
        Assert.Equal(0, later.GetProperty("totalApplications").GetInt32());
        Assert.Equal(0, later.GetProperty("landPipeline").GetProperty("published").GetInt32());
        var otherRegion = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/analytics?region=fuzuli&competitionId={opportunityId}");
        Assert.Equal(0, otherRegion.GetProperty("totalApplications").GetInt32());
        Assert.Equal(0, otherRegion.GetProperty("activeCompetitions").GetInt32());
        var otherActivity = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/analytics?activity=orchards&competitionId={opportunityId}");
        Assert.Equal(0, otherActivity.GetProperty("totalApplications").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/admin/analytics?activity=invalid")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/admin/analytics?competitionId=missing")).StatusCode);

        var analysisResponse = await admin.GetAsync($"/api/admin/lands/{landId}/proposal-analysis");
        Assert.Equal(HttpStatusCode.OK, analysisResponse.StatusCode);
        var analysis = await analysisResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("providerUnavailable", analysis.GetProperty("status").GetString());
        var comparison = analysis.GetProperty("comparison").EnumerateArray().ToList();
        Assert.Equal(2, comparison.Count);
        Assert.Contains(comparison, item => item.GetProperty("proposalId").GetString() == oldProposalId);
        Assert.Equal(50m, comparison.Single(item => item.GetProperty("proposalId").GetString() == proposalId)
            .GetProperty("profitProjection").GetProperty("base").GetDecimal());
        await using var after = factory.NewDbContext();
        Assert.Equal(ProposalStatus.Open, (await after.Proposals.SingleAsync(p => p.Id == proposalId)).Status);
    }
}
