using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>A problem tied to one form field (field = form field name, so the admin form can show it next to the input).</summary>
public sealed record LandIssue(string Code, string Field, string Message);

/// <summary>
/// Result of the publication check. Blockers must be fixed. Flags need an administrator to check the evidence:
/// they block publication until the land's verification status is VERIFIED.
/// </summary>
public sealed record LandPublicationCheck(bool CanPublish, IReadOnlyList<LandIssue> Blockers, IReadOnlyList<LandIssue> Flags, double? BoundaryAreaHectares);

/// <summary>Choices, limits and publication checks for admin-entered land.</summary>
public static partial class AdminLandRules
{
    public const double HectaresPerSot = 0.01;
    public static readonly string[] InvestmentRegions = ["aghdam", "fuzuli", "jabrayil", "zangilan", "gubadli", "lachin", "kalbajar", "khojavend", "shusha", "khankendi", "tartar"];

    /// <summary>Water availability (core field): includes "rain_fed" and "none_known" (no known water access).</summary>
    public static readonly string[] WaterAccessOptions = ["irrigation_canal", "well", "river", "reservoir", "spring", "mains", "rain_fed", "none_known"];

    /// <summary>Document kinds. Legal evidence = ownership, lease or authorization.</summary>
    public static readonly string[] DocumentKinds = ["ownership", "lease", "authorization", "soil_analysis", "water_analysis", "other"];

    private static readonly string[] LegalEvidenceKinds = ["ownership", "lease", "authorization"];

    /// <summary>Optional general details (stored in Land.Details). Validated like the type-specific inputs.</summary>
    public static readonly LandUseType DetailsSchema = new(0, "details", "Əlavə məlumatlar", false,
    [
        new("irrigation", "Suvarma sistemi", InputKind.Choice, Options: LandUseCatalog.IrrigationTypes),
        new("electricity", "Elektrik xətti var", InputKind.YesNo),
        new("gas", "Qaz xətti var", InputKind.YesNo),
        new("water_line", "Su xətti var", InputKind.YesNo),
        new("road_condition", "Yolların vəziyyəti", InputKind.Text),
        new("buildings", "Tikililər", InputKind.Text),
        new("fencing", "Hasar var", InputKind.YesNo),
        new("storage", "Anbar / saxlama yeri", InputKind.Text),
        new("slope_pct", "Maillik", InputKind.Number, "%", Min: 0, Max: 100),
        new("climate", "İqlim", InputKind.Text),
        new("flood_risk", "Daşqın riski", InputKind.Choice, Options: LandUseCatalog.LowMediumHigh),
        new("environment", "Digər ekoloji məlumatlar", InputKind.Text),
        new("crop_history", "Əkin tarixçəsi", InputKind.Text),
        new("soil_analysis", "Torpaq analizi (nəticə)", InputKind.Text),
        new("water_analysis", "Su analizi (nəticə)", InputKind.Text),
        new("last_income", "Torpaqdan son gəlir", InputKind.Number, "AZN", Min: 0),
        new("last_profit", "Torpaqdan son mənfəət", InputKind.Number, "AZN"),
    ], []);

    /// <summary>Which legal documents fit the ownership form. Private land: ownership or lease. State/municipal: authorization, ownership or lease.</summary>
    public static string[] AcceptedLegalKinds(string? ownershipForm) => ownershipForm switch
    {
        "private" => ["ownership", "lease"],
        "municipal" or "state" => ["authorization", "ownership", "lease"],
        _ => LegalEvidenceKinds,
    };

    public static bool IsLegalEvidence(string kind) => LegalEvidenceKinds.Contains(kind);

    [GeneratedRegex(@"^[\p{L}\d][\p{L}\d\-/. :]{1,49}$")]
    public static partial Regex CadastralRegex();

    // ------------------------------------------------------------------ checks

