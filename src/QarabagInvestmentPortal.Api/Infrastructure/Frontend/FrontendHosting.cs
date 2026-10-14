using Microsoft.Extensions.FileProviders;

namespace QarabagInvestmentPortal.Api.Infrastructure.Frontend;

/// <summary>
/// Serves the built React app (frontend/dist) and falls back to index.html for client-side routes.
/// Path from Frontend:Path (or the older LegacyBackend:FrontendPath setting).
/// </summary>
internal static class FrontendHosting
{
    public static void UseBuiltFrontend(this WebApplication app)
    {
        var frontendRoot = app.Configuration["Frontend:Path"] is { Length: > 0 } p ? p : app.Configuration["LegacyBackend:FrontendPath"];
        if (string.IsNullOrWhiteSpace(frontendRoot)) return;

        var fullRoot = Path.GetFullPath(frontendRoot);
        var dist = Path.Combine(fullRoot, "dist");
        if (!Directory.Exists(dist)) return;

        var distProvider = new PhysicalFileProvider(dist);
        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = distProvider });
        app.UseStaticFiles(new StaticFileOptions { FileProvider = distProvider });

        var source = Path.Combine(fullRoot, "src");
        if (Directory.Exists(source))
            app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(source), RequestPath = "/src" });

        app.MapFallback(async context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                await context.Response.WriteAsJsonAsync(new { error = "Belə ünvan yoxdur." });
                return;
            }
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(Path.Combine(dist, "index.html"));
        });
    }
}
