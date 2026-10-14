using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Notifications;

/// <summary>Adds notifications to the current unit of work; the caller saves them together with its own changes.</summary>
public sealed class NotificationService(AppDbContext db, TimeProvider clock)
{
    public void Notify(string userId, string title, string message) =>
        db.Notifications.Add(new Notification
        {
            Id = Ids.New("notif"),
            UserId = userId,
            Title = title,
            Message = message,
            IsRead = false,
            CreatedAt = clock.GetUtcNow(),
        });

    public async Task NotifyAdminsAsync(string title, string message, CancellationToken ct)
    {
        var adminIds = await db.Users.Where(u => u.Role == UserRole.Admin).Select(u => u.Id).ToListAsync(ct);
        foreach (var id in adminIds) Notify(id, title, message);
    }
}

public sealed record NotificationDto(string Id, string UserId, string Title, string Message, bool IsRead, DateTimeOffset CreatedAt);
public sealed record SuccessResponse(bool Success);

public static class NotificationEndpoints
{
    public static RouteGroupBuilder MapNotificationEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/notifications").RequireAuthorization(Policies.SignedIn);

        group.MapGet("", async (ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
        {
            var userId = user.RequiredUserId();
            var items = await db.Notifications.AsNoTracking()
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(200)
                .Select(n => new NotificationDto(n.Id, n.UserId, n.Title, n.Message, n.IsRead, n.CreatedAt))
                .ToListAsync(ct);
            return Results.Ok(items);
        });

        group.MapPatch("/{id}/read", async (string id, ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
        {
            var userId = user.RequiredUserId();
            var updated = await db.Notifications.Where(n => n.Id == id && n.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
            return Results.Ok(new SuccessResponse(updated > 0));
        });

        group.MapPost("/read-all", async (ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
        {
            var userId = user.RequiredUserId();
            await db.Notifications.Where(n => n.UserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
            return Results.Ok(new SuccessResponse(true));
        });

        return api;
    }
}
