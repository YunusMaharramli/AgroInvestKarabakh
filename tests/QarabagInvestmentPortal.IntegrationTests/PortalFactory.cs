using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.IntegrationTests;

/// <summary>
/// Runs the real API against a throw-away PostgreSQL database "qarabag_investment_test" on the same server the app uses
/// (connection from ConnectionStrings__Portal, POSTGRES_* variables or the repository .env; default 127.0.0.1:5433).
/// The database is recreated for every test run; the real database is never touched.
/// </summary>
public sealed class PortalFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "test-admin@agroinvest.test";
    public const string AdminPassword = "Admin-Test-2026";

    private readonly string _connectionString;
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "qip-tests-" + Guid.NewGuid().ToString("N"));

    public static readonly JsonSerializerOptions Json = CreateJson();

    public PortalFactory()
    {
        var config = new ConfigurationBuilder().AddEnvironmentVariables().Build();
        var builder = new NpgsqlConnectionStringBuilder(DatabaseSetup.ResolveConnectionString(config, AppContext.BaseDirectory))
        {
            Database = "qarabag_investment_test",
            Pooling = false,
        };
        _connectionString = builder.ConnectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.UseSetting("Storage:RootPath", _storageRoot);
        builder.UseSetting("Gemini:ApiKey", string.Empty);
        builder.UseSetting("Recaptcha:Enabled", "false");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();
            services.AddDbContext<AppDbContext>(o => DatabaseSetup.Configure(o, _connectionString));
        });
    }

    public async Task InitializeAsync()
    {
        await using (var db = NewDbContext())
        {
            await db.Database.EnsureDeletedAsync();
            await db.Database.MigrateAsync();
            db.Users.Add(new User
            {
                Id = "usr-test-admin",
                FirstName = "Test",
                LastName = "Admin",
                Email = AdminEmail,
                Phone = "+994 12 498 70 00",
                Role = UserRole.Admin,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(AdminPassword),
                EmailConfirmedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        }
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await using (var db = NewDbContext()) await db.Database.EnsureDeletedAsync();
        try { Directory.Delete(_storageRoot, recursive: true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }

    public AppDbContext NewDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, _connectionString);
        return new AppDbContext(options.Options);
    }

    /// <summary>A client that remembers its own login.</summary>
    public HttpClient Anonymous() => CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    public async Task<HttpClient> LoginAsync(string email, string password)
    {
        var client = Anonymous();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
        return client;
    }

    public Task<HttpClient> AdminAsync() => LoginAsync(AdminEmail, AdminPassword);

    public async Task<HttpClient> RegisterAsync(string email, string phone = "+994 50 123 45 67")
    {
        var client = Anonymous();
        var res = await client.PostAsJsonAsync("/api/auth/register", new
        {
            firstName = "Test",
            lastName = email.Split('@')[0],
            email,
            phone,
            password = "Parol-2026",
            confirmPassword = "Parol-2026",
            applicantProfile = new
            {
                applicantType = "INDIVIDUAL",
                foreignKind = (string?)null,
                fullLegalName = "Test Applicant",
                citizenship = "Azerbaijan",
                countryOfResidence = "Azerbaijan",
                residenceAddress = "",
                idDocumentType = "",
                idDocumentNumber = "",
                fin = "",
                legalName = "",
                legalForm = "",
                countryOfIncorporation = "",
                registrationIdentifier = "",
                taxIdentifier = "",
                registeredAddress = "",
                contactPhone = phone,
                contactEmail = email,
                contactAddress = "",
                representativeName = "",
                representativePosition = "",
                authorityToAct = "",
                consentToProcess = true,
            },
        });
        Assert.Equal(System.Net.HttpStatusCode.Created, res.StatusCode);

        // Registration now sends a confirmation link; confirm directly in the database, then log in.
        await using (var db = NewDbContext())
        {
            var user = await db.Users.SingleAsync(u => u.Email == email.ToLowerInvariant());
            user.EmailConfirmedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }
        return await LoginAsync(email, "Parol-2026");
    }

    private static JsonSerializerOptions CreateJson()
    {
        var o = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        o.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseUpper));
        return o;
    }
}

[CollectionDefinition(Name)]
public sealed class PortalCollection : ICollectionFixture<PortalFactory>
{
    public const string Name = "portal";
}
