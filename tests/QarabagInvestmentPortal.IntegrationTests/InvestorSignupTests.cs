using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.IntegrationTests;

/// <summary>
/// Investor sign-up through the real API: applicant type → email confirmation (followed with the sign-up token) →
/// additional information → signed in. Also the administrator rules: no password change or reset, at most 10.
/// </summary>
[Collection(PortalCollection.Name)]
public sealed class InvestorSignupTests(PortalFactory factory)
{
    private const string Password = "Parol-2026";

    private static async Task<JsonElement> Read(HttpResponseMessage res) => await res.Content.ReadFromJsonAsync<JsonElement>(PortalFactory.Json);

    private async Task ConfirmInDatabase(string email)
    {
        await using var db = factory.NewDbContext();
        var user = await db.Users.SingleAsync(u => u.Email == email);
        user.EmailConfirmedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Legal_entity_signs_up_confirms_and_completes_its_profile()
    {
        var email = $"company-{Guid.NewGuid():N}@test.az";
        var voen = Random.Shared.NextInt64(1_000_000_000, 9_999_999_999).ToString(System.Globalization.CultureInfo.InvariantCulture);
        var client = factory.Anonymous();

        var register = await client.PostAsJsonAsync("/api/auth/register", new
        {
            applicantType = "LEGAL_ENTITY", companyName = "Qarabağ Aqro MMC", email, taxIdentificationNumber = voen,
            password = Password, confirmPassword = Password, acceptTerms = true,
        });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var signupToken = (await Read(register)).GetProperty("signupToken").GetString()!;

        // Same VÖEN cannot be used twice.
        var duplicate = await client.PostAsJsonAsync("/api/auth/register", new
        {
            applicantType = "LEGAL_ENTITY", companyName = "Başqa MMC", email = $"other-{Guid.NewGuid():N}@test.az", taxIdentificationNumber = voen,
            password = Password, confirmPassword = Password, acceptTerms = true,
        });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        // Not confirmed yet: the status says so and the details are refused.
        var status = await Read(await client.PostAsJsonAsync("/api/auth/signup/status", new { signupToken }));
        Assert.False(status.GetProperty("emailConfirmed").GetBoolean());
        Assert.Equal("LEGAL_ENTITY", status.GetProperty("applicantType").GetString());
        var details = new
        {
            signupToken, address = "Ağdam r., Quzanlı", mainActivity = "Taxılçılıq", activityStartDate = "2018-04-01",
            ceoName = "Rəşad Əliyev", minimumFunds = 250000,
        };
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/signup/details", details)).StatusCode);

        await ConfirmInDatabase(email);
        status = await Read(await client.PostAsJsonAsync("/api/auth/signup/status", new { signupToken }));
        Assert.True(status.GetProperty("emailConfirmed").GetBoolean());
        Assert.True(status.GetProperty("needsOnboarding").GetBoolean());

        // Logging in before finishing works, and tells the client to finish the sign-up.
        var early = await Read(await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password }));
        Assert.True(early.GetProperty("user").GetProperty("needsOnboarding").GetBoolean());

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/signup/details", details with { ceoName = "" })).StatusCode);
        var done = await client.PostAsJsonAsync("/api/auth/signup/details", details);
        Assert.Equal(HttpStatusCode.OK, done.StatusCode);
        var body = await Read(done);
        var user = body.GetProperty("user");
        Assert.Equal("USER", user.GetProperty("role").GetString());            // an applicant type is not a role
        Assert.Equal("LEGAL_ENTITY", user.GetProperty("applicantType").GetString());
        Assert.False(user.GetProperty("needsOnboarding").GetBoolean());
        Assert.Equal(voen, body.GetProperty("profile").GetProperty("taxIdentificationNumber").GetString());
        Assert.Equal("Rəşad Əliyev", body.GetProperty("profile").GetProperty("ceoName").GetString());