    /// <summary>Everything that must be true before the land can be published (server-side, also used by the form preview).</summary>
    public static async Task<LandPublicationCheck> CheckAsync(AppDbContext db, Land land, InvestmentDeadline deadline, DateTimeOffset now, CancellationToken ct)
    {
        var blockers = new List<LandIssue>();
        var flags = new List<LandIssue>();
        void Block(string code, string field, string message) => blockers.Add(new(code, field, message));
        void Flag(string code, string field, string message) => flags.Add(new(code, field, message));

        if (string.IsNullOrWhiteSpace(land.Title)) Block("title", "title", "Sahənin adını yazın.");
        var type = LandUseCatalog.ByKey(land.LandUse);
        if (type is null) Block("land_use", "landUse", "Fəaliyyət növünü (nəzərdə tutulan istifadəni) seçin.");
        if (land.LegalCategory is null) Block("legal_category", "legalCategory", "Torpağın rəsmi kateqoriyasını (təyinatını) seçin.");
        if (land.OwnershipForm is null) Block("ownership_form", "ownershipForm", "Mülkiyyət növünü seçin (sənəd tələbi buna görə müəyyən olunur).");
        if (land.AreaHectares <= 0) Block("area", "area", "Sahənin ölçüsünü hektar və ya sot ilə yazın.");
        if (!InvestmentRegions.Contains(land.Region)) Block("region", "region", "Qarabağ investisiya rayonlarından birini seçin.");
        if (land.Latitude == 0 && land.Longitude == 0) Block("location", "location", "Sahənin yerini xəritədə işarələyin.");
        if (land.BoundaryGeoJson is null) Block("boundary", "boundary", "Sahənin sərhədini xəritədə çəkin.");
        if (land.WaterAccess is null) Block("water_access", "waterAccess", "Su təminatını seçin (o cümlədən “dəmyə” və ya “məlum su mənbəyi yoxdur”).");
        if (deadline.Value is { } d && d < now) Block("deadline", "applicationDeadline", "Müraciət üçün son tarix keçmişdədir.");
        if (land.Photos.Count == 0) Block("photos", "photos", "Dərc etmək üçün ən azı bir foto yükləyin.");

        // Cadastral number: either the number, or "not available" + manual review (verification).
        if (string.IsNullOrWhiteSpace(land.CadastralNumber))
        {
            if (!land.CadastralUnavailable)
                Block("cadastral", "cadastralNumber", "Kadastr (reyestr) nömrəsini yazın və ya “mövcud deyil” seçin.");
            else if (land.Verification != LandVerificationStatus.Verified)
                Block("cadastral_manual_review", "cadastralNumber",
                    "Kadastr nömrəsi yoxdur: sənədləri əl ilə yoxlayıb sahəni “Təsdiqlənib” statusuna keçirdikdən sonra dərc etmək olar.");
        }

        // Eligibility: the land-use deal-breakers.
        if (type is not null)
        {
            var suitability = LandSuitability.Evaluate(type, LandFacts.From(land));
            foreach (var breaker in suitability.DealBreakers)
                Block("deal_breaker_" + breaker.Code, "landUse", "Uyğunluq yoxlaması: " + breaker.Message);
        }

        // Flags: need a human check (block until VERIFIED).
        if (type is { NeedsConstruction: false } && land.LegalCategory is { } legal && legal != "agricultural")
            Flag("non_agricultural_category", "legalCategory",
                $"Kateqoriya kənd təsərrüfatı deyil ({legal}), fəaliyyət isə kənd təsərrüfatıdır. Uyğunluğu yoxlayın.");

        double? boundaryHa = null;
        var ring = ReadRing(land.BoundaryGeoJson);
        if (ring is not null)
        {
            boundaryHa = Math.Round(PolygonAreaHectares(ring), 2);
            if (land.AreaHectares > 0)
            {
                var diff = Math.Abs(boundaryHa.Value - land.AreaHectares);
                if (diff > 0.5 && diff / land.AreaHectares > 0.2)
                    Flag("area_mismatch", "area",
                        $"Yazılan sahə ({land.AreaHectares:0.##} ha) çəkilmiş sərhədin sahəsindən ({boundaryHa:0.##} ha) çox fərqlənir.");
            }
        }

        if (!string.IsNullOrWhiteSpace(land.CadastralNumber))
        {
            var number = land.CadastralNumber.Trim().ToLower();
            var duplicates = await db.Lands.AsNoTracking()
                .Where(l => l.Id != land.Id && l.Status != LandStatus.Archived && l.CadastralNumber != null && l.CadastralNumber.ToLower() == number)
                .Select(l => l.Title).Take(3).ToListAsync(ct);
            if (duplicates.Count > 0)
                Flag("duplicate_cadastral", "cadastralNumber",
                    $"Bu kadastr nömrəsi başqa sahədə də var: {string.Join(", ", duplicates)}.");
        }

        if (ring is not null)
        {
            var (minLng, minLat, maxLng, maxLat) = Bounds(ring);
            var candidates = await db.Lands.AsNoTracking()
                .Where(l => l.Id != land.Id && l.Status != LandStatus.Archived && l.BoundaryGeoJson != null
                    && l.Latitude > minLat - 0.5 && l.Latitude < maxLat + 0.5 && l.Longitude > minLng - 0.5 && l.Longitude < maxLng + 0.5)
                .Select(l => new { l.Title, l.BoundaryGeoJson }).ToListAsync(ct);
            var overlapping = candidates.Where(c => ReadRing(c.BoundaryGeoJson) is { } other && Overlaps(ring, other)).Select(c => c.Title).Take(3).ToList();
            if (overlapping.Count > 0)
                Flag("parcel_overlap", "boundary", $"Sərhəd başqa sahə(lər)lə üst-üstə düşür: {string.Join(", ", overlapping)}.");
        }

        if (flags.Count > 0 && land.Verification != LandVerificationStatus.Verified)
            Block("flags_need_review", "verification",
                "Qeyd olunan problemləri yoxlayın: sübutları yoxladıqdan sonra sahəni “Təsdiqlənib” statusuna keçirin və ya məlumatı düzəldin.");

        return new(blockers.Count == 0, blockers, flags, boundaryHa);
    }

