using Microsoft.Extensions.FileProviders;

namespace QarabagInvestmentPortal.Api.Infrastructure.Frontend;

/// <summary>
/// Serves the built React app (frontend/dist) and falls back to index.html for client-side routes.
/// Path from Frontend:Path (or the older LegacyBackend:FrontendPath setting). When neither is set,
/// the repository's own "frontend" folder is used, so the links in emails (/confirm-email, /reset-password)
/// open the app on http://localhost:3000 without extra configuration.
/// </summary>
internal static class FrontendHosting
{
    public static void UseBuiltFrontend(this WebApplication app)
    {
        var frontendRoot = app.Configuration["Frontend:Path"] is { Length: > 0 } p ? p : app.Configuration["LegacyBackend:FrontendPath"];
        if (string.IsNullOrWhiteSpace(frontendRoot)) frontendRoot = FindRepositoryFrontend(app.Environment.ContentRootPath);
        if (string.IsNullOrWhiteSpace(frontendRoot))
        {
            app.Logger.LogWarning("Frontend not served: build it with 'cd frontend; npm install; npm run build' or set Frontend:Path.");
            return;
        }

        var fullRoot = Path.GetFullPath(frontendRoot);
        var dist = Path.Combine(fullRoot, "dist");
        if (!Directory.Exists(dist))
        {
            app.Logger.LogWarning("Frontend not served: {Dist} does not exist. Run 'npm run build' in the frontend folder.", dist);
            return;
        }

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

    /// <summary>Walks up from the content root looking for a "frontend" folder that contains package.json.</summary>
    private static string? FindRepositoryFrontend(string start)
    {
        for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "frontend");
            if (File.Exists(Path.Combine(candidate, "package.json"))) return candidate;
        }
        return null;
    }
}
