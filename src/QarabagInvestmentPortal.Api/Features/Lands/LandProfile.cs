using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>
/// The land data the owner fills in: the common core (all 25 types) plus the type-specific inputs.
/// Used by the submit form (multipart fields) and by the "check before submitting" endpoint (JSON body).
/// Every field is optional at this level; missing data is reported by <see cref="LandSuitability"/>.
/// </summary>
public sealed record LandProfileInput(
    string? LandUse = null,
    string? CadastralNumber = null,
    string? LegalCategory = null,
    bool? CategoryConvertible = null,
    string? OwnershipForm = null,
    bool? HasEncumbrance = null,
    string? Encumbrances = null,
    JsonElement? Boundary = null,
    string? RoadAccessType = null,
    double? RoadDistanceKm = null,
    double? SettlementDistanceKm = null,
    string? CurrentUse = null,
    JsonElement? Attributes = null);

/// <summary>Checked and normalised land data, ready to be stored on a <see cref="Land"/>.</summary>
public sealed record LandProfile(
    LandUseType Type,
    string? CadastralNumber,
    string? LegalCategory,
    bool? CategoryConvertible,
    string? OwnershipForm,
    bool? HasEncumbrance,
    string? Encumbrances,
    string? BoundaryGeoJson,
    string? RoadAccessType,
    double? RoadDistanceKm,
    double? SettlementDistanceKm,
    string? CurrentUse,
    string AttributesJson)
{
    public void ApplyTo(Land land)
    {
        land.LandUse = Type.Key;
        land.AgricultureType = Type.Name;
        land.CadastralNumber = CadastralNumber;
        land.LegalCategory = LegalCategory;
        land.CategoryConvertible = CategoryConvertible;
        land.OwnershipForm = OwnershipForm;
        land.HasEncumbrance = HasEncumbrance;
        land.Encumbrances = Encumbrances;
        land.BoundaryGeoJson = BoundaryGeoJson;
        land.RoadAccessType = RoadAccessType;
        land.RoadDistanceKm = RoadDistanceKm;
        land.SettlementDistanceKm = SettlementDistanceKm;
        land.CurrentUse = CurrentUse;
        land.Attributes = AttributesJson;
    }

    public LandFacts ToFacts(int photoCount) => new(
        CadastralNumber, LegalCategory, CategoryConvertible, OwnershipForm, BoundaryGeoJson, RoadAccessType,
        RoadDistanceKm, SettlementDistanceKm, CurrentUse, photoCount, LandAttributes.Parse(AttributesJson));
}

