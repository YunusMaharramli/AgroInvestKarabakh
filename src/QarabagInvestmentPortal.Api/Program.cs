using Microsoft.AspNetCore.Http.Features;
using QarabagInvestmentPortal.Api.Features.Admin;
using QarabagInvestmentPortal.Api.Features.Assistant;
using QarabagInvestmentPortal.Api.Features.Documents;
using QarabagInvestmentPortal.Api.Features.Chat;
using QarabagInvestmentPortal.Api.Features.Favorites;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Recommendations;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Email;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Frontend;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Import;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Uploads: up to 10 files × 10 MB.
const long maxRequestBytes = 110L * 1024 * 1024;
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxRequestBytes);
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = maxRequestBytes);

builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o =>
{
    // Enums travel as "PENDING_REVIEW", "ACTIVE", "NOT_SELECTED", "ADMIN", ...
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseUpper));
});

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddPortalDatabase(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddPortalAuth();
builder.Services.AddApiRateLimiting();
builder.Services.AddHttpClient<RecaptchaVerifier>(
    client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.Configure<SmtpEmailOptions>(
    builder.Configuration.GetSection(SmtpEmailOptions.SectionName));
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
builder.Services.Configure<AuthLinkOptions>(
    builder.Configuration.GetSection(AuthLinkOptions.SectionName));
builder.Services.AddScoped<AuthActionTokenService>();
builder.Services.AddScoped<AuthLinkBuilder>();
builder.Services.AddScoped<EmailConfirmationService>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddSingleton<PrivateFileStorage>();

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<OpportunityQueries>();
builder.Services.AddScoped<LandSubmissionService>();
builder.Services.AddScoped<LandReviewService>();
builder.Services.AddScoped<AdminLandService>();
builder.Services.AddScoped<ProposalService>();
builder.Services.AddScoped<ChatService>();
builder.Services.AddSignalR();
builder.Services.AddScoped<LegacyJsonImporter>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<LoginAttemptService>();

var app = builder.Build();

// One-time import: dotnet run -- import-legacy "D:\path\agroinvest_db.json"
if (args.Length > 0 && args[0] == "import-legacy")
{
    return await ImportCommand.RunAsync(app, args);
}

await app.MigrateIfConfiguredAsync();

app.UseExceptionHandler();
app.UseRouting();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

var api = app.MapGroup("/api");
api.MapAuthEndpoints()
    .MapLandEndpoints()
    .MapAdminLandEndpoints()
    .MapOpportunityAndProposalEndpoints()
    .MapChatEndpoints()
    .MapDocumentEndpoints()
    .MapFavoriteEndpoints()
    .MapNotificationEndpoints()
    .MapAdminEndpoints()
    .MapRecommendationEndpoints()
    .MapAssistantEndpoints();

app.MapHub<ChatHub>("/hubs/chat").RequireAuthorization(Policies.SignedIn);

app.UseBuiltFrontend();

await app.RunAsync();
return 0;

public partial class Program;
