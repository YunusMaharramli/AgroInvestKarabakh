namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>How an input is filled in the form.</summary>
public enum InputKind
{
    Number,
    YesNo,
    Choice,
    Text,
}

/// <summary>One type-specific input (stored in Land.Attributes under <see cref="Key"/>).</summary>
public sealed record LandInput(
    string Key, string Label, InputKind Kind, string? Unit = null, IReadOnlyList<string>? Options = null,
    bool Required = false, double? Min = null, double? Max = null);

/// <summary>
/// A condition that makes the land unsuitable for a use, whatever else is true.
/// <see cref="Fails"/> returns true (fails), false (passes) or null (cannot be checked: data missing).
/// </summary>
public sealed record DealBreaker(string Code, string Message, IReadOnlyList<string> Inputs, Func<LandFacts, bool?> Fails);

/// <summary>One of the 25 land-use types. <see cref="Key"/> is the same key the frontend uses.</summary>
public sealed record LandUseType(
    int Number, string Key, string Name, bool NeedsConstruction,
    IReadOnlyList<LandInput> Inputs, IReadOnlyList<DealBreaker> DealBreakers);

/// <summary>
/// The 25 land-use types, the inputs each one needs and the deal-breakers to check first.
/// Every type also uses the common core fields on <see cref="Land"/> (cadastral number, legal category, ownership,
/// boundary, road access, distance to settlement, photos, current use).
/// Thresholds are first estimates and can be tuned here in one place.
/// </summary>
public static class LandUseCatalog
{
    // ---------------------------------------------------------------- choices

