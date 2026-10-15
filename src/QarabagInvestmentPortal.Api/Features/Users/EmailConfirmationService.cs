using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class EmailConfirmationService(
    AppDbContext db,
    AuthActionTokenService tokens,
    AuthLinkBuilder links,
    IEmailSender emailSender,
    TimeProvider clock)
{
    public async Task SendAsync(User user, CancellationToken ct)
    {
        if (user.EmailConfirmedAt is not null)
            return;

        var token = await tokens.IssueAsync(
            user.Id,
            AuthTokenPurpose.EmailConfirmation,
            TimeSpan.FromHours(24),
            ct);

        var link = links.Confirmation(token);

        await emailSender.SendAsync(
            user.Email,
            "E-poçt ünvanınızı təsdiqləyin",
            $"Qeydiyyatı tamamlamaq üçün bu linki açın:\n{link}\n\nLink 24 saat etibarlıdır.",
            ct);
    }

    public async Task<Outcome<MessageResponse>> ResendAsync(
    string? inputEmail,
    string ipAddress,
    CancellationToken ct)
    {
        var genericResult = Outcome<MessageResponse>.Success(
            new MessageResponse(
                "Bu ünvana təsdiq tələb olunursa, məktub göndəriləcək."));

        var email = inputEmail?.Trim().ToLowerInvariant() ?? string.Empty;
        if (email.Length is 0 or > 256)
            return genericResult;

        var now = clock.GetUtcNow();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        await db.Database.ExecuteSqlInterpolatedAsync($"""
        INSERT INTO portal.confirmation_resend_states
            ("IpAddress", "Email", "SentInWindow",
             "WindowStartedAt", "BlockedUntil", "UpdatedAt")
        VALUES ({ipAddress}, {email}, 0, NULL, NULL, {now})
        ON CONFLICT ("IpAddress", "Email") DO NOTHING
        """, ct);

        await db.Database.ExecuteSqlInterpolatedAsync($"""
        SELECT 1 FROM portal.confirmation_resend_states
        WHERE "IpAddress" = {ipAddress} AND "Email" = {email}
        FOR UPDATE
        """, ct);

        var state = await db.ConfirmationResendStates.SingleAsync(
            x => x.IpAddress == ipAddress && x.Email == email, ct);

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Email == email, ct);

        DateTimeOffset? lastLinkCreatedAt = null;
        if (user is not null && user.EmailConfirmedAt is null)
        {
            lastLinkCreatedAt = await db.AuthActionTokens
                .Where(t => t.UserId == user.Id &&
                            t.Purpose == AuthTokenPurpose.EmailConfirmation)
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => (DateTimeOffset?)t.CreatedAt)
                .FirstOrDefaultAsync(ct);
        }

        var decision = ConfirmationResendPolicy.CheckAndRecord(
            state, now, lastLinkCreatedAt);

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        if (decision == ConfirmationResendDecision.Send &&
            user is not null &&
            user.EmailConfirmedAt is null)
        {
            await SendAsync(user, ct);
        }

        return genericResult;
    }

    public async Task<Outcome<MessageResponse>> ConfirmAsync(
        string? rawToken,
        CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var userId = await tokens.ConsumeAsync(
            rawToken, AuthTokenPurpose.EmailConfirmation, ct);

        if (userId is null)
            return Outcome<MessageResponse>.Fail(
                400, "Təsdiq linki etibarsızdır və ya vaxtı bitib.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Outcome<MessageResponse>.Fail(400, "İstifadəçi tapılmadı.");

        var now = clock.GetUtcNow();
        user.EmailConfirmedAt ??= now;
        user.UpdatedAt = now;

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return Outcome<MessageResponse>.Success(
            new MessageResponse("E-poçt ünvanınız təsdiqləndi."));
    }
}