using Microsoft.Extensions.FileProviders;
using QarabagInvestmentPortal.Api;
using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 25 * 1024 * 1024);
builder.Services.AddProblemDetails();
builder.Services.AddSingleton<LegacyDatabase>();
builder.Services.AddApplicationModules();

var app = builder.Build();

app.UseExceptionHandler();
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));
app.MapGet("/api/system/modules", (IEnumerable<IModule> modules) => Results.Ok(modules.Select(module => new
{
    module.Name,
    module.RoutePrefix,
    module.DatabaseSchema
})));
app.MapLegacyApi();

var frontendRoot = app.Configuration["LegacyBackend:FrontendPath"];
if (!string.IsNullOrWhiteSpace(frontendRoot))
{
    var fullRoot = Path.GetFullPath(frontendRoot);
    var dist = Path.Combine(fullRoot, "dist");
    if (Directory.Exists(dist))
    {
        var distProvider = new PhysicalFileProvider(dist);
        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = distProvider });
        app.UseStaticFiles(new StaticFileOptions { FileProvider = distProvider });
        var source = Path.Combine(fullRoot, "src");
        if (Directory.Exists(source)) app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(source), RequestPath = "/src" });
        app.MapFallback(async context =>
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(Path.Combine(dist, "index.html"));
        });
    }
}

app.Run();

public partial class Program;