/// <summary>Read-only view of a land's data for the deal-breaker checks.</summary>
public sealed record LandFacts(
    string? CadastralNumber, string? LegalCategory, bool? CategoryConvertible, string? OwnershipForm,
    string? BoundaryGeoJson, string? RoadAccessType, double? RoadDistanceKm, double? SettlementDistanceKm,
    string? CurrentUse, int PhotoCount, IReadOnlyDictionary<string, JsonElement> Attributes)
{
    public static LandFacts From(Land land) => new(
        land.CadastralNumber, land.LegalCategory, land.CategoryConvertible, land.OwnershipForm, land.BoundaryGeoJson,
        land.RoadAccessType, land.RoadDistanceKm, land.SettlementDistanceKm, land.CurrentUse,
        land.Photos.Count > 0 ? land.Photos.Count : string.IsNullOrWhiteSpace(land.ImageUrl) ? 0 : 1,
        LandAttributes.Parse(land.Attributes));

    public bool Has(string key) => Attributes.ContainsKey(key);

    public double? Num(string key) =>
        Attributes.TryGetValue(key, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    public bool? Bool(string key) =>
        Attributes.TryGetValue(key, out var v) ? v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        } : null;

    public string? Str(string key) =>
        Attributes.TryGetValue(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}

/// <summary>Validation of the land data. Messages are in Azerbaijani, like the rest of the API.</summary>
public static partial class LandProfileParser
{
    // Azerbaijan's bounding box (same as the map point check).
    private const double MinLat = 38.3, MaxLat = 41.95, MinLng = 44.7, MaxLng = 50.4;

    public static (LandProfile? Profile, string? Error) Parse(LandProfileInput input)
    {
        var type = LandUseCatalog.Find(input.LandUse);
        if (type is null) return Fail("Fəaliyyət növünü seçin.");

        var cadastral = Clean(input.CadastralNumber, 50);
        if (cadastral is not null && !CadastralRegex().IsMatch(cadastral))
            return Fail("Kadastr nömrəsi yalnız rəqəm, hərf, “-”, “/” və “.” ola bilər.");

        if (!InList(input.LegalCategory, LandUseCatalog.LegalCategories, out var legal)) return Fail("Torpağın kateqoriyasını (təyinatını) seçin.");
        if (!InList(input.OwnershipForm, LandUseCatalog.OwnershipForms, out var ownership)) return Fail("Mülkiyyət növünü seçin.");
        if (!InList(input.RoadAccessType, LandUseCatalog.RoadAccessTypes, out var road)) return Fail("Yol növünü seçin.");
        if (input.RoadDistanceKm is < 0 or > 10_000) return Fail("Yola qədər məsafəni km ilə düzgün yazın.");
        if (input.SettlementDistanceKm is < 0 or > 10_000) return Fail("Yaşayış məntəqəsinə qədər məsafəni km ilə düzgün yazın.");

        string? boundary = null;
        if (input.Boundary is { ValueKind: not (JsonValueKind.Null or JsonValueKind.Undefined) } b)
        {
            (boundary, var boundaryError) = NormaliseBoundary(b);
            if (boundaryError is not null) return Fail(boundaryError);
        }

        var (attributes, attrError) = LandAttributes.Normalise(type, input.Attributes);
        if (attrError is not null) return Fail(attrError);

        return (new LandProfile(
            type, cadastral, legal, input.CategoryConvertible, ownership, input.HasEncumbrance,
            Clean(input.Encumbrances, 1000), boundary, road, input.RoadDistanceKm, input.SettlementDistanceKm,
            Clean(input.CurrentUse, 500), attributes!), null);
    }

    /// <summary>Reads the multipart form fields of the submit form.</summary>
    public static (LandProfileInput? Input, string? Error) FromForm(IFormCollection form)
    {
        string? F(string key) => form[key].ToString().Trim() is { Length: > 0 } v ? v : null;

        var (boundary, boundaryError) = JsonField(F("boundary"), "Sərhəd koordinatları");
        if (boundaryError is not null) return (null, boundaryError);
        var (attributes, attributesError) = JsonField(F("attributes"), "Əlavə məlumatlar");
        if (attributesError is not null) return (null, attributesError);

        if (!TryBool(F("categoryConvertible"), out var convertible)) return (null, "Kateqoriyanın dəyişdirilə bilməsi üçün bəli və ya xeyr seçin.");
        if (!TryBool(F("hasEncumbrance"), out var encumbrance)) return (null, "Yüklülük (girov, icarə) üçün bəli və ya xeyr seçin.");
        if (!TryNumber(F("roadDistanceKm"), out var roadKm)) return (null, "Yola qədər məsafəni km ilə düzgün yazın.");
        if (!TryNumber(F("settlementDistanceKm"), out var settlementKm)) return (null, "Yaşayış məntəqəsinə qədər məsafəni km ilə düzgün yazın.");

        return (new LandProfileInput(
            F("landUse") ?? F("agricultureType"), F("cadastralNumber"), F("legalCategory"), convertible, F("ownershipForm") ?? F("ownershipType"),
            encumbrance, F("encumbrances"), boundary, F("roadAccessType"), roadKm, settlementKm, F("currentUse"), attributes), null);
    }

    // ---------------------------------------------------------------- helpers

    internal static bool TryBool(string? raw, out bool? value)
    {
        value = null;
        if (raw is null) return true;
        switch (raw.Trim().ToLowerInvariant())
        {
            case "true" or "yes" or "1" or "bəli" or "beli" or "hə" or "on": value = true; return true;
            case "false" or "no" or "0" or "xeyr" or "yox" or "off": value = false; return true;
            default: return false;
        }
    }

    internal static bool TryNumber(string? raw, out double? value)
    {
        value = null;
        if (raw is null) return true;
        if (double.TryParse(raw.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) && double.IsFinite(v))
        {
            value = v;
            return true;
        }
        return false;
    }

    private static (JsonElement? Value, string? Error) JsonField(string? raw, string label)
    {
        if (raw is null) return (null, null);
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return (doc.RootElement.Clone(), null);
        }
        catch (JsonException)
        {
            return (null, $"{label} düzgün JSON formatında deyil.");
        }
    }

    /// <summary>Accepts a GeoJSON Polygon or a plain list of [lng, lat] points; stores a closed GeoJSON Polygon.</summary>
    internal static (string? GeoJson, string? Error) NormaliseBoundary(JsonElement value)
    {
        const string bad = "Sərhəd koordinatlarını düzgün göndərin: ən azı 3 nöqtə [uzunluq, en], Azərbaycan ərazisində.";
        var ring = value;
        if (value.ValueKind == JsonValueKind.Object)
        {
            if (!value.TryGetProperty("type", out var t) || t.GetString() != "Polygon" ||
                !value.TryGetProperty("coordinates", out var coords) || coords.ValueKind != JsonValueKind.Array || coords.GetArrayLength() == 0)
                return (null, bad);
            ring = coords[0];
        }
        if (ring.ValueKind != JsonValueKind.Array) return (null, bad);

        var points = new List<(double Lng, double Lat)>();
        foreach (var p in ring.EnumerateArray())
        {
            if (p.ValueKind != JsonValueKind.Array || p.GetArrayLength() < 2 ||
                p[0].ValueKind != JsonValueKind.Number || p[1].ValueKind != JsonValueKind.Number) return (null, bad);
            var lng = p[0].GetDouble();
            var lat = p[1].GetDouble();
            if (lat is < MinLat or > MaxLat || lng is < MinLng or > MaxLng) return (null, bad);
            points.Add((lng, lat));
        }
        if (points.Count > 1 && points[0] == points[^1]) points.RemoveAt(points.Count - 1);
        if (points.Count is < 3 or > 1000) return (null, bad);
        points.Add(points[0]);

        var coordinates = new JsonArray(new JsonArray(points.Select(p => (JsonNode)new JsonArray(p.Lng, p.Lat)).ToArray()));
        var geo = new JsonObject { ["type"] = "Polygon", ["coordinates"] = coordinates };
        return (geo.ToJsonString(), null);
    }

    private static bool InList(string? raw, string[] allowed, out string? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(raw)) return true;
        value = allowed.FirstOrDefault(a => a.Equals(raw.Trim(), StringComparison.OrdinalIgnoreCase));
        return value is not null;
    }

    private static string? Clean(string? raw, int max)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var v = raw.Trim();
        return v.Length <= max ? v : v[..max];
    }

    private static (LandProfile?, string?) Fail(string message) => (null, message);

    [GeneratedRegex(@"^[\p{L}\d][\p{L}\d\-/. ]{1,49}$")]
    private static partial Regex CadastralRegex();
}