    public static string KindLabel(string kind) => kind switch
    {
        "ownership" => "mülkiyyət sənədi",
        "lease" => "icarə müqaviləsi",
        "authorization" => "səlahiyyət / icazə sənədi",
        "soil_analysis" => "torpaq analizi",
        "water_analysis" => "su analizi",
        _ => "digər sənəd",
    };

    // ------------------------------------------------------------------ geometry

    /// <summary>Reads the outer ring of a stored GeoJSON Polygon as (lng, lat) points without the closing point.</summary>
    public static List<(double Lng, double Lat)>? ReadRing(string? geoJson)
    {
        if (string.IsNullOrWhiteSpace(geoJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(geoJson);
            if (!doc.RootElement.TryGetProperty("coordinates", out var coords) || coords.GetArrayLength() == 0) return null;
            var points = coords[0].EnumerateArray().Select(p => (p[0].GetDouble(), p[1].GetDouble())).ToList();
            if (points.Count > 1 && points[0] == points[^1]) points.RemoveAt(points.Count - 1);
            return points.Count >= 3 ? points : null;
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or IndexOutOfRangeException)
        {
            return null;
        }
    }

    /// <summary>Area of a lat/lng polygon on the sphere, in hectares (same formula as the frontend).</summary>
    public static double PolygonAreaHectares(IReadOnlyList<(double Lng, double Lat)> ring)
    {
        const double R = 6378137, rad = Math.PI / 180;
        double sum = 0;
        for (var i = 0; i < ring.Count; i++)
        {
            var (lng1, lat1) = ring[i];
            var (lng2, lat2) = ring[(i + 1) % ring.Count];
            sum += (lng2 - lng1) * rad * (2 + Math.Sin(lat1 * rad) + Math.Sin(lat2 * rad));
        }
        return Math.Abs(sum * R * R / 2) / 10000;
    }

    private static (double MinLng, double MinLat, double MaxLng, double MaxLat) Bounds(IReadOnlyList<(double Lng, double Lat)> ring) =>
        (ring.Min(p => p.Lng), ring.Min(p => p.Lat), ring.Max(p => p.Lng), ring.Max(p => p.Lat));

    /// <summary>True when two simple polygons share area: edges cross, or one lies inside the other.</summary>
    public static bool Overlaps(IReadOnlyList<(double Lng, double Lat)> a, IReadOnlyList<(double Lng, double Lat)> b)
    {
        var ba = Bounds(a);
        var bb = Bounds(b);
        if (ba.MaxLng <= bb.MinLng || bb.MaxLng <= ba.MinLng || ba.MaxLat <= bb.MinLat || bb.MaxLat <= ba.MinLat) return false;
        for (var i = 0; i < a.Count; i++)
            for (var j = 0; j < b.Count; j++)
                if (SegmentsCross(a[i], a[(i + 1) % a.Count], b[j], b[(j + 1) % b.Count])) return true;
        return Inside(a[0], b) || Inside(b[0], a);
    }

    private static bool SegmentsCross((double X, double Y) p1, (double X, double Y) p2, (double X, double Y) q1, (double X, double Y) q2)
    {
        static double Cross((double X, double Y) o, (double X, double Y) a, (double X, double Y) b) =>
            (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X);
        var d1 = Cross(q1, q2, p1);
        var d2 = Cross(q1, q2, p2);
        var d3 = Cross(p1, p2, q1);
        var d4 = Cross(p1, p2, q2);
        // Strict crossing only: parcels that merely touch along a shared border are not an overlap.
        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    }

    private static bool Inside((double X, double Y) p, IReadOnlyList<(double Lng, double Lat)> ring)
    {
        var inside = false;
        for (int i = 0, j = ring.Count - 1; i < ring.Count; j = i++)
        {
            var (xi, yi) = ring[i];
            var (xj, yj) = ring[j];
            if ((yi > p.Y) != (yj > p.Y) && p.X < (xj - xi) * (p.Y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    public static string Format(double value) => value.ToString("0.##", CultureInfo.InvariantCulture);
}

/// <summary>The listing's application deadline (kept separate so the check does not need the opportunity entity).</summary>
public readonly record struct InvestmentDeadline(DateTimeOffset? Value);
