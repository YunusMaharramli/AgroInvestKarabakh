using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Admin;
using QarabagInvestmentPortal.Api.Features.Favorites;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Infrastructure.Import;

/// <summary>
/// One-time import of the old agroinvest_db.json into PostgreSQL. Keeps every id and relationship.
/// Mapping: ENTREPRENEUR → USER; land → approved land profile (no owner = admin-managed);
/// competition → ADMIN investment opportunity; application → proposal (open unless it was decided);
/// status history and the old "information requests" → proposal history; documents → private files
/// (the demo data only had file names, so a small placeholder PDF is written for each).
/// Runs once: an import_runs row marks it done. The JSON file is not changed.
/// </summary>
public sealed class LegacyJsonImporter(AppDbContext db, PrivateFileStorage storage, ILogger<LegacyJsonImporter> log)
{
    public const string SourceName = "legacy-json";

    public sealed record ImportResult(bool Skipped, string Summary);

    public async Task<ImportResult> ImportAsync(string path, CancellationToken ct)
    {
        if (await db.ImportRuns.AnyAsync(r => r.Source == SourceName, ct))
            return new ImportResult(true, "Legacy data was already imported; nothing to do.");
        if (!File.Exists(path)) throw new FileNotFoundException("Legacy JSON file not found.", path);

        var root = JsonNode.Parse(await File.ReadAllTextAsync(path, ct))?.AsObject()
            ?? throw new InvalidDataException("The legacy JSON file is empty or invalid.");
        static IEnumerable<JsonObject> T(JsonObject r, string name) => (r[name] as JsonArray ?? new JsonArray()).OfType<JsonObject>();

        var counts = new Dictionary<string, int>();
        void Count(string key) => counts[key] = counts.GetValueOrDefault(key) + 1;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var now = DateTimeOffset.UtcNow;

        // ---- users + profiles
        var users = new Dictionary<string, User>();
        foreach (var u in T(root, "users"))
        {
            var rawPhone = S(u, "phone");
            var user = new User
            {
                Id = S(u, "id"),
                FirstName = S(u, "firstName"),
                LastName = S(u, "lastName"),
                Email = S(u, "email").Trim().ToLowerInvariant(),
                Phone = AzerbaijaniPhone.TryNormalize(rawPhone, out var phone) ? phone : (rawPhone.Length > 0 ? rawPhone : null),
                Role = S(u, "role") == "ADMIN" ? UserRole.Admin : UserRole.User,
                PasswordHash = S(u, "passwordHash"),
                EmailConfirmedAt = now,
                CreatedAt = D(u, "createdAt") ?? now,
                UpdatedAt = D(u, "updatedAt") ?? now,
            };
            if (user.Id.Length == 0 || user.Email.Length == 0 || users.Values.Any(x => x.Email == user.Email))
            {
                log.LogWarning("Skipped user {Id} (missing id/email or duplicate email)", user.Id);
                continue;
            }
            users[user.Id] = user;
            db.Users.Add(user);
            Count("users");
        }
        foreach (var p in T(root, "entrepreneurProfiles"))
        {
            if (!users.ContainsKey(S(p, "userId")) || db.UserProfiles.Local.Any(x => x.UserId == S(p, "userId"))) continue;
            db.UserProfiles.Add(new UserProfile
            {
                Id = S(p, "id"),
                UserId = S(p, "userId"),
                CompanyName = S(p, "companyName"),
                TaxIdentificationNumber = S(p, "taxIdentificationNumber"),
                BusinessActivity = S(p, "businessActivity"),
                CreatedAt = D(p, "createdAt") ?? now,
                UpdatedAt = D(p, "updatedAt") ?? now,
            });
            Count("profiles");
        }

        var admin = users.Values.FirstOrDefault(u => u.Role == UserRole.Admin);
        var adminPhone = admin?.Phone is { } ap && AzerbaijaniPhone.TryNormalize(ap, out var nap) ? nap : admin?.Phone ?? string.Empty;

        // ---- lands (all legacy land is admin-managed and already published)
        var lands = new HashSet<string>();
        foreach (var l in T(root, "lands"))
        {
            var land = new Land
            {
                Id = S(l, "id"),
                OwnerId = null,
                Title = S(l, "title"),
                Region = S(l, "region"),
                Description = S(l, "description"),
                AreaHectares = N(l, "areaHectares"),
                AgricultureType = LandUseCatalog.Find(S(l, "agricultureType"))?.Name ?? S(l, "agricultureType"),
                LandUse = LandUseCatalog.Find(S(l, "agricultureType"))?.Key ?? string.Empty,
                Latitude = N(l, "latitude"),
                Longitude = N(l, "longitude"),
                IntendedUse = S(l, "intendedUse"),
                EstimatedInvestmentRequirement = (decimal)N(l, "estimatedInvestmentRequirement"),
                ImageUrl = S(l, "imageUrl"),
                SoilQuality = NullIfEmpty(S(l, "soilQuality")),
                WaterSupply = NullIfEmpty(S(l, "waterSupply")),
                Status = S(l, "status") is "ARCHIVED" or "DRAFT" ? LandStatus.Rejected : LandStatus.Approved,
                CreatedAt = D(l, "createdAt") ?? now,
                UpdatedAt = D(l, "updatedAt") ?? now,
            };
            if (land.Id.Length == 0 || !lands.Add(land.Id)) continue;
            db.Lands.Add(land);
            Count("lands");
        }

        // ---- competitions → admin investment opportunities
        var opportunities = new Dictionary<string, InvestmentOpportunity>();
        foreach (var c in T(root, "competitions"))
        {
            if (!lands.Contains(S(c, "landId"))) { log.LogWarning("Skipped competition {Id}: unknown land", S(c, "id")); continue; }
            var status = S(c, "status") switch
            {
                "ACTIVE" => OpportunityStatus.Active,
                "DRAFT" => OpportunityStatus.Draft,
                _ => OpportunityStatus.Closed,
            };
            if (status == OpportunityStatus.Active && opportunities.Values.Any(o => o.LandId == S(c, "landId") && o.Status == OpportunityStatus.Active))
            {
                log.LogWarning("Competition {Id}: land already has an active listing, imported as closed", S(c, "id"));
                status = OpportunityStatus.Closed;
            }
            var opp = new InvestmentOpportunity
            {
                Id = S(c, "id"),
                LandId = S(c, "landId"),
                Source = OpportunitySource.Admin,
                Title = S(c, "title"),
                Description = S(c, "description"),
                EligibilityConditions = Strings(c["eligibilityConditions"]),
                RequiredDocuments = Strings(c["requiredDocuments"]),
                OpeningDate = D(c, "openingDate"),
                ApplicationDeadline = D(c, "applicationDeadline"),
                Status = status,
                ContactPhone = adminPhone,
                CreatedById = admin?.Id,
                CreatedAt = D(c, "createdAt") ?? now,
                UpdatedAt = D(c, "updatedAt") ?? now,
                ClosedAt = status == OpportunityStatus.Closed ? D(c, "updatedAt") ?? now : null,
            };
            opportunities[opp.Id] = opp;
            db.Opportunities.Add(opp);
            Count("opportunities");
        }

        // ---- applications → proposals
        var proposals = new Dictionary<string, Proposal>();
        foreach (var a in T(root, "applications"))
        {
            if (!users.TryGetValue(S(a, "userId"), out var investor) || !opportunities.TryGetValue(S(a, "competitionId"), out var opp))
            {
                log.LogWarning("Skipped application {Id}: unknown user or competition", S(a, "id"));
                continue;
            }
            if (proposals.Values.Any(p => p.InvestorId == investor.Id && p.OpportunityId == opp.Id))
            {
                log.LogWarning("Skipped application {Id}: duplicate proposal by the same investor", S(a, "id"));
                continue;
            }
            var decided = S(a, "status") == "DECIDED";
            var outcome = S(a, "decisionOutcome");
            var proposal = new Proposal
            {
                Id = S(a, "id"),
                ReferenceNumber = S(a, "referenceNumber") is { Length: > 0 } r ? r : $"AGRO-LEGACY-{S(a, "id")}",
                OpportunityId = opp.Id,
                InvestorId = investor.Id,
                ProposedInvestmentAmount = (decimal)N(a, "proposedInvestmentAmount"),
                BusinessPlanSummary = S(a, "businessPlanSummary"),
                EstimatedImplementationPeriod = S(a, "estimatedImplementationPeriod"),
                ContactPhone = investor.Phone ?? string.Empty,
                Status = decided && outcome == "APPROVED" && opp.WinnerProposalId is null ? ProposalStatus.Selected
                    : decided ? ProposalStatus.NotSelected : ProposalStatus.Open,
                SubmittedAt = D(a, "submittedAt") ?? now,
                UpdatedAt = D(a, "updatedAt") ?? now,
                DecidedAt = decided ? D(a, "updatedAt") : null,
            };
            if (proposal.Status == ProposalStatus.Selected)
            {
                opp.WinnerProposalId = proposal.Id;
                opp.Status = OpportunityStatus.Closed;
                opp.ClosedAt ??= proposal.DecidedAt ?? now;
            }
            if (!string.IsNullOrWhiteSpace(S(a, "adminDecisionNote")))
                proposal.History.Add(History(proposal.Id, "NOTE", "Köhnə sistem", $"İnzibatçı qeydi: {S(a, "adminDecisionNote")}", proposal.UpdatedAt));
            proposals[proposal.Id] = proposal;
            db.Proposals.Add(proposal);
            Count("proposals");
        }
        // A listing that got a winner in the old system: everyone else is "not selected".
        foreach (var p in proposals.Values.Where(p => p.Status == ProposalStatus.Open && opportunities[p.OpportunityId].WinnerProposalId is not null))
            p.Status = ProposalStatus.NotSelected;

        // ---- history (status history + old information requests)
        foreach (var h in T(root, "statusHistory"))
        {
            if (!proposals.ContainsKey(S(h, "applicationId"))) continue;
            db.ProposalHistory.Add(new ProposalHistoryEntry
            {
                Id = S(h, "id"),
                ProposalId = S(h, "applicationId"),
                Status = S(h, "newStatus"),
                ChangedBy = S(h, "changedBy"),
                Comment = S(h, "comment"),
                CreatedAt = D(h, "createdAt") ?? now,
            });
            Count("history");
        }
        foreach (var r in T(root, "infoRequests"))
        {
            if (!proposals.ContainsKey(S(r, "applicationId"))) continue;
            db.ProposalHistory.Add(new ProposalHistoryEntry
            {
                Id = S(r, "id"),
                ProposalId = S(r, "applicationId"),
                Status = "INFORMATION_REQUESTED",
                ChangedBy = S(r, "requestedBy"),
                Comment = $"Əlavə məlumat sorğusu (köhnə sistem): {S(r, "message")}",
                CreatedAt = D(r, "createdAt") ?? now,
            });
            if (S(r, "response").Length > 0)
                db.ProposalHistory.Add(History(S(r, "applicationId"), "INFORMATION_PROVIDED", "İnvestor", $"Cavab: {S(r, "response")}", D(r, "respondedAt") ?? now));
            Count("history");
        }

        // ---- documents → private files
        var writtenFiles = new List<string>();
        foreach (var d in T(root, "documents"))
        {
            if (!proposals.ContainsKey(S(d, "applicationId"))) continue;
            var id = S(d, "id");
            var fileName = S(d, "fileName") is { Length: > 0 } f ? f : $"{id}.pdf";
            var (bytes, type, ext) = DocumentContent(S(d, "fileData"), fileName);
            var key = await storage.SaveBytesAsync($"proposals/{S(d, "applicationId")}/{id}{ext}", bytes, ct);
            writtenFiles.Add(key);
            db.ProposalDocuments.Add(new ProposalDocument
            {
                Id = id,
                ProposalId = S(d, "applicationId"),
                FileName = fileName,
                ContentType = type,
                SizeBytes = bytes.Length,
                StorageKey = key,
                UploadedAt = D(d, "uploadedAt") ?? now,
            });
            Count("documents");
        }

        // ---- favorites, notifications, integration logs
        foreach (var f in T(root, "favorites"))
        {
            if (!users.ContainsKey(S(f, "userId")) || !lands.Contains(S(f, "landId"))) continue;
            if (db.Favorites.Local.Any(x => x.UserId == S(f, "userId") && x.LandId == S(f, "landId"))) continue;
            db.Favorites.Add(new Favorite { Id = S(f, "id"), UserId = S(f, "userId"), LandId = S(f, "landId"), CreatedAt = D(f, "createdAt") ?? now });
            Count("favorites");
        }
        foreach (var n in T(root, "notifications"))
        {
            if (!users.ContainsKey(S(n, "userId"))) continue;
            db.Notifications.Add(new Notification
            {
                Id = S(n, "id"),
                UserId = S(n, "userId"),
                Title = S(n, "title"),
                Message = S(n, "message"),
                IsRead = n["isRead"]?.GetValueKind() == JsonValueKind.True,
                CreatedAt = D(n, "createdAt") ?? now,
            });
            Count("notifications");
        }
        foreach (var l in T(root, "integrationLogs"))
        {
            db.IntegrationLogs.Add(new IntegrationLog
            {
                Id = S(l, "id"),
                IntegrationType = S(l, "integrationType"),
                Status = S(l, "status"),
                RequestPayload = l["requestPayload"]?.ToJsonString() ?? "{}",
                ResponsePayload = l["responsePayload"]?.ToJsonString() ?? "{}",
                CreatedAt = D(l, "createdAt") ?? now,
            });
            Count("integrationLogs");
        }

        var summary = string.Join(", ", counts.Select(kv => $"{kv.Key}: {kv.Value}"));
        db.ImportRuns.Add(new ImportRun { Id = Ids.New("import"), Source = SourceName, ImportedAt = now, Summary = $"{path} → {summary}" });

        try
        {
            await db.SaveChangesAsync(ct);

            // New proposal numbers continue after the highest imported one.
            var maxNumber = proposals.Values
                .Select(p => int.TryParse(p.ReferenceNumber.Split('-').Last(), NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
                .DefaultIfEmpty(0).Max();
            await db.Database.ExecuteSqlRawAsync(SetSequenceSql, [Math.Max(maxNumber, 1), maxNumber > 0], ct);

            await tx.CommitAsync(ct);
        }
        catch
        {
            foreach (var key in writtenFiles) storage.TryDelete(key);
            throw;
        }
        return new ImportResult(false, summary);
    }

    private const string SetSequenceSql = "SELECT setval('portal.proposal_reference_seq', {0}, {1})";

    // ---- helpers

    private static string S(JsonObject? o, string name) =>
        o?[name] is JsonValue v && v.GetValueKind() == JsonValueKind.String ? v.GetValue<string>() : o?[name]?.ToString() ?? string.Empty;

    private static double N(JsonObject? o, string name) =>
        o?[name] is JsonValue v && v.TryGetValue<double>(out var d) ? d
        : double.TryParse(o?[name]?.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;

    private static DateTimeOffset? D(JsonObject? o, string name) =>
        DateTimeOffset.TryParse(S(o, name), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d) ? d.ToUniversalTime() : null;

    private static List<string> Strings(JsonNode? node) =>
        node is JsonArray arr ? arr.Select(x => x?.ToString() ?? "").Where(x => x.Length > 0).ToList() : [];

    private static string? NullIfEmpty(string s) => s.Length == 0 ? null : s;

    private static ProposalHistoryEntry History(string proposalId, string status, string by, string comment, DateTimeOffset at) =>
        new() { Id = Ids.New("hist"), ProposalId = proposalId, Status = status, ChangedBy = by, Comment = comment, CreatedAt = at };

    /// <summary>Use the real bytes when the legacy file data is complete; otherwise write a labelled placeholder PDF.</summary>
    internal static (byte[] Bytes, string ContentType, string Extension) DocumentContent(string fileData, string fileName)
    {
        var data = fileData.Contains(',', StringComparison.Ordinal) && fileData.StartsWith("data:", StringComparison.Ordinal)
            ? fileData[(fileData.IndexOf(',', StringComparison.Ordinal) + 1)..] : fileData;
        if (data.Length > 0 && !data.EndsWith("...", StringComparison.Ordinal))
        {
            try
            {
                var bytes = Convert.FromBase64String(data);
                if (PrivateFileStorage.DetectType(bytes) is { } t) return (bytes, t.ContentType, t.Extension);
            }
            catch (FormatException) { /* not real data: fall through to the placeholder */ }
        }
        return (PlaceholderPdf($"Demo sened (kohne sistemden kocurulub): {ToAscii(fileName)}"), "application/pdf", ".pdf");
    }

    private static string ToAscii(string s)
    {
        var sb = new StringBuilder();
        foreach (var c in s.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(c switch { 'ə' => 'e', 'Ə' => 'E', 'ı' => 'i', '(' or ')' or '\\' => ' ', _ => c < 128 ? c : '?' });
        }
        return sb.ToString();
    }

    /// <summary>A minimal one-page PDF with one line of text.</summary>
    internal static byte[] PlaceholderPdf(string text)
    {
        var content = $"BT /F1 14 Tf 50 780 Td ({text}) Tj ET";
        var objects = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            $"<< /Length {content.Length} >>\nstream\n{content}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        };
        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Length; i++)
        {
            offsets.Add(sb.Length);
            sb.Append(CultureInfo.InvariantCulture, $"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
        }
        var xref = sb.Length;
        sb.Append(CultureInfo.InvariantCulture, $"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append(CultureInfo.InvariantCulture, $"{o:D10} 00000 n \n");
        sb.Append(CultureInfo.InvariantCulture, $"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }
}