    public static readonly string[] WaterSources = ["none", "river", "canal", "well", "spring", "reservoir", "municipal"];
    public static readonly string[] IrrigationTypes = ["none", "drip", "sprinkler", "furrow", "flood"];
    public static readonly string[] LowMediumHigh = ["low", "medium", "high"];
    public static readonly string[] Quality = ["good", "acceptable", "poor"];
    public static readonly string[] Directions = ["flat", "N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    public static readonly string[] Zoning = ["agricultural", "residential", "commercial", "industrial", "mixed", "recreational", "public"];

    /// <summary>Legal land categories (Torpaq Məcəlləsi): təyinat.</summary>
    public static readonly string[] LegalCategories =
        ["agricultural", "settlement", "industrial_transport", "protected", "forest", "water", "reserve"];
    /// <summary>Form of ownership (core field). Not the same as <see cref="LandOwnershipType"/> (private owner listing vs state land).</summary>
    public static readonly string[] OwnershipForms = ["private", "municipal", "state"];
    public static readonly string[] RoadAccessTypes = ["asphalt", "gravel", "dirt", "none"];

    // ---------------------------------------------------------------- shared inputs

    private static LandInput Slope(bool required = false) => new("slope_pct", "Maillik", InputKind.Number, "%", Required: required, Min: 0, Max: 100);
    private static LandInput WaterSource(bool required = true) => new("water_source", "Su mənbəyi", InputKind.Choice, Options: WaterSources, Required: required);
    private static LandInput Irrigation(bool required = false) => new("irrigation", "Suvarma üsulu", InputKind.Choice, Options: IrrigationTypes, Required: required);
    private static LandInput ElectricityKw(bool required = false) => new("electricity_kw", "Elektrik gücü", InputKind.Number, "kVt", Required: required, Min: 0, Max: 1_000_000);
    private static LandInput PowerStable(bool required = false) => new("power_stable", "Elektrik təchizatı fasiləsizdir", InputKind.YesNo, Required: required);
    private static LandInput DistanceHousing(bool required = true) => new("distance_housing_m", "Yaşayış evlərinə qədər məsafə", InputKind.Number, "m", Required: required, Min: 0, Max: 1_000_000);
    private static LandInput ZoningInput(bool required = true) => new("zoning", "Zonalaşdırma", InputKind.Choice, Options: Zoning, Required: required);
    private static LandInput Utilities(bool required = true) => new("utilities", "Kommunikasiyalar (su, işıq) var", InputKind.YesNo, Required: required);
    private static LandInput WaterSupply(bool required = false) => new("water_supply", "Su xətti var", InputKind.YesNo, Required: required);
    private static LandInput Sewage(bool required = false) => new("sewage", "Kanalizasiya var", InputKind.YesNo, Required: required);
    private static LandInput TruckRoad(bool required = false) => new("truck_road", "Yük maşını üçün yol var", InputKind.YesNo, Required: required);
    private static LandInput Km(string key, string label, bool required = false) => new(key, label, InputKind.Number, "km", Required: required, Min: 0, Max: 10_000);
    private static LandInput Yes(string key, string label, bool required = false) => new(key, label, InputKind.YesNo, Required: required);
    private static LandInput Text(string key, string label) => new(key, label, InputKind.Text);
    private static LandInput Choice(string key, string label, string[] options, bool required = false) => new(key, label, InputKind.Choice, Options: options, Required: required);
    private static LandInput Number(string key, string label, string unit, double min, double max, bool required = false) => new(key, label, InputKind.Number, unit, Required: required, Min: min, Max: max);

    // ---------------------------------------------------------------- deal-breaker helpers

    private static DealBreaker NoWater(string message = "Su mənbəyi yoxdur.") =>
        new("no_water", message, ["water_source"], f => f.Str("water_source") is { } s ? s == "none" : null);

    private static DealBreaker Above(string key, double limit, string code, string message) =>
        new(code, message, [key], f => f.Num(key) is { } v ? v > limit : null);

    private static DealBreaker Below(string key, double limit, string code, string message) =>
        new(code, message, [key], f => f.Num(key) is { } v ? v < limit : null);

    private static DealBreaker Is(string key, string value, string code, string message) =>
        new(code, message, [key], f => f.Str(key) is { } s ? s == value : null);

    private static DealBreaker IsNo(string key, string code, string message) =>
        new(code, message, [key], f => f.Bool(key) is { } b ? !b : null);

    private static DealBreaker IsYes(string key, string code, string message) =>
        new(code, message, [key], f => f.Bool(key) is { } b ? b : null);

    private static DealBreaker ZoningNotIn(string code, string message, params string[] allowed) =>
        new(code, message, ["zoning"], f => f.Str("zoning") is { } z ? !allowed.Contains(z) : null);

    private static DealBreaker AnyOf(string code, string message, params DealBreaker[] parts) =>
        new(code, message, parts.SelectMany(p => p.Inputs).Distinct().ToList(), f =>
        {
            var results = parts.Select(p => p.Fails(f)).ToList();
            if (results.Any(r => r == true)) return true;
            return results.All(r => r == false) ? false : null;
        });

    private static DealBreaker AllOf(string code, string message, params DealBreaker[] parts) =>
        new(code, message, parts.SelectMany(p => p.Inputs).Distinct().ToList(), f =>
        {
            var results = parts.Select(p => p.Fails(f)).ToList();
            if (results.Any(r => r == false)) return false;
            return results.All(r => r == true) ? true : null;
        });

    // ---------------------------------------------------------------- the 25 types

    public static readonly IReadOnlyList<LandUseType> All = Build();

    private static List<LandUseType> Build()
    {
        // Pieces reused by "Qarışıq kənd təsərrüfatı" (10 = 1 + 4 + 6).
        var cropInputs = new List<LandInput>
        {
            Choice("soil_type", "Torpaq tipi", ["chernozem", "chestnut", "grey_brown", "alluvial", "sandy", "clay", "loam", "other"]),
            Number("soil_ph", "Torpağın pH-ı", "pH", 0, 14),
            Choice("salinity", "Şoranlıq", ["none", "low", "medium", "high"], required: true),
            Number("organic_matter_pct", "Üzvi maddə (humus)", "%", 0, 100),
            Slope(required: true),
            WaterSource(),
            Yes("water_rights", "Su hüququ (icazə) var"),
            Text("crop_history", "Son illərdə əkilən bitkilər"),
            Number("bonitet", "Bonitet balı", "bal", 0, 100),
        };
        var cropBreakers = new List<DealBreaker>
        {
            NoWater(),
            Is("salinity", "high", "high_salinity", "Torpaq çox şoranlaşıb."),
            Above("slope_pct", 15, "steep_slope", "Maillik 15%-dən çoxdur."),
        };
        var livestockInputs = new List<LandInput>
        {
            DistanceHousing(),
            WaterSource(),
            Yes("fodder_land_nearby", "Yaxınlıqda yem sahəsi var"),
            Yes("existing_barns", "Tövlə / binalar var"),
            Yes("waste_disposal", "Peyin / tullantı utilizasiyası mümkündür"),
            Km("vet_distance_km", "Baytar xidmətinə qədər məsafə"),
        };
        var livestockBreakers = new List<DealBreaker>
        {
            Below("distance_housing_m", 500, "too_close_to_housing", "Yaşayış evlərinə çox yaxındır (500 m-dən az)."),
            NoWater(),
        };
        var pastureInputs = new List<LandInput>
        {
            Text("vegetation_type", "Bitki örtüyü"),
            Number("carrying_capacity", "Tutum (baş / ha)", "baş/ha", 0, 1000),
            Number("water_points", "Suvat yerlərinin sayı", "ədəd", 0, 1000, required: true),
            Slope(),
            Choice("season", "İstifadə mövsümü", ["summer", "winter", "all_year"]),
            Choice("degradation", "Deqradasiya", ["none", "light", "moderate", "heavy"], required: true),
        };
        var pastureBreakers = new List<DealBreaker>
        {
            Below("water_points", 1, "no_water_points", "Suvat yeri yoxdur."),
            Is("degradation", "heavy", "heavy_degradation", "Otlaq ağır deqradasiyaya uğrayıb."),
        };

        static List<LandInput> Merge(params IEnumerable<LandInput>[] lists) =>
            lists.SelectMany(l => l).GroupBy(i => i.Key).Select(g => g.First()).ToList();

        return
        [
            new(1, "crops", "Əkinçilik", false, cropInputs, cropBreakers),

            new(2, "orchards", "Bağçılıq və çoxillik əkinlər", false,
            [
                Number("soil_depth_cm", "Torpaq qatının qalınlığı", "sm", 0, 1000, required: true),
                Choice("drainage", "Drenaj", Quality),
                Choice("frost_risk", "Şaxta riski", LowMediumHigh, required: true),
                Choice("orientation", "Yamacın istiqaməti", Directions),
                Text("existing_trees", "Mövcud ağaclar (növ, yaş)"),
                Number("tree_count", "Ağacların sayı", "ədəd", 0, 10_000_000),
                Irrigation(), WaterSource(),
                Number("altitude_m", "Dəniz səviyyəsindən hündürlük", "m", -50, 5000),
            ],
            [
                Below("soil_depth_cm", 60, "shallow_soil", "Torpaq qatı çox nazikdir (60 sm-dən az)."),
                Is("frost_risk", "high", "frost_pocket", "Şaxta cibidir (şaxta riski yüksəkdir)."),
                NoWater(),
            ]),

            new(3, "greenhouse", "İstixana təsərrüfatı", false,
            [
                Slope(required: true),
                Number("sun_hours", "Günəşli saatlar (gündə)", "saat", 0, 24),
                ElectricityKw(required: true),
                Yes("gas_access", "Qaz xətti var", required: true),
                WaterSource(),
                Choice("water_quality", "Suyun keyfiyyəti", Quality, required: true),
                Choice("wind_exposure", "Külək təsiri", LowMediumHigh),
                Km("distance_market_km", "Bazara qədər məsafə"),
            ],
            [
                AllOf("no_energy", "Nə elektrik, nə də qaz var.",
                    Below("electricity_kw", 0.001, "no_power", ""), IsNo("gas_access", "no_gas", "")),
                Is("water_quality", "poor", "poor_water", "Suyun keyfiyyəti pisdir."),
            ]),

            new(4, "livestock", "Heyvandarlıq", false, livestockInputs, livestockBreakers),

            new(5, "poultry", "Quşçuluq", false,
            [
                DistanceHousing(),
                Number("distance_other_farms_m", "Başqa quş fermalarına qədər məsafə", "m", 0, 1_000_000, required: true),
                ElectricityKw(), PowerStable(required: true), WaterSource(),
                Yes("ventilation_ok", "Havalandırma üçün əlverişlidir"),
                TruckRoad(),
            ],
            [
                Below("distance_other_farms_m", 1000, "biosecurity", "Başqa quş fermalarına çox yaxındır (1 km-dən az)."),
                IsNo("power_stable", "unstable_power", "Elektrik təchizatı fasiləlidir."),
            ]),

            new(6, "pasture", "Otlaq və örüş", false, pastureInputs, pastureBreakers),

            new(7, "beekeeping", "Arıçılıq", false,
            [
                Text("flowering_plants", "Yaxınlıqdakı çiçəkli bitkilər"),
                Text("flowering_season", "Çiçəkləmə mövsümü"),
                Km("distance_pesticide_fields_km", "Pestisid səpilən sahələrə qədər məsafə"),
                Yes("intensive_pesticide_nearby", "Yaxınlıqda intensiv pestisid istifadəsi var", required: true),
                WaterSource(required: false),
                Yes("wind_shelter", "Küləkdən qorunur"),
            ],
            [
                IsYes("intensive_pesticide_nearby", "pesticides", "Yaxınlıqda intensiv pestisid istifadə olunur."),
            ]),

            new(8, "fishery", "Balıqçılıq təsərrüfatı", false,
            [
                WaterSource(),
                Number("water_flow_ls", "Su sərfi", "l/san", 0, 1_000_000, required: true),
                Number("water_temp_c", "Suyun temperaturu", "°C", -5, 50),
                Choice("water_quality", "Suyun keyfiyyəti", Quality, required: true),
                Yes("clay_soil", "Torpaq su keçirmir (gil)"),
                Choice("flood_risk", "Daşqın riski", LowMediumHigh),
                Yes("discharge_permit", "Su axıtma icazəsi var"),
            ],
            [
                NoWater("Su mənbəyi yoxdur."),
                Below("water_flow_ls", 5, "low_flow", "Su kifayət deyil (5 l/san-dən az)."),
                Is("water_quality", "poor", "polluted_water", "Su çirklidir."),
            ]),

            new(9, "nursery", "Tingçilik və şitilçilik", false,
            [
                Choice("soil_quality", "Torpağın keyfiyyəti", Quality),
                Irrigation(required: true),
                Yes("greenhouse_possible", "İstixana qurmaq mümkündür"),
                Slope(), ElectricityKw(),
                Km("distance_buyers_km", "Alıcılara qədər məsafə"),
            ],
            [
                Is("irrigation", "none", "no_irrigation", "Suvarma yoxdur."),
            ]),

            new(10, "mixed", "Qarışıq kənd təsərrüfatı", false,
                Merge([Text("internal_zoning", "Sahənin daxili bölgüsü")], cropInputs, livestockInputs, pastureInputs),
                // "Same as weakest component": any deal-breaker of 1, 4 or 6 applies.
                cropBreakers.Concat(livestockBreakers).Concat(pastureBreakers).GroupBy(d => d.Code).Select(g => g.First()).ToList()),

            new(11, "processing", "Kənd təsərrüfatı məhsullarının emalı və qablaşdırılması", false,
            [
                ElectricityKw(required: true), WaterSupply(), Sewage(), TruckRoad(),
                Km("distance_raw_material_km", "Xammal mənbəyinə qədər məsafə"),
                ZoningInput(),
            ],
            [
                Below("electricity_kw", 100, "weak_power", "Sənaye üçün elektrik gücü yoxdur (100 kVt-dan az)."),
                ZoningNotIn("wrong_zoning", "Zonalaşdırma emal müəssisəsinə uyğun deyil.", "industrial", "mixed", "agricultural"),
            ]),

            new(12, "coldStorage", "Kənd təsərrüfatı məhsullarının saxlanması və soyuducu anbarlar", false,
            [
                ElectricityKw(), PowerStable(required: true), Slope(),
                Yes("ground_stable", "Torpaq bərk və sabitdir"),
                TruckRoad(),
                Km("distance_farms_km", "Təsərrüfatlara qədər məsafə"),
                Km("distance_highway_km", "Magistral yola qədər məsafə"),
            ],
            [
                IsNo("power_stable", "unstable_power", "Elektrik təchizatı fasiləlidir."),
            ]),

            new(13, "machinery", "Kənd təsərrüfatı texnikası üçün saxlama və servis sahələri", false,
            [
                Yes("hard_surface", "Sərt, düz səth var"),
                Yes("heavy_vehicle_road", "Ağır texnika üçün yol var", required: true),
                Yes("electricity", "Elektrik var"),
                Km("distance_farms_km", "Təsərrüfat sahələrinə qədər məsafə"),
            ],
            [
                IsNo("heavy_vehicle_road", "weak_road", "Ağır texnika üçün yol yoxdur."),
            ]),

            new(14, "forestry", "Meşəçilik və oduncaq istehsalı", false,
            [
                Number("forest_cover_pct", "Meşə örtüyü", "%", 0, 100),
                Text("tree_species", "Ağac növləri"),
                Number("tree_age_years", "Ağacların orta yaşı", "il", 0, 1000),
                Slope(),
                Yes("logging_roads", "Meşə yolları var"),
                Yes("protected_area", "Mühafizə olunan meşədir", required: true),
            ],
            [
                IsYes("protected_area", "protected_forest", "Meşə mühafizə olunan statusdadır."),
            ]),

            new(15, "agrotourism", "Aqroturizm və kənd qonaq evləri", false,
            [
                Text("landscape", "Mənzərə"),
                Text("attractions_nearby", "Yaxınlıqdakı təbii görməli yerlər"),
                Km("distance_tourist_route_km", "Turist marşrutuna qədər məsafə"),
                Utilities(),
                Yes("farm_activity", "Fəaliyyətdə olan təsərrüfat var"),
                Yes("internet", "İnternet var"),
            ],
            [
                IsNo("utilities", "no_utilities", "Kommunikasiya (su, işıq) yoxdur."),
            ]),

            new(16, "holidayHomes", "Bağ və istirahət evlərinin tikintisi", true,
            [
                ZoningInput(required: false), Text("view", "Mənzərə"), Utilities(required: false),
                Km("distance_city_km", "Şəhərə qədər məsafə"),
                Choice("road_quality", "Yolun vəziyyəti", Quality),
                Slope(), Text("neighbors", "Qonşu sahələr"),
            ],
            []),   // Deal-breaker: agricultural category not convertible — checked for every construction type.

            new(17, "residential", "Yaşayış binalarının tikintisi", true,
            [
                ZoningInput(),
                Number("max_height_m", "İcazə verilən hündürlük", "m", 0, 500),
                Number("max_density_pct", "İcazə verilən sıxlıq", "%", 0, 100),
                WaterSupply(required: true), Sewage(required: true),
                Yes("gas_access", "Qaz xətti var"),
                Yes("electricity", "Elektrik var", required: true),
                Number("seismic_zone", "Seysmik zona (bal)", "bal", 5, 10),
                Number("soil_bearing_kpa", "Torpağın yükgötürmə qabiliyyəti", "kPa", 0, 10_000),
                Km("distance_school_km", "Məktəbə qədər məsafə"),
                Km("distance_hospital_km", "Xəstəxanaya qədər məsafə"),
            ],
            [
                ZoningNotIn("wrong_zoning", "Zonalaşdırma yaşayış binasına uyğun deyil.", "residential", "mixed"),
                AnyOf("no_utilities", "Su, kanalizasiya və ya elektrik qoşulması yoxdur.",
                    IsNo("water_supply", "x", ""), IsNo("sewage", "x", ""), IsNo("electricity", "x", "")),
            ]),

            new(18, "commercial", "Ticarət və ofis obyektlərinin tikintisi", true,
            [
                ZoningInput(),
                Number("road_frontage_m", "Yol tərəfi uzunluğu", "m", 0, 100_000),
                Choice("traffic", "Nəqliyyat axını", LowMediumHigh, required: true),
                Choice("visibility", "Görünmə", LowMediumHigh, required: true),
                Number("parking_spaces", "Avtomobil yerləri", "ədəd", 0, 100_000),
                Number("population_nearby", "Yaxınlıqda əhali", "nəfər", 0, 100_000_000),
            ],
            [
                AnyOf("low_traffic", "Nəqliyyat axını və ya görünmə zəifdir.",
                    Is("traffic", "low", "x", ""), Is("visibility", "low", "x", "")),
                ZoningNotIn("wrong_zoning", "Zonalaşdırma ticarət obyektinə uyğun deyil.", "commercial", "mixed"),
            ]),

            new(19, "roadside", "Restoran və yolkənarı xidmət obyektləri", true,
            [
                Yes("highway_frontage", "Magistral yola çıxışı var", required: true),
                Number("traffic_volume", "Gündəlik nəqliyyat sayı", "maşın/gün", 0, 1_000_000),
                Yes("entrance_exit_possible", "Giriş-çıxış qurmaq mümkündür", required: true),
                WaterSupply(), Sewage(),
                Km("distance_competitors_km", "Ən yaxın rəqibə qədər məsafə"),
            ],
            [
                AnyOf("no_road_access", "Yola birbaşa çıxış yoxdur.",
                    IsNo("highway_frontage", "x", ""), IsNo("entrance_exit_possible", "x", "")),
            ]),

            new(20, "industry", "Sənaye müəssisələri və emalatxanalar", true,
            [
                ZoningInput(), ElectricityKw(), DistanceHousing(),
                Yes("emission_permit", "Tullantı / emissiya icazəsi var"),
                TruckRoad(),
                Yes("rail_access", "Dəmir yoluna çıxış var"),
            ],
            [
                Below("distance_housing_m", 500, "too_close_to_housing", "Yaşayış ərazisinə çox yaxındır (500 m-dən az)."),
                ZoningNotIn("wrong_zoning", "Zonalaşdırma sənaye üçün deyil.", "industrial"),
            ]),

            new(21, "logistics", "Anbar və logistika mərkəzləri", true,
            [
                Km("distance_highway_km", "Magistral yola qədər məsafə", required: true),
                Km("distance_rail_km", "Dəmir yoluna qədər məsafə"),
                Km("distance_port_km", "Limana qədər məsafə"),
                Km("distance_border_km", "Sərhədə qədər məsafə"),
                Slope(),
                Yes("regular_shape", "Sahənin forması düzgündür"),
                Yes("truck_space", "Tır manevri üçün yer var"),
            ],
            [
                Above("distance_highway_km", 20, "far_from_routes", "Əsas yollardan uzaqdır (20 km-dən çox)."),
            ]),

            new(22, "renewable", "Bərpa olunan enerji layihələri", true,
            [
                Choice("energy_kind", "Enerji növü", ["solar", "wind", "both"]),
                Number("solar_kwh_m2_year", "Günəş radiasiyası", "kVt·saat/m²/il", 0, 5000),
                Number("wind_speed_ms", "Orta külək sürəti", "m/san", 0, 50),
                Km("distance_grid_km", "Elektrik şəbəkəsinə / yarımstansiyaya qədər məsafə", required: true),
                Number("grid_capacity_mw", "Şəbəkənin boş gücü", "MVt", 0, 100_000, required: true),
                Slope(), Choice("orientation", "Yamacın istiqaməti", Directions),
                Choice("shading", "Kölgə", ["none", "partial", "heavy"]),
            ],
            [
                Above("distance_grid_km", 10, "far_from_grid", "Elektrik şəbəkəsindən uzaqdır (10 km-dən çox)."),
                Below("grid_capacity_mw", 0.001, "no_grid_capacity", "Şəbəkədə boş güc yoxdur."),
            ]),

            new(23, "sport", "İdman və istirahət obyektləri", true,
            [
                Number("flat_area_ha", "Düz sahə", "ha", 0, 100_000),
                Number("population_nearby", "10 km radiusda əhali", "nəfər", 0, 100_000_000, required: true),
                Utilities(required: false),
                Number("parking_spaces", "Avtomobil yerləri", "ədəd", 0, 100_000),
            ],
            [
                Below("population_nearby", 5000, "far_from_population", "Əhalidən çox uzaqdır (yaxınlıqda 5000 nəfərdən az)."),
            ]),

            new(24, "camping", "Düşərgə və açıq hava turizmi", true,
            [
                Text("landscape", "Təbii mənzərə"),
                Yes("water_body_nearby", "Yaxınlıqda su hövzəsi var"),
                Yes("forest_nearby", "Yaxınlıqda meşə var"),
                Choice("flood_risk", "Daşqın riski", LowMediumHigh, required: true),
                Choice("landslide_risk", "Sürüşmə riski", LowMediumHigh, required: true),
                Text("season", "Mövsüm"),
                Yes("minimal_utilities", "Minimal kommunikasiya var"),
            ],
            [
                AnyOf("natural_hazard", "Təbii təhlükə riski yüksəkdir (daşqın və ya sürüşmə).",
                    Is("flood_risk", "high", "x", ""), Is("landslide_risk", "high", "x", "")),
            ]),

            new(25, "social", "Sosial və ictimai xidmət obyektləri", true,
            [
                ZoningInput(),
                Number("population_served", "Xidmət ediləcək əhali", "nəfər", 0, 100_000_000),
                Yes("public_transport", "İctimai nəqliyyat var", required: true),
                Utilities(),
                Yes("safety_ok", "Ərazi təhlükəsizdir"),
                Km("distance_similar_km", "Oxşar obyektə qədər məsafə"),
            ],
            [
                new DealBreaker("low_accessibility", "Əlçatanlıq zəifdir (ictimai nəqliyyat yoxdur və yaşayış məntəqəsi 10 km-dən uzaqdır).",
                    ["public_transport"], f =>
                    {
                        if (f.Bool("public_transport") is not { } pt) return null;
                        if (pt) return false;
                        return f.SettlementDistanceKm is { } d ? d > 10 : null;
                    }),
            ]),
        ];
    }

    // ---------------------------------------------------------------- lookup

    private static readonly Dictionary<string, string> LegacyNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Bağçılıq"] = "orchards",
        ["İstixana"] = "greenhouse",
        ["Tingçilik"] = "nursery",
        ["Balıqçılıq"] = "fishery",
        ["Qarışıq"] = "mixed",
        ["Meşəçilik"] = "forestry",
        ["Aqroturizm"] = "agrotourism",
    };

    public static LandUseType? ByKey(string? key) =>
        string.IsNullOrWhiteSpace(key) ? null : All.FirstOrDefault(t => t.Key.Equals(key.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>Finds a type by key, by its Azerbaijani name, or by an old short name ("Bağçılıq", "İstixana təsərrüfatı"...).</summary>
    public static LandUseType? Find(string? keyOrName)
    {
        if (string.IsNullOrWhiteSpace(keyOrName)) return null;
        var value = keyOrName.Trim();
        return ByKey(value)
            ?? All.FirstOrDefault(t => t.Name.Equals(value, StringComparison.OrdinalIgnoreCase))
            ?? (LegacyNames.TryGetValue(value, out var key) ? ByKey(key) : null)
            ?? All.FirstOrDefault(t => t.Name.StartsWith(value + " ", StringComparison.OrdinalIgnoreCase));
    }
}
