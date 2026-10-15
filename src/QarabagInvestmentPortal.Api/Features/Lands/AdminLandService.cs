using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>Result of an admin land action: the updated land, or an error with optional per-field messages / blockers.</summary>
public sealed record AdminLandResult(
    AdminLandDetailDto? Land, int Status, string? Error,
    IReadOnlyDictionary<string, string>? Fields = null, IReadOnlyList<LandIssue>? Blockers = null)
{
    public bool Ok => Error is null;
    public static AdminLandResult Success(AdminLandDetailDto land, int status = 200) => new(land, status, null);
    public static AdminLandResult Fail(int status, string error, IReadOnlyDictionary<string, string>? fields = null, IReadOnlyList<LandIssue>? blockers = null) =>
        new(null, status, error, fields, blockers);

    public IResult ToResult() => Ok
        ? Results.Json(Land, statusCode: Status)
        : Results.Json(new { error = Error, fields = Fields, blockers = Blockers }, statusCode: Status);
}

/// <summary>
/// Ministry administrators create and manage land records and listings directly (draft → publish → unpublish / archive).
/// Owner submissions and their review flow are untouched; these actions only apply to admin-managed land
/// (entered by an admin, or older state land without an owner).
/// </summary>
public sealed class AdminLandService(
    AppDbContext db, PrivateFileStorage storage, NotificationService notifications, OpportunityQueries opportunities, TimeProvider clock)
{
    private const int MaxDocuments = 30, MaxPhotos = 20;
    private const double MinLat = 38.3, MaxLat = 41.95, MinLng = 44.7, MaxLng = 50.4;

    /// <summary>Lands this flow manages: no owner (state land / legacy) or entered by an admin.</summary>
    private IQueryable<Land> Managed() =>
        db.Lands.Where(l => l.OwnerId == null || l.EntrySource != LandEntrySource.Owner);

    // ------------------------------------------------------------------ queries

    public async Task<List<AdminLandListItemDto>> ListAsync(string? status, string? search, CancellationToken ct)
    {
        var query = Managed().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && status != "all" && Enum.TryParse<LandStatus>(status.Replace("_", ""), true, out var s))
            query = query.Where(l => l.Status == s);
        else if (status != "all")
            query = query.Where(l => l.Status != LandStatus.Archived);
        if (search?.Trim() is { Length: > 0 } q)
        {
            var pattern = $"%{q.Replace("%", "").Replace("_", "")}%";
            query = query.Where(l => EF.Functions.ILike(l.Title, pattern) || EF.Functions.ILike(l.Region, pattern)
                || (l.District != null && EF.Functions.ILike(l.District, pattern)) || (l.Settlement != null && EF.Functions.ILike(l.Settlement, pattern))
                || (l.CadastralNumber != null && EF.Functions.ILike(l.CadastralNumber, pattern)) || EF.Functions.ILike(l.AgricultureType, pattern));
        }
        var lands = await query.OrderByDescending(l => l.UpdatedAt).Take(500).ToListAsync(ct);
        var ids = lands.Select(l => l.Id).ToList();
        var userIds = lands.SelectMany(l => new[] { l.CreatedById, l.UpdatedById }).OfType<string>().Distinct().ToList();
        var names = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        var oppStatus = (await db.Opportunities.AsNoTracking().Where(o => ids.Contains(o.LandId))
                .Select(o => new { o.LandId, o.Status, o.CreatedAt }).ToListAsync(ct))
            .GroupBy(o => o.LandId).ToDictionary(g => g.Key, g => (OpportunityStatus?)g.OrderByDescending(o => o.Status == OpportunityStatus.Active).ThenByDescending(o => o.CreatedAt).First().Status);

        return lands.Select(l => new AdminLandListItemDto(
            l.Id, l.Title, l.Region, l.District, l.Settlement, l.AreaHectares, l.LandUse, l.Status, l.Verification, l.EntrySource,
            oppStatus.GetValueOrDefault(l.Id), l.CadastralNumber, l.CadastralUnavailable,
            l.CreatedById is { } c ? names.GetValueOrDefault(c) : null, l.UpdatedById is { } u ? names.GetValueOrDefault(u) : null,
            l.CreatedAt, l.UpdatedAt, l.PublishedAt)).ToList();
    }

    public async Task<AdminLandDetailDto?> GetAsync(string id, string adminId, CancellationToken ct)
    {
        var land = await Managed().AsNoTracking().Include(l => l.Documents).Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
        return land is null ? null : await ToDetailAsync(land, adminId, ct);
    }

    // ------------------------------------------------------------------ create / edit

    public async Task<AdminLandResult> CreateAsync(string adminId, IFormCollection form, CancellationToken ct)
    {
        var requestId = form["clientRequestId"].ToString().Trim();
        if (requestId.Length is > 0 and <= 64)
        {
            // Double submit (double click, retry): return the land the first request created.
            var existing = await db.Lands.AsNoTracking().Where(l => l.ClientRequestId == requestId && l.CreatedById == adminId).Select(l => l.Id).FirstOrDefaultAsync(ct);
            if (existing is not null) return AdminLandResult.Success((await GetAsync(existing, adminId, ct))!);
        }

        var admin = await db.Users.AsNoTracking().FirstAsync(u => u.Id == adminId, ct);
        var now = clock.GetUtcNow();
        var land = new Land
        {
            Id = Ids.New("land"),
            OwnerId = null,
            OwnershipType = LandOwnershipType.State,
            Status = LandStatus.Draft,
            EntrySource = LandEntrySource.Admin,
            Verification = LandVerificationStatus.AdminEntered,
            CreatedById = adminId,
            UpdatedById = adminId,
            ClientRequestId = requestId.Length is > 0 and <= 64 ? requestId : null,
            ImageUrl = string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
        };
        var opportunity = new InvestmentOpportunity
        {
            Id = Ids.New("opp"),
            LandId = land.Id,
            Source = OpportunitySource.Admin,
            Status = OpportunityStatus.Draft,
            ContactPhone = AzerbaijaniPhone.TryNormalize(admin.Phone, out var phone) ? phone : string.Empty,
            CreatedById = adminId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        var reader = new AdminLandForm(form, creating: true);
        reader.ApplyTo(land, opportunity);
        if (reader.Errors.Count > 0) return AdminLandResult.Fail(400, "Formada səhvlər var. Qırmızı ilə qeyd olunan sahələri düzəldin.", reader.Errors);

        var (docs, photos, fileError) = await ValidateFilesAsync(form, 0, 0, ct);
        if (fileError is not null) return AdminLandResult.Fail(400, fileError.Value.Message, new Dictionary<string, string> { [fileError.Value.Field] = fileError.Value.Message });

        db.Lands.Add(land);
        db.Opportunities.Add(opportunity);
        var saved = await SaveDocumentsAsync(land, adminId, docs, reader.DocumentKinds, ct);
        saved.AddRange(await SavePhotosAsync(land, photos, ct));
        Audit(land.Id, adminId, "created", land.EntrySource == LandEntrySource.AdminOnBehalf ? $"Qaralama yaradıldı ({land.OnBehalfOf} adından)." : "Qaralama yaradıldı.");
        if (docs.Count > 0) Audit(land.Id, adminId, "document_added", $"{docs.Count} sənəd əlavə edildi.");
        if (photos.Count > 0) Audit(land.Id, adminId, "photo_added", $"{photos.Count} foto əlavə edildi.");

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (land.ClientRequestId is not null)
        {
            foreach (var key in saved) storage.TryDelete(key);
            db.ChangeTracker.Clear();
            var first = await db.Lands.AsNoTracking().Where(l => l.ClientRequestId == land.ClientRequestId).Select(l => l.Id).FirstOrDefaultAsync(ct);
            if (first is not null) return AdminLandResult.Success((await GetAsync(first, adminId, ct))!);
            throw;
        }
        catch
        {
            foreach (var key in saved) storage.TryDelete(key);
            throw;
        }
        return AdminLandResult.Success((await GetAsync(land.Id, adminId, ct))!, StatusCodes.Status201Created);
    }

    public async Task<AdminLandResult> UpdateAsync(string id, string adminId, IFormCollection form, CancellationToken ct)
    {
        var land = await Managed().Include(l => l.Documents).Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(400, "Arxivdəki sahəni dəyişmək üçün əvvəlcə onu arxivdən çıxarın.");
        var opportunity = await LatestOpportunityAsync(id, ct);

        var before = Snapshot(land);
        var reader = new AdminLandForm(form, creating: false);
        reader.ApplyTo(land, opportunity);
        if (reader.Errors.Count > 0)
        {
            db.ChangeTracker.Clear();
            return AdminLandResult.Fail(400, "Formada səhvlər var. Qırmızı ilə qeyd olunan sahələri düzəldin.", reader.Errors);
        }
        var (docs, photos, fileError) = await ValidateFilesAsync(form, land.Documents.Count, land.Photos.Count, ct);
        if (fileError is not null)
        {
            db.ChangeTracker.Clear();
            return AdminLandResult.Fail(400, fileError.Value.Message, new Dictionary<string, string> { [fileError.Value.Field] = fileError.Value.Message });
        }

        var now = clock.GetUtcNow();
        var changed = Snapshot(land).Where(kv => !Equals(before.GetValueOrDefault(kv.Key), kv.Value)).Select(kv => kv.Key).ToList();
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        if (opportunity is not null) opportunity.UpdatedAt = now;

        var saved = await SaveDocumentsAsync(land, adminId, docs, reader.DocumentKinds, ct);
        saved.AddRange(await SavePhotosAsync(land, photos, ct));
        if (changed.Count > 0) Audit(id, adminId, "updated", "Dəyişdirildi: " + string.Join(", ", changed));
        if (docs.Count > 0) Audit(id, adminId, "document_added", string.Join(", ", docs.Select((d, i) => $"{d.File.FileName} ({AdminLandRules.KindLabel(reader.DocumentKinds.ElementAtOrDefault(i) ?? "other")})")));
        if (photos.Count > 0) Audit(id, adminId, "photo_added", $"{photos.Count} foto əlavə edildi.");

        // Changing legal data or adding evidence means the evidence has to be checked again.
        if (land.Verification == LandVerificationStatus.Verified && (changed.Any(LegalFields.Contains) || docs.Count > 0))
        {
            land.Verification = LandVerificationStatus.EvidencePending;
            land.VerificationNote = "Hüquqi məlumat dəyişdiyi üçün yenidən yoxlanmalıdır.";
            Audit(id, adminId, "verification", "Status: sübut yoxlanılır (hüquqi məlumat dəyişdi).");
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

        // A published listing must keep passing the checks; otherwise it goes back to draft (never silently stays public).
        if (land.Status == LandStatus.Approved)
        {
            var check = await CheckAsync(land, opportunity, ct);
            if (!check.CanPublish)
            {
                await SetUnpublishedAsync(land, opportunity, adminId, "Dəyişiklikdən sonra dərc yoxlaması keçmədi: " + string.Join(" ", check.Blockers.Select(b => b.Message)), ct);
                await db.SaveChangesAsync(ct);
            }
        }
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    public async Task<AdminLandResult> RemoveDocumentAsync(string id, string documentId, string adminId, CancellationToken ct)
    {
        var land = await Managed().Include(l => l.Documents).Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(400, "Arxivdəki sahədə dəyişiklik etmək olmaz.");
        var doc = land.Documents.FirstOrDefault(d => d.Id == documentId);
        if (doc is null) return AdminLandResult.Fail(404, "Sənəd tapılmadı.");

        db.LandDocuments.Remove(doc);
        land.Documents.Remove(doc);
        land.UpdatedById = adminId;
        land.UpdatedAt = clock.GetUtcNow();
        Audit(id, adminId, "document_removed", $"{doc.FileName} ({AdminLandRules.KindLabel(doc.Kind)}) silindi.");
        if (land.Verification == LandVerificationStatus.Verified && AdminLandRules.IsLegalEvidence(doc.Kind))
        {
            land.Verification = LandVerificationStatus.EvidencePending;
            land.VerificationNote = "Hüquqi sənəd silindiyi üçün yenidən yoxlanmalıdır.";
            Audit(id, adminId, "verification", "Status: sübut yoxlanılır (hüquqi sənəd silindi).");
        }
        await db.SaveChangesAsync(ct);
        storage.TryDelete(doc.StorageKey);

        if (land.Status == LandStatus.Approved)
        {
            var opportunity = await LatestOpportunityAsync(id, ct);
            var check = await CheckAsync(land, opportunity, ct);
            if (!check.CanPublish)
            {
                await SetUnpublishedAsync(land, opportunity, adminId, "Sənəd silindikdən sonra dərc yoxlaması keçmədi.", ct);
                await db.SaveChangesAsync(ct);
            }
        }
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    public async Task<AdminLandResult> RemovePhotoAsync(string id, string photoId, string adminId, CancellationToken ct)
    {
        var land = await Managed().Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(400, "Arxivdəki sahədə dəyişiklik etmək olmaz.");
        var photo = land.Photos.FirstOrDefault(p => p.Id == photoId);
        if (photo is null) return AdminLandResult.Fail(404, "Foto tapılmadı.");
        db.LandPhotos.Remove(photo);
        land.UpdatedById = adminId;
        land.UpdatedAt = clock.GetUtcNow();
        Audit(id, adminId, "photo_removed", "Foto silindi.");
        await db.SaveChangesAsync(ct);
        storage.TryDelete(photo.StorageKey);
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    // ------------------------------------------------------------------ status actions

    public async Task<AdminLandResult> PublishAsync(string id, string adminId, CancellationToken ct)
    {
        var land = await Managed().Include(l => l.Documents).Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Approved) return AdminLandResult.Fail(409, "Sahə artıq dərc olunub.");
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(400, "Arxivdəki sahəni dərc etmək üçün əvvəlcə onu arxivdən çıxarın.");
        if (land.Status is not LandStatus.Draft)
            return AdminLandResult.Fail(400, "Bu sahə sahibin müraciəti kimi yoxlanılır; onu “Torpaq müraciətləri” bölməsindən təsdiqləyin.");

        var opportunity = await LatestOpportunityAsync(id, ct);
        var check = await CheckAsync(land, opportunity, ct);
        if (!check.CanPublish)
            return AdminLandResult.Fail(400, "Dərc etmək üçün aşağıdakıları düzəldin.", blockers: check.Blockers);
        if (opportunity is { WinnerProposalId: not null })
            return AdminLandResult.Fail(409, "Bu elan üzrə qalib artıq seçilib; yeni elan üçün sahəni arxivdən çıxarın.");

        var now = clock.GetUtcNow();
        if (opportunity is null || opportunity.Status is OpportunityStatus.Closed or OpportunityStatus.Rejected)
        {
            opportunity = NewOpportunity(land, adminId, opportunity, now);
            db.Opportunities.Add(opportunity);
        }
        opportunity.Status = OpportunityStatus.Active;
        opportunity.OpeningDate ??= now;
        opportunity.ClosedAt = null;
        opportunity.ClosureReason = null;
        opportunity.Title = land.Title;
        opportunity.Description = land.Description;
        opportunity.ReviewedById = adminId;
        opportunity.ReviewedAt = now;
        opportunity.UpdatedAt = now;
        land.Status = LandStatus.Approved;
        land.PublishedAt = now;
        land.ReviewedAt = now;
        land.ReviewedById = adminId;
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        Audit(id, adminId, "published", "Elan dərc olundu.");
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return AdminLandResult.Fail(409, "Bu sahə üçün artıq aktiv elan var.");
        }
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    public async Task<AdminLandResult> UnpublishAsync(string id, string adminId, string? reason, CancellationToken ct)
    {
        reason = reason?.Trim();
        if (string.IsNullOrEmpty(reason) || reason.Length > 1000) return AdminLandResult.Fail(400, "Dərcdən çıxarma səbəbini yazın (ən çox 1000 simvol).", new Dictionary<string, string> { ["reason"] = "Səbəbi yazın." });
        var land = await Managed().Include(l => l.Documents).Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status != LandStatus.Approved) return AdminLandResult.Fail(400, "Sahə dərc olunmayıb.");
        var opportunity = await LatestOpportunityAsync(id, ct);
        if (opportunity is { WinnerProposalId: not null }) return AdminLandResult.Fail(409, "Qalib seçilmiş elanı dərcdən çıxarmaq olmaz; sahəni arxivləşdirin.");
        await SetUnpublishedAsync(land, opportunity, adminId, reason, ct);
        await db.SaveChangesAsync(ct);
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    public async Task<AdminLandResult> ArchiveAsync(string id, string adminId, string? reason, CancellationToken ct)
    {
        reason = reason?.Trim();
        if (string.IsNullOrEmpty(reason) || reason.Length > 1000) return AdminLandResult.Fail(400, "Arxivləşdirmə səbəbini yazın (ən çox 1000 simvol).", new Dictionary<string, string> { ["reason"] = "Səbəbi yazın." });
        var land = await Managed().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(409, "Sahə artıq arxivdədir.");

        var now = clock.GetUtcNow();
        var open = await db.Opportunities.Where(o => o.LandId == id && (o.Status == OpportunityStatus.Active || o.Status == OpportunityStatus.Draft)).ToListAsync(ct);
        foreach (var o in open)
        {
            o.Status = OpportunityStatus.Closed;
            o.ClosedAt = now;
            o.ClosureReason = "Sahə arxivləşdirildi: " + reason;
            o.UpdatedAt = now;
        }
        land.Status = LandStatus.Archived;
        land.ArchivedAt = now;
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        Audit(id, adminId, "archived", reason);
        await db.SaveChangesAsync(ct);
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    public async Task<AdminLandResult> RestoreAsync(string id, string adminId, CancellationToken ct)
    {
        var land = await Managed().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status != LandStatus.Archived) return AdminLandResult.Fail(400, "Sahə arxivdə deyil.");
        var now = clock.GetUtcNow();
        var last = await LatestOpportunityAsync(id, ct);
        db.Opportunities.Add(NewOpportunity(land, adminId, last, now));
        land.Status = LandStatus.Draft;
        land.ArchivedAt = null;
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        Audit(id, adminId, "restored", "Arxivdən çıxarıldı (qaralama).");
        await db.SaveChangesAsync(ct);
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    /// <summary>Who answers investor inquiries: null/empty email = the ministry; otherwise a confirmed user account with a valid phone number.</summary>
    public async Task<AdminLandResult> ReassignAsync(string id, string adminId, string? email, CancellationToken ct)
    {
        var land = await Managed().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(400, "Arxivdəki sahədə dəyişiklik etmək olmaz.");
        var opportunity = await LatestOpportunityAsync(id, ct);
        var now = clock.GetUtcNow();

        if (string.IsNullOrWhiteSpace(email))
        {
            if (land.ResponsibleUserId is null) return AdminLandResult.Fail(400, "Cavabdeh tərəf artıq nazirlikdir.");
            var admin = await db.Users.AsNoTracking().FirstAsync(u => u.Id == adminId, ct);
            land.ResponsibleUserId = null;
            if (opportunity is not null) opportunity.ContactPhone = AzerbaijaniPhone.TryNormalize(admin.Phone, out var p) ? p : opportunity.ContactPhone;
            Audit(id, adminId, "reassigned", "Cavabdeh tərəf: nazirlik.");
        }
        else
        {
            var normalized = email.Trim().ToLowerInvariant();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalized, ct);
            if (user is null) return AdminLandResult.Fail(404, "Bu e-poçtla istifadəçi tapılmadı.", new Dictionary<string, string> { ["email"] = "İstifadəçi tapılmadı." });
            if (user.EmailConfirmedAt is null) return AdminLandResult.Fail(400, "Bu istifadəçinin e-poçtu təsdiqlənməyib.", new Dictionary<string, string> { ["email"] = "E-poçt təsdiqlənməyib." });
            if (!AzerbaijaniPhone.TryNormalize(user.Phone, out var phone))
                return AdminLandResult.Fail(400, "Bu istifadəçinin profilində düzgün telefon nömrəsi yoxdur; investorlar onunla əlaqə saxlaya bilməz.", new Dictionary<string, string> { ["email"] = "Telefon nömrəsi yoxdur." });
            land.ResponsibleUserId = user.Id;
            if (opportunity is not null) opportunity.ContactPhone = phone;
            notifications.Notify(user.Id, "Elan üzrə cavabdeh təyin olundunuz",
                $"“{land.Title}” elanı üzrə investorların müraciətlərinə siz cavab verəcəksiniz.");
            Audit(id, adminId, "reassigned", $"Cavabdeh tərəf: {user.FullName} ({user.Email}).");
        }
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        if (opportunity is not null) opportunity.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    /// <summary>
    /// VERIFIED only after an administrator states they checked the legal evidence (documents) themselves.
    /// Uploading or entering data never verifies anything on its own.
    /// </summary>
    public async Task<AdminLandResult> SetVerificationAsync(string id, string adminId, string? status, bool evidenceChecked, string? note, CancellationToken ct)
    {
        var land = await Managed().Include(l => l.Documents).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (land is null) return NotFound();
        if (land.Status == LandStatus.Archived) return AdminLandResult.Fail(400, "Arxivdəki sahədə dəyişiklik etmək olmaz.");
        note = note?.Trim();
        if (note?.Length > 2000) return AdminLandResult.Fail(400, "Qeyd ən çox 2000 simvol ola bilər.", new Dictionary<string, string> { ["note"] = "Çox uzundur." });
        var now = clock.GetUtcNow();

        switch (status?.Trim().ToUpperInvariant().Replace("-", "_"))
        {
            case "VERIFIED":
                if (!evidenceChecked)
                    return AdminLandResult.Fail(400, "Sübutları özünüz yoxladığınızı təsdiqləyin.", new Dictionary<string, string> { ["evidenceChecked"] = "Təsdiqləyin." });
                var accepted = AdminLandRules.AcceptedLegalKinds(land.OwnershipForm);
                if (!land.Documents.Any(d => accepted.Contains(d.Kind)))
                    return AdminLandResult.Fail(400, "Təsdiq üçün hüquqi sənəd yoxdur. Əvvəlcə mülkiyyət, icarə və ya icazə sənədini yükləyin.");
                if (string.IsNullOrWhiteSpace(land.CadastralNumber) && string.IsNullOrEmpty(note))
                    return AdminLandResult.Fail(400, "Kadastr nömrəsi olmadan təsdiq üçün əl ilə yoxlamanın nəticəsini qeyd edin.", new Dictionary<string, string> { ["note"] = "Yoxlamanın nəticəsini yazın." });
                land.Verification = LandVerificationStatus.Verified;
                land.VerifiedById = adminId;
                land.VerifiedAt = now;
                land.VerificationNote = note;
                Audit(id, adminId, "verification", "Status: təsdiqlənib (sübutlar yoxlanıldı)." + (string.IsNullOrEmpty(note) ? "" : " " + note));
                break;
            case "EVIDENCE_PENDING":
                land.Verification = LandVerificationStatus.EvidencePending;
                land.VerificationNote = note;
                Audit(id, adminId, "verification", "Status: sübut yoxlanılır." + (string.IsNullOrEmpty(note) ? "" : " " + note));
                break;
            default:
                return AdminLandResult.Fail(400, "Status VERIFIED və ya EVIDENCE_PENDING olmalıdır.");
        }
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        // Taking verification away may break a published listing's checks.
        if (land.Status == LandStatus.Approved && land.Verification != LandVerificationStatus.Verified)
        {
            var full = await db.Lands.Include(l => l.Documents).Include(l => l.Photos).FirstAsync(l => l.Id == id, ct);
            var opportunity = await LatestOpportunityAsync(id, ct);
            var check = await CheckAsync(full, opportunity, ct);
            if (!check.CanPublish)
            {
                await SetUnpublishedAsync(full, opportunity, adminId, "Təsdiq statusu dəyişdiyi üçün dərc yoxlaması keçmədi.", ct);
                await db.SaveChangesAsync(ct);
            }
        }
        return AdminLandResult.Success((await GetAsync(id, adminId, ct))!);
    }

    // ------------------------------------------------------------------ helpers

    private static readonly HashSet<string> LegalFields = ["cadastralNumber", "cadastralUnavailable", "legalCategory", "ownershipForm", "boundary", "area", "hasEncumbrance", "encumbrances"];

    private static Dictionary<string, object?> Snapshot(Land l) => new()
    {
        ["title"] = l.Title, ["description"] = l.Description, ["region"] = l.Region, ["district"] = l.District, ["settlement"] = l.Settlement,
        ["area"] = l.AreaHectares, ["location"] = (l.Latitude, l.Longitude), ["boundary"] = l.BoundaryGeoJson, ["landUse"] = l.LandUse,
        ["intendedUse"] = l.IntendedUse, ["legalCategory"] = l.LegalCategory, ["categoryConvertible"] = l.CategoryConvertible,
        ["ownershipForm"] = l.OwnershipForm, ["hasEncumbrance"] = l.HasEncumbrance, ["encumbrances"] = l.Encumbrances,
        ["cadastralNumber"] = l.CadastralNumber, ["cadastralUnavailable"] = l.CadastralUnavailable, ["waterAccess"] = l.WaterAccess,
        ["roadAccessType"] = l.RoadAccessType, ["roadDistanceKm"] = l.RoadDistanceKm, ["settlementDistanceKm"] = l.SettlementDistanceKm,
        ["currentUse"] = l.CurrentUse, ["soilQuality"] = l.SoilQuality, ["waterSupply"] = l.WaterSupply, ["attributes"] = l.Attributes,
        ["details"] = l.Details, ["estimatedInvestmentRequirement"] = l.EstimatedInvestmentRequirement, ["adminNotes"] = l.AdminNotes,
        ["entrySource"] = l.EntrySource, ["onBehalfOf"] = l.OnBehalfOf,
    };

    private async Task<LandPublicationCheck> CheckAsync(Land land, InvestmentOpportunity? opportunity, CancellationToken ct) =>
        await AdminLandRules.CheckAsync(db, land, new InvestmentDeadline(opportunity?.ApplicationDeadline), clock.GetUtcNow(), ct);

    private async Task SetUnpublishedAsync(Land land, InvestmentOpportunity? opportunity, string adminId, string reason, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        land.Status = LandStatus.Draft;
        land.UpdatedById = adminId;
        land.UpdatedAt = now;
        if (opportunity is { Status: OpportunityStatus.Active })
        {
            opportunity.Status = OpportunityStatus.Draft;
            opportunity.UpdatedAt = now;
        }
        Audit(land.Id, adminId, "unpublished", reason);
        await Task.CompletedTask;
    }

    private Task<InvestmentOpportunity?> LatestOpportunityAsync(string landId, CancellationToken ct) =>
        db.Opportunities.Where(o => o.LandId == landId)
            .OrderByDescending(o => o.Status == OpportunityStatus.Active).ThenByDescending(o => o.Status == OpportunityStatus.Draft).ThenByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

    private static InvestmentOpportunity NewOpportunity(Land land, string adminId, InvestmentOpportunity? previous, DateTimeOffset now) => new()
    {
        Id = Ids.New("opp"),
        LandId = land.Id,
        Source = OpportunitySource.Admin,
        Title = land.Title,
        Description = land.Description,
        EligibilityConditions = previous?.EligibilityConditions ?? [],
        RequiredDocuments = previous?.RequiredDocuments ?? [],
        ApplicationDeadline = previous?.ApplicationDeadline is { } d && d > now ? d : null,
        Status = OpportunityStatus.Draft,
        ContactPhone = previous?.ContactPhone ?? string.Empty,
        CreatedById = adminId,
        CreatedAt = now,
        UpdatedAt = now,
    };

    private void Audit(string landId, string actorId, string action, string? details) =>
        db.LandAudit.Add(new LandAuditEntry
        {
            Id = Ids.New("laud"),
            LandId = landId,
            ActorId = actorId,
            Action = action,
            Details = details is { Length: > 2000 } ? details[..2000] : details,
            At = clock.GetUtcNow(),
        });

    private static AdminLandResult NotFound() => AdminLandResult.Fail(404, "Torpaq sahəsi tapılmadı.");

    private static async Task<(List<ValidatedFile> Docs, List<ValidatedFile> Photos, (string Field, string Message)? Error)> ValidateFilesAsync(
        IFormCollection form, int existingDocs, int existingPhotos, CancellationToken ct)
    {
        var docFiles = form.Files.GetFiles("documents");
        var photoFiles = form.Files.GetFiles("photos");
        if (existingDocs + docFiles.Count > MaxDocuments) return ([], [], ("documents", $"Bir sahə üçün ən çox {MaxDocuments} sənəd ola bilər."));
        if (existingPhotos + photoFiles.Count > MaxPhotos) return ([], [], ("photos", $"Bir sahə üçün ən çox {MaxPhotos} foto ola bilər."));
        var (docs, docError) = await PrivateFileStorage.ValidateAsync(docFiles, FileRule.AdminLandDocuments, ct);
        if (docError is not null) return ([], [], ("documents", docError));
        var (photos, photoError) = await PrivateFileStorage.ValidateAsync(photoFiles, FileRule.LandPhotos, ct);
        if (photoError is not null) return ([], [], ("photos", photoError));
        return (docs, photos, null);
    }

    private async Task<List<string>> SaveDocumentsAsync(Land land, string uploadedBy, List<ValidatedFile> files, IReadOnlyList<string> kinds, CancellationToken ct)
    {
        var keys = new List<string>();
        var now = clock.GetUtcNow();
        for (var i = 0; i < files.Count; i++)
        {
            var file = files[i];
            var docId = Ids.New("ldoc");
            var key = await storage.SaveAsync($"lands/{land.Id}", docId, file, ct);
            keys.Add(key);
            var doc = new LandDocument
            {
                Id = docId,
                LandId = land.Id,
                FileName = Path.GetFileName(file.File.FileName) is { Length: > 255 } n ? n[..255] : Path.GetFileName(file.File.FileName),
                ContentType = file.ContentType,
                SizeBytes = file.File.Length,
                StorageKey = key,
                UploadedById = uploadedBy,
                UploadedAt = now,
                Kind = kinds.ElementAtOrDefault(i) ?? "other",
            };
            land.Documents.Add(doc);
            db.LandDocuments.Add(doc);
        }
        return keys;
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
            var photo = new LandPhoto { Id = photoId, LandId = land.Id, ContentType = file.ContentType, SizeBytes = file.File.Length, StorageKey = key, SortOrder = order++, UploadedAt = now };
            land.Photos.Add(photo);
            db.LandPhotos.Add(photo);
        }
        return keys;
    }

    private async Task<AdminLandDetailDto> ToDetailAsync(Land land, string adminId, CancellationToken ct)
    {
        var opportunity = await db.Opportunities.AsNoTracking().Include(o => o.Land)
            .Where(o => o.LandId == land.Id)
            .OrderByDescending(o => o.Status == OpportunityStatus.Active).ThenByDescending(o => o.Status == OpportunityStatus.Draft).ThenByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);
        var check = await AdminLandRules.CheckAsync(db, land, new InvestmentDeadline(opportunity?.ApplicationDeadline), clock.GetUtcNow(), ct);
        var audit = await db.LandAudit.AsNoTracking().Where(a => a.LandId == land.Id).OrderByDescending(a => a.At).Take(200).ToListAsync(ct);

        var userIds = audit.Select(a => a.ActorId)
            .Concat(new[] { land.CreatedById, land.UpdatedById, land.VerifiedById, land.ResponsibleUserId }.OfType<string>()).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new AdminUserRefDto(u.Id, u.FullName, u.Email), ct);
        AdminUserRefDto? U(string? id) => id is not null ? users.GetValueOrDefault(id) : null;

        OpportunityDto? opportunityDto = opportunity is null ? null
            : (await opportunities.ToDtosAsync([opportunity], new Viewer(adminId, true), ct, includeLand: false)).FirstOrDefault();

        return new AdminLandDetailDto(
            LandDto.From(land, opportunity?.Status == OpportunityStatus.Active),
            new AdminLandFieldsDto(
                land.Title, land.Description, land.Region, land.District, land.Settlement, land.AreaHectares, land.Latitude, land.Longitude,
                ParseJson(land.BoundaryGeoJson), land.LandUse, land.IntendedUse, land.LegalCategory, land.CategoryConvertible, land.OwnershipForm,
                land.HasEncumbrance, land.Encumbrances, land.CadastralNumber, land.CadastralUnavailable, land.WaterAccess, land.RoadAccessType,
                land.RoadDistanceKm, land.SettlementDistanceKm, land.CurrentUse, land.SoilQuality, land.WaterSupply,
                ParseJson(land.Attributes) ?? EmptyObject(), ParseJson(land.Details) ?? EmptyObject(), land.EstimatedInvestmentRequirement,
                land.AdminNotes, land.EntrySource, land.OnBehalfOf, opportunity?.EligibilityConditions ?? [], opportunity?.RequiredDocuments ?? [],
                opportunity?.ApplicationDeadline),
            new AdminLandRecordDto(
                land.Status, land.Verification, U(land.VerifiedById), land.VerifiedAt, land.VerificationNote,
                U(land.CreatedById), land.CreatedAt, U(land.UpdatedById), land.UpdatedAt, land.PublishedAt, land.ArchivedAt,
                U(land.ResponsibleUserId), land.OwnershipType),
            land.Documents.OrderBy(d => d.UploadedAt).Select(d => new AdminLandDocumentDto(d.Id, d.FileName, d.Kind, d.ContentType, d.SizeBytes, d.UploadedAt, $"/api/documents/lands/{d.Id}")).ToList(),
            opportunityDto,
            check,
            audit.Select(a => new AdminLandAuditDto(a.Id, a.Action, a.Details, U(a.ActorId), a.At)).ToList());
    }

    private static JsonElement? ParseJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (JsonException) { return null; }
    }

    private static JsonElement EmptyObject()
    {
        using var doc = JsonDocument.Parse("{}");
        return doc.RootElement.Clone();
    }
}

