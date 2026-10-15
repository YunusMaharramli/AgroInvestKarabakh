using System.Security.Claims;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;

namespace QarabagInvestmentPortal.Api.Features.Users;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth");

        auth.MapPost("/register",
            async (RegisterRequest req, AuthService service, CancellationToken ct) =>
                (await service.RegisterAsync(req, ct))
                    .ToResult(r => Results.Json(
                        r, statusCode: StatusCodes.Status201Created)));

        auth.MapPost("/confirm-email",
            async (ConfirmEmailRequest req,
                   EmailConfirmationService service,
                   CancellationToken ct) =>
                (await service.ConfirmAsync(req.Token, ct))
                    .ToResult(r => Results.Ok(r)));
        auth.MapPost("/forgot-password",
        async (ForgotPasswordRequest req,
               PasswordResetService service,
               CancellationToken ct) =>
        (await service.RequestAsync(req.Email, ct))
            .ToResult(r => Results.Ok(r)));

        auth.MapPost("/reset-password",
            async (ResetPasswordRequest req,
                   PasswordResetService service,
                   HttpResponse response,
                   CancellationToken ct) =>
                (await service.ResetAsync(req, response, ct))
                    .ToResult(r => Results.Ok(r)));


        auth.MapPost("/resend-confirmation",
            async (ResendConfirmationRequest req,
                   EmailConfirmationService service,
                   HttpContext context,
                   CancellationToken ct) =>
    {
        var remoteIp = context.Connection.RemoteIpAddress;
        var ipAddress = remoteIp is null
            ? "unknown"
            : remoteIp.IsIPv4MappedToIPv6
                ? remoteIp.MapToIPv4().ToString()
                : remoteIp.ToString();

        return (await service.ResendAsync(req.Email, ipAddress, ct))
            .ToResult(r => Results.Ok(r));
    });

        auth.MapPost("/login",
            async (
                LoginRequest req,
                AuthService service,
                HttpContext context,
                CancellationToken ct) =>
        {
            var remoteIp = context.Connection.RemoteIpAddress;
            var ipAddress = remoteIp is null
                ? "unknown"
                : remoteIp.IsIPv4MappedToIPv6
                    ? remoteIp.MapToIPv4().ToString()
                    : remoteIp.ToString();

            return (await service.LoginAsync(
                req, ipAddress, context.Response, ct))
                .ToResult(r => Results.Ok(r));
        });

        auth.MapPost("/change-password",
            async (ChangePasswordRequest req,
                   ClaimsPrincipal principal,
                   AuthService service,
                   HttpResponse response,
                   CancellationToken ct) =>
        (await service.ChangePasswordAsync(
            principal.RequiredUserId(), req, response, ct))
        .ToResult(r => Results.Ok(r)))
    .RequireAuthorization(Policies.SignedIn);

        auth.MapPost("/logout", (HttpRequest request, HttpResponse response, SessionStore sessions) =>
        {
            if (SessionStore.ReadToken(request) is { } token) sessions.Remove(token);
            response.Cookies.Delete(SessionStore.CookieName);
            return Results.Ok(new MessageResponse("Sistemdən uğurla çıxış edildi."));
        });

        auth.MapGet("/me", async (ClaimsPrincipal principal, AuthService service, CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var me = userId is null ? null : await service.MeAsync(userId, ct);
            return me is null ? ApiResults.Error(StatusCodes.Status401Unauthorized, "Aktiv sessiya tapılmadı.") : Results.Ok(me);
        });

        auth.MapPatch("/profile", async (UpdateProfileRequest req, ClaimsPrincipal principal, AuthService service, CancellationToken ct) =>
            (await service.UpdateProfileAsync(principal.RequiredUserId(), req, ct)).ToResult(r => Results.Ok(r)))
            .RequireAuthorization(Policies.SignedIn);

        return api;
    }
}
