using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Npgsql;

namespace QarabagInvestmentPortal.Api.Infrastructure.Persistence;

internal static class DatabaseSetup
{
    /// <summary>
    /// Connection string order: ConnectionStrings:Portal → POSTGRES_* environment variables → the repository's .env file
    /// (the same values docker compose uses). Host and port default to the Docker mapping 127.0.0.1:5433.
    /// </summary>
    public static string ResolveConnectionString(IConfiguration configuration, string contentRoot)
    {
        var configured = configuration.GetConnectionString("Portal");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        var env = ReadDotEnv(contentRoot);
        string Get(string key, string fallback) =>
            Environment.GetEnvironmentVariable(key) is { Length: > 0 } fromEnv ? fromEnv
            : env.TryGetValue(key, out var fromFile) && fromFile.Length > 0 ? fromFile
            : fallback;

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = Get("POSTGRES_HOST", "127.0.0.1"),
            Port = int.TryParse(Get("POSTGRES_PORT", "5433"), out var port) ? port : 5433,
            Database = Get("POSTGRES_DB", "qarabag_investment"),
            Username = Get("POSTGRES_USER", "qarabag_app"),
            Password = Get("POSTGRES_PASSWORD", string.Empty),
        };
        return builder.ConnectionString;
    }

    public static IServiceCollection AddPortalDatabase(this IServiceCollection services, IConfiguration configuration, string contentRoot)
    {
        var connectionString = ResolveConnectionString(configuration, contentRoot);
        services.AddDbContext<AppDbContext>(options => Configure(options, connectionString));
        return services;
    }

    public static void Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, npgsql =>
            npgsql.MigrationsHistoryTable("__ef_migrations_history", AppDbContext.Schema));

    /// <summary>Applies pending migrations when Database:MigrateOnStartup is true (on by default in Development).</summary>
    public static async Task MigrateIfConfiguredAsync(this WebApplication app)
    {
        if (!app.Configuration.GetValue("Database:MigrateOnStartup", false)) return;
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    private static Dictionary<string, string> ReadDotEnv(string contentRoot)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        var dir = new DirectoryInfo(contentRoot);
        while (dir is not null)
        {
            var path = Path.Combine(dir.FullName, ".env");
            if (File.Exists(path))
            {
                foreach (var raw in File.ReadAllLines(path))
                {
                    var line = raw.Trim();
                    if (line.Length == 0 || line.StartsWith('#')) continue;
                    var eq = line.IndexOf('=', StringComparison.Ordinal);
                    if (eq <= 0) continue;
                    values[line[..eq].Trim()] = line[(eq + 1)..].Trim().Trim('"');
                }
                break;
            }
            dir = dir.Parent;
        }
        return values;
    }
}

/// <summary>Used only by "dotnet ef" when creating migrations; it never connects to a database.</summary>
internal sealed class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, "Host=127.0.0.1;Port=5433;Database=design_time;Username=design;Password=design");
        return new AppDbContext(options.Options);
    }
}
