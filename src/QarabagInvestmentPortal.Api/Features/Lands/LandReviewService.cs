using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>Admin side: review land submitted by owners — approve, request missing documents, or reject.</summary>
public sealed class LandReviewService(AppDbContext db, NotificationService notifications, OpportunityQueries opportunities, TimeProvider clock)
{
    public async Task<List<LandReviewDto>> QueueAsync(string? status, string adminId, CancellationToken ct)
    {
        var query = db.Lands.AsNoTracking().Include(l => l.Documents).Include(l => l.Owner).Where(l => l.OwnerId != null);
        if (string.IsNullOrWhiteSpace(status) || status == "open")
            query = query.Where(l => l.Status == LandStatus.PendingReview || l.Status == LandStatus.DocumentsRequested);
        else if (status != "all" && Enum.TryParse<LandStatus>(status.Replace("_", ""), true, out var s))
            query = query.Where(l => l.Status == s);

        var lands = await query.OrderBy(l => l.Status == LandStatus.PendingReview ? 0 : 1).ThenBy(l => l.SubmittedAt).ToListAsync(ct);
        return await ToDtosAsync(lands, adminId, ct);
    }

    public async Task<LandReviewDto?> GetAsync(string landId, string adminId, CancellationToken ct)
    {
        var land = await db.Lands.AsNoTracking().Include(l => l.Documents).Include(l => l.Owner).FirstOrDefaultAsync(l => l.Id == landId, ct);
        return land is null ? null : (await ToDtosAsync([land], adminId, ct))[0];
    }

    /// <summary>Approve: the land profile becomes public and its listing is published (ACTIVE).</summary>
    public Task<Outcome<LandReviewDto>> ApproveAsync(string landId, string adminId, CancellationToken ct) =>
        DecideAsync(landId, adminId, null, ct, (land, draft, now) =>
        {
            land.Status = LandStatus.Approved;
            land.ReviewNote = null;
            if (draft is not null)
            {
                draft.Status = OpportunityStatus.Active;
                draft.OpeningDate = now;
                draft.UpdatedAt = now;
            }
            notifications.Notify(land.OwnerId!, "Torpağınız təsdiq edildi",
                $"“{land.Title}” sahəniz təsdiq olundu və “İnvestisiya imkanları” siyahısında dərc edildi. İnvestorlar indi təklif göndərə bilər.");
            return null;
        });

    public Task<Outcome<LandReviewDto>> RequestDocumentsAsync(string landId, string adminId, string? message, CancellationToken ct) =>
        DecideAsync(landId, adminId, message, ct, (land, _, _) =>
        {
            if (string.IsNullOrWhiteSpace(message)) return "Hansı sənədin lazım olduğunu yazın.";
            land.Status = LandStatus.DocumentsRequested;
            land.ReviewNote = message.Trim();
            notifications.Notify(land.OwnerId!, "Əlavə sənəd lazımdır",
                $"“{land.Title}” sahəsi üçün inzibatçı əlavə sənəd istəyir: {message.Trim()}");
            return null;
        });

    public Task<Outcome<LandReviewDto>> RejectAsync(string landId, string adminId, string? message, CancellationToken ct) =>
        DecideAsync(landId, adminId, message, ct, (land, draft, now) =>
        {
            if (string.IsNullOrWhiteSpace(message)) return "Rədd etmə səbəbini yazın.";
            land.Status = LandStatus.Rejected;
            land.ReviewNote = message.Trim();
            if (draft is not null)
            {
                draft.Status = OpportunityStatus.Closed;
                draft.ClosedAt = now;
                draft.UpdatedAt = now;
            }
            notifications.Notify(land.OwnerId!, "Torpaq təsdiq olunmadı",
                $"“{land.Title}” sahəsi təsdiq olunmadı. Səbəb: {message.Trim()}");
            return null;
        });

    private async Task<Outcome<LandReviewDto>> DecideAsync(
        string landId, string adminId, string? message, CancellationToken ct,
        Func<Land, InvestmentOpportunity?, DateTimeOffset, string?> apply)
    {
        if (message is { Length: > 2000 }) return Outcome<LandReviewDto>.Fail(400, "Mesaj çox uzundur.");
        var land = await db.Lands.FirstOrDefaultAsync(l => l.Id == landId, ct);
        if (land is null || land.OwnerId is null) return Outcome<LandReviewDto>.Fail(404, "Torpaq müraciəti tapılmadı.");
        if (land.Status is not (LandStatus.PendingReview or LandStatus.DocumentsRequested))
            return Outcome<LandReviewDto>.Fail(409, "Bu müraciət üzrə qərar artıq verilib.");

        var draft = await db.Opportunities.FirstOrDefaultAsync(o => o.LandId == landId && o.Status == OpportunityStatus.Draft, ct);
        var now = clock.GetUtcNow();
        var error = apply(land, draft, now);
        if (error is not null) return Outcome<LandReviewDto>.Fail(400, error);

        land.ReviewedAt = now;
        land.ReviewedById = adminId;
        land.UpdatedAt = now;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Outcome<LandReviewDto>.Fail(409, "Bu sahə üçün artıq aktiv elan var.");
        }
        return Outcome<LandReviewDto>.Success((await GetAsync(landId, adminId, ct))!);
    }

    private async Task<List<LandReviewDto>> ToDtosAsync(List<Land> lands, string adminId, CancellationToken ct)
    {
        var ids = lands.Select(l => l.Id).ToList();
        var opps = await db.Opportunities.AsNoTracking().Include(o => o.Land)
            .Where(o => ids.Contains(o.LandId)).ToListAsync(ct);
        var latest = opps.GroupBy(o => o.LandId)
            .Select(g => g.OrderByDescending(o => o.Status == OpportunityStatus.Active).ThenByDescending(o => o.CreatedAt).First()).ToList();
        var dtos = (await opportunities.ToDtosAsync(latest, new Viewer(adminId, true), ct, includeLand: false)).ToDictionary(d => d.LandId);

        return lands.Select(l => new LandReviewDto(
            LandDto.From(l, dtos.TryGetValue(l.Id, out var o) && o.Status == OpportunityStatus.Active),
            l.Owner is null ? null : PersonDto.From(l.Owner), l.Owner?.Phone,
            l.ReviewNote, l.OwnerNote, l.SubmittedAt, l.ReviewedAt,
            l.Documents.OrderBy(d => d.UploadedAt).Select(LandDocumentDto.From).ToList(),
            dtos.GetValueOrDefault(l.Id))).ToList();
    }
}
