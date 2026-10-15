using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class AuthActionTokenService(AppDbContext db, TimeProvider clock)
{
    public async Task<string> IssueAsync(
        string userId,
        AuthTokenPurpose purpose,
        TimeSpan lifetime,
        CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var rawToken = AuthTokenCodec.NewToken();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        await db.AuthActionTokens
            .Where(t => t.UserId == userId &&
                        t.Purpose == purpose &&
                        t.UsedAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    t => t.UsedAt, (DateTimeOffset?)now), ct);

        db.AuthActionTokens.Add(new AuthActionToken
        {
            Id = Ids.New("act"),
            UserId = userId,
            Purpose = purpose,
            TokenHash = AuthTokenCodec.Hash(rawToken),
            CreatedAt = now,
            ExpiresAt = now.Add(lifetime)
        });

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return rawToken;
    }

    /// <summary>The user a still-valid token belongs to, without using the token up.</summary>
    public async Task<string?> PeekAsync(
        string? rawToken,
        AuthTokenPurpose purpose,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            return null;

        var now = clock.GetUtcNow();
        var hash = AuthTokenCodec.Hash(rawToken);
        return await db.AuthActionTokens
            .AsNoTracking()
            .Where(t => t.TokenHash == hash &&
                        t.Purpose == purpose &&
                        t.UsedAt == null &&
                        t.ExpiresAt > now)
            .Select(t => t.UserId)
            .SingleOrDefaultAsync(ct);
    }

    public async Task<string?> ConsumeAsync(
        string? rawToken,
        AuthTokenPurpose purpose,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            return null;

        var now = clock.GetUtcNow();
        var hash = AuthTokenCodec.Hash(rawToken);

        var token = await db.AuthActionTokens
            .AsNoTracking()
            .Where(t => t.TokenHash == hash &&
                        t.Purpose == purpose &&
                        t.UsedAt == null &&
                        t.ExpiresAt > now)
            .Select(t => new { t.Id, t.UserId })
            .SingleOrDefaultAsync(ct);

        if (token is null)
            return null;

        var updated = await db.AuthActionTokens
            .Where(t => t.Id == token.Id &&
                        t.UsedAt == null &&
                        t.ExpiresAt > now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    t => t.UsedAt, (DateTimeOffset?)now), ct);

        return updated == 1 ? token.UserId : null;
    }
}