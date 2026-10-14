using System.Globalization;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>Owner side: submit land with ownership documents, add documents when asked, see "my lands".</summary>
public sealed class LandSubmissionService(
    AppDbContext db, PrivateFileStorage storage, NotificationService notifications, OpportunityQueries opportunities, TimeProvider clock)
{
    public static readonly string[] AgricultureTypes = ["Əkinçilik", "Bağçılıq", "İstixana təsərrüfatı", "Heyvandarlıq", "Arıçılıq"];

    // Azerbaijan's bounding box, to catch obviously wrong map points.
    private const double MinLat = 38.3, MaxLat = 41.95, MinLng = 44.7, MaxLng = 50.4;

    public async Task<Outcome<MyLandDto>> SubmitAsync(string ownerId, IFormCollection form, CancellationToken ct)
    {
        string F(string key) => form[key].ToString().Trim();
        static bool Num(string raw, out double value) =>
            double.TryParse(raw.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out value);

        var title = F("title");
        var region = F("region");
        var type = F("agricultureType");
        if (title.Length is 0 or > 200) return Fail(400, "Sahənin adını yazın (ən çox 200 simvol).");
        if (region.Length is 0 or > 100) return Fail(400, "Rayonu seçin.");
        if (!AgricultureTypes.Contains(type)) return Fail(400, "Fəaliyyət növünü seçin.");
        if (!Num(F("areaHectares"), out var area) || area <= 0 || area > 100_000) return Fail(400, "Sahənin ölçüsünü hektarla düzgün yazın.");
        if (!Num(F("latitude"), out var lat) || !Num(F("longitude"), out var lng) || lat is < MinLat or > MaxLat || lng is < MinLng or > MaxLng)
            return Fail(400, "Sahənin yerini xəritədə seçin.");
        if (!Num(F("estimatedInvestmentRequirement"), out var investment) || investment < 0 || investment > 1_000_000_000)
            return Fail(400, "Lazım olan sərmayəni manatla yazın.");

        DateTimeOffset? deadline = null;
        if (F("applicationDeadline") is { Length: > 0 } rawDeadline)
        {
            if (!DateTimeOffset.TryParse(rawDeadline, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d))
                return Fail(400, "Son tarixi düzgün yazın.");
            if (d < clock.GetUtcNow()) return Fail(400, "Son tarix keçmişdə ola bilməz.");
            deadline = new DateTimeOffset(d.UtcDateTime.Date.AddDays(1).AddSeconds(-1), TimeSpan.Zero);
        }

        var owner = await db.Users.FirstOrDefaultAsync(u => u.Id == ownerId, ct);
        if (owner is null) return Fail(401, "Giriş tələb olunur.");

        // Listing contact phone: the owner's phone. Required in the form only if the owner has no valid phone yet.
        string contactPhone;
        if (AzerbaijaniPhone.TryNormalize(owner.Phone, out var existing)) contactPhone = existing;
        else if (AzerbaijaniPhone.TryNormalize(F("contactPhone"), out var given)) { contactPhone = given; owner.Phone = given; }
        else return Fail(400, string.IsNullOrEmpty(F("contactPhone")) ? "Əlaqə telefonunuzu yazın." : AzerbaijaniPhone.InvalidMessage);

        var files = form.Files.GetFiles("documents");
        if (files.Count == 0) return Fail(400, "Mülkiyyət sənədinin şəklini (JPG və ya PNG) yükləyin.");
        var (validated, fileError) = await PrivateFileStorage.ValidateAsync(files, FileRule.LandDocuments, ct);
        if (fileError is not null) return Fail(400, fileError);

        var now = clock.GetUtcNow();
        var land = new Land
        {
            Id = Ids.New("land"),
            OwnerId = ownerId,
            Title = title,
            Region = region,
            AgricultureType = type,
            AreaHectares = area,
            Latitude = lat,
            Longitude = lng,
            IntendedUse = Limit(F("intendedUse"), 500),
            Description = Limit(F("description"), 4000),
            EstimatedInvestmentRequirement = (decimal)investment,
            SoilQuality = NullIfEmpty(Limit(F("soilQuality"), 500)),
            WaterSupply = NullIfEmpty(Limit(F("waterSupply"), 500)),
            ImageUrl = string.Empty,
            Status = LandStatus.PendingReview,
            SubmittedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Lands.Add(land);

        // The listing is created now as DRAFT and becomes ACTIVE when an admin approves the land.
        db.Opportunities.Add(new InvestmentOpportunity
        {
            Id = Ids.New("opp"),
            LandId = land.Id,
            Source = OpportunitySource.Owner,
            Title = title,
            Description = land.Description,
            EligibilityConditions = Lines(F("eligibilityConditions")),
            RequiredDocuments = Lines(F("requiredDocuments")),
            ApplicationDeadline = deadline,
            Status = OpportunityStatus.Draft,
            ContactPhone = contactPhone,
            CreatedById = ownerId,
            CreatedAt = now,
            UpdatedAt = now,
        });

        var saved = await SaveDocumentsAsync(land, ownerId, validated, ct);
        await notifications.NotifyAdminsAsync("Yeni torpaq yoxlanılmalıdır",
            $"{owner.FullName} “{title}” ({region}) sahəsini yoxlamaya göndərdi.", ct);
        notifications.Notify(ownerId, "Torpağınız yoxlamaya göndərildi",
            $"“{title}” sahəniz qəbul edildi. İnzibatçı sənədləri yoxlayandan sonra sizə xəbər veriləcək.");

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            foreach (var key in saved) storage.TryDelete(key);
            throw;
        }

        return Outcome<MyLandDto>.Success((await GetMineAsync(ownerId, land.Id, ct))!);
    }

    /// <summary>Owner adds documents (usually after the admin asked for more). Sends the land back to review.</summary>
    public async Task<Outcome<MyLandDto>> AddDocumentsAsync(string ownerId, string landId, IFormCollection form, CancellationToken ct)
    {
        var land = await db.Lands.Include(l => l.Documents).FirstOrDefaultAsync(l => l.Id == landId, ct);
        if (land is null || land.OwnerId != ownerId) return Fail(404, "Torpaq sahəsi tapılmadı.");
        if (land.Status is LandStatus.Approved or LandStatus.Rejected)
            return Fail(400, "Bu sahə üçün yoxlama artıq başa çatıb.");

        var files = form.Files.GetFiles("documents");
        if (files.Count == 0) return Fail(400, "Ən azı bir sənəd şəkli (JPG və ya PNG) yükləyin.");
        if (land.Documents.Count + files.Count > 30) return Fail(400, "Bu sahə üçün çox sənəd yüklənib.");
        var (validated, fileError) = await PrivateFileStorage.ValidateAsync(files, FileRule.LandDocuments, ct);
        if (fileError is not null) return Fail(400, fileError);

        var now = clock.GetUtcNow();
        var wasRequested = land.Status == LandStatus.DocumentsRequested;
        land.Status = LandStatus.PendingReview;
        land.OwnerNote = NullIfEmpty(Limit(form["message"].ToString().Trim(), 2000));
        land.SubmittedAt = now;
        land.UpdatedAt = now;

        var saved = await SaveDocumentsAsync(land, ownerId, validated, ct);
        if (wasRequested)
            await notifications.NotifyAdminsAsync("Əlavə sənəd göndərildi", $"“{land.Title}” sahəsinin sahibi istənilən sənədləri göndərdi.", ct);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            foreach (var key in saved) storage.TryDelete(key);
            throw;
        }
        return Outcome<MyLandDto>.Success((await GetMineAsync(ownerId, land.Id, ct))!);
    }

    /// <summary>After a winner was chosen (or the listing closed), the owner can publish a new listing for the same approved land.</summary>
    public async Task<Outcome<MyLandDto>> ReopenAsync(string ownerId, string landId, CancellationToken ct)
    {
        var land = await db.Lands.FirstOrDefaultAsync(l => l.Id == landId, ct);
        if (land is null || land.OwnerId != ownerId) return Fail(404, "Torpaq sahəsi tapılmadı.");
        if (land.Status != LandStatus.Approved) return Fail(400, "Sahə hələ təsdiq olunmayıb.");
        if (await db.Opportunities.AnyAsync(o => o.LandId == landId && o.Status != OpportunityStatus.Closed, ct))
            return Fail(409, "Bu sahə üçün artıq açıq elan var.");

        var last = await db.Opportunities.Where(o => o.LandId == landId).OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct);
        var owner = await db.Users.FirstAsync(u => u.Id == ownerId, ct);
        var now = clock.GetUtcNow();
        db.Opportunities.Add(new InvestmentOpportunity
        {
            Id = Ids.New("opp"),
            LandId = landId,
            Source = OpportunitySource.Owner,
            Title = land.Title,
            Description = land.Description,
            EligibilityConditions = last?.EligibilityConditions ?? [],
            RequiredDocuments = last?.RequiredDocuments ?? [],
            Status = OpportunityStatus.Active,
            OpeningDate = now,
            ContactPhone = AzerbaijaniPhone.TryNormalize(owner.Phone, out var p) ? p : last?.ContactPhone ?? string.Empty,
            CreatedById = ownerId,
            CreatedAt = now,
            UpdatedAt = now,
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Fail(409, "Bu sahə üçün artıq açıq elan var.");
        }
        return Outcome<MyLandDto>.Success((await GetMineAsync(ownerId, landId, ct))!);
    }

    public async Task<List<MyLandDto>> ListMineAsync(string ownerId, CancellationToken ct)
    {
        var lands = await db.Lands.AsNoTracking().Include(l => l.Documents)
            .Where(l => l.OwnerId == ownerId).OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return await ToMyLandDtosAsync(lands, ownerId, ct);
    }

    public async Task<MyLandDto?> GetMineAsync(string ownerId, string landId, CancellationToken ct)
    {
        var land = await db.Lands.AsNoTracking().Include(l => l.Documents).FirstOrDefaultAsync(l => l.Id == landId && l.OwnerId == ownerId, ct);
        return land is null ? null : (await ToMyLandDtosAsync([land], ownerId, ct))[0];
    }

    private async Task<List<MyLandDto>> ToMyLandDtosAsync(List<Land> lands, string ownerId, CancellationToken ct)
    {
        var ids = lands.Select(l => l.Id).ToList();
        var opps = await db.Opportunities.AsNoTracking().Include(o => o.Land)
            .Where(o => ids.Contains(o.LandId)).OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        var latest = opps.GroupBy(o => o.LandId).Select(g => g.OrderByDescending(o => o.Status == OpportunityStatus.Active).ThenByDescending(o => o.CreatedAt).First()).ToList();
        var dtos = (await opportunities.ToDtosAsync(latest, new Viewer(ownerId, false), ct, includeLand: false)).ToDictionary(d => d.LandId);

        return lands.Select(l => new MyLandDto(
            LandDto.From(l, dtos.TryGetValue(l.Id, out var o) && o.Status == OpportunityStatus.Active),
            l.ReviewNote, l.OwnerNote, l.SubmittedAt, l.ReviewedAt,
            l.Documents.OrderBy(d => d.UploadedAt).Select(LandDocumentDto.From).ToList(),
            dtos.GetValueOrDefault(l.Id))).ToList();
    }

    private async Task<List<string>> SaveDocumentsAsync(Land land, string uploadedBy, List<ValidatedFile> files, CancellationToken ct)
    {
        var keys = new List<string>();
        var now = clock.GetUtcNow();
        foreach (var file in files)
        {
            var docId = Ids.New("ldoc");
            var key = await storage.SaveAsync($"lands/{land.Id}", docId, file, ct);
            keys.Add(key);
            db.LandDocuments.Add(new LandDocument
            {
                Id = docId,
                LandId = land.Id,
                FileName = Limit(Path.GetFileName(file.File.FileName), 255),
                ContentType = file.ContentType,
                SizeBytes = file.File.Length,
                StorageKey = key,
                UploadedById = uploadedBy,
                UploadedAt = now,
            });
        }
        return keys;
    }

    private static Outcome<MyLandDto> Fail(int status, string message) => Outcome<MyLandDto>.Fail(status, message);
    private static string Limit(string value, int max) => value.Length <= max ? value : value[..max];
    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;

    private static List<string> Lines(string raw) =>
        raw.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.Length > 0).Select(x => Limit(x, 300)).Take(20).ToList();
}
