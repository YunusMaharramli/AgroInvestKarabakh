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
    /// <summary>Names of the 25 land-use types (LandUseCatalog). The form may send the key ("crops") or the name.</summary>
    public static IReadOnlyList<string> AgricultureTypes => LandUseCatalog.All.Select(t => t.Name).ToList();

    // Azerbaijan's bounding box, to catch obviously wrong map points.
    private const double MinLat = 38.3, MaxLat = 41.95, MinLng = 44.7, MaxLng = 50.4;

    public Task<Outcome<MyLandDto>> SubmitAdminAsync(string adminId, IFormCollection form, CancellationToken ct) =>
        SubmitAsync(adminId, form, ct, adminManaged: true);

    public async Task<Outcome<MyLandDto>> SubmitAsync(string ownerId, IFormCollection form, CancellationToken ct, bool adminManaged = false)
    {
        string F(string key) => form[key].ToString().Trim();
        static bool Num(string raw, out double value) =>
            double.TryParse(raw.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out value);

        var title = F("title");
        var region = F("region");
        if (title.Length is 0 or > 200) return Fail(400, "Sahənin adını yazın (ən çox 200 simvol).");
        if (region.Length is 0 or > 100) return Fail(400, "Rayonu seçin.");

        // Land-use type + common core + type-specific inputs. All optional except the type;
        // deal-breakers only warn (the admin sees them in the review queue).
        var (input, inputError) = LandProfileParser.FromForm(form);
        if (inputError is not null) return Fail(400, inputError);
        var (profile, profileError) = LandProfileParser.Parse(input!);
        if (profileError is not null) return Fail(400, profileError);
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
        var (photos, photoError) = await PrivateFileStorage.ValidateAsync(form.Files.GetFiles("photos"), FileRule.LandPhotos, ct);
        if (photoError is not null) return Fail(400, photoError);

        var now = clock.GetUtcNow();
        var land = new Land
        {
            Id = Ids.New("land"),
            OwnerId = adminManaged ? null : ownerId,
            OwnershipType = adminManaged ? LandOwnershipType.State : LandOwnershipType.Private,
            EntrySource = adminManaged ? LandEntrySource.Admin : LandEntrySource.Owner,
            Verification = adminManaged ? LandVerificationStatus.AdminEntered : LandVerificationStatus.EvidencePending,
            CreatedById = ownerId,
            UpdatedById = ownerId,
            Title = title,
            Region = region,
            AreaHectares = area,
            Latitude = lat,
            Longitude = lng,
            IntendedUse = Limit(F("intendedUse"), 500),
            Description = Limit(F("description"), 4000),
            EstimatedInvestmentRequirement = (decimal)investment,
            SoilQuality = NullIfEmpty(Limit(F("soilQuality"), 500)),
            WaterSupply = NullIfEmpty(Limit(F("waterSupply"), 500)),
            ImageUrl = string.Empty,
            Status = adminManaged ? LandStatus.Approved : LandStatus.PendingReview,
            SubmittedAt = now,
            ReviewedAt = adminManaged ? now : null,
            ReviewedById = adminManaged ? ownerId : null,
            CreatedAt = now,
            UpdatedAt = now,
        };
        profile!.ApplyTo(land);
        db.Lands.Add(land);

        // Owner listings await ministry review; ministry-managed state land is published immediately.
        db.Opportunities.Add(new InvestmentOpportunity
        {
            Id = Ids.New("opp"),
            LandId = land.Id,
            Source = adminManaged ? OpportunitySource.Admin : OpportunitySource.Owner,
            Title = title,
            Description = land.Description,
            EligibilityConditions = Lines(F("eligibilityConditions")),
            RequiredDocuments = Lines(F("requiredDocuments")),
            ApplicationDeadline = deadline,
            Status = adminManaged ? OpportunityStatus.Active : OpportunityStatus.Draft,
            OpeningDate = adminManaged ? now : null,
            ContactPhone = contactPhone,
            CreatedById = ownerId,
            CreatedAt = now,
            UpdatedAt = now,
        });

        var saved = await SaveDocumentsAsync(land, ownerId, validated, ct);
        saved.AddRange(await SavePhotosAsync(land, photos, ct));
        if (!adminManaged)
        {
            var check = LandSuitability.Evaluate(profile.Type, profile.ToFacts(photos.Count));
            var warning = check.Level == SuitabilityLevel.Unsuitable ? $" Diqqət: {LandSuitability.Summary(check)}." : "";
            await notifications.NotifyAdminsAsync("Yeni torpaq yoxlanılmalıdır",
                $"{owner.FullName} “{title}” ({region}, {profile.Type.Name}) sahəsini yoxlamaya göndərdi.{warning}", ct);
            notifications.Notify(ownerId, "Torpağınız yoxlamaya göndərildi",
                $"“{title}” sahəniz qəbul edildi. Nazirlik sənədləri yoxlayandan sonra sizə xəbər veriləcək.");
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            foreach (var key in saved) storage.TryDelete(key);
            throw;
        }

        if (!adminManaged) return Outcome<MyLandDto>.Success((await GetMineAsync(ownerId, land.Id, ct))!);
        var stateLand = await db.Lands.AsNoTracking().Include(l => l.Documents).Include(l => l.Photos).FirstAsync(l => l.Id == land.Id, ct);
        var listing = await db.Opportunities.AsNoTracking().Include(o => o.Land).FirstAsync(o => o.LandId == land.Id, ct);
        var listingDto = await opportunities.GetAsync(listing.Id, new Viewer(ownerId, true), ct);
        return Outcome<MyLandDto>.Success(new MyLandDto(
            LandDto.From(stateLand, true), null, null, now, now,
            stateLand.Documents.Select(LandDocumentDto.From).ToList(), listingDto));
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

    /// <summary>Request a new publication; only an admin can approve and publish it.</summary>
    public async Task<Outcome<MyLandDto>> ReopenAsync(string ownerId, string landId, CancellationToken ct)
    {
        var land = await db.Lands.FirstOrDefaultAsync(l => l.Id == landId, ct);
        if (land is null || land.OwnerId != ownerId) return Fail(404, "Torpaq sahəsi tapılmadı.");
        if (land.Status != LandStatus.Approved) return Fail(400, "Sahə hələ təsdiq olunmayıb.");
        if (await db.Opportunities.AnyAsync(o => o.LandId == landId &&
            (o.Status == OpportunityStatus.Active || o.Status == OpportunityStatus.Draft), ct))
            return Fail(409, "Bu sahə üçün aktiv elan və ya gözləyən dərc müraciəti var.");

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
            Status = OpportunityStatus.Draft,
            ContactPhone = AzerbaijaniPhone.TryNormalize(owner.Phone, out var p) ? p : last?.ContactPhone ?? string.Empty,
            CreatedById = ownerId,
            CreatedAt = now,
            UpdatedAt = now,
        });
        try
        {
            await notifications.NotifyAdminsAsync("Yenidən dərc müraciəti",
                $"{owner.FullName} “{land.Title}” sahəsinin yenidən dərcini istəyir.", ct);
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Fail(409, "Bu sahə üçün dərc müraciəti artıq var.");
        }
        return Outcome<MyLandDto>.Success((await GetMineAsync(ownerId, landId, ct))!);
    }

    public async Task<List<MyLandDto>> ListMineAsync(string ownerId, CancellationToken ct)
    {
        var lands = await db.Lands.AsNoTracking().Include(l => l.Documents).Include(l => l.Photos)
            .Where(l => l.OwnerId == ownerId).OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return await ToMyLandDtosAsync(lands, ownerId, ct);
    }

    public async Task<MyLandDto?> GetMineAsync(string ownerId, string landId, CancellationToken ct)
    {
        var land = await db.Lands.AsNoTracking().Include(l => l.Documents).Include(l => l.Photos)
            .FirstOrDefaultAsync(l => l.Id == landId && l.OwnerId == ownerId, ct);
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

    /// <summary>
    /// Owner fills in or corrects the land data (type, common core, type-specific inputs) and may add photos.
    /// Allowed while the land is not yet decided, and for approved land (data only; it stays approved).
    /// </summary>
    public async Task<Outcome<MyLandDto>> UpdateProfileAsync(string ownerId, string landId, IFormCollection form, CancellationToken ct)
    {
        var land = await db.Lands.Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == landId, ct);
        if (land is null || land.OwnerId != ownerId) return Fail(404, "Torpaq sahəsi tapılmadı.");
        if (land.Status == LandStatus.Rejected) return Fail(400, "Rədd edilmiş sahənin məlumatları dəyişdirilə bilməz.");

        var (input, inputError) = LandProfileParser.FromForm(form);
        if (inputError is not null) return Fail(400, inputError);
        var (profile, profileError) = LandProfileParser.Parse(input! with { LandUse = input!.LandUse ?? land.LandUse });
        if (profileError is not null) return Fail(400, profileError);

        var newPhotos = form.Files.GetFiles("photos");
        if (land.Photos.Count + newPhotos.Count > 20) return Fail(400, "Bir sahə üçün ən çox 20 foto ola bilər.");
        var (photos, photoError) = await PrivateFileStorage.ValidateAsync(newPhotos, FileRule.LandPhotos, ct);
        if (photoError is not null) return Fail(400, photoError);

        profile!.ApplyTo(land);
        land.UpdatedAt = clock.GetUtcNow();
        var saved = await SavePhotosAsync(land, photos, ct);
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

    private async Task<List<string>> SavePhotosAsync(Land land, List<ValidatedFile> files, CancellationToken ct)
    {
        var keys = new List<string>();
        var now = clock.GetUtcNow();
        var order = land.Photos.Count == 0 ? 0 : land.Photos.Max(p => p.SortOrder) + 1;
        foreach (var file in files)
        {
            var photoId = Ids.New("lph");
            var key = await storage.SaveAsync($"land-photos/{land.Id}", photoId, file, ct);
            keys.Add(key);
            var photo = new LandPhoto
            {
                Id = photoId,
                LandId = land.Id,
                ContentType = file.ContentType,
                SizeBytes = file.File.Length,
                StorageKey = key,
                SortOrder = order++,
                UploadedAt = now,
            };
            land.Photos.Add(photo);
            db.LandPhotos.Add(photo);
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
