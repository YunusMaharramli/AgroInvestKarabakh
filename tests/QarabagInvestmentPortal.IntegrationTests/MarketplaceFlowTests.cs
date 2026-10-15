using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace QarabagInvestmentPortal.IntegrationTests;

/// <summary>Rental marketplace workflows through the real API and PostgreSQL.</summary>
[Collection(PortalCollection.Name)]
public sealed class MarketplaceFlowTests(PortalFactory factory)
{
    private static readonly byte[] Pdf = "%PDF-1.4\n%test\n"u8.ToArray();

    [Fact]
    public async Task Listing_and_decisions_are_admin_only_and_legacy_submission_routes_are_closed()
    {
        var applicant = await factory.RegisterAsync($"browse-{Guid.NewGuid():N}@test.az");
        var admin = await factory.AdminAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await applicant.PostAsync("/api/my/lands", new StringContent(""))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.GetAsync("/api/admin/rentals")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.PostAsJsonAsync("/api/admin/rentals", Listing("Unauthorized"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.GetAsync("/api/admin/rental-applications")).StatusCode);

        var created = await admin.PostAsJsonAsync("/api/admin/rentals", Listing($"Admin listing {Guid.NewGuid():N}"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await Read(created);
        Assert.Equal("DRAFT", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Applicant_snapshot_private_documents_additional_information_and_concurrent_lease_finalization_work()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var admin = await factory.AdminAsync();
        var applicantA = await factory.RegisterAsync($"applicant-a-{suffix}@test.az");
        var applicantB = await factory.RegisterAsync($"applicant-b-{suffix}@test.az");
        var other = await factory.RegisterAsync($"other-{suffix}@test.az");
        var listingId = await CreatePublishedListing(admin, $"Lease test {suffix}");

        await SaveProfile(applicantA, "Aysel Məmmədova", "+1 202 555 0183");
        await SaveProfile(applicantB, "Kamran Əliyev", "+44 20 7946 0958");
        await SaveProfile(other, "Başqa İstifadəçi", "+994 50 222 33 44");

        var concurrentDrafts = await Task.WhenAll(
            other.PostAsJsonAsync("/api/rental-applications", new { listingId, intendedUse = "Taxıl", proposedLeaseMonths = 12, message = "" }),
            other.PostAsJsonAsync("/api/rental-applications", new { listingId, intendedUse = "Taxıl", proposedLeaseMonths = 12, message = "" }));
        Assert.Single(concurrentDrafts, x => x.StatusCode == HttpStatusCode.Created);
        Assert.Single(concurrentDrafts, x => x.StatusCode == HttpStatusCode.Conflict);

        var applicationA = await CreateAndSubmitApplication(applicantA, listingId);
        var applicationB = await CreateAndSubmitApplication(applicantB, listingId);
        var appAId = applicationA.GetProperty("id").GetString()!;
        var appBId = applicationB.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.Conflict, (await applicantA.PostAsJsonAsync("/api/rental-applications", new { listingId, intendedUse = "Taxıl", proposedLeaseMonths = 12, message = "" })).StatusCode);

        var documentId = applicationA.GetProperty("documents")[0].GetProperty("id").GetString()!;
        var documentUrl = $"/api/documents/rentals/{documentId}";
        Assert.Equal(HttpStatusCode.OK, (await applicantA.GetAsync(documentUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(documentUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await applicantB.GetAsync(documentUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/rental-applications/{appAId}")).StatusCode);

        var applicantList = await ReadArray(await applicantA.GetAsync("/api/rental-applications"));
        var listedA = Assert.Single(applicantList, x => x.GetProperty("id").GetString() == appAId);
        Assert.Equal(JsonValueKind.Null, listedA.GetProperty("applicantProfile").ValueKind);
        Assert.Empty(listedA.GetProperty("documents").EnumerateArray());

        var adminList = await ReadArray(await admin.GetAsync("/api/admin/rental-applications"));
        var adminListedA = Assert.Single(adminList, x => x.GetProperty("id").GetString() == appAId);
        Assert.Equal(JsonValueKind.Null, adminListedA.GetProperty("applicantProfile").ValueKind);
        Assert.Equal(JsonValueKind.Null, adminListedA.GetProperty("applicantSnapshot").ValueKind);
        Assert.Empty(adminListedA.GetProperty("documents").EnumerateArray());

        await SaveProfile(applicantA, "Changed after submission", "+1 202 555 0183");
        var appDetail = await Read(await applicantA.GetAsync($"/api/rental-applications/{appAId}"));
        Assert.Equal("Aysel Məmmədova", appDetail.GetProperty("applicantProfile").GetProperty("fullLegalName").GetString());
        Assert.Equal("SUBMITTED", appDetail.GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.Forbidden, (await applicantA.PostAsJsonAsync($"/api/admin/rental-applications/{appAId}/approve", new { reason = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicantA.GetAsync("/api/admin/rental-applications")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/admin/rental-applications/{appAId}/under-review", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/rental-applications/{appAId}/request-information", new { reason = "Təsərrüfat planını izah edin." })).StatusCode);
        using (var responseForm = new MultipartFormDataContent { { new StringContent("Məhsul növbəli əkiləcək."), "response" } })
            Assert.Equal(HttpStatusCode.OK, (await applicantA.PostAsync($"/api/rental-applications/{appAId}/documents", responseForm)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await applicantA.PostAsync($"/api/rental-applications/{appAId}/submit", null)).StatusCode);

        var concurrentApprovals = await Task.WhenAll(
            admin.PostAsJsonAsync($"/api/admin/rental-applications/{appAId}/approve", new { reason = "Təsdiq" }),
            admin.PostAsJsonAsync($"/api/admin/rental-applications/{appAId}/approve", new { reason = "Təsdiq" }));
        Assert.Single(concurrentApprovals, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(concurrentApprovals, x => x.StatusCode == HttpStatusCode.Conflict);
        var reviewedA = await Read(await admin.GetAsync($"/api/admin/rental-applications/{appAId}"));
        Assert.Equal("Məhsul növbəli əkiləcək.", reviewedA.GetProperty("additionalInformationResponse").GetString());

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/admin/rental-applications/{appBId}/under-review", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/rental-applications/{appBId}/approve", new { reason = "Təsdiq" })).StatusCode);

        var leaseA = new { agreementReference = "LEASE-2026-TEST-A", startsAt = "2026-11-01T00:00:00Z", endsAt = "2027-10-31T23:59:59Z" };
        var leaseB = new { agreementReference = "LEASE-2026-TEST-B", startsAt = "2026-11-01T00:00:00Z", endsAt = "2027-10-31T23:59:59Z" };
        var concurrentLeases = await Task.WhenAll(
            admin.PostAsJsonAsync($"/api/admin/rental-applications/{appAId}/finalize-lease", leaseA),
            admin.PostAsJsonAsync($"/api/admin/rental-applications/{appBId}/finalize-lease", leaseB));
        Assert.Single(concurrentLeases, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(concurrentLeases, x => x.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.Anonymous().GetAsync($"/api/rentals/{listingId}")).StatusCode);

        await using var db = factory.NewDbContext();
        Assert.Equal(1, await db.RentalLeases.CountAsync(x => x.ListingId == listingId && x.EndedAt == null));
        Assert.True(await db.RentalAudit.AnyAsync(x => x.Action == "lease_finalized"));
    }

    [Fact]
    public async Task Rental_migration_is_additive_and_legacy_tables_remain_in_the_model()
    {
        await using var db = factory.NewDbContext();
        var applied = await db.Database.GetAppliedMigrationsAsync();
        Assert.Contains(applied, x => x.EndsWith("_AdminManagedRentals", StringComparison.Ordinal));
        Assert.Equal("lands", db.Model.FindEntityType(typeof(QarabagInvestmentPortal.Api.Features.Lands.Land))!.GetTableName());
        Assert.Equal("proposals", db.Model.FindEntityType(typeof(QarabagInvestmentPortal.Api.Features.Proposals.Proposal))!.GetTableName());
        var names = await db.Database.SqlQueryRaw<string>("SELECT table_name AS \"Value\" FROM information_schema.tables WHERE table_schema = 'portal'").ToListAsync();
        Assert.Contains("rental_listings", names);
        Assert.Contains("lands", names);
        Assert.Contains("proposals", names);
    }

    private static async Task<string> CreatePublishedListing(HttpClient admin, string title)
    {
        var create = await admin.PostAsJsonAsync("/api/admin/rentals", Listing(title));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await Read(create);
        var id = created.GetProperty("id").GetString()!;

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("authority"), "kind");
        form.Add(File(Pdf, "application/pdf"), "documents", "authority.pdf");
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/admin/rentals/{id}/documents", form)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/admin/rentals/{id}/publish", null)).StatusCode);
        return id;
    }

    private static object Listing(string title) => new
    {
        propertyType = "LAND", title, description = "İcarə üçün kənd təsərrüfatı sahəsi.", ownerCategory = "PRIVATE",
        legalDesignation = "Kənd təsərrüfatı təyinatlı", region = "Ağdam", address = "Ağdam rayonu", area = 25,
        areaUnit = "ha", permittedUse = "Bitkiçilik", rentAmount = 1000, currency = "AZN", paymentPeriod = "month",
        minimumLeaseMonths = 6, maximumLeaseMonths = 36, depositAmount = 500, additionalCharges = "", infrastructure = "Suvarma",
        photoUrls = Array.Empty<string>(), authorityBasis = "Mülkiyyətçinin icarəyə vermək səlahiyyəti", authorityReference = "DOC-1",
        authorityReviewed = true, procedure = "DIRECT", procedureReference = "", procedureNotes = "Hüquqşünas tərəfindən yoxlanılıb.",
        eligibilityRules = "Elan üzrə şərtlər.",
        documentRequirements = new[] { new { applicantScope = "ALL", kind = "identity", label = "Şəxsiyyəti təsdiqləyən sənəd", isRequired = true } },
    };

    private static async Task SaveProfile(HttpClient user, string fullName, string phone)
    {
        var result = await user.PostAsJsonAsync("/api/applicant/profile", new
        {
            applicantType = "INDIVIDUAL", foreignKind = (string?)null, fullLegalName = fullName,
            citizenship = "", countryOfResidence = "", residenceAddress = "", idDocumentType = "", idDocumentNumber = "", fin = "",
            legalName = "", legalForm = "", countryOfIncorporation = "", registrationIdentifier = "", taxIdentifier = "", registeredAddress = "",
            contactPhone = phone, contactEmail = "", contactAddress = "", representativeName = "", representativePosition = "", authorityToAct = "",
            consentToProcess = true,
        });
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
    }

    private static async Task<JsonElement> CreateAndSubmitApplication(HttpClient user, string listingId)
    {
        var create = await user.PostAsJsonAsync("/api/rental-applications", new { listingId, intendedUse = "Taxıl və növbəli əkin", proposedLeaseMonths = 12, message = "" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var app = await Read(create);
        var id = app.GetProperty("id").GetString()!;
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("identity"), "kinds");
        form.Add(File(Pdf, "application/pdf"), "documents", "identity.pdf");
        Assert.Equal(HttpStatusCode.OK, (await user.PostAsync($"/api/rental-applications/{id}/documents", form)).StatusCode);
        var submit = await user.PostAsync($"/api/rental-applications/{id}/submit", null);
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
        return await Read(submit);
    }

    private static ByteArrayContent File(byte[] bytes, string type)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(type);
        return content;
    }

    private static Task<JsonElement> Read(HttpResponseMessage response) => response.Content.ReadFromJsonAsync<JsonElement>(PortalFactory.Json)!;

    private static async Task<List<JsonElement>> ReadArray(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await Read(response)).EnumerateArray().ToList();
    }
}
