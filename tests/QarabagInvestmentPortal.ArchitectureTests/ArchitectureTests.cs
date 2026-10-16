using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.ArchitectureTests;

/// <summary>Rules for the single-project, folder-based modular monolith (Features + Infrastructure, one AppDbContext).</summary>
public sealed class ArchitectureTests
{
    private static readonly Assembly Api = typeof(AppDbContext).Assembly;

    [Fact]
    public void Api_does_not_reference_the_removed_module_projects()
    {
        var refs = Api.GetReferencedAssemblies().Select(a => a.Name ?? string.Empty).ToList();
        Assert.DoesNotContain(refs, n => n.StartsWith("QarabagInvestmentPortal.Modules.", StringComparison.Ordinal));
        Assert.DoesNotContain(refs, n => n == "QarabagInvestmentPortal.BuildingBlocks");
    }

    [Fact]
    public void There_is_exactly_one_DbContext()
    {
        var contexts = Api.GetTypes().Where(t => !t.IsAbstract && typeof(Microsoft.EntityFrameworkCore.DbContext).IsAssignableFrom(t)).ToList();
        Assert.Equal(typeof(AppDbContext), Assert.Single(contexts));
    }

    [Fact]
    public void Feature_code_lives_under_Features_and_technical_code_under_Infrastructure()
    {
        var namespaces = Api.GetTypes()
            .Where(t => t.Namespace is not null && !t.Name.StartsWith('<') && t.Namespace.StartsWith("QarabagInvestmentPortal.Api", StringComparison.Ordinal))
            .Select(t => t.Namespace!)
            .Distinct()
            .ToList();
        Assert.All(namespaces, ns => Assert.True(
            ns == "QarabagInvestmentPortal.Api"
            || ns.StartsWith("QarabagInvestmentPortal.Api.Features.", StringComparison.Ordinal)
            || ns.StartsWith("QarabagInvestmentPortal.Api.Infrastructure.", StringComparison.Ordinal)
            || ns.StartsWith("QarabagInvestmentPortal.Api.Migrations", StringComparison.Ordinal),
            $"Unexpected namespace {ns}"));
    }

    [Fact]
    public void Every_admin_endpoint_requires_the_admin_policy()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.UseSetting("Database:MigrateOnStartup", "false");
        });
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();

        var admin = endpoints.Where(e => e.RoutePattern.RawText?.StartsWith("/api/admin", StringComparison.Ordinal) == true).ToList();
        Assert.NotEmpty(admin);
        Assert.All(admin, e => Assert.Contains(
            e.Metadata.GetOrderedMetadata<IAuthorizeData>(), a => a.Policy == Policies.Admin));

        // Private areas need a login.
        var privatePrefixes = new[] { "/api/my/", "/api/proposals", "/api/documents/", "/api/favorites", "/api/notifications" };
        var priv = endpoints.Where(e => privatePrefixes.Any(p => e.RoutePattern.RawText?.StartsWith(p, StringComparison.Ordinal) == true)).ToList();
        Assert.NotEmpty(priv);
        Assert.All(priv, e => Assert.NotEmpty(e.Metadata.GetOrderedMetadata<IAuthorizeData>()));

        Assert.Contains(admin, e => e.RoutePattern.RawText == "/api/admin/analytics" &&
            e.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == Policies.Admin));
        Assert.Contains(admin, e => e.RoutePattern.RawText == "/api/admin/lands/{landId}/proposal-analysis" &&
            e.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == Policies.Admin));
    }

    [Fact]
    public async Task Anonymous_users_cannot_read_admin_analytics_or_proposal_analysis()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.UseSetting("Database:MigrateOnStartup", "false");
        });
        using var client = factory.CreateClient();
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/analytics")).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/lands/land-x/proposal-analysis")).StatusCode);
    }
}