/// <summary>Type-specific inputs, stored as a JSON object (jsonb) in Land.Attributes.</summary>
public static class LandAttributes
{
    public static IReadOnlyDictionary<string, JsonElement> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, JsonElement>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return new Dictionary<string, JsonElement>();
            return doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone());
        }
        catch (JsonException)
        {
            return new Dictionary<string, JsonElement>();
        }
    }

    /// <summary>Checks every value against the type's inputs; returns a normalised JSON object (numbers, true/false, option keys).</summary>
    public static (string? Json, string? Error) Normalise(LandUseType type, JsonElement? value)
    {
        var result = new JsonObject();
        if (value is not { ValueKind: not (JsonValueKind.Null or JsonValueKind.Undefined) } obj) return (result.ToJsonString(), null);
        if (obj.ValueKind != JsonValueKind.Object) return (null, "Əlavə məlumatlar obyekt şəklində olmalıdır.");

        var inputs = type.Inputs.ToDictionary(i => i.Key);
        foreach (var prop in obj.EnumerateObject())
        {
            if (!inputs.TryGetValue(prop.Name, out var input))
                return (null, $"“{type.Name}” üçün naməlum sahə: {prop.Name}.");
            var v = prop.Value;
            if (v.ValueKind == JsonValueKind.Null || (v.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(v.GetString())))
                continue; // empty = not filled

            switch (input.Kind)
            {
                case InputKind.Number:
                    double? n = v.ValueKind == JsonValueKind.Number ? v.GetDouble()
                        : v.ValueKind == JsonValueKind.String && LandProfileParser.TryNumber(v.GetString(), out var parsed) ? parsed : null;
                    if (n is null || !double.IsFinite(n.Value)) return (null, $"“{input.Label}” rəqəm olmalıdır.");
                    if ((input.Min is { } min && n < min) || (input.Max is { } max && n > max))
                        return (null, $"“{input.Label}” {input.Min}–{input.Max} {input.Unit} aralığında olmalıdır.");
                    result[input.Key] = n.Value;
                    break;
                case InputKind.YesNo:
                    bool? b = v.ValueKind switch
                    {
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        JsonValueKind.String when LandProfileParser.TryBool(v.GetString(), out var pb) => pb,
                        _ => null,
                    };
                    if (b is null) return (null, $"“{input.Label}” üçün bəli və ya xeyr seçin.");
                    result[input.Key] = b.Value;
                    break;
                case InputKind.Choice:
                    var choice = v.ValueKind == JsonValueKind.String
                        ? input.Options!.FirstOrDefault(o => o.Equals(v.GetString()!.Trim(), StringComparison.OrdinalIgnoreCase))
                        : null;
                    if (choice is null) return (null, $"“{input.Label}” üçün variantlardan birini seçin: {string.Join(", ", input.Options!)}.");
                    result[input.Key] = choice;
                    break;
                default:
                    if (v.ValueKind != JsonValueKind.String) return (null, $"“{input.Label}” mətn olmalıdır.");
                    var text = v.GetString()!.Trim();
                    result[input.Key] = text.Length <= 500 ? text : text[..500];
                    break;
            }
        }
        return (result.ToJsonString(), null);
    }
}
