using System.Security.Claims;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;

namespace QarabagInvestmentPortal.Api.Features.Proposals;

public static class ProposalEndpoints
{
    public static RouteGroupBuilder MapOpportunityAndProposalEndpoints(this RouteGroupBuilder api)
    {
        // ------------------------------------------------ investment opportunities (was "competitions")
        api.MapGet("/opportunities", async (string? status, string? region, ClaimsPrincipal user, OpportunityQueries queries, CancellationToken ct) =>
            Results.Ok(await queries.ListAsync(ViewerOf(user), status, region, ct)));

        api.MapGet("/opportunities/{id}", async (string id, ClaimsPrincipal user, OpportunityQueries queries, CancellationToken ct) =>
            await queries.GetAsync(id, ViewerOf(user), ct) is { } dto ? Results.Ok(dto) : ApiResults.NotFound("İnvestisiya elanı tapılmadı."));

        api.MapPost("/opportunities/{id}/select-winner", async (string id, SelectWinnerRequest req, ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            (await service.SelectWinnerAsync(id, req.ProposalId, ViewerOf(user), ct)).ToResult(r => Results.Ok(r)))
            .RequireAuthorization(Policies.Admin);

        api.MapPatch("/opportunities/{id}/status", async (string id, CloseOpportunityRequest req, ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            (await service.SetStatusAsync(id, req.Status, req.Reason, ViewerOf(user), ct)).ToResult(r => Results.Ok(r)))
            .RequireAuthorization(Policies.SignedIn);

        // ------------------------------------------------ proposals (was "applications")
        var proposals = api.MapGroup("/proposals").RequireAuthorization(Policies.SignedIn);

        proposals.MapPost("", async (HttpRequest request, ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return ApiResults.BadRequest("Təklif forması düzgün göndərilməyib.");
            var form = await request.ReadFormAsync(ct);
            return (await service.SubmitAsync(ViewerOf(user), form, ct)).ToResult(r => Results.Json(r, statusCode: StatusCodes.Status201Created));
        });

        proposals.MapGet("/sent", async (ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            Results.Ok(await service.SentAsync(ViewerOf(user), ct)));

        proposals.MapGet("/received", async (ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            Results.Ok(await service.ReceivedAsync(ViewerOf(user), ct)));

        proposals.MapGet("/{id}", async (string id, ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            await service.GetAsync(id, ViewerOf(user), ct) is { } dto ? Results.Ok(dto) : ApiResults.NotFound("Təklif tapılmadı."));

        // ------------------------------------------------ admin: every proposal
        api.MapGet("/admin/proposals", async (string? status, string? region, string? search, ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            Results.Ok(await service.AllAsync(ViewerOf(user), status, region, search, ct)))
            .RequireAuthorization(Policies.Admin);

        api.MapPost("/admin/proposals/{id}/reject", async (string id, RejectProposalRequest req, ClaimsPrincipal user, ProposalService service, CancellationToken ct) =>
            (await service.RejectAsync(id, req.Reason, ViewerOf(user), ct)).ToResult(r => Results.Ok(r)))
            .RequireAuthorization(Policies.Admin);

        return api;
    }

    private static Viewer ViewerOf(ClaimsPrincipal user) => new(user.UserId(), user.IsAdmin());
}
