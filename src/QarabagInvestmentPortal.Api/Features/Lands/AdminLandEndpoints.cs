using System.Security.Claims;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>
/// Admin land management (/api/admin/lands). Every route requires the Admin policy on the server;
/// hiding the buttons in the UI is only a convenience.
/// </summary>
public static class AdminLandEndpoints
{
    public static RouteGroupBuilder MapAdminLandEndpoints(this RouteGroupBuilder api)
    {
        var lands = api.MapGroup("/admin/lands").RequireAuthorization(Policies.Admin);

        // Choices for the form (land-use types come from GET /api/land-uses).
        lands.MapGet("/options", () => Results.Ok(new
        {
            AdminLandRules.WaterAccessOptions,
            AdminLandRules.InvestmentRegions,
            AdminLandRules.DocumentKinds,
            LandUseCatalog.LegalCategories,
            LandUseCatalog.OwnershipForms,
            LandUseCatalog.RoadAccessTypes,
            Details = AdminLandRules.DetailsSchema.Inputs,
            AdminLandRules.HectaresPerSot,
        }));

        lands.MapGet("", async (string? status, string? search, string? region, string? landUse, string? competitionId,
            DateOnly? from, DateOnly? to, AdminLandService service, CancellationToken ct) =>
            Results.Ok(await service.ListAsync(status, search, region, landUse, competitionId, from, to, ct)));

        lands.MapGet("/{id}", async (string id, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            await service.GetAsync(id, user.RequiredUserId(), ct) is { } dto ? Results.Ok(dto) : ApiResults.NotFound("Torpaq sahəsi tapılmadı."));

        // Create as a draft (multipart: fields + documents[] + documentKinds[] + photos[]).
        lands.MapPost("", async (HttpRequest request, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Məlumatları forma ilə göndərin.");
            var form = await request.ReadFormAsync(ct);
            return (await service.CreateAsync(user.RequiredUserId(), form, ct)).ToResult();
        });

        // Edit (multipart; only the fields that are sent change). New files are added.
        lands.MapPost("/{id}", async (string id, HttpRequest request, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Məlumatları forma ilə göndərin.");
            var form = await request.ReadFormAsync(ct);
            return (await service.UpdateAsync(id, user.RequiredUserId(), form, ct)).ToResult();
        });

        lands.MapDelete("/{id}/documents/{documentId}", async (string id, string documentId, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.RemoveDocumentAsync(id, documentId, user.RequiredUserId(), ct)).ToResult());

        lands.MapDelete("/{id}/photos/{photoId}", async (string id, string photoId, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.RemovePhotoAsync(id, photoId, user.RequiredUserId(), ct)).ToResult());

        lands.MapPost("/{id}/publish", async (string id, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.PublishAsync(id, user.RequiredUserId(), ct)).ToResult());

        lands.MapPost("/{id}/unpublish", async (string id, AdminLandReasonRequest req, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.UnpublishAsync(id, user.RequiredUserId(), req.Reason, ct)).ToResult());

        lands.MapPost("/{id}/archive", async (string id, AdminLandReasonRequest req, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.ArchiveAsync(id, user.RequiredUserId(), req.Reason, ct)).ToResult());

        lands.MapPost("/{id}/restore", async (string id, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.RestoreAsync(id, user.RequiredUserId(), ct)).ToResult());

        lands.MapPost("/{id}/reassign", async (string id, AdminLandReassignRequest req, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.ReassignAsync(id, user.RequiredUserId(), req.Email, ct)).ToResult());

        lands.MapPost("/{id}/verification", async (string id, AdminLandVerificationRequest req, ClaimsPrincipal user, AdminLandService service, CancellationToken ct) =>
            (await service.SetVerificationAsync(id, user.RequiredUserId(), req.Status, req.EvidenceChecked, req.Note, ct)).ToResult());

        return api;
    }
}
