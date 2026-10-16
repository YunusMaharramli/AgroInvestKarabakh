using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Infrastructure.Import;

/// <summary>Command line: dotnet run -- seed-demo-lands.</summary>
internal static class DemoLandCommand
{
    public static async Task<int> RunAsync(WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        var seeder = scope.ServiceProvider.GetRequiredService<DemoLandSeeder>();
        var result = await seeder.SeedAsync(CancellationToken.None);
        Console.WriteLine($"Created {result.LandsCreated} demo lands and {result.OpportunitiesCreated} demo opportunities. Updated geography for {result.LandsUpdated} demo lands and {result.OpportunitiesUpdated} opportunity descriptions. {result.ExistingLands} demo lands already existed.");
        return 0;
    }
}
