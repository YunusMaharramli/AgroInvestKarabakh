using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Proposals;

/// <summary>Sending proposals, listing them, and choosing the winner.</summary>
public sealed class ProposalService(
    AppDbContext db, PrivateFileStorage storage, NotificationService notifications, OpportunityQueries opportunities, TimeProvider clock)
{
    // ---------------------------------------------------------------- send

    public async Task<Outcome<ProposalDto>> SubmitAsync(Viewer viewer, IFormCollection form, CancellationToken ct)
    {
        var investorId = viewer.UserId!;
        string F(string key) => form[key].ToString().Trim();

        // Accept the old field name too, so nothing breaks if an old page is still open.
        var opportunityId = F("opportunityId") is { Length: > 0 } oid ? oid : F("competitionId");
        if (opportunityId.Length == 0) return Fail(400, "İnvestisiya elanı seçilməyib.");
        if (!decimal.TryParse(F("proposedInvestmentAmount").Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var amount) || amount <= 0)
            return Fail(400, "Təklif etdiyiniz məbləği yazın.");
        var applicantType = F("applicantType");
        var applicantName = F("applicantName");
        var taxNumber = F("taxNumber");
        if (applicantType is not ("individual" or "company")) return Fail(400, "Müraciətçi növünü seçin.");
        if (applicantName.Length is < 3 or > 200) return Fail(400, "Sahibkarın və ya şirkətin adını yazın (3–200 simvol).");
        if ((applicantType == "company" || taxNumber.Length > 0) && (taxNumber.Length != 10 || taxNumber.Any(c => c < '0' || c > '9')))
            return Fail(400, "VÖEN 10 rəqəmdən ibarət olmalıdır.");
        var summary = F("businessPlanSummary");
        if (summary.Length == 0) return Fail(400, "Layihənizi qısa təsvir edin.");
        if (summary.Length > 4000) return Fail(400, "Layihə təsviri çox uzundur (ən çox 4000 simvol).");
        var period = F("estimatedImplementationPeriod") is { Length: > 0 } p ? Limit(p, 100) : "24 ay";

        if (viewer.IsAdmin) return Fail(403, "İnzibatçı investisiya təklifi göndərə bilməz.");

        var investor = await db.Users.FirstOrDefaultAsync(u => u.Id == investorId, ct);
        if (investor is null) return Fail(401, "Giriş tələb olunur.");

        // Contact phone: required only if the user has no valid phone; saved as a snapshot with the proposal.
        string contactPhone;
        var givenPhone = F("contactPhone");
        if (AzerbaijaniPhone.TryNormalize(investor.Phone, out var existing) && givenPhone.Length == 0) contactPhone = existing;
        else if (AzerbaijaniPhone.TryNormalize(givenPhone, out var given)) contactPhone = given;
        else if (AzerbaijaniPhone.TryNormalize(investor.Phone, out existing)) contactPhone = existing;
        else return Fail(400, givenPhone.Length == 0 ? "Əlaqə telefonunuzu yazın." : AzerbaijaniPhone.InvalidMessage);
        if (!AzerbaijaniPhone.IsValid(investor.Phone)) investor.Phone = contactPhone;

        var files = form.Files.GetFiles("documents");
        var (validated, fileError) = await PrivateFileStorage.ValidateAsync(files, FileRule.ProposalDocuments, ct);
        if (fileError is not null) return Fail(400, fileError);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockOpportunityAsync(opportunityId, ct);

        var opp = await db.Opportunities.Include(o => o.Land).FirstOrDefaultAsync(o => o.Id == opportunityId, ct);
        if (opp is null || opp.Source != OpportunitySource.Admin || opp.Status == OpportunityStatus.Draft) return Fail(404, "İnvestisiya elanı tapılmadı.");
        var now = clock.GetUtcNow();
        if (opp.Status != OpportunityStatus.Active) return Fail(400, "Bu elan bağlanıb, yeni təklif qəbul edilmir.");
        if (!opp.AcceptsProposals(now)) return Fail(400, "Bu elanın son təklif tarixi keçib.");
        if (opp.Land!.OwnerId == investorId) return Fail(400, "Öz elanınıza təklif göndərə bilməzsiniz.");
        if (opp.RequiredDocuments.Count > 0 && validated.Count == 0)
            return Fail(400, "Bu elan üçün sənəd tələb olunur. Ən azı bir sənəd (PDF, JPG və ya PNG) yükləyin.");
        if (await db.Proposals.AnyAsync(x => x.OpportunityId == opportunityId && x.InvestorId == investorId, ct))
            return Fail(409, "Bu elana artıq təklif göndərmisiniz.");

        var sequence = await db.Database.SqlQueryRaw<long>(NextReferenceSql).SingleAsync(ct);

        var proposal = new Proposal
        {
            Id = Ids.New("prop"),
            ReferenceNumber = $"AGRO-{now.Year}-{sequence:0000}",
            OpportunityId = opportunityId,
            InvestorId = investorId,
            ApplicantType = applicantType,
            ApplicantName = applicantName,
            TaxNumber = taxNumber.Length > 0 ? taxNumber : null,
            ProposedInvestmentAmount = amount,
            BusinessPlanSummary = summary,
            EstimatedImplementationPeriod = period,
            ContactPhone = contactPhone,
            Status = ProposalStatus.Open,
            SubmittedAt = now,
            UpdatedAt = now,
        };
        proposal.History.Add(History(proposal.Id, "SUBMITTED", "Sistem", "Təklif göndərildi.", now));
        db.Proposals.Add(proposal);

        var savedKeys = new List<string>();
        try
        {
            foreach (var file in validated)
            {
                var docId = Ids.New("pdoc");
                var key = await storage.SaveAsync($"proposals/{proposal.Id}", docId, file, ct);
                savedKeys.Add(key);
                db.ProposalDocuments.Add(new ProposalDocument
                {
                    Id = docId,
                    ProposalId = proposal.Id,
                    FileName = Limit(Path.GetFileName(file.File.FileName), 255),
                    ContentType = file.ContentType,
                    SizeBytes = file.File.Length,
                    StorageKey = key,
                    UploadedAt = now,
                });
            }

            notifications.Notify(investorId, "Təklifiniz göndərildi",
                $"“{opp.Title}” elanına {proposal.ReferenceNumber} nömrəli təklifiniz göndərildi.");
            var message = $"“{opp.Title}” elanına {investor.FullName} yeni təklif göndərdi ({proposal.ReferenceNumber}).";
            if (opp.Source == OpportunitySource.Owner)
                notifications.Notify(opp.Land!.OwnerId!, "Yeni investisiya təklifi", message);
            await notifications.NotifyAdminsAsync("Yeni investisiya təklifi", message, ct);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            foreach (var key in savedKeys) storage.TryDelete(key);
            return Fail(409, "Bu elana artıq təklif göndərmisiniz.");
        }
        catch
        {
            foreach (var key in savedKeys) storage.TryDelete(key);
            throw;
        }

        return Outcome<ProposalDto>.Success((await GetAsync(proposal.Id, viewer, ct))!);
    }

    // ---------------------------------------------------------------- choose the winner

    public async Task<Outcome<ProposalDto>> RejectAsync(string proposalId, string? reason, Viewer viewer, CancellationToken ct)
    {
        if (!viewer.IsAdmin) return Fail(403, "Təklifi yalnız nazirlik rədd edə bilər.");
        reason = reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000)
            return Fail(400, "Rədd etmə səbəbini yazın (ən çox 2000 simvol).");

        var opportunityId = await db.Proposals.AsNoTracking()
            .Where(p => p.Id == proposalId).Select(p => p.OpportunityId).FirstOrDefaultAsync(ct);
        if (opportunityId is null) return Fail(404, "Təklif tapılmadı.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockOpportunityAsync(opportunityId, ct);
        var proposal = await db.Proposals.Include(p => p.Opportunity).ThenInclude(o => o!.Land)
            .FirstOrDefaultAsync(p => p.Id == proposalId, ct);
        if (proposal is null) return Fail(404, "Təklif tapılmadı.");
        if (!IsPending(proposal.Status) || proposal.Opportunity!.Status != OpportunityStatus.Active)
            return Fail(409, "Yalnız aktiv elanın açıq təklifi rədd edilə bilər.");

        var now = clock.GetUtcNow();
        proposal.Status = ProposalStatus.Rejected;
        proposal.DecidedAt = now;
        proposal.UpdatedAt = now;
        db.ProposalHistory.Add(History(proposal.Id, "REJECTED", await DecidedByAsync(viewer, ct), reason, now));
        notifications.Notify(proposal.InvestorId, "Təklifiniz rədd edildi",
            $"“{proposal.Opportunity.Title}” elanı üzrə {proposal.ReferenceNumber} nömrəli təklifiniz rədd edildi. Səbəb: {reason}");
        if (proposal.Opportunity.Source == OpportunitySource.Owner && proposal.Opportunity.Land!.OwnerId is { } ownerId)
            notifications.Notify(ownerId, "Elanınız üzrə təklif rədd edildi",
                $"“{proposal.Opportunity.Title}” elanı üzrə {proposal.ReferenceNumber} nömrəli təklif nazirlik tərəfindən rədd edildi.");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Outcome<ProposalDto>.Success((await GetAsync(proposalId, viewer, ct))!);
    }

    /// <summary>
    /// An admin picks one winner. In one transaction (with the listing row locked): the winner becomes
    /// SELECTED, every other OPEN proposal becomes NOT_SELECTED and is notified, and the listing is CLOSED so no new
    /// proposals can arrive.
    /// </summary>
    public async Task<Outcome<WinnerSelectedResponse>> SelectWinnerAsync(string opportunityId, string? proposalId, Viewer viewer, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(proposalId)) return Outcome<WinnerSelectedResponse>.Fail(400, "Qalib təklifi seçin.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockOpportunityAsync(opportunityId, ct);

        var opp = await db.Opportunities.Include(o => o.Land).FirstOrDefaultAsync(o => o.Id == opportunityId, ct);
        if (opp is null) return Outcome<WinnerSelectedResponse>.Fail(404, "İnvestisiya elanı tapılmadı.");
        if (!viewer.IsAdmin)
            return Outcome<WinnerSelectedResponse>.Fail(403, "Qalibi yalnız nazirlik seçə bilər.");
        if (opp.WinnerProposalId is not null) return Outcome<WinnerSelectedResponse>.Fail(409, "Bu elan üçün qalib artıq seçilib.");
        if (opp.Status != OpportunityStatus.Active) return Outcome<WinnerSelectedResponse>.Fail(400, "Yalnız aktiv elan üzrə qalib seçilə bilər.");

        var proposals = await db.Proposals.Include(p => p.Investor)
            .Where(p => p.OpportunityId == opportunityId && (p.Status == ProposalStatus.Open || p.Status == ProposalStatus.UnderReview || p.Status == ProposalStatus.InformationRequested)).ToListAsync(ct);
        var winner = proposals.FirstOrDefault(p => p.Id == proposalId);
        if (winner is null) return Outcome<WinnerSelectedResponse>.Fail(404, "Seçilən təklif tapılmadı və ya artıq bağlanıb.");

        var now = clock.GetUtcNow();
        var decidedBy = await DecidedByAsync(viewer, ct);

        winner.Status = ProposalStatus.Selected;
        winner.DecidedAt = now;
        winner.UpdatedAt = now;
        db.ProposalHistory.Add(History(winner.Id, "SELECTED", decidedBy, "Təklifiniz qalib seçildi.", now));
        notifications.Notify(winner.InvestorId, "Təklifiniz qalib seçildi",
            $"Təbriklər! “{opp.Title}” elanı üzrə {winner.ReferenceNumber} nömrəli təklifiniz nazirlik tərəfindən seçildi.");
        if (opp.Source == OpportunitySource.Owner && opp.Land!.OwnerId is { } ownerId)
            notifications.Notify(ownerId, "Elanınız üzrə qalib seçildi",
                $"“{opp.Title}” elanı üzrə {winner.ReferenceNumber} nömrəli təklif nazirlik tərəfindən qalib seçildi.");

        var others = proposals.Where(p => p.Id != winner.Id).ToList();
        foreach (var p in others)
        {
            p.Status = ProposalStatus.NotSelected;
            p.DecidedAt = now;
            p.UpdatedAt = now;
            db.ProposalHistory.Add(History(p.Id, "NOT_SELECTED", decidedBy, "Başqa təklif seçildi.", now));
            notifications.Notify(p.InvestorId, "Təklifiniz seçilmədi",
                $"“{opp.Title}” elanı üzrə qalib seçildi. {p.ReferenceNumber} nömrəli təklifiniz seçilmədi. Maraq göstərdiyiniz üçün təşəkkür edirik.");
        }

        opp.Status = OpportunityStatus.Closed;
        opp.WinnerProposalId = winner.Id;
        opp.ClosedAt = now;
        opp.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Outcome<WinnerSelectedResponse>.Fail(409, "Bu elan üçün qalib artıq seçilib.");
        }

        var dto = await opportunities.GetAsync(opportunityId, viewer, ct);
        return Outcome<WinnerSelectedResponse>.Success(new WinnerSelectedResponse(
            $"{winner.ReferenceNumber} qalib seçildi. Elan bağlandı.", dto!, others.Count));
    }

    /// <summary>The owner may withdraw an active listing with a reason; republishing requires admin approval.</summary>
    public async Task<Outcome<OpportunityDto>> SetStatusAsync(string opportunityId, OpportunityStatus? status, string? reason, Viewer viewer, CancellationToken ct)
    {
        if (status != OpportunityStatus.Closed)
            return Outcome<OpportunityDto>.Fail(400, "Bu əməliyyat yalnız elanı bağlaya bilər. Yenidən dərc üçün müraciət göndərin.");
        reason = reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000)
            return Outcome<OpportunityDto>.Fail(400, "Bağlanma səbəbini yazın (ən çox 2000 simvol).");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockOpportunityAsync(opportunityId, ct);
        var opp = await db.Opportunities.Include(o => o.Land).FirstOrDefaultAsync(o => o.Id == opportunityId, ct);
        if (opp is null) return Outcome<OpportunityDto>.Fail(404, "İnvestisiya elanı tapılmadı.");
        if (!viewer.IsAdmin)
            return Outcome<OpportunityDto>.Fail(403, "Bu elanı yalnız onun sahibi idarə edə bilər.");
        if (opp.Status != OpportunityStatus.Active || opp.WinnerProposalId is not null)
            return Outcome<OpportunityDto>.Fail(409, "Yalnız qalib seçilməmiş aktiv elan bağlana bilər.");

        var now = clock.GetUtcNow();
        opp.Status = OpportunityStatus.Closed;
        opp.ClosedAt = now;
        opp.ClosureReason = reason;
        opp.UpdatedAt = now;
        var openProposals = await db.Proposals.Where(p => p.OpportunityId == opportunityId && (p.Status == ProposalStatus.Open || p.Status == ProposalStatus.UnderReview || p.Status == ProposalStatus.InformationRequested)).ToListAsync(ct);
        var actor = await DecidedByAsync(viewer, ct);
        foreach (var proposal in openProposals)
        {
            proposal.Status = ProposalStatus.Cancelled;
            proposal.DecidedAt = now;
            proposal.UpdatedAt = now;
            db.ProposalHistory.Add(History(proposal.Id, "CANCELLED", actor, reason, now));
            notifications.Notify(proposal.InvestorId, "İnvestisiya elanı bağlandı",
                $"“{opp.Title}” elanı qalib seçilmədən bağlandı. Səbəb: {reason}");
        }
        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Outcome<OpportunityDto>.Fail(409, "Bu torpaq üçün artıq aktiv elan var.");
        }
        return Outcome<OpportunityDto>.Success((await opportunities.GetAsync(opportunityId, viewer, ct))!);
    }

    public static bool IsPending(ProposalStatus status) => status is ProposalStatus.Open or ProposalStatus.UnderReview or ProposalStatus.InformationRequested;

    public async Task<Outcome<ProposalDto>> ReviewAsync(string id, ReviewApplicationRequest request, Viewer viewer, CancellationToken ct)
    {
        if (!viewer.IsAdmin) return Fail(403, "İnzibatçı icazəsi tələb olunur.");
        if (request.Status is not (ProposalStatus.UnderReview or ProposalStatus.InformationRequested))
            return Fail(400, "Baxış statusu düzgün deyil.");
        var comment = request.Comment?.Trim() ?? "";
        if (comment.Length > 2000 || (request.Status == ProposalStatus.InformationRequested && comment.Length == 0))
            return Fail(400, "Tələb olunan əlavə məlumatı yazın (ən çox 2000 simvol).");
        var opportunityId = await db.Proposals.Where(p => p.Id == id).Select(p => p.OpportunityId).FirstOrDefaultAsync(ct);
        if (opportunityId is null) return Fail(404, "Müraciət tapılmadı.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockOpportunityAsync(opportunityId, ct);
        var proposal = await db.Proposals.Include(p => p.Opportunity).FirstAsync(p => p.Id == id, ct);
        if (!IsPending(proposal.Status) || proposal.Opportunity!.Status != OpportunityStatus.Active)
            return Fail(409, "Bu müraciət üzrə qərar artıq verilib.");
        if (proposal.Status == request.Status) return Fail(409, "Müraciət artıq bu statusdadır.");
        proposal.Status = request.Status;
        proposal.UpdatedAt = clock.GetUtcNow();
        var status = request.Status == ProposalStatus.UnderReview ? "UNDER_REVIEW" : "INFORMATION_REQUESTED";
        db.ProposalHistory.Add(History(id, status, await DecidedByAsync(viewer, ct), comment, proposal.UpdatedAt));
        notifications.Notify(proposal.InvestorId, request.Status == ProposalStatus.UnderReview ? "Müraciətə baxılır" : "Əlavə məlumat tələb olunur", comment);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Outcome<ProposalDto>.Success((await GetAsync(id, viewer, ct))!);
    }

    public async Task<Outcome<ProposalDto>> SupplementAsync(string id, Viewer viewer, IFormCollection form, CancellationToken ct)
    {
        var message = form["message"].ToString().Trim();
        if (message.Length is < 1 or > 4000) return Fail(400, "Əlavə məlumatı yazın (ən çox 4000 simvol).");
        var (files, error) = await PrivateFileStorage.ValidateAsync(form.Files.GetFiles("documents"), FileRule.ProposalDocuments, ct);
        if (error is not null) return Fail(400, error);
        var opportunityId = await db.Proposals.Where(p => p.Id == id && p.InvestorId == viewer.UserId).Select(p => p.OpportunityId).FirstOrDefaultAsync(ct);
        if (opportunityId is null) return Fail(404, "Müraciət tapılmadı.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockOpportunityAsync(opportunityId, ct);
        var proposal = await db.Proposals.Include(p => p.Opportunity).FirstAsync(p => p.Id == id, ct);
        if (proposal.Status != ProposalStatus.InformationRequested || proposal.Opportunity!.Status != OpportunityStatus.Active)
            return Fail(409, "Yalnız əlavə məlumat tələb olunan müraciət yenilənə bilər.");
        var saved = new List<string>();
        try
        {
            foreach (var file in files)
            {
                var docId = Ids.New("pdoc");
                var key = await storage.SaveAsync($"proposals/{id}", docId, file, ct);
                saved.Add(key);
                db.ProposalDocuments.Add(new ProposalDocument { Id = docId, ProposalId = id, FileName = Limit(Path.GetFileName(file.File.FileName), 255), ContentType = file.ContentType, SizeBytes = file.File.Length, StorageKey = key, UploadedAt = clock.GetUtcNow() });
            }
            proposal.Status = ProposalStatus.UnderReview;
            proposal.UpdatedAt = clock.GetUtcNow();
            db.ProposalHistory.Add(History(id, "UNDER_REVIEW", "Müraciətçi", message, proposal.UpdatedAt));
            await notifications.NotifyAdminsAsync("Əlavə məlumat təqdim edildi", proposal.ReferenceNumber, ct);
            notifications.Notify(proposal.InvestorId, "Əlavə məlumat qeydə alındı", proposal.ReferenceNumber);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch { foreach (var key in saved) storage.TryDelete(key); throw; }
        return Outcome<ProposalDto>.Success((await GetAsync(id, viewer, ct))!);
    }

    // ---------------------------------------------------------------- read

    public async Task<List<ProposalDto>> SentAsync(Viewer viewer, CancellationToken ct) =>
        await ToDtosAsync(await BaseQuery().Where(p => p.InvestorId == viewer.UserId).OrderByDescending(p => p.SubmittedAt).ToListAsync(ct), viewer, ct);

    public async Task<List<ProposalDto>> AllAsync(Viewer viewer, string? status, string? region, string? search, CancellationToken ct)
    {
        var query = BaseQuery().Where(p => p.Opportunity!.Source == OpportunitySource.Admin);
        if (!string.IsNullOrWhiteSpace(status) && status != "all" && Enum.TryParse<ProposalStatus>(status.Replace("_", ""), true, out var s))
            query = query.Where(p => p.Status == s);
        if (!string.IsNullOrWhiteSpace(region) && region != "all") query = query.Where(p => p.Opportunity!.Land!.Region == region);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("%", "").Replace("_", "")}%";
            query = query.Where(p => EF.Functions.ILike(p.ReferenceNumber, pattern) || EF.Functions.ILike(p.Opportunity!.Title, pattern)
                || EF.Functions.ILike(p.Investor!.FirstName + " " + p.Investor.LastName, pattern) || EF.Functions.ILike(p.Investor.Email, pattern));
        }
        return await ToDtosAsync(await query.OrderByDescending(p => p.SubmittedAt).ToListAsync(ct), viewer, ct);
    }

    /// <summary>Visible to the investor, the responsible party and admins; null otherwise.</summary>
    public async Task<ProposalDto?> GetAsync(string idOrReference, Viewer viewer, CancellationToken ct)
    {
        var p = await BaseQuery().FirstOrDefaultAsync(x => x.Id == idOrReference || x.ReferenceNumber == idOrReference, ct);
        if (p is null || !CanView(p, viewer)) return null;
        return (await ToDtosAsync([p], viewer, ct))[0];
    }

    public static bool CanView(Proposal p, Viewer viewer) =>
        viewer.UserId is not null && (viewer.IsAdmin || p.InvestorId == viewer.UserId);

    private IQueryable<Proposal> BaseQuery() => db.Proposals.AsNoTracking()
        .Include(p => p.Investor)
        .Include(p => p.Opportunity).ThenInclude(o => o!.Land)
        .Include(p => p.Documents)
        .Include(p => p.History)
        .AsSplitQuery();

    private async Task<List<ProposalDto>> ToDtosAsync(List<Proposal> proposals, Viewer viewer, CancellationToken ct)
    {
        var opps = proposals.Select(p => p.Opportunity!).DistinctBy(o => o.Id).ToList();
        var oppDtos = (await opportunities.ToDtosAsync(opps, viewer, ct, includeLand: false)).ToDictionary(o => o.Id);
        return proposals.Select(p =>
        {
            var o = p.Opportunity!;
            return new ProposalDto(
                p.Id, p.ReferenceNumber, p.InvestorId, p.OpportunityId, p.ProposedInvestmentAmount, p.BusinessPlanSummary,
                p.EstimatedImplementationPeriod, p.ContactPhone, p.Status, p.SubmittedAt, p.UpdatedAt, p.DecidedAt,
                p.Investor is null ? null : PersonDto.From(p.Investor),
                oppDtos.GetValueOrDefault(o.Id),
                LandDto.From(o.Land!, o.Status == OpportunityStatus.Active),
                p.Documents.OrderBy(d => d.UploadedAt).Select(ProposalDocumentDto.From).ToList(),
                p.History.OrderBy(h => h.CreatedAt).Select(ProposalHistoryDto.From).ToList(),
                CanSelectWinner: viewer.IsAdmin && IsPending(p.Status)
                    && o.WinnerProposalId is null && o.Status == OpportunityStatus.Active,
                p.ApplicantType, p.ApplicantName, p.TaxNumber);
        }).ToList();
    }

    // ---------------------------------------------------------------- helpers

    /// <summary>Row lock on the listing for the rest of the transaction, so proposals and winner selection cannot interleave.</summary>
    private Task LockOpportunityAsync(string opportunityId, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync(LockOpportunitySql, [opportunityId], ct);

    private const string LockOpportunitySql = "SELECT 1 FROM portal.investment_opportunities WHERE \"Id\" = {0} FOR UPDATE";
    private const string NextReferenceSql = "SELECT nextval('portal.proposal_reference_seq') AS \"Value\"";

    private async Task<string> DecidedByAsync(Viewer viewer, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == viewer.UserId, ct);
        var name = user?.FullName ?? "—";
        return viewer.IsAdmin ? $"{name} (nazirlik)" : $"{name} (elan sahibi)";
    }

    private static ProposalHistoryEntry History(string proposalId, string status, string by, string comment, DateTimeOffset at) => new()
    {
        Id = Ids.New("hist"),
        ProposalId = proposalId,
        Status = status,
        ChangedBy = by,
        Comment = comment,
        CreatedAt = at,
    };

    private static Outcome<ProposalDto> Fail(int status, string message) => Outcome<ProposalDto>.Fail(status, message);
    private static string Limit(string value, int max) => value.Length <= max ? value : value[..max];
}
