using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Infrastructure.Import;

/// <summary>Command line: applies migrations, then imports the legacy JSON once. Never deletes anything.</summary>
internal static class ImportCommand
{
    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        var path = args.Length > 1 ? args[1] : app.Configuration["LegacyBackend:DatabasePath"];
        if (string.IsNullOrWhiteSpace(path))
        {
            await Console.Error.WriteLineAsync("Usage: dotnet run -- import-legacy <path-to-agroinvest_db.json>");
            return 2;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        var importer = scope.ServiceProvider.GetRequiredService<LegacyJsonImporter>();
        var result = await importer.ImportAsync(Path.GetFullPath(path), CancellationToken.None);
        Console.WriteLine(result.Skipped ? result.Summary : $"Import finished: {result.Summary}");
        return 0;
    }
}