/// <summary>
/// Reads the admin land form (multipart). On edit, only fields that are sent are changed.
/// Collects one message per field instead of stopping at the first error.
/// </summary>
internal sealed class AdminLandForm(IFormCollection form, bool creating)
{
    public Dictionary<string, string> Errors { get; } = new(StringComparer.OrdinalIgnoreCase);
    public List<string> DocumentKinds { get; } = [];
    private const double MinLat = 38.3, MaxLat = 41.95, MinLng = 44.7, MaxLng = 50.4;

    private bool Sent(string key) => creating || form.ContainsKey(key);
    private string? Raw(string key) => form[key].ToString().Trim() is { Length: > 0 } v ? v : null;

    private string? Text(string key, int max)
    {
        var v = Raw(key);
        if (v is null) return null;
        if (v.Length > max) Errors[key] = $"Ən çox {max} simvol ola bilər.";
        return v.Length > max ? v[..max] : v;
    }

    private string? Choice(string key, string[] options, string message)
    {
        var v = Raw(key);
        if (v is null) return null;
        var match = options.FirstOrDefault(o => o.Equals(v, StringComparison.OrdinalIgnoreCase));
        if (match is null) Errors[key] = message;
        return match;
    }

    private double? Number(string key, double min, double max, string message)
    {
        var v = Raw(key);
        if (v is null) return null;
        if (!double.TryParse(v.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n) || !double.IsFinite(n) || n < min || n > max)
        {
            Errors[key] = message;
            return null;
        }
        return n;
    }

