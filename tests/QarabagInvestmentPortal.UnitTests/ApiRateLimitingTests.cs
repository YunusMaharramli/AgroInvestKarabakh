using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using QarabagInvestmentPortal.Api.Infrastructure.Http;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class ApiRateLimitingTests
{
    [Fact]
    public void Public_api_allows_100_requests_per_ip_then_rejects()
    {
        using var services = CreateServices();
        using var limiter = GetLimiter(services);

        for (var i = 0; i < 100; i++)
        {
            using var lease = limiter.AttemptAcquire(Request("/api/ai/status", "GET", "192.0.2.1"));
            Assert.True(lease.IsAcquired);
        }

        using var rejected = limiter.AttemptAcquire(Request("/api/auth/login", "POST", "192.0.2.1"));
        Assert.False(rejected.IsAcquired);

        using var anotherIp = limiter.AttemptAcquire(Request("/api/ai/status", "GET", "192.0.2.2"));
        Assert.True(anotherIp.IsAcquired);
    }

    [Fact]
    public void Protected_writes_share_10_request_limit_by_user_and_ip()
    {
        using var services = CreateServices();
        using var limiter = GetLimiter(services);

        for (var i = 0; i < 10; i++)
        {
            var method = (i % 3) switch { 0 => "POST", 1 => "PATCH", _ => "DELETE" };
            using var lease = limiter.AttemptAcquire(Request("/api/favorites", method, "192.0.2.3", "user-a", protectedEndpoint: true));
            Assert.True(lease.IsAcquired);
        }

        using var rejected = limiter.AttemptAcquire(Request("/api/favorites", "POST", "192.0.2.3", "user-a", protectedEndpoint: true));
        Assert.False(rejected.IsAcquired);

        using var anotherUser = limiter.AttemptAcquire(Request("/api/favorites", "POST", "192.0.2.3", "user-b", protectedEndpoint: true));
        Assert.True(anotherUser.IsAcquired);

        using var anotherIp = limiter.AttemptAcquire(Request("/api/favorites", "POST", "192.0.2.4", "user-a", protectedEndpoint: true));
        Assert.True(anotherIp.IsAcquired);
    }

    [Fact]
    public void Chat_messages_allow_30_per_minute_per_account_without_consuming_other_write_quota()
    {
        using var services = CreateServices();
        using var limiter = GetLimiter(services);

        for (var i = 0; i < 30; i++)
        {
            var ip = i % 2 == 0 ? "192.0.2.7" : "192.0.2.8";
            using var lease = limiter.AttemptAcquire(Request("/api/chats/proposal-1/messages", "POST", ip, "user-a", protectedEndpoint: true));
            Assert.True(lease.IsAcquired);
        }

        using var rejected = limiter.AttemptAcquire(Request("/api/chats/proposal-2/messages", "POST", "192.0.2.9", "user-a", protectedEndpoint: true));
        Assert.False(rejected.IsAcquired);
        using var otherWrite = limiter.AttemptAcquire(Request("/api/favorites", "POST", "192.0.2.7", "user-a", protectedEndpoint: true));
        Assert.True(otherWrite.IsAcquired);
    }

    [Fact]
    public void Protected_get_and_non_api_requests_are_not_limited()
    {
        using var services = CreateServices();
        using var limiter = GetLimiter(services);

        for (var i = 0; i < 105; i++)
        {
            using var protectedGet = limiter.AttemptAcquire(Request("/api/favorites", "GET", "192.0.2.5", "user-a", protectedEndpoint: true));
            Assert.True(protectedGet.IsAcquired);

            using var health = limiter.AttemptAcquire(Request("/health", "GET", "192.0.2.5"));
            Assert.True(health.IsAcquired);
        }
    }

    private static ServiceProvider CreateServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApiRateLimiting();
        return services.BuildServiceProvider();
    }

    private static System.Threading.RateLimiting.PartitionedRateLimiter<HttpContext> GetLimiter(
        ServiceProvider services) =>
        services.GetRequiredService<IOptions<RateLimiterOptions>>().Value.GlobalLimiter!;

    private static HttpContext Request(
        string path,
        string method,
        string ip,
        string? userId = null,
        bool protectedEndpoint = false)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);

        if (userId is not null)
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId)], "test"));

        if (protectedEndpoint)
            context.SetEndpoint(new Endpoint(
                _ => Task.CompletedTask,
                new EndpointMetadataCollection(new AuthorizeAttribute()),
                "protected"));

        return context;
    }
}
