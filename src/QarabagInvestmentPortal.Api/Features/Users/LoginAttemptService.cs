using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class LoginAttemptService(AppDbContext db, TimeProvider clock)
{
    public async Task<Outcome<User>> AuthenticateAsync(
        string email, string password, string ipAddress, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // Sətir mövcud deyilsə yaradırıq. Eyni IP + email üçün paralel
        // sorğularda PostgreSQL-in unique key-i yalnız birini keçirir.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO portal.login_attempt_states
                ("IpAddress", "Email", "FailedAttempts", "CompletedBlocks",
                 "BlockedUntil", "UpdatedAt")
            VALUES ({ipAddress}, {email}, 0, 0, NULL, {clock.GetUtcNow()})
            ON CONFLICT ("IpAddress", "Email") DO NOTHING
            """, ct);

        // Şifrə yoxlanana və sayğac yazılana qədər həmin sətri kilidləyirik.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            SELECT 1 FROM portal.login_attempt_states
            WHERE "IpAddress" = {ipAddress} AND "Email" = {email}
            FOR UPDATE
            """, ct);

        var state = await db.LoginAttemptStates.SingleAsync(
            x => x.IpAddress == ipAddress && x.Email == email, ct);
        var now = clock.GetUtcNow();

        if (LoginBlockPolicy.GetRemainingBlock(state, now) is { } remaining)
        {
            await transaction.CommitAsync(ct);
            return Outcome<User>.Fail(
                429,
                $"Bu IP və e-poçt üçün giriş müvəqqəti məhdudlaşdırılıb. " +
                $"{Math.Ceiling(remaining.TotalMinutes)} dəqiqə sonra yenidən yoxlayın.");
        }

        var user = await db.Users.Include(x => x.Profile)
            .FirstOrDefaultAsync(x => x.Email == email, ct);

        if (user is null ||
            !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            var blockDuration = LoginBlockPolicy.RecordFailure(state, now);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return blockDuration is null
                ? Outcome<User>.Fail(401, "E-poçt və ya şifrə yanlışdır.")
                : Outcome<User>.Fail(
                    429,
                    $"Çox sayda uğursuz giriş. " +
                    $"{Math.Ceiling(blockDuration.Value.TotalMinutes)} dəqiqə sonra yenidən yoxlayın.");
        }

        // Uğurlu giriş sayğacı tam sıfırlayır.
        db.LoginAttemptStates.Remove(state);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return Outcome<User>.Success(user);
    }
}