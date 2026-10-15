using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;

namespace QarabagInvestmentPortal.Api.Infrastructure.Http;

public static class ApiRateLimiting
{
    public static IServiceCollection AddApiRateLimiting(
        this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.GlobalLimiter =
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    if (!context.Request.Path.StartsWithSegments("/api"))
                        return RateLimitPartition.GetNoLimiter<string>("non-api");

                    // Public land photos (many per page) are not counted.
                    if (HttpMethods.IsGet(context.Request.Method)
                        && context.Request.Path.Value is { } path
                        && path.StartsWith("/api/lands/", StringComparison.Ordinal)
                        && path.Contains("/photos/", StringComparison.Ordinal))
                        return RateLimitPartition.GetNoLimiter<string>("land-photos");

                    var requiresAuth = context.GetEndpoint()?
                        .Metadata.GetMetadata<IAuthorizeData>() is not null;

                    var isWrite = HttpMethods.IsPost(context.Request.Method)
                        || HttpMethods.IsPatch(context.Request.Method)
                        || HttpMethods.IsDelete(context.Request.Method);

                    // Giriş tələb edən GET sorğularına bu limit tətbiq edilmir.
                    if (requiresAuth && !isWrite)
                        return RateLimitPartition.GetNoLimiter<string>("protected-get");

                    var ip = context.Connection.RemoteIpAddress;
                    var ipKey = ip is null
                        ? "unknown"
                        : (ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip)
                            .ToString();

                    var userId = context.User.FindFirstValue(
                        ClaimTypes.NameIdentifier);

                    var protectedWrite = requiresAuth
                        && isWrite
                        && !string.IsNullOrEmpty(userId);

                    var chatSend = protectedWrite && HttpMethods.IsPost(context.Request.Method)
                        && context.Request.Path.StartsWithSegments("/api/chats", out var chatPath)
                        && chatPath.Value?.EndsWith("/messages", StringComparison.OrdinalIgnoreCase) == true;

                    var key = chatSend
                        ? $"chat:{userId}"
                        : protectedWrite
                        ? $"write:{userId}:{ipKey}"
                        : $"public:{ipKey}";

                    var limit = chatSend ? 30 : protectedWrite ? 10 : 100;

                    return RateLimitPartition.GetFixedWindowLimiter(
                        key,
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = limit,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                            AutoReplenishment = true
                        });
                });

            options.OnRejected = async (rejection, ct) =>
            {
                var response = rejection.HttpContext.Response;
                response.StatusCode = StatusCodes.Status429TooManyRequests;

                if (rejection.Lease.TryGetMetadata(
                    MetadataName.RetryAfter, out var retryAfter))
                {
                    response.Headers["Retry-After"] =
                        Math.Ceiling(retryAfter.TotalSeconds)
                            .ToString(CultureInfo.InvariantCulture);
                }

                await response.WriteAsJsonAsync(
                    new { error = "Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin." },
                    cancellationToken: ct);
            };
        });

        return services;
    }
}
