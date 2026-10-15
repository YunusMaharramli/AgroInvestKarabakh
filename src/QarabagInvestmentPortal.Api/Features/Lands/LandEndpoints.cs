using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
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
            var query = db.Lands.AsNoTracking().Where(l => l.Status == LandStatus.Approved && (l.OwnerId == null || l.EntrySource != LandEntrySource.Owner));
            if (q["region"].ToString() is { Length: > 0 } region && region != "all") query = query.Where(l => l.Region == region);
            if (q["agricultureType"].ToString() is { Length: > 0 } type && type != "all") query = query.Where(l => l.AgricultureType == type);
            if (q["landUse"].ToString() is { Length: > 0 } use && use != "all" && LandUseCatalog.Find(use) is { } lu)
                query = query.Where(l => l.LandUse == lu.Key || l.AgricultureType == lu.Name);
            if (double.TryParse(q["minArea"], CultureInfo.InvariantCulture, out var min)) query = query.Where(l => l.AreaHectares >= min);
            if (double.TryParse(q["maxArea"], CultureInfo.InvariantCulture, out var max)) query = query.Where(l => l.AreaHectares <= max);
            if (q["search"].ToString().Trim() is { Length: > 0 } search)
            {
                var pattern = $"%{search.Replace("%", "").Replace("_", "")}%";
                query = query.Where(l => EF.Functions.ILike(l.Title, pattern) || EF.Functions.ILike(l.Region, pattern)
                    || EF.Functions.ILike(l.Description, pattern) || EF.Functions.ILike(l.IntendedUse, pattern)
                    || EF.Functions.ILike(l.AgricultureType, pattern)
                    || (l.District != null && EF.Functions.ILike(l.District, pattern)) || (l.Settlement != null && EF.Functions.ILike(l.Settlement, pattern)));
            }

            var lands = await query.Include(l => l.Photos).OrderBy(l => l.CreatedAt).ThenBy(l => l.Id).ToListAsync(ct);
            var ids = lands.Select(l => l.Id).ToList();
            var active = (await db.Opportunities.AsNoTracking()
                .Where(o => ids.Contains(o.LandId) && o.Status == OpportunityStatus.Active)
                .Select(o => o.LandId).ToListAsync(ct)).ToHashSet();
            return Results.Ok(lands.Select(l => LandDto.From(l, active.Contains(l.Id))));
        });

        api.MapGet("/lands/{id}", async (string id, ClaimsPrincipal user, AppDbContext db, OpportunityQueries opportunities, CancellationToken ct) =>
        {
            var viewer = new Viewer(user.UserId(), user.IsAdmin());
            var land = await db.Lands.AsNoTracking().Include(l => l.Photos).FirstOrDefaultAsync(l => l.Id == id, ct);
            var isPublic = land is { Status: LandStatus.Approved } && land.EntrySource != LandEntrySource.Owner;
            if (land is null || (!isPublic && !viewer.IsAdmin))
                return ApiResults.NotFound("Torpaq sahəsi tapılmadı.");

            var opps = await db.Opportunities.AsNoTracking().Include(o => o.Land)
                .Where(o => o.LandId == id && (viewer.IsAdmin ||
                    (o.Source == OpportunitySource.Admin && o.Status != OpportunityStatus.Draft && o.Status != OpportunityStatus.Rejected)))
                .OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
            var dtos = await opportunities.ToDtosAsync(opps, viewer, ct, includeLand: false);
            var active = dtos.FirstOrDefault(o => o.Status == OpportunityStatus.Active);
            return Results.Ok(new LandDetailDto(LandDto.From(land, active is not null), dtos, active));
        });

        // Land photos: public only for ministry-published land; other records remain admin-only.
        api.MapGet("/lands/{landId}/photos/{photoId}", async (string landId, string photoId, ClaimsPrincipal user, AppDbContext db, PrivateFileStorage storage, HttpResponse response, CancellationToken ct) =>
        {
            var row = await db.LandPhotos.AsNoTracking()
                .Join(db.Lands, p => p.LandId, l => l.Id, (p, l) => new { Photo = p, l.Status, l.EntrySource })
                .FirstOrDefaultAsync(x => x.Photo.Id == photoId && x.Photo.LandId == landId, ct);
            if (row is null) return ApiResults.NotFound("Foto tapılmadı.");
            var isPublic = row.Status == LandStatus.Approved && row.EntrySource != LandEntrySource.Owner;
            if (!isPublic && !user.IsAdmin())
                return ApiResults.NotFound("Foto tapılmadı.");
            var stream = storage.OpenRead(row.Photo.StorageKey);
            if (stream is null) return ApiResults.NotFound("Fayl serverdə tapılmadı.");
            response.Headers[HeaderNames.CacheControl] = isPublic ? "public, max-age=86400" : "private, no-store";
            response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.Stream(stream, row.Photo.ContentType, enableRangeProcessing: true);
        });

        // The 25 land-use types: inputs and deal-breakers (the "add land" form builds itself from this).
        api.MapGet("/land-uses", () => Results.Ok(new
        {
            Core = LandSuitability.CoreFields.Select(c => new { c.Field, c.Label }),
            LandUseCatalog.LegalCategories,
            LandUseCatalog.OwnershipForms,
            LandUseCatalog.RoadAccessTypes,
            Types = LandUseCatalog.All.Select(LandUseTypeDto.From),
        }));

        api.MapGet("/land-uses/{key}", (string key) =>
            LandUseCatalog.Find(key) is { } t ? Results.Ok(LandUseTypeDto.From(t)) : ApiResults.NotFound("Belə fəaliyyət növü yoxdur."));

        // Check land data before submitting (legal category → deal-breakers → missing data). Nothing is saved.
        api.MapPost("/land-uses/check", (LandProfileInput input, int? photos) =>
        {
            var (profile, error) = LandProfileParser.Parse(input);
            if (error is not null) return ApiResults.BadRequest(error);
            return Results.Ok(LandSuitability.Evaluate(profile!.Type, profile.ToFacts(Math.Max(0, photos ?? 0))));
        });

        return api;
    }
}

/// <summary>A land-use type for the form: inputs plus a readable list of deal-breakers.</summary>
public sealed record LandUseTypeDto(
    int Number, string Key, string Name, bool NeedsConstruction, IReadOnlyList<LandInput> Inputs, IReadOnlyList<DealBreakerDto> DealBreakers)
{
    public static LandUseTypeDto From(LandUseType t)
    {
        var breakers = new List<DealBreakerDto>();
        if (t.NeedsConstruction)
            breakers.Add(new("category_not_convertible", "Kənd təsərrüfatı təyinatlı torpağın kateqoriyası dəyişdirilə bilmir.", ["legalCategory", "categoryConvertible"]));
        breakers.AddRange(t.DealBreakers.Select(d => new DealBreakerDto(d.Code, d.Message, d.Inputs)));
        return new(t.Number, t.Key, t.Name, t.NeedsConstruction, t.Inputs, breakers);
    }
}

public sealed record DealBreakerDto(string Code, string Message, IReadOnlyList<string> Inputs);