    private bool? Bool(string key, string message)
    {
        if (!LandProfileParser.TryBool(Raw(key), out var value)) Errors[key] = message;
        return value;
    }

    private JsonElement? Json(string key, string message)
    {
        var v = Raw(key);
        if (v is null) return null;
        try
        {
            using var doc = JsonDocument.Parse(v);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            Errors[key] = message;
            return null;
        }
    }

    public void ApplyTo(Land land, InvestmentOpportunity? opportunity)
    {
        if (Sent("title"))
        {
            var title = Text("title", 200);
            if (title is null) Errors["title"] = "Sahənin adını yazın.";
            else land.Title = title;
        }
        if (Sent("description")) land.Description = Text("description", 4000) ?? string.Empty;
        if (Sent("region")) land.Region = Text("region", 100) ?? string.Empty;
        if (Sent("district")) land.District = Text("district", 100);
        if (Sent("settlement")) land.Settlement = Text("settlement", 100);

        // Area: hectares or sot (1 sot = 0.01 ha); stored as hectares.
        if (Sent("areaValue") || Sent("areaHectares"))
        {
            var unit = Raw("areaUnit")?.ToLowerInvariant() ?? "ha";
            if (unit is not ("ha" or "sot")) Errors["area"] = "Ölçü vahidi hektar (ha) və ya sot olmalıdır.";
            var value = Number(Raw("areaValue") is not null ? "areaValue" : "areaHectares", 0, unit == "sot" ? 10_000_000 : 100_000, "Sahənin ölçüsünü düzgün yazın.");
            if (Errors.Remove("areaValue") || Errors.Remove("areaHectares")) Errors["area"] = "Sahənin ölçüsünü düzgün yazın.";
            land.AreaHectares = value is null ? 0 : Math.Round(unit == "sot" ? value.Value * AdminLandRules.HectaresPerSot : value.Value, 4);
        }

        if (Sent("latitude") || Sent("longitude"))
        {
            var lat = Number("latitude", MinLat, MaxLat, "Nöqtə Azərbaycan ərazisində olmalıdır.");
            var lng = Number("longitude", MinLng, MaxLng, "Nöqtə Azərbaycan ərazisində olmalıdır.");
            var latError = Errors.Remove("latitude");
            var lngError = Errors.Remove("longitude");
            if (latError || lngError) Errors["location"] = "Nöqtə Azərbaycan ərazisində olmalıdır.";
            land.Latitude = lat ?? 0;
            land.Longitude = lng ?? 0;
        }

        if (Sent("boundary"))
        {
            var raw = Json("boundary", "Sərhəd koordinatları düzgün deyil.");
            if (raw is null) land.BoundaryGeoJson = null;
            else
            {
                var (geo, error) = LandProfileParser.NormaliseBoundary(raw.Value);
                if (error is not null) Errors["boundary"] = error;
                else land.BoundaryGeoJson = geo;
            }
        }

        LandUseType? type = LandUseCatalog.ByKey(land.LandUse);
        if (Sent("landUse"))
        {
            var raw = Raw("landUse");
            type = raw is null ? null : LandUseCatalog.Find(raw);
            if (raw is not null && type is null) Errors["landUse"] = "Fəaliyyət növünü siyahıdan seçin.";
            land.LandUse = type?.Key ?? string.Empty;
            land.AgricultureType = type?.Name ?? string.Empty;
        }
        if (Sent("intendedUse")) land.IntendedUse = Text("intendedUse", 500) ?? string.Empty;
        if (Sent("legalCategory")) land.LegalCategory = Choice("legalCategory", LandUseCatalog.LegalCategories, "Kateqoriyanı siyahıdan seçin.");
        if (Sent("categoryConvertible")) land.CategoryConvertible = Bool("categoryConvertible", "Bəli və ya xeyr seçin.");
        if (Sent("ownershipForm"))
        {
            land.OwnershipForm = Choice("ownershipForm", LandUseCatalog.OwnershipForms, "Mülkiyyət növünü siyahıdan seçin.");
            land.OwnershipType = land.OwnershipForm == "private" ? LandOwnershipType.Private : LandOwnershipType.State;
        }
        if (Sent("hasEncumbrance")) land.HasEncumbrance = Bool("hasEncumbrance", "Bəli və ya xeyr seçin.");
        if (Sent("encumbrances")) land.Encumbrances = Text("encumbrances", 1000);

        if (Sent("cadastralNumber"))
        {
            var number = Text("cadastralNumber", 50);
            if (number is not null && !AdminLandRules.CadastralRegex().IsMatch(number))
                Errors["cadastralNumber"] = "Kadastr nömrəsi yalnız rəqəm, hərf, “-”, “/”, “:” və “.” ola bilər.";
            land.CadastralNumber = number;
        }
        if (Sent("cadastralUnavailable")) land.CadastralUnavailable = Bool("cadastralUnavailable", "Bəli və ya xeyr seçin.") ?? false;
        if (!string.IsNullOrWhiteSpace(land.CadastralNumber)) land.CadastralUnavailable = false;

        if (Sent("waterAccess")) land.WaterAccess = Choice("waterAccess", AdminLandRules.WaterAccessOptions, "Su təminatını siyahıdan seçin.");
        if (Sent("roadAccessType")) land.RoadAccessType = Choice("roadAccessType", LandUseCatalog.RoadAccessTypes, "Yol növünü siyahıdan seçin.");
        if (Sent("roadDistanceKm")) land.RoadDistanceKm = Number("roadDistanceKm", 0, 10_000, "Məsafəni km ilə düzgün yazın.");
        if (Sent("settlementDistanceKm")) land.SettlementDistanceKm = Number("settlementDistanceKm", 0, 10_000, "Məsafəni km ilə düzgün yazın.");
        if (Sent("currentUse")) land.CurrentUse = Text("currentUse", 500);
        if (Sent("soilQuality")) land.SoilQuality = Text("soilQuality", 500);
        if (Sent("waterSupply")) land.WaterSupply = Text("waterSupply", 500);

        if (Sent("attributes"))
        {
            var raw = Json("attributes", "Fəaliyyət növünə aid məlumatlar düzgün deyil.");
            if (type is null)
            {
                if (raw is { ValueKind: JsonValueKind.Object } obj && obj.EnumerateObject().Any()) Errors["attributes"] = "Əvvəlcə fəaliyyət növünü seçin.";
                land.Attributes = "{}";
            }
            else
            {
                var (json, error) = LandAttributes.Normalise(type, raw);
                if (error is not null) Errors["attributes"] = error;
                else land.Attributes = json!;
            }
        }
        else if (Sent("landUse") && type is not null && LandAttributes.Normalise(type, ParseObject(land.Attributes)).Error is not null)
        {
            land.Attributes = "{}"; // type changed: drop inputs that belong to the old type
        }

        if (Sent("details"))
        {
            var (json, error) = LandAttributes.Normalise(AdminLandRules.DetailsSchema, Json("details", "Əlavə məlumatlar düzgün deyil."));
            if (error is not null) Errors["details"] = error;
            else land.Details = json!;
        }

        if (Sent("estimatedInvestmentRequirement"))
            land.EstimatedInvestmentRequirement = (decimal)(Number("estimatedInvestmentRequirement", 0, 1_000_000_000, "Məbləği manatla düzgün yazın.") ?? 0);
        if (Sent("adminNotes")) land.AdminNotes = Text("adminNotes", 4000);

        if (Sent("entrySource"))
        {
            var source = Raw("entrySource")?.ToLowerInvariant();
            land.EntrySource = source is "on_behalf" or "admin_on_behalf" ? LandEntrySource.AdminOnBehalf : LandEntrySource.Admin;
        }
        if (Sent("onBehalfOf")) land.OnBehalfOf = Text("onBehalfOf", 200);
        if (land.EntrySource == LandEntrySource.AdminOnBehalf && string.IsNullOrWhiteSpace(land.OnBehalfOf))
            Errors["onBehalfOf"] = "Kimin adından daxil edildiyini yazın.";
        if (land.EntrySource != LandEntrySource.AdminOnBehalf) land.OnBehalfOf = null;

        if (opportunity is not null)
        {
            opportunity.Title = land.Title;
            opportunity.Description = land.Description;
            if (Sent("eligibilityConditions")) opportunity.EligibilityConditions = Lines(form["eligibilityConditions"].ToString());
            if (Sent("requiredDocuments")) opportunity.RequiredDocuments = Lines(form["requiredDocuments"].ToString());
            if (Sent("applicationDeadline"))
            {
                var raw = Raw("applicationDeadline");
                if (raw is null) opportunity.ApplicationDeadline = null;
                else if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d))
                    opportunity.ApplicationDeadline = new DateTimeOffset(d.UtcDateTime.Date.AddDays(1).AddSeconds(-1), TimeSpan.Zero);
                else Errors["applicationDeadline"] = "Tarixi düzgün yazın.";
            }
        }

        // One kind per uploaded document, in the same order as the files.
        foreach (var kind in form["documentKinds"])
        {
            var k = kind?.Trim().ToLowerInvariant() ?? "other";
            if (!AdminLandRules.DocumentKinds.Contains(k)) Errors["documents"] = "Sənəd növünü siyahıdan seçin.";
            DocumentKinds.Add(k);
        }
        if (form.Files.GetFiles("documents").Count != DocumentKinds.Count && form.Files.GetFiles("documents").Count > 0)
            Errors["documents"] = "Hər sənəd üçün növ seçin.";
    }

    private static JsonElement? ParseObject(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (JsonException) { return null; }
    }

    private static List<string> Lines(string raw) =>
        raw.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.Length > 0).Select(x => x.Length <= 300 ? x : x[..300]).Take(20).ToList();
}
