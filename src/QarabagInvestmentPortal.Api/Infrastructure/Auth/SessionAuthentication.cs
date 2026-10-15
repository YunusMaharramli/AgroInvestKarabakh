using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Infrastructure.Auth;

/// <summary>
/// Same login model as before: a random token is returned at login and accepted as "Authorization: Bearer" or as the
/// HttpOnly "agroinvest_session" cookie (the cookie lets &lt;img&gt; tags load private documents). Sessions live in memory,
/// so restarting the server logs everyone out.
/// </summary>
public sealed class SessionStore
{
    public const string CookieName = "agroinvest_session";
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    private readonly ConcurrentDictionary<string, Session> _sessions = new();

    public sealed record Session(string UserId, UserRole Role, DateTimeOffset ExpiresAt);

    public string Create(User user, HttpResponse response)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        _sessions[token] = new Session(user.Id, user.Role, DateTimeOffset.UtcNow.Add(Lifetime));
        response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = false,
            MaxAge = Lifetime,
        });
        return token;
    }

    public Session? Find(string token) =>
        _sessions.TryGetValue(token, out var s) && s.ExpiresAt > DateTimeOffset.UtcNow ? s : null;

    public void Remove(string token) => _sessions.TryRemove(token, out _);

    public void RemoveAllForUser(string userId)
    {
        foreach (var session in _sessions)
        {
            if (session.Value.UserId == userId)
                _sessions.TryRemove(session.Key, out _);
        }
    }

    public static string? ReadToken(HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return header[7..].Trim();
        return request.Cookies[CookieName];
    }
}

public sealed class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    SessionStore sessions) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Session";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = SessionStore.ReadToken(Request);
        if (string.IsNullOrEmpty(token)) return Task.FromResult(AuthenticateResult.NoResult());
        var session = sessions.Find(token);
        if (session is null) return Task.FromResult(AuthenticateResult.NoResult());

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, session.UserId),
                new Claim(ClaimTypes.Role, session.Role == UserRole.Admin ? Roles.Admin : Roles.User),
            ],
            SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Response.WriteAsJsonAsync(new { error = "Giriş tələb olunur." });
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        return Response.WriteAsJsonAsync(new { error = "Bu əməliyyat üçün icazəniz yoxdur." });
    }
}

public static class Roles
{
    public const string User = "USER";
    public const string Admin = "ADMIN";
}

public static class Policies
{
    /// <summary>Any logged-in user (USER or ADMIN).</summary>
    public const string SignedIn = "SignedIn";

    /// <summary>Administrators only.</summary>
    public const string Admin = "Admin";
}

public static class AuthSetup
{
    public static IServiceCollection AddPortalAuth(this IServiceCollection services)
    {
        services.AddSingleton<SessionStore>();
        services.AddAuthentication(SessionAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthenticationHandler.SchemeName, null);
        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.SignedIn, p => p.RequireAuthenticatedUser())
            .AddPolicy(Policies.Admin, p => p.RequireAuthenticatedUser().RequireRole(Roles.Admin));
        return services;
    }
}

public static class ClaimsPrincipalExtensions
{
    /// <summary>The logged-in user's id, or null for anonymous requests.</summary>
    public static string? UserId(this ClaimsPrincipal principal) =>
        principal.Identity?.IsAuthenticated == true ? principal.FindFirstValue(ClaimTypes.NameIdentifier) : null;

    /// <summary>The logged-in user's id; only call on endpoints that require authorization.</summary>
    public static string RequiredUserId(this ClaimsPrincipal principal) =>
        principal.UserId() ?? throw new InvalidOperationException("Endpoint must require authorization.");

    public static bool IsAdmin(this ClaimsPrincipal principal) => principal.IsInRole(Roles.Admin);
}
