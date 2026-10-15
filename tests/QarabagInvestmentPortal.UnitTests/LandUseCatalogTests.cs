using System.Text.Json;
using QarabagInvestmentPortal.Api.Features.Lands;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class LandUseCatalogTests
{
    // Same keys as frontend/src/data/categories.ts
    private static readonly string[] FrontendKeys =
    [
        "crops", "orchards", "greenhouse", "livestock", "poultry", "pasture", "beekeeping", "fishery", "nursery", "mixed",
        "processing", "coldStorage", "machinery", "forestry", "agrotourism", "holidayHomes", "residential", "commercial",
        "roadside", "industry", "logistics", "renewable", "sport", "camping", "social",
    ];

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static LandFacts Facts(string attributes = "{}", string? legal = "agricultural", bool? convertible = null, double? settlementKm = 5) =>
        new("20-123-0456", legal, convertible, "private", "{\"type\":\"Polygon\"}", "asphalt", 1, settlementKm, "boş", 2,
            LandAttributes.Parse(attributes));

    [Fact]
    public void Catalog_has_the_25_types_with_the_frontend_keys()
    {
        Assert.Equal(25, LandUseCatalog.All.Count);
        Assert.Equal(FrontendKeys, LandUseCatalog.All.Select(t => t.Key));
        Assert.Equal(Enumerable.Range(1, 25), LandUseCatalog.All.Select(t => t.Number));
        Assert.All(LandUseCatalog.All.Where(t => t.Number >= 16), t => Assert.True(t.NeedsConstruction));
        Assert.All(LandUseCatalog.All.Where(t => t.Number <= 15), t => Assert.False(t.NeedsConstruction));
    }

    [Fact]
    public void Every_deal_breaker_only_uses_inputs_of_its_type()
    {
        foreach (var type in LandUseCatalog.All)
        {
            var keys = type.Inputs.Select(i => i.Key).ToHashSet();
            Assert.Equal(keys.Count, type.Inputs.Count); // no duplicate keys
            Assert.All(type.DealBreakers.SelectMany(d => d.Inputs), k => Assert.Contains(k, keys));
            Assert.All(type.Inputs.Where(i => i.Kind == InputKind.Choice), i => Assert.NotEmpty(i.Options!));
        }
    }

    [Theory]
    [InlineData("crops", "crops")]
    [InlineData("Əkinçilik", "crops")]
    [InlineData("Bağçılıq", "orchards")]
    [InlineData("İstixana təsərrüfatı", "greenhouse")]
    [InlineData("Arıçılıq", "beekeeping")]
    [InlineData("Bərpa olunan enerji layihələri", "renewable")]
    public void Finds_types_by_key_name_or_old_short_name(string value, string key) =>
        Assert.Equal(key, LandUseCatalog.Find(value)?.Key);

    [Fact]
    public void Unknown_type_is_not_found() => Assert.Null(LandUseCatalog.Find("kosmodrom"));

    [Fact]
    public void Crops_without_water_is_unsuitable()
    {
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("crops"), Facts("""{"water_source":"none","salinity":"low","slope_pct":3}"""));
        Assert.Equal(SuitabilityLevel.Unsuitable, r.Level);
        Assert.Contains(r.DealBreakers, d => d.Code == "no_water");
    }

    [Fact]
    public void Crops_with_good_data_is_suitable()
    {
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("crops"), Facts("""{"water_source":"canal","salinity":"low","slope_pct":3}"""));
        Assert.Equal(SuitabilityLevel.Suitable, r.Level);
        Assert.Empty(r.DealBreakers);
        Assert.Empty(r.Missing);
    }

    [Fact]
    public void Missing_data_means_needs_data_not_unsuitable()
    {
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("crops"), Facts("{}"));
        Assert.Equal(SuitabilityLevel.NeedsData, r.Level);
        Assert.Contains("Şoranlıq", r.Missing);
        Assert.NotEmpty(r.Unchecked);
    }

    [Fact]
    public void Steep_slope_fails_crops()
    {
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("crops"), Facts("""{"water_source":"well","salinity":"none","slope_pct":22}"""));
        Assert.Contains(r.DealBreakers, d => d.Code == "steep_slope");
    }

    [Fact]
    public void Legal_category_is_checked_first_for_construction()
    {
        // Wrong zoning would also fail, but the legal check stops before the type's deal-breakers.
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("residential"),
            Facts("""{"zoning":"industrial"}""", legal: "agricultural", convertible: false));
        Assert.Equal(SuitabilityLevel.Unsuitable, r.Level);
        var only = Assert.Single(r.DealBreakers);
        Assert.Equal("category_not_convertible", only.Code);
    }

    [Fact]
    public void Construction_on_convertible_agricultural_land_only_warns()
    {
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("holidayHomes"), Facts("{}", legal: "agricultural", convertible: true));
        Assert.NotEqual(SuitabilityLevel.Unsuitable, r.Level);
        Assert.Contains(r.Warnings, w => w.Code == "category_change_needed");
    }

    [Fact]
    public void Protected_area_blocks_crops_but_only_warns_for_camping()
    {
        Assert.Equal(SuitabilityLevel.Unsuitable,
            LandSuitability.Evaluate(LandUseCatalog.ByKey("crops"), Facts("{}", legal: "protected")).Level);
        var camping = LandSuitability.Evaluate(LandUseCatalog.ByKey("camping"), Facts("{}", legal: "protected"));
        Assert.NotEqual(SuitabilityLevel.Unsuitable, camping.Level);
        Assert.Contains(camping.Warnings, w => w.Code == "protected_area");
    }

    [Fact]
    public void Greenhouse_fails_only_when_both_power_and_gas_are_missing()
    {
        var type = LandUseCatalog.ByKey("greenhouse");
        Assert.Contains(LandSuitability.Evaluate(type, Facts("""{"electricity_kw":0,"gas_access":false}""")).DealBreakers, d => d.Code == "no_energy");
        Assert.DoesNotContain(LandSuitability.Evaluate(type, Facts("""{"electricity_kw":50,"gas_access":false}""")).DealBreakers, d => d.Code == "no_energy");
    }

    [Fact]
    public void Mixed_farming_uses_the_weakest_component()
    {
        var r = LandSuitability.Evaluate(LandUseCatalog.ByKey("mixed"), Facts("""{"water_source":"river","degradation":"heavy"}"""));
        Assert.Contains(r.DealBreakers, d => d.Code == "heavy_degradation");
    }

    [Fact]
    public void Attributes_are_normalised_and_checked()
    {
        var crops = LandUseCatalog.ByKey("crops")!;
        var (json, error) = LandAttributes.Normalise(crops, Json("""{"slope_pct":"7,5","water_rights":"bəli","salinity":"LOW","crop_history":" buğda "}"""));
        Assert.Null(error);
        var a = LandAttributes.Parse(json);
        Assert.Equal(7.5, a["slope_pct"].GetDouble());
        Assert.True(a["water_rights"].GetBoolean());
        Assert.Equal("low", a["salinity"].GetString());
        Assert.Equal("buğda", a["crop_history"].GetString());

        Assert.NotNull(LandAttributes.Normalise(crops, Json("""{"wind_speed_ms":5}""")).Error);   // not a crops input
        Assert.NotNull(LandAttributes.Normalise(crops, Json("""{"slope_pct":150}""")).Error);     // out of range
        Assert.NotNull(LandAttributes.Normalise(crops, Json("""{"salinity":"extreme"}""")).Error); // not an option
        Assert.NotNull(LandAttributes.Normalise(crops, Json("""{"water_rights":"maybe"}""")).Error);
    }

    [Fact]
    public void Boundary_is_stored_as_a_closed_polygon_inside_Azerbaijan()
    {
        var (geo, error) = LandProfileParser.NormaliseBoundary(Json("[[47.0,40.0],[47.1,40.0],[47.1,40.1]]"));
        Assert.Null(error);
        var ring = JsonDocument.Parse(geo!).RootElement.GetProperty("coordinates")[0];
        Assert.Equal(4, ring.GetArrayLength());
        Assert.Equal(ring[0].ToString(), ring[3].ToString());

        Assert.NotNull(LandProfileParser.NormaliseBoundary(Json("[[2.35,48.85],[2.36,48.85],[2.36,48.86]]")).Error); // Paris
        Assert.NotNull(LandProfileParser.NormaliseBoundary(Json("[[47.0,40.0],[47.1,40.0]]")).Error);                 // 2 points
    }

    [Fact]
    public void Profile_parse_accepts_old_type_names_and_rejects_bad_core_values()
    {
        var (profile, error) = LandProfileParser.Parse(new LandProfileInput(LandUse: "Əkinçilik", LegalCategory: "AGRICULTURAL"));
        Assert.Null(error);
        Assert.Equal("crops", profile!.Type.Key);
        Assert.Equal("agricultural", profile.LegalCategory);

        Assert.NotNull(LandProfileParser.Parse(new LandProfileInput(LandUse: null)).Error);
        Assert.NotNull(LandProfileParser.Parse(new LandProfileInput(LandUse: "crops", LegalCategory: "moon")).Error);
        Assert.NotNull(LandProfileParser.Parse(new LandProfileInput(LandUse: "crops", RoadDistanceKm: -1)).Error);
        Assert.NotNull(LandProfileParser.Parse(new LandProfileInput(LandUse: "crops", CadastralNumber: "<script>")).Error);
    }
}
