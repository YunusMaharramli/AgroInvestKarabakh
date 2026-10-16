using System.Text.Json;
using QarabagInvestmentPortal.Api.Features.Lands;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class DemoParcelGeometryTests
{
    public static IEnumerable<object[]> DemoParcels() => Enumerable.Range(0, LandUseCatalog.All.Count * 2)
        .Select(index => new object[] { index, AreaFor(index) });

    [Theory]
    [MemberData(nameof(DemoParcels))]
    public void Every_demo_boundary_is_closed_simple_and_preserves_its_advertised_area(int index, double hectares)
    {
        var (latitude, longitude) = DemoLandSeeder.Location(index, DemoLandSeeder.Places[index % DemoLandSeeder.Places.Length]);
        var boundary = DemoParcelGeometry.CreateBoundary(latitude, longitude, hectares, index);
        using var json = JsonDocument.Parse(boundary);
        Assert.Equal("Polygon", json.RootElement.GetProperty("type").GetString());
        var rings = json.RootElement.GetProperty("coordinates");
        Assert.Equal(1, rings.GetArrayLength());
        var closedRing = rings[0].EnumerateArray()
            .Select(point => (Lng: point[0].GetDouble(), Lat: point[1].GetDouble())).ToArray();
        Assert.Equal(closedRing[0], closedRing[^1]);

        var ring = Assert.IsType<List<(double Lng, double Lat)>>(AdminLandRules.ReadRing(boundary));
        Assert.True(ring.Count >= 6, $"Demo parcel {index + 1} needs at least six distinct corners.");
        Assert.Equal(ring.Count, ring.Distinct().Count());
        Assert.All(ring, point => Assert.True(double.IsFinite(point.Lng) && double.IsFinite(point.Lat)));
        Assert.Null(LandProfileParser.NormaliseBoundary(json.RootElement).Error);
        AssertSimple(ring, index);

        var measuredArea = AdminLandRules.PolygonAreaHectares(ring);
        var tolerance = Math.Max(.001, hectares * .0002);
        Assert.True(Math.Abs(measuredArea - hectares) < tolerance,
            $"Demo parcel {index + 1}: expected {hectares} ha, measured {measuredArea} ha (tolerance {tolerance} ha).");
        Assert.Equal(boundary, DemoParcelGeometry.CreateBoundary(latitude, longitude, hectares, index));
        Assert.Equal((latitude, longitude), DemoLandSeeder.Location(index, DemoLandSeeder.Places[index % DemoLandSeeder.Places.Length]));
    }

    [Fact]
    public void Demo_boundaries_include_convex_concave_and_several_corner_counts()
    {
        var rings = Enumerable.Range(0, LandUseCatalog.All.Count * 2).Select(RingFor).ToArray();
        Assert.Contains(rings, ring => IsConvex(ring));
        Assert.Contains(rings, ring => !IsConvex(ring));
        Assert.True(rings.Select(ring => ring.Count).Distinct().Count() >= 3);
    }

    [Fact]
    public void Demo_anchors_cover_25_settlements_in_all_11_supported_regions_without_Tartar()
    {
        var places = DemoLandSeeder.Places;
        Assert.Equal(25, places.Length);
        Assert.Equal(25, places.Select(place => (place.Key, place.Settlement)).Distinct().Count());
        Assert.Equal(25, places.Select(place => (place.Latitude, place.Longitude)).Distinct().Count());
        Assert.Equal(11, places.Select(place => place.Key).Distinct().Count());
        Assert.Equal(AdminLandRules.InvestmentRegions.OrderBy(region => region),
            places.Select(place => place.Key).Distinct().OrderBy(region => region));
        Assert.DoesNotContain(places, place => place.Key.Equals("tartar", StringComparison.OrdinalIgnoreCase)
            || place.Name.Equals("Tərtər", StringComparison.OrdinalIgnoreCase));

        // These are the active map fixtures, so every supported region is visible before closed/draft records.
        Assert.Equal(AdminLandRules.InvestmentRegions.OrderBy(region => region),
            places.Take(20).Select(place => place.Key).Distinct().OrderBy(region => region));
    }

    [Fact]
    public void All_50_generated_demo_parcels_are_separate()
    {
        var rings = Enumerable.Range(0, LandUseCatalog.All.Count * 2).Select(RingFor).ToArray();
        Assert.Equal(50, rings.Length);
        for (var first = 0; first < rings.Length; first++)
            for (var second = first + 1; second < rings.Length; second++)
                Assert.False(AdminLandRules.Overlaps(rings[first], rings[second]),
                    $"Demo parcels {first + 1} and {second + 1} overlap.");
    }

    private static double AreaFor(int index) => LandUseCatalog.All[index / 2].NeedsConstruction
        ? .4 + ((index * 13) % 45) / 10d
        : 2.5 + ((index * 17) % 950) / 10d;

    private static List<(double Lng, double Lat)> RingFor(int index)
    {
        var (latitude, longitude) = DemoLandSeeder.Location(index, DemoLandSeeder.Places[index % DemoLandSeeder.Places.Length]);
        return AdminLandRules.ReadRing(DemoParcelGeometry.CreateBoundary(latitude, longitude, AreaFor(index), index))!;
    }

    private static bool IsConvex(IReadOnlyList<(double Lng, double Lat)> ring)
    {
        var turns = Enumerable.Range(0, ring.Count)
            .Select(index => Math.Sign(Cross(ring[index], ring[(index + 1) % ring.Count], ring[(index + 2) % ring.Count])))
            .Where(turn => turn != 0).Distinct().ToArray();
        return turns.Length == 1;
    }

    private static void AssertSimple(IReadOnlyList<(double Lng, double Lat)> ring, int parcel)
    {
        for (var first = 0; first < ring.Count; first++)
            for (var second = first + 1; second < ring.Count; second++)
            {
                if (second == first + 1 || (first == 0 && second == ring.Count - 1)) continue;
                Assert.False(SegmentsIntersect(ring[first], ring[(first + 1) % ring.Count],
                        ring[second], ring[(second + 1) % ring.Count]),
                    $"Demo parcel {parcel + 1} intersects itself at edges {first} and {second}.");
            }
    }

    private static bool SegmentsIntersect((double Lng, double Lat) a, (double Lng, double Lat) b,
        (double Lng, double Lat) c, (double Lng, double Lat) d)
    {
        var abC = Cross(a, b, c);
        var abD = Cross(a, b, d);
        var cdA = Cross(c, d, a);
        var cdB = Cross(c, d, b);
        if (Math.Sign(abC) != Math.Sign(abD) && Math.Sign(cdA) != Math.Sign(cdB)) return true;
        return (Math.Abs(abC) < 1e-14 && OnSegment(a, b, c))
            || (Math.Abs(abD) < 1e-14 && OnSegment(a, b, d))
            || (Math.Abs(cdA) < 1e-14 && OnSegment(c, d, a))
            || (Math.Abs(cdB) < 1e-14 && OnSegment(c, d, b));
    }

    private static bool OnSegment((double Lng, double Lat) a, (double Lng, double Lat) b, (double Lng, double Lat) p) =>
        p.Lng >= Math.Min(a.Lng, b.Lng) && p.Lng <= Math.Max(a.Lng, b.Lng)
        && p.Lat >= Math.Min(a.Lat, b.Lat) && p.Lat <= Math.Max(a.Lat, b.Lat);

    private static double Cross((double Lng, double Lat) origin, (double Lng, double Lat) a, (double Lng, double Lat) b) =>
        (a.Lng - origin.Lng) * (b.Lat - origin.Lat) - (a.Lat - origin.Lat) * (b.Lng - origin.Lng);
}
