using System.Security.Claims;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;

namespace QarabagInvestmentPortal.Api.Features.Rentals;

public static class RentalEndpoints
{
    public static RouteGroupBuilder MapRentalEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/rentals", async (string? region, string? propertyType, string? search, RentalService service, CancellationToken ct) =>
            Results.Ok(await service.PublicListingsAsync(region, propertyType, search, ct)));
        api.MapGet("/rentals/{id}", async (string id, RentalService service, CancellationToken ct) =>
            await service.PublicListingAsync(id, ct) is { } listing ? Results.Ok(listing) : ApiResults.NotFound("İcarə elanı tapılmadı."));

        var applicant = api.MapGroup("/applicant").RequireAuthorization(Policies.User);
        applicant.MapGet("/profile", async (ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            Results.Ok(await service.GetProfileAsync(user.RequiredUserId(), ct)));
        applicant.MapPost("/profile", async (ApplicantProfileInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.SaveProfileAsync(user.RequiredUserId(), input, ct)).ToResult(x => Results.Ok(x)));

        var applications = api.MapGroup("/rental-applications").RequireAuthorization(Policies.User);
        applications.MapGet("", async (ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            Results.Ok(await service.ApplicantApplicationsAsync(user.RequiredUserId(), ct)));
        applications.MapPost("", async (RentalApplicationDraftInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.CreateDraftAsync(user.RequiredUserId(), input, ct)).ToResult(x => Results.Json(x, statusCode: StatusCodes.Status201Created)));
        applications.MapGet("/{id}", async (string id, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            await service.GetApplicantApplicationAsync(id, user.RequiredUserId(), ct) is { } item ? Results.Ok(item) : ApiResults.NotFound("Müraciət tapılmadı."));
        applications.MapPost("/{id}/documents", async (string id, HttpRequest request, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Sənədləri forma ilə göndərin.");
            return (await service.AddApplicationDocumentsAsync(id, user.RequiredUserId(), await request.ReadFormAsync(ct), ct)).ToResult(x => Results.Ok(x));
        });
        applications.MapPost("/{id}/submit", async (string id, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.SubmitAsync(id, user.RequiredUserId(), ct)).ToResult(x => Results.Ok(x)));
        applications.MapPost("/{id}/withdraw", async (string id, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.WithdrawAsync(id, user.RequiredUserId(), ct)).ToResult(x => Results.Ok(x)));

        var adminListings = api.MapGroup("/admin/rentals").RequireAuthorization(Policies.Admin);
        adminListings.MapGet("", async (string? status, string? search, RentalService service, CancellationToken ct) =>
            Results.Ok(await service.AdminListingsAsync(status, search, ct)));
        adminListings.MapGet("/{id}", async (string id, RentalService service, CancellationToken ct) =>
            await service.AdminListingAsync(id, ct) is { } item ? Results.Ok(item) : ApiResults.NotFound("İcarə elanı tapılmadı."));
        adminListings.MapPost("", async (RentalListingInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.CreateListingAsync(user.RequiredUserId(), input, ct)).ToResult(x => Results.Json(x, statusCode: StatusCodes.Status201Created)));
        adminListings.MapPost("/{id}", async (string id, RentalListingInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.UpdateListingAsync(id, user.RequiredUserId(), input, ct)).ToResult(x => Results.Ok(x)));
        adminListings.MapPost("/{id}/publish", async (string id, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.PublishAsync(id, user.RequiredUserId(), ct)).ToResult(x => Results.Ok(x)));
        adminListings.MapPost("/{id}/withdraw", async (string id, RentalDecisionInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.WithdrawAsync(id, user.RequiredUserId(), input.Reason, ct)).ToResult(x => Results.Ok(x)));
        adminListings.MapPost("/{id}/documents", async (string id, HttpRequest request, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Sənədi forma ilə göndərin.");
            return (await service.AddListingDocumentAsync(id, user.RequiredUserId(), await request.ReadFormAsync(ct), ct)).ToResult(x => Results.Ok(x));
        });

        var adminApps = api.MapGroup("/admin/rental-applications").RequireAuthorization(Policies.Admin);
        adminApps.MapGet("", async (string? status, string? search, RentalService service, CancellationToken ct) =>
            Results.Ok(await service.AdminApplicationsAsync(status, search, ct)));
        adminApps.MapGet("/{id}", async (string id, RentalService service, CancellationToken ct) =>
            await service.AdminApplicationAsync(id, ct) is { } item ? Results.Ok(item) : ApiResults.NotFound("Müraciət tapılmadı."));
        adminApps.MapPost("/{id}/under-review", async (string id, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.BeginReviewAsync(id, user.RequiredUserId(), ct)).ToResult(x => Results.Ok(x)));
        adminApps.MapPost("/{id}/request-information", async (string id, RentalDecisionInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.RequestInformationAsync(id, user.RequiredUserId(), input.Reason, ct)).ToResult(x => Results.Ok(x)));
        adminApps.MapPost("/{id}/approve", async (string id, RentalDecisionInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.ApproveAsync(id, user.RequiredUserId(), input.Reason, ct)).ToResult(x => Results.Ok(x)));
        adminApps.MapPost("/{id}/reject", async (string id, RentalDecisionInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.RejectAsync(id, user.RequiredUserId(), input.Reason, ct)).ToResult(x => Results.Ok(x)));
        adminApps.MapPost("/{id}/finalize-lease", async (string id, FinalizeLeaseInput input, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.FinalizeLeaseAsync(id, user.RequiredUserId(), input, ct)).ToResult(x => Results.Ok(x)));
        api.MapPost("/admin/rental-leases/{id}/end", async (string id, ClaimsPrincipal user, RentalService service, CancellationToken ct) =>
            (await service.EndLeaseAsync(id, user.RequiredUserId(), ct)).ToResult(x => Results.Ok(x))).RequireAuthorization(Policies.Admin);
        return api;
    }
}
