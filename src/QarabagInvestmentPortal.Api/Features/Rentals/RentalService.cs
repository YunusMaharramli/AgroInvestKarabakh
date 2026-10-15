using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Rentals;

public sealed class RentalService(
    AppDbContext db,
    PrivateFileStorage storage,
    NotificationService notifications,
    TimeProvider clock)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<List<RentalListingDto>> PublicListingsAsync(string? region, string? propertyType, string? search, CancellationToken ct)
    {
        var q = db.RentalListings.AsNoTracking().Where(x => x.Status == RentalListingStatus.Published
            && !db.RentalLeases.Any(l => l.ListingId == x.Id && l.EndedAt == null));
        if (!string.IsNullOrWhiteSpace(region) && region != "all") q = q.Where(x => x.Region == region);
        if (Enum.TryParse<RentalPropertyType>(propertyType, true, out var parsedType)) q = q.Where(x => x.PropertyType == parsedType);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("%", "").Replace("_", "")}%";
            q = q.Where(x => EF.Functions.ILike(x.Title, pattern) || EF.Functions.ILike(x.Region, pattern)
                || EF.Functions.ILike(x.LegalDesignation, pattern) || EF.Functions.ILike(x.PermittedUse, pattern));
        }
        var rows = await q.Include(x => x.DocumentRequirements).OrderByDescending(x => x.PublishedAt).ToListAsync(ct);
        return rows.Select(x => ToListingDto(x, isAvailable: true, includeAdmin: false)).ToList();
    }

    public async Task<RentalListingDto?> PublicListingAsync(string id, CancellationToken ct)
    {
        var item = await db.RentalListings.AsNoTracking().Include(x => x.DocumentRequirements)
            .FirstOrDefaultAsync(x => x.Id == id && x.Status == RentalListingStatus.Published, ct);
        if (item is null) return null;
        var available = !await db.RentalLeases.AnyAsync(l => l.ListingId == id && l.EndedAt == null, ct);
        return available ? ToListingDto(item, true, false) : null;
    }

    public async Task<List<RentalListingDto>> AdminListingsAsync(string? status, string? search, CancellationToken ct)
    {
        var q = db.RentalListings.AsNoTracking().Include(x => x.DocumentRequirements).Include(x => x.Documents).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RentalListingStatus>(status, true, out var parsed)) q = q.Where(x => x.Status == parsed);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("%", "").Replace("_", "")}%";
            q = q.Where(x => EF.Functions.ILike(x.Title, pattern) || EF.Functions.ILike(x.Region, pattern));
        }
        var items = await q.OrderByDescending(x => x.UpdatedAt).Take(500).ToListAsync(ct);
        var leases = (await db.RentalLeases.AsNoTracking().Where(l => l.EndedAt == null && items.Select(i => i.Id).Contains(l.ListingId))
            .Select(l => l.ListingId).ToListAsync(ct)).ToHashSet();
        return items.Select(x => ToListingDto(x, !leases.Contains(x.Id), true)).ToList();
    }

    public async Task<RentalListingDto?> AdminListingAsync(string id, CancellationToken ct)
    {
        var item = await db.RentalListings.AsNoTracking().Include(x => x.DocumentRequirements).Include(x => x.Documents)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        var available = !await db.RentalLeases.AnyAsync(l => l.ListingId == id && l.EndedAt == null, ct);
        return ToListingDto(item, available, true);
    }

    public async Task<Outcome<RentalListingDto>> CreateListingAsync(string adminId, RentalListingInput input, CancellationToken ct)
    {
        var errors = RentalRules.ValidateListing(input);
        if (errors.Count > 0) return Outcome<RentalListingDto>.Fail(400, string.Join(" ", errors.Values));
        var now = clock.GetUtcNow();
        var row = new RentalListing { Id = Ids.New("rlisting"), CreatedById = adminId, CreatedAt = now };
        ApplyListing(row, input);
        row.UpdatedById = adminId;
        row.UpdatedAt = now;
        SetRequirements(row, input.DocumentRequirements);
        db.RentalListings.Add(row);
        Audit(adminId, "listing_created", "listing", row.Id);
        await db.SaveChangesAsync(ct);
        return Outcome<RentalListingDto>.Success((await AdminListingAsync(row.Id, ct))!);
    }

    public async Task<Outcome<RentalListingDto>> UpdateListingAsync(string id, string adminId, RentalListingInput input, CancellationToken ct)
    {
        var errors = RentalRules.ValidateListing(input);
        if (errors.Count > 0) return Outcome<RentalListingDto>.Fail(400, string.Join(" ", errors.Values));
        var row = await db.RentalListings.Include(x => x.DocumentRequirements).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return Outcome<RentalListingDto>.Fail(404, "İcarə elanı tapılmadı.");
        if (row.Status is RentalListingStatus.Archived) return Outcome<RentalListingDto>.Fail(409, "Arxivdə olan elan redaktə edilə bilməz.");
        if (await HasActiveLeaseAsync(id, ct)) return Outcome<RentalListingDto>.Fail(409, "Aktiv icarə müddətində elan redaktə edilə bilməz.");
        var wasPublished = row.Status == RentalListingStatus.Published;
        ApplyListing(row, input);
        if (wasPublished)
        {
            row.Status = RentalListingStatus.Draft;
            Audit(adminId, "listing_unpublished_for_edit", "listing", id);
        }
        row.UpdatedById = adminId;
        row.UpdatedAt = clock.GetUtcNow();
        db.RentalDocumentRequirements.RemoveRange(row.DocumentRequirements);
        row.DocumentRequirements.Clear();
        SetRequirements(row, input.DocumentRequirements);
        Audit(adminId, "listing_updated", "listing", row.Id);
        await db.SaveChangesAsync(ct);
        return Outcome<RentalListingDto>.Success((await AdminListingAsync(row.Id, ct))!);
    }

    public async Task<Outcome<RentalListingDto>> PublishAsync(string id, string adminId, CancellationToken ct)
    {
        var row = await db.RentalListings.Include(x => x.DocumentRequirements).Include(x => x.Documents).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return Outcome<RentalListingDto>.Fail(404, "İcarə elanı tapılmadı.");
        if (row.Status == RentalListingStatus.Archived) return Outcome<RentalListingDto>.Fail(409, "Arxivdə olan elan dərc edilə bilməz.");
        if (!row.AuthorityReviewed || row.AuthorityBasis.Length == 0 || row.Procedure == RentalProcedure.LegalReviewRequired)
            return Outcome<RentalListingDto>.Fail(409, "Dərc üçün icarəyə vermək səlahiyyəti və müvafiq prosedur yoxlanmalıdır.");
        if (!row.Documents.Any(d => d.Kind is "authority" or "ownership" or "mandate" or "registry"))
            return Outcome<RentalListingDto>.Fail(409, "Dərcdən əvvəl səlahiyyət və ya mülkiyyət əsasını göstərən məxfi sənəd əlavə edin.");
        if (row.DocumentRequirements.Count == 0)
            return Outcome<RentalListingDto>.Fail(409, "Ən azı bir müraciətçi əhatə dairəsi və sənəd qaydası konfiqurasiya edilməlidir.");
        row.Status = RentalListingStatus.Published;
        row.PublishedAt = clock.GetUtcNow();
        row.UpdatedAt = row.PublishedAt.Value;
        row.UpdatedById = adminId;
        Audit(adminId, "listing_published", "listing", id);
        await db.SaveChangesAsync(ct);
        return Outcome<RentalListingDto>.Success((await AdminListingAsync(id, ct))!);
    }

    public async Task<Outcome<RentalListingDto>> WithdrawAsync(string id, string adminId, string? reason, CancellationToken ct)
    {
        reason = reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000) return Outcome<RentalListingDto>.Fail(400, "Elanı geri götürmə səbəbini yazın.");
        var row = await db.RentalListings.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return Outcome<RentalListingDto>.Fail(404, "İcarə elanı tapılmadı.");
        if (row.Status != RentalListingStatus.Published) return Outcome<RentalListingDto>.Fail(409, "Yalnız dərc olunmuş elan geri götürülə bilər.");
        row.Status = RentalListingStatus.Withdrawn;
        row.WithdrawalReason = reason;
        row.UpdatedById = adminId;
        row.UpdatedAt = clock.GetUtcNow();
        Audit(adminId, "listing_withdrawn", "listing", id);
        await db.SaveChangesAsync(ct);
        return Outcome<RentalListingDto>.Success((await AdminListingAsync(id, ct))!);
    }

    public async Task<Outcome<RentalListingDocumentDto>> AddListingDocumentAsync(string listingId, string adminId, IFormCollection form, CancellationToken ct)
    {
        var kind = form["kind"].ToString().Trim().ToLowerInvariant();
        if (kind is not ("authority" or "ownership" or "mandate" or "registry" or "other"))
            return Outcome<RentalListingDocumentDto>.Fail(400, "Sənəd növü düzgün seçilməyib.");
        var listing = await db.RentalListings.FirstOrDefaultAsync(x => x.Id == listingId, ct);
        if (listing is null) return Outcome<RentalListingDocumentDto>.Fail(404, "İcarə elanı tapılmadı.");
        if (listing.Status == RentalListingStatus.Archived) return Outcome<RentalListingDocumentDto>.Fail(409, "Arxivdə olan elana sənəd əlavə edilə bilməz.");
        var (files, fileError) = await PrivateFileStorage.ValidateAsync(form.Files.GetFiles("documents"), FileRule.RentalDocuments, ct);
        if (fileError is not null) return Outcome<RentalListingDocumentDto>.Fail(400, fileError);
        if (files.Count == 0) return Outcome<RentalListingDocumentDto>.Fail(400, "Sənəd seçin.");
        if (files.Count > 1) return Outcome<RentalListingDocumentDto>.Fail(400, "Bir dəfə yalnız bir sənəd yükləyin.");
        if (listing.Status == RentalListingStatus.Published)
        {
            listing.Status = RentalListingStatus.Draft;
            listing.UpdatedById = adminId;
            listing.UpdatedAt = clock.GetUtcNow();
            Audit(adminId, "listing_unpublished_for_document_change", "listing", listingId);
        }
        var file = files[0];
        var id = Ids.New("rldoc");
        var key = await storage.SaveAsync($"rental-listings/{listingId}", id, file, ct);
        var row = new RentalListingDocument { Id = id, ListingId = listingId, Kind = kind, FileName = SafeName(file.File.FileName), ContentType = file.ContentType, SizeBytes = file.File.Length, StorageKey = key, UploadedById = adminId, UploadedAt = clock.GetUtcNow() };
        db.RentalListingDocuments.Add(row);
        Audit(adminId, "listing_document_added", "listing_document", id);
        try { await db.SaveChangesAsync(ct); }
        catch { storage.TryDelete(key); throw; }
        return Outcome<RentalListingDocumentDto>.Success(ToListingDocumentDto(row));
    }

    public async Task<ApplicantProfileDto?> GetProfileAsync(string userId, CancellationToken ct) =>
        await db.RentalApplicantProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, ct) is { } p ? ApplicantProfileDto.From(p) : null;

    public async Task<Outcome<ApplicantProfileDto>> SaveProfileAsync(string userId, ApplicantProfileInput input, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Outcome<ApplicantProfileDto>.Fail(404, "Hesab tapılmadı.");
        input = input with
        {
            ContactEmail = string.IsNullOrWhiteSpace(input.ContactEmail) ? user.Email : input.ContactEmail,
            ContactPhone = string.IsNullOrWhiteSpace(input.ContactPhone) ? user.Phone : input.ContactPhone,
        };
        var errors = RentalRules.Validate(input);
        if (errors.Count > 0) return Outcome<ApplicantProfileDto>.Fail(400, string.Join(" ", errors.Values));
        var now = clock.GetUtcNow();
        var row = await db.RentalApplicantProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        var created = row is null;
        row ??= new RentalApplicantProfile { Id = Ids.New("rprofile"), UserId = userId, CreatedAt = now };
        row.ApplicantType = input.ApplicantType;
        row.ForeignKind = input.ForeignKind;
        var isIndividual = input.ApplicantType == ApplicantType.Individual || input.ForeignKind == ForeignApplicantKind.Individual;
        var isEntity = input.ApplicantType == ApplicantType.LegalEntity || input.ForeignKind == ForeignApplicantKind.LegalEntity;
        row.FullLegalName = isIndividual ? Clean(input.FullLegalName) : string.Empty;
        row.Citizenship = input.ApplicantType != ApplicantType.LegalEntity ? Clean(input.Citizenship) : string.Empty;
        row.CountryOfResidence = isIndividual ? Clean(input.CountryOfResidence) : string.Empty;
        row.ResidenceAddress = isIndividual ? Clean(input.ResidenceAddress) : string.Empty;
        row.IdDocumentType = isIndividual ? Clean(input.IdDocumentType) : string.Empty;
        row.IdDocumentNumber = isIndividual ? Clean(input.IdDocumentNumber) : string.Empty;
        row.Fin = input.ApplicantType == ApplicantType.Individual ? Clean(input.Fin) : string.Empty;
        row.LegalName = isEntity ? Clean(input.LegalName) : string.Empty;
        row.LegalForm = isEntity ? Clean(input.LegalForm) : string.Empty;
        row.CountryOfIncorporation = isEntity ? Clean(input.CountryOfIncorporation) : string.Empty;
        row.RegistrationIdentifier = isEntity ? Clean(input.RegistrationIdentifier) : string.Empty;
        row.TaxIdentifier = input.ApplicantType == ApplicantType.LegalEntity ? Clean(input.TaxIdentifier) : string.Empty;
        row.RegisteredAddress = isEntity ? Clean(input.RegisteredAddress) : string.Empty;
        row.ContactPhone = Clean(input.ContactPhone);
        row.ContactEmail = Clean(input.ContactEmail).ToLowerInvariant();
        row.ContactAddress = Clean(input.ContactAddress);
        row.RepresentativeName = isEntity ? Clean(input.RepresentativeName) : string.Empty;
        row.RepresentativePosition = isEntity ? Clean(input.RepresentativePosition) : string.Empty;
        row.AuthorityToAct = isEntity ? Clean(input.AuthorityToAct) : string.Empty;
        row.ConsentGrantedAt = now;
        row.ConsentVersion = "rental-profile-v1";
        row.UpdatedAt = now;
        if (created) db.RentalApplicantProfiles.Add(row);
        await db.SaveChangesAsync(ct);
        return Outcome<ApplicantProfileDto>.Success(ApplicantProfileDto.From(row));
    }

    public async Task<Outcome<RentalApplicationDto>> CreateDraftAsync(string userId, RentalApplicationDraftInput input, CancellationToken ct)
    {
        var profile = await db.RentalApplicantProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile is null) return Outcome<RentalApplicationDto>.Fail(400, "Əvvəlcə müraciətçi profilinizi tamamlayın.");
        var listing = await db.RentalListings.Include(x => x.DocumentRequirements).FirstOrDefaultAsync(x => x.Id == input.ListingId, ct);
        if (listing is null || listing.Status != RentalListingStatus.Published) return Outcome<RentalApplicationDto>.Fail(404, "İcarə elanı tapılmadı.");
        if (await HasActiveLeaseAsync(listing.Id, ct)) return Outcome<RentalApplicationDto>.Fail(409, "Bu əmlak üzrə aktiv icarə mövcuddur.");
        if (await db.RentalApplications.AnyAsync(x => x.ListingId == listing.Id && x.ApplicantUserId == userId, ct))
            return Outcome<RentalApplicationDto>.Fail(409, "Bu elana artıq müraciət yaratmısınız.");
        if (string.IsNullOrWhiteSpace(input.IntendedUse) || input.IntendedUse.Trim().Length > 1000)
            return Outcome<RentalApplicationDto>.Fail(400, "İstifadə məqsədini daxil edin (ən çox 1000 simvol).");
        if (input.Message?.Length > 2000) return Outcome<RentalApplicationDto>.Fail(400, "Mesaj ən çox 2000 simvol ola bilər.");
        if (input.ProposedLeaseMonths is <= 0) return Outcome<RentalApplicationDto>.Fail(400, "İcarə müddəti müsbət aylarla göstərilməlidir.");
        if (input.ProposedLeaseMonths is { } months && ((listing.MinimumLeaseMonths is { } min && months < min) || (listing.MaximumLeaseMonths is { } max && months > max)))
            return Outcome<RentalApplicationDto>.Fail(400, "Təklif olunan müddət elan üzrə mümkün aralıqdan kənardadır.");
        var now = clock.GetUtcNow();
        var row = new RentalApplication
        {
            Id = Ids.New("rapp"), ReferenceNumber = $"REN-{Guid.NewGuid():N}"[..14].ToUpperInvariant(), ListingId = listing.Id,
            ApplicantUserId = userId, ApplicantProfileId = profile.Id, IntendedUse = input.IntendedUse.Trim(),
            ProposedLeaseMonths = input.ProposedLeaseMonths, Message = input.Message?.Trim() ?? string.Empty,
            Status = RentalApplicationStatus.Draft, CreatedAt = now, UpdatedAt = now,
        };
        db.RentalApplications.Add(row);
        AddHistory(row, userId, RentalApplicationStatus.Draft, "Qaralama yaradıldı.", now);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The unique listing/applicant index is the final guard when two create requests race.
            return Outcome<RentalApplicationDto>.Fail(409, "Bu elana artıq müraciət yaratmısınız.");
        }
        return Outcome<RentalApplicationDto>.Success((await GetApplicantApplicationAsync(row.Id, userId, ct))!);
    }

    public async Task<Outcome<RentalApplicationDto>> AddApplicationDocumentsAsync(string id, string userId, IFormCollection form, CancellationToken ct)
    {
        var app = await db.RentalApplications.Include(x => x.Listing).ThenInclude(x => x!.DocumentRequirements)
            .Include(x => x.Documents).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (app is null || app.ApplicantUserId != userId) return Outcome<RentalApplicationDto>.Fail(404, "Müraciət tapılmadı.");
        if (app.Status is not (RentalApplicationStatus.Draft or RentalApplicationStatus.AdditionalInformationRequired))
            return Outcome<RentalApplicationDto>.Fail(409, "Sənədlər yalnız qaralama və əlavə məlumat mərhələsində yüklənə bilər.");
        var (files, fileError) = await PrivateFileStorage.ValidateAsync(form.Files.GetFiles("documents"), FileRule.RentalDocuments, ct);
        if (fileError is not null) return Outcome<RentalApplicationDto>.Fail(400, fileError);
        var response = form["response"].ToString().Trim();
        if (response.Length > 2000) return Outcome<RentalApplicationDto>.Fail(400, "Cavab ən çox 2000 simvol ola bilər.");
        if (app.Status == RentalApplicationStatus.AdditionalInformationRequired && response.Length == 0 && files.Count == 0)
            return Outcome<RentalApplicationDto>.Fail(400, "Əlavə məlumatın cavabını yazın və ya ən azı bir sənəd yükləyin.");
        var kinds = form["kinds"].Select(x => (x ?? string.Empty).Trim().ToLowerInvariant()).ToList();
        if (kinds.Count != files.Count || kinds.Any(string.IsNullOrWhiteSpace)) return Outcome<RentalApplicationDto>.Fail(400, "Hər fayl üçün sənəd növünü seçin.");
        var scope = await db.RentalApplicantProfiles.Where(p => p.UserId == userId).Select(p => new { p.ApplicantType, p.ForeignKind }).SingleAsync(ct);
        for (var i = 0; i < files.Count; i++)
        {
            var requirement = app.Listing!.DocumentRequirements.FirstOrDefault(r => r.Kind == kinds[i]
                && RentalRules.MatchesScope(r.ApplicantScope, scope.ApplicantType, scope.ForeignKind));
            if (requirement is null) return Outcome<RentalApplicationDto>.Fail(400, "Bu elan üçün uyğun sənəd növü konfiqurasiya edilməyib.");
        }
        if (response.Length > 0) app.AdditionalInformationResponse = response;
        var keys = new List<string>();
        try
        {
            for (var i = 0; i < files.Count; i++)
            {
                var documentId = Ids.New("radoc");
                var key = await storage.SaveAsync($"rental-applications/{id}", documentId, files[i], ct);
                keys.Add(key);
                db.RentalApplicationDocuments.Add(new RentalApplicationDocument
                {
                    Id = documentId, ApplicationId = id, Kind = kinds[i], FileName = SafeName(files[i].File.FileName),
                    ContentType = files[i].ContentType, SizeBytes = files[i].File.Length, StorageKey = key, UploadedAt = clock.GetUtcNow(),
                });
            }
            await db.SaveChangesAsync(ct);
        }
        catch { foreach (var key in keys) storage.TryDelete(key); throw; }
        return Outcome<RentalApplicationDto>.Success((await GetApplicantApplicationAsync(id, userId, ct))!);
    }

    public async Task<Outcome<RentalApplicationDto>> SubmitAsync(string id, string userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockApplicationAsync(id, ct);
        var app = await db.RentalApplications.Include(x => x.Listing).ThenInclude(x => x!.DocumentRequirements)
            .Include(x => x.Documents).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (app is null || app.ApplicantUserId != userId) return Outcome<RentalApplicationDto>.Fail(404, "Müraciət tapılmadı.");
        if (app.Status is not (RentalApplicationStatus.Draft or RentalApplicationStatus.AdditionalInformationRequired))
            return Outcome<RentalApplicationDto>.Fail(409, "Bu müraciət hazırda göndərilə bilməz.");
        if (app.Listing?.Status != RentalListingStatus.Published || await HasActiveLeaseAsync(app.ListingId, ct))
            return Outcome<RentalApplicationDto>.Fail(409, "Elan artıq müraciət qəbul etmir.");
        var profile = await db.RentalApplicantProfiles.FirstOrDefaultAsync(x => x.Id == app.ApplicantProfileId && x.UserId == userId, ct);
        if (profile is null) return Outcome<RentalApplicationDto>.Fail(400, "Müraciətçi profili tapılmadı.");
        var required = app.Listing.DocumentRequirements.Where(r => r.IsRequired && RentalRules.MatchesScope(r.ApplicantScope, profile.ApplicantType, profile.ForeignKind)).Select(r => r.Kind).Distinct().ToHashSet(StringComparer.OrdinalIgnoreCase);
        var uploaded = app.Documents.Select(d => d.Kind).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = required.Except(uploaded).ToList();
        if (missing.Count > 0) return Outcome<RentalApplicationDto>.Fail(400, "Tələb olunan sənədlər çatışmır: " + string.Join(", ", missing));
        var now = clock.GetUtcNow();
        var from = app.Status;
        var to = from == RentalApplicationStatus.Draft ? RentalApplicationStatus.Submitted : RentalApplicationStatus.UnderReview;
        if (!RentalRules.CanTransition(from, to)) return Outcome<RentalApplicationDto>.Fail(409, "Müraciət statusu dəyişdirilə bilməz.");
        if (from == RentalApplicationStatus.AdditionalInformationRequired && string.IsNullOrWhiteSpace(app.AdditionalInformationResponse))
        {
            var requestedAt = await db.RentalApplicationHistory.Where(h => h.ApplicationId == app.Id && h.Status == RentalApplicationStatus.AdditionalInformationRequired)
                .OrderByDescending(h => h.CreatedAt).Select(h => (DateTimeOffset?)h.CreatedAt).FirstOrDefaultAsync(ct);
            if (requestedAt is null || !app.Documents.Any(d => d.UploadedAt > requestedAt.Value))
                return Outcome<RentalApplicationDto>.Fail(400, "Əlavə məlumatın cavabını yazın və ya yeni sənəd yükləyin.");
        }
        if (app.ApplicantSnapshot is null)
        {
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct);
            app.ApplicantSnapshot = JsonSerializer.Serialize(new ApplicantSnapshot(profile, user?.FirstName, user?.LastName), JsonOptions);
            app.SubmittedAt = now;
        }
        app.Status = to;
        app.UpdatedAt = now;
        AddHistory(app, userId, to, from == RentalApplicationStatus.Draft ? "Müraciət göndərildi." : "Tələb olunan əlavə məlumat təqdim edildi.", now);
        await notifications.NotifyAdminsAsync("Yeni icarə müraciəti", $"{app.ReferenceNumber} nömrəli müraciət baxış üçün göndərildi.", ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Outcome<RentalApplicationDto>.Success((await GetApplicantApplicationAsync(id, userId, ct))!);
    }

    public async Task<Outcome<RentalApplicationDto>> WithdrawAsync(string id, string userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockApplicationAsync(id, ct);
        var app = await db.RentalApplications.FirstOrDefaultAsync(x => x.Id == id && x.ApplicantUserId == userId, ct);
        if (app is null) return Outcome<RentalApplicationDto>.Fail(404, "Müraciət tapılmadı.");
        if (!RentalRules.CanTransition(app.Status, RentalApplicationStatus.Withdrawn)) return Outcome<RentalApplicationDto>.Fail(409, "Bu mərhələdə müraciəti geri götürmək mümkün deyil.");
        var now = clock.GetUtcNow();
        app.Status = RentalApplicationStatus.Withdrawn;
        app.UpdatedAt = now;
        AddHistory(app, userId, app.Status, "Müraciət istifadəçi tərəfindən geri götürüldü.", now);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Outcome<RentalApplicationDto>.Success((await GetApplicantApplicationAsync(id, userId, ct))!);
    }

    public async Task<List<RentalApplicationDto>> ApplicantApplicationsAsync(string userId, CancellationToken ct)
    {
        var items = await db.RentalApplications.AsNoTracking().Where(x => x.ApplicantUserId == userId)
            .Include(x => x.Listing).Include(x => x.Documents).OrderByDescending(x => x.UpdatedAt).ToListAsync(ct);
        return await ToApplicationDtosAsync(items, includeSensitive: false, ct);
    }

    public async Task<RentalApplicationDto?> GetApplicantApplicationAsync(string id, string userId, CancellationToken ct)
    {
        var item = await db.RentalApplications.AsNoTracking().Include(x => x.Listing).Include(x => x.Documents)
            .Include(x => x.Listing).ThenInclude(x => x!.DocumentRequirements).FirstOrDefaultAsync(x => x.Id == id && x.ApplicantUserId == userId, ct);
        if (item is null) return null;
        var profile = await db.RentalApplicantProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == item.ApplicantProfileId, ct);
        return (await ToApplicationDtosAsync([item], includeSensitive: false, ct, profile, includeDetails: true)).Single();
    }

    public async Task<List<RentalApplicationDto>> AdminApplicationsAsync(string? status, string? search, CancellationToken ct)
    {
        var q = db.RentalApplications.AsNoTracking().Include(x => x.Listing).Include(x => x.Documents).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RentalApplicationStatus>(status, true, out var parsed)) q = q.Where(x => x.Status == parsed);
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(x => x.ReferenceNumber == search.Trim());
        var items = await q.OrderByDescending(x => x.UpdatedAt).Take(500).ToListAsync(ct);
        return await ToApplicationDtosAsync(items, includeSensitive: false, ct);
    }

    public async Task<RentalApplicationDto?> AdminApplicationAsync(string id, CancellationToken ct)
    {
        var item = await db.RentalApplications.AsNoTracking().Include(x => x.Listing).ThenInclude(x => x!.DocumentRequirements).Include(x => x.Documents).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        var profile = await db.RentalApplicantProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == item.ApplicantProfileId, ct);
        return (await ToApplicationDtosAsync([item], includeSensitive: true, ct, profile, includeDetails: true)).Single();
    }

    public Task<Outcome<RentalApplicationDto>> BeginReviewAsync(string id, string adminId, CancellationToken ct) =>
        TransitionAsync(id, adminId, RentalApplicationStatus.UnderReview, null, ct);

    public Task<Outcome<RentalApplicationDto>> RequestInformationAsync(string id, string adminId, string? reason, CancellationToken ct) =>
        TransitionAsync(id, adminId, RentalApplicationStatus.AdditionalInformationRequired, reason, ct);

    public Task<Outcome<RentalApplicationDto>> ApproveAsync(string id, string adminId, string? reason, CancellationToken ct) =>
        TransitionAsync(id, adminId, RentalApplicationStatus.Approved, reason, ct);

    public Task<Outcome<RentalApplicationDto>> RejectAsync(string id, string adminId, string? reason, CancellationToken ct) =>
        TransitionAsync(id, adminId, RentalApplicationStatus.Rejected, reason, ct);

    public async Task<Outcome<RentalLeaseDto>> FinalizeLeaseAsync(string applicationId, string adminId, FinalizeLeaseInput input, CancellationToken ct)
    {
        var agreementReference = input.AgreementReference.Trim();
        if (agreementReference.Length is 0 or > 200) return Outcome<RentalLeaseDto>.Fail(400, "Müqavilə istinadını daxil edin.");
        if (input.StartsAt == default || input.EndsAt <= input.StartsAt) return Outcome<RentalLeaseDto>.Fail(400, "İcarənin başlanğıc və bitmə tarixlərini yoxlayın.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var appBefore = await db.RentalApplications.AsNoTracking().FirstOrDefaultAsync(x => x.Id == applicationId, ct);
        if (appBefore is null) return Outcome<RentalLeaseDto>.Fail(404, "Müraciət tapılmadı.");
        await LockListingAsync(appBefore.ListingId, ct);
        var app = await db.RentalApplications.Include(x => x.Listing).FirstOrDefaultAsync(x => x.Id == applicationId, ct);
        if (app?.Listing is null) return Outcome<RentalLeaseDto>.Fail(404, "Elan tapılmadı.");
        if (app.Status != RentalApplicationStatus.Approved) return Outcome<RentalLeaseDto>.Fail(409, "Yalnız təsdiqlənmiş müraciət əsasında icarə rəsmiləşdirilə bilər.");
        if (app.Listing.Status != RentalListingStatus.Published) return Outcome<RentalLeaseDto>.Fail(409, "Elan dərc olunmuş vəziyyətdə olmalıdır.");
        if (await HasActiveLeaseAsync(app.ListingId, ct)) return Outcome<RentalLeaseDto>.Fail(409, "Bu əmlak üzrə başqa aktiv icarə mövcuddur.");
        var lease = new RentalLease
        {
            Id = Ids.New("lease"), ListingId = app.ListingId, ApplicationId = app.Id, AgreementReference = agreementReference,
            StartsAt = input.StartsAt, EndsAt = input.EndsAt, FinalizedAt = clock.GetUtcNow(), FinalizedById = adminId,
        };
        db.RentalLeases.Add(lease);
        Audit(adminId, "lease_finalized", "lease", lease.Id);
        notifications.Notify(app.ApplicantUserId, "İcarə müqaviləsi rəsmiləşdirildi", $"{app.ReferenceNumber} nömrəli müraciət üzrə icarə rəsmiləşdirildi.");
        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Outcome<RentalLeaseDto>.Fail(409, "Bu əmlak üzrə başqa aktiv icarə paralel olaraq rəsmiləşdirilib.");
        }
        return Outcome<RentalLeaseDto>.Success(ToLeaseDto(lease));
    }

    public async Task<Outcome<RentalLeaseDto>> EndLeaseAsync(string id, string adminId, CancellationToken ct)
    {
        var row = await db.RentalLeases.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return Outcome<RentalLeaseDto>.Fail(404, "İcarə qeydi tapılmadı.");
        if (row.EndedAt is not null) return Outcome<RentalLeaseDto>.Fail(409, "İcarə artıq başa çatdırılıb.");
        row.EndedAt = clock.GetUtcNow();
        Audit(adminId, "lease_ended", "lease", id);
        await db.SaveChangesAsync(ct);
        return Outcome<RentalLeaseDto>.Success(ToLeaseDto(row));
    }

    public async Task<PrivateRentalDocument?> GetDocumentAsync(string id, string actorId, bool isAdmin, string? applicantId, CancellationToken ct)
    {
        var listingDocument = await db.RentalListingDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (listingDocument is not null)
        {
            if (!isAdmin) return null;
            Audit(actorId, "private_document_accessed", "listing_document", id);
            await db.SaveChangesAsync(ct);
            return new PrivateRentalDocument(listingDocument.StorageKey, listingDocument.ContentType, listingDocument.FileName);
        }
        var row = await db.RentalApplicationDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return null;
        var app = await db.RentalApplications.AsNoTracking().FirstOrDefaultAsync(x => x.Id == row.ApplicationId, ct);
        if (app is null || (!isAdmin && (applicantId is null || app.ApplicantUserId != applicantId))) return null;
        Audit(actorId, "private_document_accessed", "application_document", id);
        await db.SaveChangesAsync(ct);
        return new PrivateRentalDocument(row.StorageKey, row.ContentType, row.FileName);
    }

    private async Task<Outcome<RentalApplicationDto>> TransitionAsync(string id, string adminId, RentalApplicationStatus to, string? reason, CancellationToken ct)
    {
        reason = reason?.Trim() ?? string.Empty;
        if ((to is RentalApplicationStatus.AdditionalInformationRequired or RentalApplicationStatus.Rejected) && string.IsNullOrWhiteSpace(reason))
            return Outcome<RentalApplicationDto>.Fail(400, to == RentalApplicationStatus.Rejected ? "Rədd səbəbini yazın." : "Tələb olunan əlavə məlumatı qeyd edin.");
        if (reason.Length > 2000) return Outcome<RentalApplicationDto>.Fail(400, "Səbəb ən çox 2000 simvol ola bilər.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockApplicationAsync(id, ct);
        var app = await db.RentalApplications.Include(x => x.Listing).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (app is null) return Outcome<RentalApplicationDto>.Fail(404, "Müraciət tapılmadı.");
        if (!RentalRules.CanTransition(app.Status, to)) return Outcome<RentalApplicationDto>.Fail(409, "Bu status keçidi mümkün deyil.");
        var now = clock.GetUtcNow();
        app.Status = to;
        if (to == RentalApplicationStatus.AdditionalInformationRequired) app.AdditionalInformationResponse = string.Empty;
        app.DecisionReason = reason;
        app.DecidedById = to is RentalApplicationStatus.Approved or RentalApplicationStatus.Rejected ? adminId : null;
        app.DecidedAt = to is RentalApplicationStatus.Approved or RentalApplicationStatus.Rejected ? now : null;
        app.UpdatedAt = now;
        AddHistory(app, adminId, to, reason, now);
        notifications.Notify(app.ApplicantUserId, NotificationTitle(to), NotificationMessage(to, app.ReferenceNumber, reason));
        Audit(adminId, "application_" + to.ToString().ToLowerInvariant(), "application", id);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Outcome<RentalApplicationDto>.Success((await AdminApplicationAsync(id, ct))!);
    }

    private async Task<List<RentalApplicationDto>> ToApplicationDtosAsync(List<RentalApplication> items, bool includeSensitive, CancellationToken ct, RentalApplicantProfile? profile = null, bool includeDetails = false)
    {
        if (items.Count == 0) return [];
        var ids = items.Select(x => x.Id).ToList();
        var history = await db.RentalApplicationHistory.AsNoTracking().Where(x => ids.Contains(x.ApplicationId)).OrderBy(x => x.CreatedAt).ToListAsync(ct);
        var profiles = includeDetails && profile is null && includeSensitive
            ? await db.RentalApplicantProfiles.AsNoTracking().Where(p => items.Select(i => i.ApplicantProfileId).Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct)
            : new Dictionary<string, RentalApplicantProfile>();
        return items.Select(x =>
        {
            RentalApplicantProfile? applicationProfile = null;
            if (includeDetails && !string.IsNullOrWhiteSpace(x.ApplicantSnapshot))
                applicationProfile = JsonSerializer.Deserialize<ApplicantSnapshot>(x.ApplicantSnapshot, JsonOptions)?.Profile;
            if (includeDetails && applicationProfile is null && profile?.Id == x.ApplicantProfileId) applicationProfile = profile;
            if (applicationProfile is null && profiles.TryGetValue(x.ApplicantProfileId, out var found)) applicationProfile = found;
            return new RentalApplicationDto(
                x.Id, x.ReferenceNumber, x.ListingId, x.Listing?.Title ?? string.Empty, x.Status, x.IntendedUse, x.ProposedLeaseMonths,
                x.Message, includeDetails ? x.AdditionalInformationResponse : string.Empty, x.DecisionReason, x.CreatedAt, x.SubmittedAt,
                history.Where(h => h.ApplicationId == x.Id).Select(h => new RentalApplicationHistoryDto(h.Status.ToString(), h.Comment, h.CreatedAt)).ToList(),
                includeDetails ? x.Documents.OrderBy(d => d.UploadedAt).Select(d => new RentalApplicationDocumentDto(d.Id, d.Kind, d.FileName, d.UploadedAt, $"/api/documents/rentals/{d.Id}")).ToList() : [],
                x.Listing?.DocumentRequirements.Select(r => new RentalRequirementDto(r.ApplicantScope, r.Kind, r.Label, r.IsRequired)).ToList() ?? [],
                applicationProfile is not null ? ApplicantProfileDto.From(applicationProfile) : null,
                includeSensitive ? x.ApplicantSnapshot : null);
        }).ToList();
    }

    private static RentalListingDto ToListingDto(RentalListing x, bool isAvailable, bool includeAdmin) => new(
        x.Id, x.PropertyType, x.Title, x.Description, x.OwnerCategory, x.LegalDesignation, x.Region, x.Address, x.Area, x.AreaUnit,
        x.PermittedUse, x.RentAmount, x.Currency, x.PaymentPeriod, x.MinimumLeaseMonths, x.MaximumLeaseMonths, x.DepositAmount,
        x.AdditionalCharges, x.Infrastructure, x.PhotoUrls, x.Procedure, x.ProcedureReference, x.ProcedureNotes, x.EligibilityRules,
        x.Status, isAvailable, x.DocumentRequirements.OrderBy(r => r.Kind).Select(r => new RentalRequirementDto(r.ApplicantScope, r.Kind, r.Label, r.IsRequired)).ToList(),
        includeAdmin ? x.Documents.OrderBy(d => d.UploadedAt).Select(ToListingDocumentDto).ToList() : null,
        includeAdmin ? x.AuthorityBasis : null, includeAdmin ? x.AuthorityReference : null, includeAdmin ? x.AuthorityReviewed : null, x.UpdatedAt);

    private static RentalListingDocumentDto ToListingDocumentDto(RentalListingDocument d) =>
        new(d.Id, d.Kind, d.FileName, d.UploadedAt, $"/api/documents/rentals/{d.Id}");

    private async Task<bool> HasActiveLeaseAsync(string listingId, CancellationToken ct) =>
        await db.RentalLeases.AnyAsync(x => x.ListingId == listingId && x.EndedAt == null, ct);

    private async Task LockApplicationAsync(string id, CancellationToken ct)
    {
        _ = await db.RentalApplications.FromSqlInterpolated($"SELECT * FROM portal.rental_applications WHERE \"Id\" = {id} FOR UPDATE").ToListAsync(ct);
    }

    private async Task LockListingAsync(string id, CancellationToken ct)
    {
        _ = await db.RentalListings.FromSqlInterpolated($"SELECT * FROM portal.rental_listings WHERE \"Id\" = {id} FOR UPDATE").ToListAsync(ct);
    }

    private static void ApplyListing(RentalListing row, RentalListingInput input)
    {
        row.PropertyType = input.PropertyType;
        row.Title = input.Title.Trim();
        row.Description = input.Description.Trim();
        row.OwnerCategory = input.OwnerCategory;
        row.LegalDesignation = input.LegalDesignation.Trim();
        row.Region = input.Region.Trim();
        row.Address = input.Address.Trim();
        row.Area = input.Area;
        row.AreaUnit = input.AreaUnit.Trim();
        row.PermittedUse = input.PermittedUse.Trim();
        row.RentAmount = input.RentAmount;
        row.Currency = input.Currency.Trim().ToUpperInvariant();
        row.PaymentPeriod = input.PaymentPeriod.Trim();
        row.MinimumLeaseMonths = input.MinimumLeaseMonths;
        row.MaximumLeaseMonths = input.MaximumLeaseMonths;
        row.DepositAmount = input.DepositAmount;
        row.AdditionalCharges = input.AdditionalCharges?.Trim() ?? string.Empty;
        row.Infrastructure = input.Infrastructure?.Trim() ?? string.Empty;
        row.PhotoUrls = input.PhotoUrls?.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToArray() ?? [];
        row.AuthorityBasis = input.AuthorityBasis.Trim();
        row.AuthorityReference = input.AuthorityReference.Trim();
        row.AuthorityReviewed = input.AuthorityReviewed;
        row.Procedure = input.Procedure;
        row.ProcedureReference = input.ProcedureReference?.Trim() ?? string.Empty;
        row.ProcedureNotes = input.ProcedureNotes?.Trim() ?? string.Empty;
        row.EligibilityRules = input.EligibilityRules?.Trim() ?? string.Empty;
    }

    private static void SetRequirements(RentalListing row, IReadOnlyList<RentalRequirementInput>? requirements)
    {
        foreach (var r in requirements ?? [])
            row.DocumentRequirements.Add(new RentalDocumentRequirement
            {
                Id = Ids.New("rreq"), ListingId = row.Id, ApplicantScope = r.ApplicantScope.Trim().ToUpperInvariant(),
                Kind = r.Kind.Trim().ToLowerInvariant(), Label = r.Label.Trim(), IsRequired = r.IsRequired,
            });
    }

    private void Audit(string actor, string action, string objectType, string objectId) => db.RentalAudit.Add(new RentalAuditEntry
    {
        Id = Ids.New("raudit"), ActorId = actor, Action = action, ObjectType = objectType, ObjectId = objectId, At = clock.GetUtcNow(),
    });

    private void AddHistory(RentalApplication app, string actor, RentalApplicationStatus status, string comment, DateTimeOffset now)
    {
        db.RentalApplicationHistory.Add(new RentalApplicationHistory
        {
            Id = Ids.New("rhist"), ApplicationId = app.Id, ActorId = actor, Status = status,
            Comment = comment.Length > 2000 ? comment[..2000] : comment, CreatedAt = now,
        });
    }

    private static RentalLeaseDto ToLeaseDto(RentalLease x) => new(x.Id, x.ListingId, x.ApplicationId, x.AgreementReference, x.StartsAt, x.EndsAt, x.FinalizedAt, x.EndedAt);
    private static string Clean(string? x) => x?.Trim() ?? string.Empty;
    private static string SafeName(string name) => Path.GetFileName(name).Replace("\r", "").Replace("\n", "");
    private static string NotificationTitle(RentalApplicationStatus s) => s switch
    {
        RentalApplicationStatus.UnderReview => "Müraciət baxışdadır",
        RentalApplicationStatus.AdditionalInformationRequired => "Əlavə məlumat tələb olunur",
        RentalApplicationStatus.Approved => "Müraciət təsdiqləndi",
        RentalApplicationStatus.Rejected => "Müraciət rədd edildi",
        _ => "Müraciət yeniləndi",
    };
    private static string NotificationMessage(RentalApplicationStatus s, string reference, string reason) => s switch
    {
        RentalApplicationStatus.UnderReview => $"{reference} nömrəli müraciət baxışa götürüldü.",
        RentalApplicationStatus.AdditionalInformationRequired => $"{reference} nömrəli müraciət üçün əlavə məlumat tələb olunur: {reason}",
        RentalApplicationStatus.Approved => $"{reference} nömrəli müraciət təsdiqləndi. Bu addım icarə müqaviləsi bağlamır.",
        RentalApplicationStatus.Rejected => $"{reference} nömrəli müraciət rədd edildi: {reason}",
        _ => $"{reference} nömrəli müraciət yeniləndi.",
    };

    private sealed record ApplicantSnapshot(RentalApplicantProfile Profile, string? AccountFirstName, string? AccountLastName);
}
