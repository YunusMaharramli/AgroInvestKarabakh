using System.Security.Claims;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;

namespace QarabagInvestmentPortal.Api.Features.Chat;

public static class ChatEndpoints
{
    public static RouteGroupBuilder MapChatEndpoints(this RouteGroupBuilder api)
    {
        var chats = api.MapGroup("/chats").RequireAuthorization(Policies.SignedIn);
        chats.MapGet("", async (ClaimsPrincipal user, ChatService service, CancellationToken ct) =>
            Results.Ok(await service.ThreadsAsync(ViewerOf(user), ct)));
        chats.MapGet("/{proposalId}/messages", async (
            string proposalId, DateTimeOffset? before, ClaimsPrincipal user, ChatService service, CancellationToken ct) =>
            (await service.MessagesAsync(proposalId, ViewerOf(user), before, ct)).ToResult(Results.Ok));
        chats.MapPost("/{proposalId}/messages", async (
            string proposalId, SendChatMessageRequest request, ClaimsPrincipal user, ChatService service, CancellationToken ct) =>
            (await service.SendAsync(proposalId, request.Body, ViewerOf(user), ct))
                .ToResult(value => Results.Json(value, statusCode: StatusCodes.Status201Created)));
        return api;
    }

    private static Viewer ViewerOf(ClaimsPrincipal user) => new(user.UserId(), user.IsAdmin());
}
