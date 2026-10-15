using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Lands;

public static class LandEndpoints
{
    public static RouteGroupBuilder MapLandEndpoints(this RouteGroupBuilder api)
    {
        // Public land profiles (only approved land).
        api.MapGet("/lands", async (HttpRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var q = request.Query;
            var query = db.Lands.AsNoTracking().Where(l => l.Status == LandStatus.Approved);
            if (q["region"].ToString() is { Length: > 0 } region && region != "all") query = query.Where(l => l.Region == region);
            if (q["agricultureType"].ToString() is { Length: > 0 } type && type != "all") query = query.Where(l => l.AgricultureType == type);
            if (double.TryParse(q["minArea"], CultureInfo.InvariantCulture, out var min)) query = query.Where(l => l.AreaHectares >= min);
            if (double.TryParse(q["maxArea"], CultureInfo.InvariantCulture, out var max)) query = query.Where(l => l.AreaHectares <= max);
            if (q["search"].ToString().Trim() is { Length: > 0 } search)
            {
                var pattern = $"%{search.Replace("%", "").Replace("_", "")}%";
                query = query.Where(l => EF.Functions.ILike(l.Title, pattern) || EF.Functions.ILike(l.Region, pattern)
                    || EF.Functions.ILike(l.Description, pattern) || EF.Functions.ILike(l.IntendedUse, pattern));
            }

            var rows = await query
                .OrderBy(l => l.CreatedAt).ThenBy(l => l.Id)
                .Select(l => new { Land = l, Active = db.Opportunities.Any(o => o.LandId == l.Id && o.Status == OpportunityStatus.Active) })
                .ToListAsync(ct);
            return Results.Ok(rows.Select(r => LandDto.From(r.Land, r.Active)));
        });

        api.MapGet("/lands/{id}", async (string id, ClaimsPrincipal user, AppDbContext db, OpportunityQueries opportunities, CancellationToken ct) =>
        {
            var viewer = new Viewer(user.UserId(), user.IsAdmin());
            var land = await db.Lands.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct);
            var isOwner = land?.OwnerId is not null && land.OwnerId == viewer.UserId;
            if (land is null || (land.Status != LandStatus.Approved && !isOwner && !viewer.IsAdmin))
                return ApiResults.NotFound("Torpaq sahəsi tapılmadı.");

            var opps = await db.Opportunities.AsNoTracking().Include(o => o.Land)
                .Where(o => o.LandId == id && ((o.Status != OpportunityStatus.Draft
                    && o.Status != OpportunityStatus.Rejected) || isOwner || viewer.IsAdmin))
                .OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
            var dtos = await opportunities.ToDtosAsync(opps, viewer, ct, includeLand: false);
            var active = dtos.FirstOrDefault(o => o.Status == OpportunityStatus.Active);
            return Results.Ok(new LandDetailDto(LandDto.From(land, active is not null), dtos, active));
        });

        // Owner: my lands.
        var mine = api.MapGroup("/my/lands").RequireAuthorization(Policies.SignedIn);

        mine.MapGet("", async (ClaimsPrincipal user, LandSubmissionService service, CancellationToken ct) =>
            Results.Ok(await service.ListMineAsync(user.RequiredUserId(), ct)));

        mine.MapPost("", async (HttpRequest request, ClaimsPrincipal user, LandSubmissionService service, CancellationToken ct) =>
        {
            if (user.IsAdmin()) return ApiResults.Forbidden("İnzibatçı torpaq əlavə edə bilməz. Torpağı yalnız sahibi əlavə edir.");
            if (!request.HasFormContentType) return ApiResults.BadRequest("Forma və sənədlər birlikdə göndərilməlidir.");
            var form = await request.ReadFormAsync(ct);
            return (await service.SubmitAsync(user.RequiredUserId(), form, ct))
                .ToResult(r => Results.Json(r, statusCode: StatusCodes.Status201Created));
        });

        mine.MapPost("/{id}/documents", async (string id, HttpRequest request, ClaimsPrincipal user, LandSubmissionService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Sənədləri yükləyin.");
            var form = await request.ReadFormAsync(ct);
            return (await service.AddDocumentsAsync(user.RequiredUserId(), id, form, ct)).ToResult(r => Results.Ok(r));
        });

        mine.MapPost("/{id}/reopen", async (string id, ClaimsPrincipal user, LandSubmissionService service, CancellationToken ct) =>
            (await service.ReopenAsync(user.RequiredUserId(), id, ct)).ToResult(r => Results.Ok(r)));

        var stateLands = api.MapGroup("/admin/lands").RequireAuthorization(Policies.Admin);
        stateLands.MapPost("", async (HttpRequest request, ClaimsPrincipal user, LandSubmissionService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Forma və sənədlər birlikdə göndərilməlidir.");
            var form = await request.ReadFormAsync(ct);
            return (await service.SubmitAdminAsync(user.RequiredUserId(), form, ct))
                .ToResult(r => Results.Json(r, statusCode: StatusCodes.Status201Created));
        });

        // Admin: review queue.
        var review = api.MapGroup("/admin/land-reviews").RequireAuthorization(Policies.Admin);

        review.MapGet("", async (string? status, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            Results.Ok(await service.QueueAsync(status, user.RequiredUserId(), ct)));

        review.MapGet("/{id}", async (string id, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            await service.GetAsync(id, user.RequiredUserId(), ct) is { } dto ? Results.Ok(dto) : ApiResults.NotFound("Torpaq müraciəti tapılmadı."));

        review.MapPost("/{id}/approve", async (string id, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            (await service.ApproveAsync(id, user.RequiredUserId(), ct)).ToResult(r => Results.Ok(r)));

        review.MapPost("/{id}/request-documents", async (string id, ReviewMessageRequest req, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            (await service.RequestDocumentsAsync(id, user.RequiredUserId(), req.Message, ct)).ToResult(r => Results.Ok(r)));

        review.MapPost("/{id}/reject", async (string id, ReviewMessageRequest req, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            (await service.RejectAsync(id, user.RequiredUserId(), req.Message, ct)).ToResult(r => Results.Ok(r)));

        var republish = api.MapGroup("/admin/republish-reviews").RequireAuthorization(Policies.Admin);
        republish.MapGet("", async (ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            Results.Ok(await service.RepublishQueueAsync(user.RequiredUserId(), ct)));
        republish.MapPost("/{id}/approve", async (string id, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            (await service.ApproveRepublishAsync(id, user.RequiredUserId(), ct)).ToResult(r => Results.Ok(r)));
        republish.MapPost("/{id}/reject", async (string id, ReviewMessageRequest req, ClaimsPrincipal user, LandReviewService service, CancellationToken ct) =>
            (await service.RejectRepublishAsync(id, user.RequiredUserId(), req.Message, ct)).ToResult(r => Results.Ok(r)));

        return api;
    }
}
