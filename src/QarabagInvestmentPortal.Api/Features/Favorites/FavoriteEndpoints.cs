using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Favorites;

public sealed record FavoriteDto(string Id, string UserId, string LandId, DateTimeOffset CreatedAt, LandDto? Land);
public sealed record AddFavoriteRequest(string? LandId);

public static class FavoriteEndpoints
{
    public static RouteGroupBuilder MapFavoriteEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/favorites").RequireAuthorization(Policies.SignedIn);

        group.MapGet("", async (ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
        {
            var userId = user.RequiredUserId();
            var rows = await db.Favorites.AsNoTracking()
                .Where(f => f.UserId == userId && f.Land!.Status == LandStatus.Approved)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new { Fav = f, f.Land, Active = db.Opportunities.Any(o => o.LandId == f.LandId && o.Status == OpportunityStatus.Active) })
                .ToListAsync(ct);
            return Results.Ok(rows.Select(r => new FavoriteDto(r.Fav.Id, r.Fav.UserId, r.Fav.LandId, r.Fav.CreatedAt, LandDto.From(r.Land!, r.Active))));
        });

        group.MapPost("", async (AddFavoriteRequest req, ClaimsPrincipal user, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var userId = user.RequiredUserId();
            if (string.IsNullOrWhiteSpace(req.LandId)) return ApiResults.BadRequest("Torpaq sahəsi seçilməlidir.");
            var land = await db.Lands.AsNoTracking().FirstOrDefaultAsync(l => l.Id == req.LandId && l.Status == LandStatus.Approved, ct);
            if (land is null) return ApiResults.NotFound("Torpaq sahəsi tapılmadı.");

            var fav = await db.Favorites.AsNoTracking().FirstOrDefaultAsync(f => f.UserId == userId && f.LandId == land.Id, ct);
            if (fav is null)
            {
                fav = new Favorite { Id = Ids.New("fav"), UserId = userId, LandId = land.Id, CreatedAt = clock.GetUtcNow() };
                db.Favorites.Add(fav);
                try
                {
                    await db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
                {
                    // Saved twice at the same moment: already there.
                }
            }
            return Results.Json(new FavoriteDto(fav.Id, fav.UserId, fav.LandId, fav.CreatedAt, LandDto.From(land)), statusCode: StatusCodes.Status201Created);
        });

        group.MapDelete("/{landId}", async (string landId, ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
        {
            var userId = user.RequiredUserId();
            var deleted = await db.Favorites.Where(f => f.UserId == userId && f.LandId == landId).ExecuteDeleteAsync(ct);
            return Results.Ok(new SuccessResponse(deleted > 0));
        });

        return api;
    }
}
