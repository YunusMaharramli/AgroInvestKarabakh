using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Import;

namespace QarabagInvestmentPortal.IntegrationTests;

[Collection(PortalCollection.Name)]
public sealed class LegacyImportTests(PortalFactory factory)
{
    private const string Legacy = """
        {
          "users": [
            { "id": "usr-legacy-admin", "firstName": "Tural", "lastName": "M", "email": "legacy-admin@agroinvest.test", "phone": "+994 12 498 70 00", "role": "ADMIN", "passwordHash": "$2a$10$abcdefghijklmnopqrstuuJ6s9rQ5kQ7oG2b2nGkq8mN1Z5o6r0Wi", "createdAt": "2026-01-10T09:00:00Z", "updatedAt": "2026-01-10T09:00:00Z" },
            { "id": "usr-legacy-1", "firstName": "Rəşad", "lastName": "Ə", "email": "legacy-1@agroinvest.test", "phone": "050 555 66 77", "role": "ENTREPRENEUR", "passwordHash": "x", "createdAt": "2026-01-15T11:30:00Z", "updatedAt": "2026-01-15T11:30:00Z" }
          ],
          "entrepreneurProfiles": [ { "id": "prof-legacy-1", "userId": "usr-legacy-1", "companyName": "Aqro", "taxIdentificationNumber": "1", "businessActivity": "Taxıl" } ],
          "lands": [
            { "id": "land-legacy-1", "title": "Köhnə sahə", "region": "Ağdam", "description": "d", "areaHectares": 250, "agricultureType": "Əkinçilik", "latitude": 39.99, "longitude": 46.93, "intendedUse": "Buğda", "estimatedInvestmentRequirement": 420000, "imageUrl": "/x.jpg", "status": "PUBLISHED" },
            { "id": "land-legacy-2", "title": "Elansız sahə", "region": "Füzuli", "description": "d", "areaHectares": 45, "agricultureType": "Bağçılıq", "latitude": 39.6, "longitude": 47.1, "intendedUse": "Nar", "estimatedInvestmentRequirement": 100000, "imageUrl": "/y.jpg", "status": "PUBLISHED" }
          ],
          "competitions": [ { "id": "comp-legacy-1", "landId": "land-legacy-1", "title": "Ağdam müsabiqəsi", "description": "d", "eligibilityConditions": ["Təcrübə"], "requiredDocuments": ["Biznes plan"], "openingDate": "2026-01-20T00:00:00Z", "applicationDeadline": "2099-12-31T23:59:59Z", "status": "ACTIVE" } ],
          "applications": [ { "id": "app-legacy-1", "referenceNumber": "AGRO-2026-0041", "userId": "usr-legacy-1", "competitionId": "comp-legacy-1", "proposedInvestmentAmount": 480000, "businessPlanSummary": "Plan", "estimatedImplementationPeriod": "18 ay", "status": "ADDITIONAL_INFORMATION_REQUIRED", "decisionOutcome": "NONE", "submittedAt": "2026-02-10T14:20:00Z", "updatedAt": "2026-02-12T10:00:00Z" } ],
          "statusHistory": [ { "id": "hist-legacy-1", "applicationId": "app-legacy-1", "previousStatus": "RECEIVED", "newStatus": "RECEIVED", "changedBy": "Sistem", "comment": "Qəbul edildi", "createdAt": "2026-02-10T14:20:00Z" } ],
          "documents": [ { "id": "doc-legacy-1", "applicationId": "app-legacy-1", "fileName": "plan.pdf", "mimeType": "application/pdf", "fileSize": 100, "uploadedAt": "2026-02-10T14:15:00Z", "fileData": "JVBERi0xLjQKJcTl8uXr..." } ],
          "favorites": [ { "id": "fav-legacy-1", "userId": "usr-legacy-1", "landId": "land-legacy-2", "createdAt": "2026-01-22T10:00:00Z" } ],
          "notifications": [ { "id": "notif-legacy-1", "userId": "usr-legacy-1", "title": "Salam", "message": "m", "isRead": true, "createdAt": "2026-01-22T10:00:00Z" } ],
          "infoRequests": [ { "id": "req-legacy-1", "applicationId": "app-legacy-1", "requestedBy": "Tural", "message": "Arayış göndərin", "status": "PENDING", "createdAt": "2026-02-12T10:00:00Z" } ],
          "integrationLogs": [ { "id": "log-legacy-1", "integrationType": "EKTIS", "status": "SUCCESS", "requestPayload": { "a": 1 }, "responsePayload": { "b": 2 }, "createdAt": "2026-02-01T00:00:00Z" } ]
        }
        """;

