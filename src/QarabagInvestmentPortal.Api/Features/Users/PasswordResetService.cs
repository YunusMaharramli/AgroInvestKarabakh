using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class PasswordResetService(
    AppDbContext db,
    AuthActionTokenService tokens,
    AuthLinkBuilder links,
    IEmailSender emailSender,
    TimeProvider clock,
    SessionStore sessions,
    ILogger<PasswordResetService> logger)
{
    public async Task<Outcome<MessageResponse>> RequestAsync(
        string? inputEmail,
        CancellationToken ct)
    {
        var result = Outcome<MessageResponse>.Success(
            new MessageResponse(
                "Bu e-poçt sistemdə varsa, şifrə sıfırlama linki göndəriləcək."));

        var email = inputEmail?.Trim().ToLowerInvariant() ?? string.Empty;
        if (email.Length is 0 or > 256)
            return result;

        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null)
            return result;

        // Administrator passwords are managed in the database only: no reset by email.
        if (user.Role == UserRole.Admin)
            return Outcome<MessageResponse>.Fail(403, AdminAccounts.PasswordLockedMessage);

        var lastCreatedAt = await db.AuthActionTokens
            .Where(t => t.UserId == user.Id &&
                        t.Purpose == AuthTokenPurpose.PasswordReset)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => (DateTimeOffset?)t.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (lastCreatedAt is not null &&
            lastCreatedAt > clock.GetUtcNow().AddMinutes(-5))
            return result;

        try
        {
            var token = await tokens.IssueAsync(
                user.Id,
                AuthTokenPurpose.PasswordReset,
                TimeSpan.FromMinutes(30),
                ct);

            var link = links.PasswordReset(token);

            await emailSender.SendAsync(
                user.Email,
                "Şifrənizi sıfırlayın",
                $"Şifrənizi yeniləmək üçün bu linki açın:\n{link}\n\nLink 30 dəqiqə etibarlıdır.",
                ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex,
                "Password reset email could not be sent for user {UserId}",
                user.Id);
        }

        return result;
    }

    public async Task<Outcome<MessageResponse>> ResetAsync(
        ResetPasswordRequest req,
        HttpResponse response,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Token) ||
            string.IsNullOrEmpty(req.NewPassword) ||
            string.IsNullOrEmpty(req.ConfirmNewPassword))
            return Outcome<MessageResponse>.Fail(400, "Bütün sahələr doldurulmalıdır.");

        if (req.NewPassword != req.ConfirmNewPassword)
            return Outcome<MessageResponse>.Fail(400, "Yeni şifrələr uyğun gəlmir.");

        if (req.NewPassword.Length < ApplicantSignupRules.MinPasswordLength)
            return Outcome<MessageResponse>.Fail(
                400, $"Şifrə ən azı {ApplicantSignupRules.MinPasswordLength} simvol olmalıdır.");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var userId = await tokens.ConsumeAsync(
            req.Token, AuthTokenPurpose.PasswordReset, ct);

        if (userId is null)
            return Outcome<MessageResponse>.Fail(
                400, "Şifrə sıfırlama linki etibarsızdır və ya vaxtı bitib.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Outcome<MessageResponse>.Fail(400, "İstifadəçi tapılmadı.");

        if (user.Role == UserRole.Admin)
            return Outcome<MessageResponse>.Fail(403, AdminAccounts.PasswordLockedMessage);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.UpdatedAt = clock.GetUtcNow();

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        sessions.RemoveAllForUser(user.Id);
        response.Cookies.Delete(SessionStore.CookieName);

        return Outcome<MessageResponse>.Success(
            new MessageResponse("Şifrə yeniləndi. Yeni şifrənizlə daxil olun."));
    }
}