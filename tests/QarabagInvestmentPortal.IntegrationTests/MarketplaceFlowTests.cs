using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;

namespace QarabagInvestmentPortal.IntegrationTests;

/// <summary>The current marketplace flow: an admin publishes land, investors apply, and an admin decides.</summary>
[Collection(PortalCollection.Name)]
public sealed class MarketplaceFlowTests(PortalFactory factory)
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];
    private static readonly byte[] Pdf = "%PDF-1.4\n%test\n"u8.ToArray();
    private static int _nextParcel;

    [Fact]
    public async Task Only_admins_create_lands_and_drafts_need_publication_data()
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        using var admin = await factory.AdminAsync();
        using var investor = await factory.RegisterAsync($"land-{unique}@test.az");
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.Anonymous().PostAsync("/api/admin/lands", CompleteLandForm(unique))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await investor.PostAsync("/api/admin/lands", CompleteLandForm(unique))).StatusCode);

        using var draftForm = new MultipartFormDataContent { { new StringContent("Draft " + unique), "title" } };
        var created = await admin.PostAsync("/api/admin/lands", draftForm);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var landId = (await Read(created)).GetProperty("land").GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.PostAsync($"/api/admin/lands/{landId}/publish", null)).StatusCode);
        Assert.DoesNotContain(await ReadArray(await factory.Anonymous().GetAsync("/api/lands")),
            land => land.GetProperty("id").GetString() == landId);

        var edited = await admin.PostAsync($"/api/admin/lands/{landId}", CompleteLandForm(unique));
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var published = await admin.PostAsync($"/api/admin/lands/{landId}/publish", null);
        Assert.True(published.StatusCode == HttpStatusCode.OK, await published.Content.ReadAsStringAsync());
        Assert.Equal("APPROVED", (await Read(published)).GetProperty("land").GetProperty("status").GetString());
        Assert.Contains(await ReadArray(await factory.Anonymous().GetAsync("/api/lands")),
            land => land.GetProperty("id").GetString() == landId);
    }

    [Fact]
    public async Task Investors_apply_and_admin_selects_exactly_one_winner()
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        using var admin = await factory.AdminAsync();
        var (landId, opportunityId) = await CreatePublishedLandAsync(admin, unique);
        using var investorA = await factory.RegisterAsync($"inv-a-{unique}@test.az");
        using var investorB = await factory.RegisterAsync($"inv-b-{unique}@test.az");

        Assert.Equal(HttpStatusCode.Forbidden,
            (await admin.PostAsync("/api/proposals", ProposalForm(opportunityId))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await investorA.PostAsync("/api/proposals", ProposalForm(opportunityId, withDocument: false))).StatusCode);

        var first = await investorA.PostAsync("/api/proposals", ProposalForm(opportunityId));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var firstProposal = await Read(first);
        var firstId = firstProposal.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.Conflict,
            (await investorA.PostAsync("/api/proposals", ProposalForm(opportunityId))).StatusCode);
        var second = await investorB.PostAsync("/api/proposals", ProposalForm(opportunityId, amount: 450_000));
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var secondId = (await Read(second)).GetProperty("id").GetString()!;

        var privateDoc = firstProposal.GetProperty("documents")[0].GetProperty("url").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await investorA.GetAsync(privateDoc)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(privateDoc)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await investorB.GetAsync(privateDoc)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Anonymous().GetAsync(privateDoc)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await investorB.GetAsync($"/api/proposals/{firstId}")).StatusCode);
        Assert.Equal(2, (await ReadArray(await admin.GetAsync("/api/admin/proposals")))
            .Count(p => p.GetProperty("opportunityId").GetString() == opportunityId));

        var decisions = await Task.WhenAll(
            admin.PostAsJsonAsync($"/api/opportunities/{opportunityId}/select-winner", new { proposalId = firstId }),
            admin.PostAsJsonAsync($"/api/opportunities/{opportunityId}/select-winner", new { proposalId = secondId }));
        Assert.Single(decisions, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(decisions, response => response.StatusCode == HttpStatusCode.Conflict);
        await using var db = factory.NewDbContext();
        var statuses = await db.Proposals.Where(p => p.OpportunityId == opportunityId).Select(p => p.Status).ToListAsync();
        Assert.Single(statuses, status => status == ProposalStatus.Selected);
        Assert.Single(statuses, status => status == ProposalStatus.NotSelected);
        Assert.Equal(OpportunityStatus.Closed, (await db.Opportunities.SingleAsync(o => o.Id == opportunityId)).Status);
        Assert.Equal(LandStatus.Approved, (await db.Lands.SingleAsync(l => l.Id == landId)).Status);
    }

    [Fact]
    public async Task Archiving_published_land_removes_it_and_cancels_open_applications()
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        using var admin = await factory.AdminAsync();
        var (landId, opportunityId) = await CreatePublishedLandAsync(admin, unique);
        using var investor = await factory.RegisterAsync($"archive-{unique}@test.az");
        Assert.Equal(HttpStatusCode.Created,
            (await investor.PostAsync("/api/proposals", ProposalForm(opportunityId))).StatusCode);

        var archived = await admin.PostAsJsonAsync($"/api/admin/lands/{landId}/archive",
            new { reason = "Fixture no longer available" });
        Assert.Equal(HttpStatusCode.OK, archived.StatusCode);
        Assert.DoesNotContain(await ReadArray(await factory.Anonymous().GetAsync("/api/lands")),
            land => land.GetProperty("id").GetString() == landId);
        await using var db = factory.NewDbContext();
        Assert.Equal(LandStatus.Archived, (await db.Lands.SingleAsync(l => l.Id == landId)).Status);
        Assert.Equal(ProposalStatus.Cancelled,
            (await db.Proposals.SingleAsync(p => p.OpportunityId == opportunityId)).Status);
    }

    private async Task<(string LandId, string OpportunityId)> CreatePublishedLandAsync(HttpClient admin, string unique)
    {
        var created = await admin.PostAsync("/api/admin/lands", CompleteLandForm(unique));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var landId = (await Read(created)).GetProperty("land").GetProperty("id").GetString()!;
        var published = await admin.PostAsync($"/api/admin/lands/{landId}/publish", null);
        Assert.True(published.StatusCode == HttpStatusCode.OK, await published.Content.ReadAsStringAsync());
        var opportunityId = (await Read(published)).GetProperty("listing").GetProperty("id").GetString()!;
        return (landId, opportunityId);
    }

    private static MultipartFormDataContent CompleteLandForm(string unique)
    {
        // The integration database is shared by this class. Distinct polygons avoid overlap-review blockers.
        var west = 46.9 + Interlocked.Increment(ref _nextParcel) * 0.03;
        var east = west + 0.01;
        var longitude = west + 0.005;
        var boundary = JsonSerializer.Serialize(new
        {
            type = "Polygon",
            coordinates = new[] { new[] {
                new[] { west, 39.99 }, new[] { east, 39.99 }, new[] { east, 40.00 },
                new[] { west, 40.00 }, new[] { west, 39.99 }
            } }
        });
        var form = new MultipartFormDataContent
        {
            { new StringContent("Test land " + unique), "title" },
            { new StringContent("aghdam"), "region" },
            { new StringContent("crops"), "landUse" },
            { new StringContent("100"), "areaHectares" },
            { new StringContent("39.995"), "latitude" },
            { new StringContent(longitude.ToString(System.Globalization.CultureInfo.InvariantCulture)), "longitude" },
            { new StringContent(boundary), "boundary" },
            { new StringContent("agricultural"), "legalCategory" },
            { new StringContent("state"), "ownershipForm" },
            { new StringContent("TEST-" + unique), "cadastralNumber" },
            { new StringContent("well"), "waterAccess" },
            { new StringContent("400000"), "estimatedInvestmentRequirement" },
            { new StringContent("Business plan"), "requiredDocuments" },
            { new StringContent(DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd")), "applicationDeadline" },
        };
        form.Add(File(Png, "image/png"), "photos", "land.png");
        return form;
    }

    private static MultipartFormDataContent ProposalForm(string opportunityId, decimal amount = 400_000, bool withDocument = true)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(opportunityId), "opportunityId" },
            { new StringContent("individual"), "applicantType" },
            { new StringContent("Test Investor"), "applicantName" },
            { new StringContent(amount.ToString(System.Globalization.CultureInfo.InvariantCulture)), "proposedInvestmentAmount" },
            { new StringContent("I will grow crops using modern irrigation and invest in equipment."), "businessPlanSummary" },
            { new StringContent("18 months"), "estimatedImplementationPeriod" },
        };
        if (withDocument) form.Add(File(Pdf, "application/pdf"), "documents", "business-plan.pdf");
        return form;
    }

    private static ByteArrayContent File(byte[] bytes, string contentType)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return content;
    }

    private static async Task<JsonElement> Read(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(PortalFactory.Json);

    private static async Task<List<JsonElement>> ReadArray(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await Read(response)).EnumerateArray().ToList();
    }
}