    [Fact]
    public async Task Imports_once_keeping_ids_and_relationships()
    {
        var path = Path.Combine(Path.GetTempPath(), $"legacy-{Guid.NewGuid():N}.json");
        await File.WriteAllTextAsync(path, Legacy);
        try
        {
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                var importer = scope.ServiceProvider.GetRequiredService<LegacyJsonImporter>();
                // The import marker is global: clear it so this test is independent of the order of tests.
                var db = scope.ServiceProvider.GetRequiredService<QarabagInvestmentPortal.Api.Infrastructure.Persistence.AppDbContext>();
                await db.ImportRuns.Where(r => r.Source == LegacyJsonImporter.SourceName).ExecuteDeleteAsync();

                var first = await importer.ImportAsync(path, CancellationToken.None);
                Assert.False(first.Skipped);
            }
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                var second = await scope.ServiceProvider.GetRequiredService<LegacyJsonImporter>().ImportAsync(path, CancellationToken.None);
                Assert.True(second.Skipped);
            }

            await using var check = factory.NewDbContext();
            var user = await check.Users.Include(u => u.Profile).SingleAsync(u => u.Id == "usr-legacy-1");
            Assert.Equal(UserRole.User, user.Role);
            Assert.Equal("+994 50 555 66 77", user.Phone);
            Assert.Equal("prof-legacy-1", user.Profile!.Id);

            var opp = await check.Opportunities.SingleAsync(o => o.Id == "comp-legacy-1");
            Assert.Equal(OpportunitySource.Admin, opp.Source);
            Assert.Equal(OpportunityStatus.Active, opp.Status);
            Assert.Equal("land-legacy-1", opp.LandId);
            Assert.Equal("+994 12 498 70 00", opp.ContactPhone);
            Assert.False(await check.Opportunities.AnyAsync(o => o.LandId == "land-legacy-2")); // lands without a competition stay without a listing

            var proposal = await check.Proposals.Include(p => p.Documents).Include(p => p.History).SingleAsync(p => p.Id == "app-legacy-1");
            Assert.Equal("AGRO-2026-0041", proposal.ReferenceNumber);
            Assert.Equal(ProposalStatus.Open, proposal.Status);
            Assert.Equal("doc-legacy-1", Assert.Single(proposal.Documents).Id);
            Assert.Contains(proposal.History, h => h.Id == "hist-legacy-1");
            Assert.Contains(proposal.History, h => h.Id == "req-legacy-1" && h.Comment.Contains("Arayış göndərin", StringComparison.Ordinal));

            Assert.True(await check.Favorites.AnyAsync(f => f.Id == "fav-legacy-1" && f.LandId == "land-legacy-2"));
            Assert.True(await check.Notifications.AnyAsync(n => n.Id == "notif-legacy-1" && n.IsRead));
            Assert.True(await check.IntegrationLogs.AnyAsync(l => l.Id == "log-legacy-1"));

            // New proposal numbers continue after the imported ones.
            var next = await check.Database.SqlQueryRaw<long>("SELECT nextval('portal.proposal_reference_seq') AS \"Value\"").SingleAsync();
            Assert.True(next > 41);
        }
        finally
        {
            File.Delete(path);
        }
    }
}
