using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Users;

/// <summary>
/// Administrator accounts come from the database only: nobody signs up as an admin. The list is kept in configuration
/// ("Admins:Accounts" in user-secrets, environment variables or the git-ignored admins.local.json) and written to the
/// database at start-up. At most <see cref="AdminAccounts.MaxAdmins"/> administrators exist.
/// </summary>
public sealed class AdminAccountsOptions
{
    public const string SectionName = "Admins";
    public List<AdminAccountOptions> Accounts { get; set; } = [];
}

public sealed class AdminAccountOptions
{
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = "Admin";
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Initial password, used only when the account does not exist yet. An existing account (for example an earlier
    /// sign-up being promoted) keeps its password; the configuration never overwrites one.
    /// </summary>
    public string? Password { get; set; }
}

public sealed record AdminSeedResult(int Created, int Promoted, int Skipped, int TotalAdmins);

public static class AdminAccounts
{
    public const int MaxAdmins = 10;

    public const string PasswordLockedMessage =
        "Bu e-poçt admin hesabına aiddir. Admin şifrəsi yalnız verilənlər bazasında idarə olunur: onu dəyişmək və ya e-poçtla bərpa etmək mümkün deyil.";

    /// <summary>Writes the configured administrators to the database (called at start-up, after migrations).</summary>
    public static async Task SeedAdminAccountsAsync(this WebApplication app)
    {
        // Runs with the migrations (Development) or when asked for explicitly; never against an un-migrated database in tests.
        var seed = app.Configuration.GetValue("Admins:SeedOnStartup", app.Configuration.GetValue("Database:MigrateOnStartup", false));
        if (!seed) return;
        var options = app.Services.GetRequiredService<IOptions<AdminAccountsOptions>>().Value;
        if (options.Accounts.Count == 0) return;
        await using var scope = app.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<AdminAccountSeeder>().SeedAsync(CancellationToken.None);
    }
}

public sealed class AdminAccountSeeder(
    AppDbContext db,
    IOptions<AdminAccountsOptions> options,
    TimeProvider clock,
    ILogger<AdminAccountSeeder> logger)
{
    public async Task<AdminSeedResult> SeedAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var admins = await db.Users.CountAsync(u => u.Role == UserRole.Admin, ct);
        int created = 0, promoted = 0, skipped = 0;

        var accounts = options.Value.Accounts
            .Select(a => (Account: a, Email: a.Email.Trim().ToLowerInvariant()))
            .Where(a => a.Email.Length > 0)
            .DistinctBy(a => a.Email)
            .ToList();

        foreach (var (account, email) in accounts)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
            if (user?.Role == UserRole.Admin)
            {
                user.EmailConfirmedAt ??= now;
                continue;
            }

            if (admins >= AdminAccounts.MaxAdmins)
            {
                logger.LogError("Admin account {Email} skipped: the limit of {Max} administrators is reached.", email, AdminAccounts.MaxAdmins);
                skipped++;
                continue;
            }

            if (user is not null)
            {
                user.Role = UserRole.Admin;
                user.EmailConfirmedAt ??= now;
                user.UpdatedAt = now;
                promoted++;
            }
            else
            {
                if (string.IsNullOrEmpty(account.Password) || account.Password.Length < ApplicantSignupRules.MinPasswordLength)
                {
                    logger.LogWarning("Admin account {Email} skipped: a new admin needs a password of at least {Min} characters.",
                        email, ApplicantSignupRules.MinPasswordLength);
                    skipped++;
                    continue;
                }

                db.Users.Add(new User
                {
                    Id = Ids.New("usr"),
                    FirstName = string.IsNullOrWhiteSpace(account.FirstName) ? "Admin" : account.FirstName.Trim(),
                    LastName = account.LastName?.Trim() ?? string.Empty,
                    Email = email,
                    Role = UserRole.Admin,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(account.Password),
                    EmailConfirmedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                created++;
            }
            admins++;
        }

        await db.SaveChangesAsync(ct);
        if (created + promoted + skipped > 0)
            logger.LogInformation("Admin accounts: {Created} created, {Promoted} promoted, {Skipped} skipped, {Total} in total.",
                created, promoted, skipped, admins);
        return new AdminSeedResult(created, promoted, skipped, admins);
    }
}