        // The sign-up token is used up and the profile is visible to the signed-in investor.
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/auth/signup/status", new { signupToken })).StatusCode);
        var investor = factory.Anonymous();
        investor.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
        var me = await Read(await investor.GetAsync("/api/auth/me"));
        Assert.Equal(250000m, me.GetProperty("profile").GetProperty("minimumFunds").GetDecimal());
        Assert.Equal(HttpStatusCode.Conflict, (await investor.PostAsJsonAsync("/api/auth/signup/details", details)).StatusCode);
    }

    [Fact]
    public async Task Individual_who_left_finishes_the_sign_up_after_logging_in()
    {
        var email = $"person-{Guid.NewGuid():N}@test.az";
        var register = await factory.Anonymous().PostAsJsonAsync("/api/auth/register", new
        {
            applicantType = "INDIVIDUAL", fullName = "Leyla Həsənova", email, phone = "+994 55 123 45 67",
            password = Password, confirmPassword = Password, acceptTerms = true,
        });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        await ConfirmInDatabase(email);

        var client = await factory.LoginAsync(email, Password);
        var details = new
        {
            maritalStatus = "MARRIED", incomeLast6Months = 18000, hasCredit = true, monthlyCreditPayment = 0,
            hasFixedIncome = false, minimumFunds = 30000,
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/signup/details", details)).StatusCode);
        var done = await client.PostAsJsonAsync("/api/auth/signup/details", details with { monthlyCreditPayment = 450 });
        Assert.Equal(HttpStatusCode.OK, done.StatusCode);
        var profile = (await Read(done)).GetProperty("profile");
        Assert.Equal("MARRIED", profile.GetProperty("maritalStatus").GetString());
        Assert.Equal(450m, profile.GetProperty("monthlyCreditPayment").GetDecimal());
    }

    [Fact]
    public async Task Sign_up_without_accepting_the_terms_is_refused()
    {
        var res = await factory.Anonymous().PostAsJsonAsync("/api/auth/register", new
        {
            applicantType = "FOREIGN_INDIVIDUAL", fullName = "John Smith", email = $"john-{Guid.NewGuid():N}@test.az",
            password = Password, confirmPassword = Password, acceptTerms = false,
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Admins_cannot_change_or_reset_their_password()
    {
        var admin = await factory.AdminAsync();
        var change = await admin.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = PortalFactory.AdminPassword, newPassword = "Yeni-Parol-2026", confirmNewPassword = "Yeni-Parol-2026",
        });
        Assert.Equal(HttpStatusCode.Forbidden, change.StatusCode);
        Assert.Contains("admin", (await Read(change)).GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);

        var forgot = await factory.Anonymous().PostAsJsonAsync("/api/auth/forgot-password", new { email = PortalFactory.AdminEmail });
        Assert.Equal(HttpStatusCode.Forbidden, forgot.StatusCode);

        // Admins have no sign-up details to fill in.
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/auth/signup/details", new { address = "x" })).StatusCode);

        // Still works with the original password.
        await factory.AdminAsync();

        // A normal investor can still ask for a reset link (generic answer).
        Assert.Equal(HttpStatusCode.OK, (await factory.Anonymous().PostAsJsonAsync("/api/auth/forgot-password", new { email = $"nobody-{Guid.NewGuid():N}@test.az" })).StatusCode);
    }

    [Fact]
    public async Task Admin_accounts_come_from_configuration_and_are_capped_at_ten()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        await using var db = factory.NewDbContext();
        var existing = await db.Users.CountAsync(u => u.Role == UserRole.Admin);

        var accounts = Enumerable.Range(1, 12)
            .Select(i => new AdminAccountOptions { Email = $"admin{i}-{tag}@agroinvest.test", FirstName = "Admin", LastName = i.ToString(System.Globalization.CultureInfo.InvariantCulture), Password = "Admin-Parol-2026" })
            .Append(new AdminAccountOptions { Email = $"nopass-{tag}@agroinvest.test" })
            .ToList();
        var seeder = new AdminAccountSeeder(db, Options.Create(new AdminAccountsOptions { Accounts = accounts }), TimeProvider.System,
            NullLogger<AdminAccountSeeder>.Instance);

        var result = await seeder.SeedAsync(CancellationToken.None);
        var expectedCreated = Math.Max(0, AdminAccounts.MaxAdmins - existing);
        Assert.Equal(Math.Min(12, expectedCreated), result.Created);
        Assert.True(result.TotalAdmins <= Math.Max(AdminAccounts.MaxAdmins, existing));
        Assert.False(await db.Users.AnyAsync(u => u.Email == $"nopass-{tag}@agroinvest.test"));

        // Running again changes nothing.
        var again = await new AdminAccountSeeder(db, Options.Create(new AdminAccountsOptions { Accounts = accounts }), TimeProvider.System,
            NullLogger<AdminAccountSeeder>.Instance).SeedAsync(CancellationToken.None);
        Assert.Equal(0, again.Created + again.Promoted);

        if (result.Created > 0)
            await factory.LoginAsync($"admin1-{tag}@agroinvest.test", "Admin-Parol-2026");

        // Clean up so the other tests keep their single test admin.
        await db.Users.Where(u => u.Email.EndsWith($"-{tag}@agroinvest.test")).ExecuteDeleteAsync();
    }
}
