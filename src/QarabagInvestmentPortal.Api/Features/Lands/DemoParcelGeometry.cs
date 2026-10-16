using System.Text.Json;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>Synthetic field outlines for demo records, never cadastral or surveyed boundaries.</summary>
internal static class DemoParcelGeometry
{
    // Clipped fields, tapered plots, recessed access edges and stepped boundaries.
    // The corner order is counterclockwise; small variations preserve each simple outline.
    private static readonly (double X, double Y)[][] Shapes =
    [
        [(-1, -.7), (-.2, -.95), (.85, -.75), (1, .1), (.65, .85), (-.35, 1), (-.95, .4)],
        [(-1.5, -.45), (-.2, -.65), (1.2, -.3), (1.45, .25), (.6, .65), (-.65, .5), (-1.4, .1)],
        [(-1, -.9), (.9, -.75), (1, -.1), (.15, -.05), (.1, .85), (-.45, 1), (-.95, .55)],
        [(-1, -.8), (-.1, -.9), (.05, -.5), (.9, -.45), (1, .5), (.3, .85), (-.35, .8), (-.4, .25), (-1, .2)],
        [(-1, -.65), (-.35, -.95), (.5, -.85), (1, -.2), (.8, .15), (.95, .5), (.4, .9), (-.1, .75), (-.45, .95), (-.9, .4)],
        [(-1.1, -.85), (.8, -.65), (1.05, .1), (.35, .95), (-.45, .7), (-1, .05)],
    ];

    public static string CreateBoundary(double latitude, double longitude, double areaHectares, int variant)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(areaHectares);
        const double radius = 6378137;
        const double radians = Math.PI / 180;
        var template = Shapes[Math.Abs(variant % Shapes.Length)];
        var angle = variant * .721;
        var aspect = .8 + Math.Abs(variant % 7) * .09;
        var corners = template.Select((point, i) =>
        {
            var variation = 1 + .045 * Math.Sin(variant * 1.7 + i * 2.3);
            var x = point.X * aspect * variation;
            var y = point.Y / aspect * variation;
            return (X: x * Math.Cos(angle) - y * Math.Sin(angle), Y: x * Math.Sin(angle) + y * Math.Cos(angle));
        }).ToArray();

        var planarArea = Math.Abs(corners.Select((p, i) =>
            p.X * corners[(i + 1) % corners.Length].Y - corners[(i + 1) % corners.Length].X * p.Y).Sum()) / 2;
        var scale = Math.Sqrt(areaHectares * 10000 / planarArea);
        List<(double Lng, double Lat)> Project(double factor) => corners.Select(p =>
            (longitude + p.X * factor / (radius * Math.Cos(latitude * radians)) / radians,
             latitude + p.Y * factor / radius / radians)).ToList();

        // Normalize with the same spherical area calculation used by selection and publication checks.
        for (var pass = 0; pass < 2; pass++)
            scale *= Math.Sqrt(areaHectares / AdminLandRules.PolygonAreaHectares(Project(scale)));

        var ring = Project(scale).Select(p => new[] { Math.Round(p.Lng, 7), Math.Round(p.Lat, 7) }).ToList();
        ring.Add([.. ring[0]]);
        return JsonSerializer.Serialize(new { type = "Polygon", coordinates = new[] { ring } });
    }
}
