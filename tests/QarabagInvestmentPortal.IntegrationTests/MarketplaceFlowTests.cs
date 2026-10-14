using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace QarabagInvestmentPortal.IntegrationTests;

/// <summary>
/// The whole marketplace, through the real HTTP API and PostgreSQL:
/// owner submits land → admin asks for documents → owner adds them → admin approves → investors propose →
/// owner picks a winner (atomically) → listing closes, others become NOT_SELECTED and are notified.
/// </summary>
[Collection(PortalCollection.Name)]
public sealed class MarketplaceFlowTests(PortalFactory factory)
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];
    private static readonly byte[] Pdf = "%PDF-1.4\n%test\n"u8.ToArray();

    [Fact]
    public async Task Full_flow_from_land_submission_to_winner_selection()
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        var owner = await factory.RegisterAsync($"owner-{unique}@test.az", "+994 50 111 22 33");
        var investorA = await factory.RegisterAsync($"inv-a-{unique}@test.az", "055 222 33 44");
        var investorB = await factory.RegisterAsync($"inv-b-{unique}@test.az", "+994 70 333 44 55");
        var latecomer = await factory.RegisterAsync($"inv-c-{unique}@test.az", "+994 77 444 55 66");
        var admin = await factory.AdminAsync();

        // ---- owner submits land with an ownership photo; it is not public yet
        var submit = await owner.PostAsync("/api/my/lands", LandForm($"Test sahə {unique}", requiredDocuments: "Biznes plan"));
        Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
        var myLand = await Read(submit);
        var landId = myLand.GetProperty("land").GetProperty("id").GetString()!;
        Assert.Equal("PENDING_REVIEW", myLand.GetProperty("land").GetProperty("status").GetString());
        Assert.Equal("DRAFT", myLand.GetProperty("opportunity").GetProperty("status").GetString());
        Assert.DoesNotContain(await ReadArray(await factory.Anonymous().GetAsync("/api/lands")), l => l.GetProperty("id").GetString() == landId);
        Assert.Equal(HttpStatusCode.NotFound, (await investorA.GetAsync($"/api/lands/{landId}")).StatusCode);

        // ---- the land document is private
        var landDocUrl = myLand.GetProperty("documents")[0].GetProperty("url").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync(landDocUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(landDocUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await investorA.GetAsync(landDocUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Anonymous().GetAsync(landDocUrl)).StatusCode);

        // ---- review queue: admins only
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync("/api/admin/land-reviews")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Anonymous().GetAsync("/api/admin/land-reviews")).StatusCode);
        var queue = await ReadArray(await admin.GetAsync("/api/admin/land-reviews"));
        Assert.Contains(queue, r => r.GetProperty("land").GetProperty("id").GetString() == landId);

        // ---- admin asks for more documents; owner sends them; admin approves
        var request = await admin.PostAsJsonAsync($"/api/admin/land-reviews/{landId}/request-documents", new { message = "Kadastr pasportunun şəklini əlavə edin." });
        Assert.Equal(HttpStatusCode.OK, request.StatusCode);
        Assert.Equal("DOCUMENTS_REQUESTED", (await Read(request)).GetProperty("land").GetProperty("status").GetString());

        var more = new MultipartFormDataContent { { File(Png, "image/png"), "documents", "kadastr.png" }, { new StringContent("Əlavə etdim"), "message" } };
        var added = await owner.PostAsync($"/api/my/lands/{landId}/documents", more);
        Assert.Equal(HttpStatusCode.OK, added.StatusCode);
        Assert.Equal("PENDING_REVIEW", (await Read(added)).GetProperty("land").GetProperty("status").GetString());

        var approve = await admin.PostAsync($"/api/admin/land-reviews/{landId}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/admin/land-reviews/{landId}/approve", null)).StatusCode);

        var detail = await Read(await investorA.GetAsync($"/api/lands/{landId}"));
        var opportunity = detail.GetProperty("activeOpportunity");
        var oppId = opportunity.GetProperty("id").GetString()!;
        Assert.Equal("OWNER", opportunity.GetProperty("source").GetString());
        Assert.Equal(JsonValueKind.Null, opportunity.GetProperty("contactPhone").ValueKind); // not before proposing

        // ---- only one active listing per land
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsync($"/api/my/lands/{landId}/reopen", null)).StatusCode);

        // ---- proposals: documents required by this listing; owner/admin cannot propose
        Assert.Equal(HttpStatusCode.BadRequest, (await investorA.PostAsync("/api/proposals", ProposalForm(oppId, withDocument: false))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync("/api/proposals", ProposalForm(oppId))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsync("/api/proposals", ProposalForm(oppId))).StatusCode);

        var propA = await investorA.PostAsync("/api/proposals", ProposalForm(oppId, amount: 500_000));
        Assert.Equal(HttpStatusCode.Created, propA.StatusCode);
        var proposalA = await Read(propA);
        var proposalAId = proposalA.GetProperty("id").GetString()!;
        Assert.Equal("+994 55 222 33 44", proposalA.GetProperty("contactPhone").GetString()); // snapshot of the profile phone
        Assert.Equal(HttpStatusCode.Conflict, (await investorA.PostAsync("/api/proposals", ProposalForm(oppId))).StatusCode);

        var propB = await investorB.PostAsync("/api/proposals", ProposalForm(oppId, amount: 450_000));
        Assert.Equal(HttpStatusCode.Created, propB.StatusCode);
        var proposalBId = (await Read(propB)).GetProperty("id").GetString()!;

        // ---- after proposing, the investor sees the listing's contact number
        var seenByA = await Read(await investorA.GetAsync($"/api/opportunities/{oppId}"));
        Assert.Equal("+994 50 111 22 33", seenByA.GetProperty("contactPhone").GetString());
        Assert.Equal(JsonValueKind.Null, (await Read(await latecomer.GetAsync($"/api/opportunities/{oppId}"))).GetProperty("contactPhone").ValueKind);

        // ---- who can see what
        var received = await ReadArray(await owner.GetAsync("/api/proposals/received"));
        Assert.Equal(2, received.Count(p => p.GetProperty("opportunityId").GetString() == oppId));
        Assert.Empty(await ReadArray(await investorB.GetAsync("/api/proposals/received")));
        Assert.Equal(HttpStatusCode.NotFound, (await investorB.GetAsync($"/api/proposals/{proposalAId}")).StatusCode);
        var docUrl = proposalA.GetProperty("documents")[0].GetProperty("url").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync(docUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(docUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await investorB.GetAsync(docUrl)).StatusCode);

        // ---- only the owner (responsible party) can choose; admins cannot decide for owner listings
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync($"/api/opportunities/{oppId}/select-winner", new { proposalId = proposalAId })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await investorB.PostAsJsonAsync($"/api/opportunities/{oppId}/select-winner", new { proposalId = proposalBId })).StatusCode);

        // ---- two winner selections at the same time: exactly one succeeds
        var results = await Task.WhenAll(
            owner.PostAsJsonAsync($"/api/opportunities/{oppId}/select-winner", new { proposalId = proposalAId }),
            owner.PostAsJsonAsync($"/api/opportunities/{oppId}/select-winner", new { proposalId = proposalBId }));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);

        await using (var db = factory.NewDbContext())
        {
            var statuses = await db.Proposals.Where(p => p.OpportunityId == oppId).Select(p => p.Status.ToString()).ToListAsync();
            Assert.Single(statuses, s => s == "Selected");
            Assert.Single(statuses, s => s == "NotSelected");
            var opp = await db.Opportunities.SingleAsync(o => o.Id == oppId);
            Assert.Equal("Closed", opp.Status.ToString());
            Assert.NotNull(opp.WinnerProposalId);
            var loserId = opp.WinnerProposalId == proposalAId ? proposalBId : proposalAId;
            var loser = await db.Proposals.Include(p => p.Investor).SingleAsync(p => p.Id == loserId);
            Assert.True(await db.Notifications.AnyAsync(n => n.UserId == loser.InvestorId && n.Title == "Təklifiniz seçilmədi"));
        }

        // ---- closed: no new proposals
        Assert.Equal(HttpStatusCode.BadRequest, (await latecomer.PostAsync("/api/proposals", ProposalForm(oppId))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync($"/api/opportunities/{oppId}/select-winner", new { proposalId = proposalBId })).StatusCode);
    }

    [Fact]
    public async Task Admins_cannot_submit_land_and_phone_numbers_are_checked()
    {
        var admin = await factory.AdminAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsync("/api/my/lands", LandForm("Admin sahəsi"))).StatusCode);

        var bad = await factory.Anonymous().PostAsJsonAsync("/api/auth/register", new
        {
            firstName = "A", lastName = "B", email = $"bad-{Guid.NewGuid():N}@test.az", phone = "+7 912 345 67 89",
            password = "Parol-2026", confirmPassword = "Parol-2026",
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var user = await factory.RegisterAsync($"files-{Guid.NewGuid():N}@test.az");
        var wrongType = new MultipartFormDataContent();
        foreach (var (k, v) in LandFields("Fayl testi")) wrongType.Add(new StringContent(v), k);
        wrongType.Add(File(Pdf, "application/pdf"), "documents", "sened.pdf"); // land documents must be JPG/PNG
        Assert.Equal(HttpStatusCode.BadRequest, (await user.PostAsync("/api/my/lands", wrongType)).StatusCode);

        var noDocs = new MultipartFormDataContent();
        foreach (var (k, v) in LandFields("Sənədsiz")) noDocs.Add(new StringContent(v), k);
        Assert.Equal(HttpStatusCode.BadRequest, (await user.PostAsync("/api/my/lands", noDocs)).StatusCode);
    }

    [Fact]
    public async Task Rejected_land_never_becomes_public()
    {
        var owner = await factory.RegisterAsync($"rej-{Guid.NewGuid():N}@test.az");
        var admin = await factory.AdminAsync();
        var landId = (await Read(await owner.PostAsync("/api/my/lands", LandForm("Rədd ediləcək")))).GetProperty("land").GetProperty("id").GetString()!;

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/admin/land-reviews/{landId}/reject", new { message = "" })).StatusCode);
        var reject = await admin.PostAsJsonAsync($"/api/admin/land-reviews/{landId}/reject", new { message = "Sənəd başqa şəxsin adınadır." });
        Assert.Equal(HttpStatusCode.OK, reject.StatusCode);

        Assert.DoesNotContain(await ReadArray(await factory.Anonymous().GetAsync("/api/lands")), l => l.GetProperty("id").GetString() == landId);
        var mine = await ReadArray(await owner.GetAsync("/api/my/lands"));
        var land = Assert.Single(mine, l => l.GetProperty("land").GetProperty("id").GetString() == landId);
        Assert.Equal("REJECTED", land.GetProperty("land").GetProperty("status").GetString());
        Assert.Equal("Sənəd başqa şəxsin adınadır.", land.GetProperty("reviewNote").GetString());
    }

    // ---------------------------------------------------------------- helpers

    private static IEnumerable<(string Key, string Value)> LandFields(string title, string requiredDocuments = "") =>
    [
        ("title", title), ("region", "Ağdam"), ("agricultureType", "Əkinçilik"), ("areaHectares", "120"),
        ("latitude", "39.99"), ("longitude", "46.93"), ("estimatedInvestmentRequirement", "400000"),
        ("intendedUse", "Buğda"), ("description", "Test"), ("requiredDocuments", requiredDocuments),
    ];

    private static MultipartFormDataContent LandForm(string title, string requiredDocuments = "")
    {
        var form = new MultipartFormDataContent();
        foreach (var (k, v) in LandFields(title, requiredDocuments)) form.Add(new StringContent(v), k);
        form.Add(File(Png, "image/png"), "documents", "cixaris.png");
        return form;
    }

    private static MultipartFormDataContent ProposalForm(string opportunityId, decimal amount = 400_000, bool withDocument = true)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(opportunityId), "opportunityId" },
            { new StringContent(amount.ToString(System.Globalization.CultureInfo.InvariantCulture)), "proposedInvestmentAmount" },
            { new StringContent("Müasir suvarma ilə buğda istehsalı."), "businessPlanSummary" },
            { new StringContent("18 ay"), "estimatedImplementationPeriod" },
        };
        if (withDocument) form.Add(File(Pdf, "application/pdf"), "documents", "biznes-plan.pdf");
        return form;
    }

    private static ByteArrayContent File(byte[] bytes, string type)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(type);
        return content;
    }

    private static async Task<JsonElement> Read(HttpResponseMessage res) => await res.Content.ReadFromJsonAsync<JsonElement>(PortalFactory.Json);

    private static async Task<List<JsonElement>> ReadArray(HttpResponseMessage res)
    {
        res.EnsureSuccessStatusCode();
        return (await Read(res)).EnumerateArray().ToList();
    }
}
