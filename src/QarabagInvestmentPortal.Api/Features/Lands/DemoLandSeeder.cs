using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Lands;

/// <summary>Creates a repeatable set of clearly marked demo lands for local review and UI development.</summary>
public sealed class DemoLandSeeder(AppDbContext db, TimeProvider clock)
{
    // Settlement anchors only: generated plots nearby are illustrative, not cadastral records.
    internal static readonly (string Key, string Name, string Settlement, double Latitude, double Longitude)[] Places =
    [
        ("aghdam", "Ağdam", "Ağdam", 39.990960, 46.927356),
        ("fuzuli", "Füzuli", "Füzuli", 39.600940, 47.145290),
        ("jabrayil", "Cəbrayıl", "Cəbrayıl", 39.399173, 47.028345),
        ("zangilan", "Zəngilan", "Zəngilan", 39.083705, 46.659881),
        ("gubadli", "Qubadlı", "Qubadlı", 39.344407, 46.581834),
        ("lachin", "Laçın", "Laçın", 39.637420, 46.549770),
        ("kalbajar", "Kəlbəcər", "Kəlbəcər", 40.109842, 46.044460),
        ("khojavend", "Xocavənd", "Xocavənd", 39.794964, 47.111701),
        ("shusha", "Şuşa", "Şuşa", 39.760057, 46.749893),
        ("khankendi", "Xankəndi", "Xankəndi", 39.817700, 46.752800),
        ("khojaly", "Xocalı", "Xocalı", 39.913611, 46.791667),
        ("aghdam", "Ağdam", "Şelli", 39.952907, 46.889593),
        ("fuzuli", "Füzuli", "Yuxarı Veysəlli", 39.736944, 47.090556),
        ("jabrayil", "Cəbrayıl", "Qalacıq", 39.406795, 46.900014),
        ("zangilan", "Zəngilan", "Mincivan", 39.030230, 46.723286),
        ("gubadli", "Qubadlı", "Xanlıq", 39.272222, 46.720833),
        ("lachin", "Laçın", "Zabux", 39.591150, 46.543020),
        ("kalbajar", "Kəlbəcər", "Qaragüney", 40.079084, 46.263393),
        ("khojavend", "Xocavənd", "Hadrut", 39.520027, 47.031904),
        ("khojaly", "Xocalı", "Əsgəran", 39.939096, 46.831607),
        ("aghdam", "Ağdam", "Sarıcalı", 40.001214, 46.985111),
        ("fuzuli", "Füzuli", "Qovşatlı", 39.614091, 47.060557),
        ("lachin", "Laçın", "Kalafalıq", 39.796747, 46.532759),
        ("khojavend", "Xocavənd", "Böyük Tağlar", 39.621306, 46.955524),
        ("shusha", "Şuşa", "Turşsu", 39.687500, 46.643056),
    ];

    private static readonly string[] WaterAccess = ["irrigation_canal", "well", "river", "reservoir", "spring", "mains", "rain_fed", "none_known"];
    private static readonly string[] Roads = ["asphalt", "gravel", "dirt", "none"];
    private static readonly string[] OwnershipForms = ["private", "municipal", "state"];
    private static readonly string[] LegalCategories = ["agricultural", "settlement", "industrial_transport", "protected", "forest", "reserve"];

    public sealed record SeedResult(int LandsCreated, int OpportunitiesCreated, int ExistingLands, int LandsUpdated, int OpportunitiesUpdated);

    public async Task<SeedResult> SeedAsync(CancellationToken ct, int? requestedCount = null)
    {
        var count = requestedCount ?? LandUseCatalog.All.Count * 2;
        if (count < 1 || count > LandUseCatalog.All.Count * 2)
            throw new ArgumentOutOfRangeException(nameof(requestedCount));
        var now = clock.GetUtcNow();
        var adminId = await db.Users.AsNoTracking().Where(u => u.Role == QarabagInvestmentPortal.Api.Features.Users.UserRole.Admin)
            .OrderBy(u => u.CreatedAt).Select(u => u.Id).FirstOrDefaultAsync(ct);
        var landIds = Enumerable.Range(1, count).Select(i => $"demo-land-{i:00}").ToArray();
        var opportunityIds = Enumerable.Range(1, count).Select(i => $"demo-opp-{i:00}").ToArray();
        var existingLands = await db.Lands.Where(l => landIds.Contains(l.Id)).ToDictionaryAsync(l => l.Id, ct);
        var existingOpportunities = await db.Opportunities.Where(o => opportunityIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, ct);
        // Never overwrite a real record that happens to reuse one of the fixture IDs.
        if (existingLands.Values.Any(l => !l.Description.StartsWith("DEMO DATA ONLY.", StringComparison.Ordinal))
            || existingOpportunities.Values.Any(o => !o.Description.StartsWith("DEMO DATA ONLY.", StringComparison.Ordinal)
                || o.LandId != o.Id.Replace("demo-opp-", "demo-land-", StringComparison.Ordinal)))
            throw new InvalidOperationException("A demo ID is used by a non-demo record. No sample data was changed.");

        var landsCreated = 0;
        var opportunitiesCreated = 0;
        var landsUpdated = 0;
        var opportunitiesUpdated = 0;
        for (var index = 0; index < count; index++)
        {
            var type = LandUseCatalog.All[index / 2];
            var variant = index % 2;
            var place = Places[index % Places.Length];
            var id = $"demo-land-{index + 1:00}";
            var createdAt = now.AddDays(-((index * 7) % 240));
            var status = StatusFor(index);
            var verification = status == LandStatus.Approved ? LandVerificationStatus.Verified
                : status is LandStatus.PendingReview or LandStatus.DocumentsRequested ? LandVerificationStatus.EvidencePending
                : LandVerificationStatus.AdminEntered;
            var cadastralUnavailable = index % 10 == 8;
            var area = type.NeedsConstruction ? 0.4 + ((index * 13) % 45) / 10d : 2.5 + ((index * 17) % 950) / 10d;
            var (latitude, longitude) = Location(index, place);
            var legalCategory = LegalCategoryFor(type, index);
            var ownershipForm = OwnershipForms[index % OwnershipForms.Length];
            var placeLabel = place.Settlement == place.Name ? place.Name : $"{place.Settlement}, {place.Name}";
            var title = $"[DEMO] {index + 1:00} · {type.Name} · {placeLabel}";
            var description = $"DEMO DATA ONLY. Nümunə sahə: {type.Name}. {placeLabel}. Kontur və yer təxminidir, real kadastr sərhədi deyil. Torpaq, qiymət, hüquqi və maliyyə məlumatları nümayiş məqsədi daşıyır və real təklif deyil.";
            var amount = 35_000m + ((index * 47_321m) % 1_465_000m);
            var hasEncumbrance = index % 7 == 2;

            if (!existingLands.TryGetValue(id, out var existingLand))
            {
                var land = new Land
                {
                    Id = id,
                    Title = title,
                    Region = place.Key,
                    District = place.Name,
                    Settlement = place.Settlement,
                    Description = description,
                    AreaHectares = Math.Round(area, 2),
                    AgricultureType = type.Name,
                    LandUse = type.Key,
                    Latitude = latitude,
                    Longitude = longitude,
                    IntendedUse = type.Name,
                    EstimatedInvestmentRequirement = amount,
                    ImageUrl = $"/images/site/photo-{(index % 25) + 1:00}.jpg",
                    SoilQuality = (index % 3) switch { 0 => "Humusla zəngin, nümayiş məlumatı", 1 => "Orta münbitlik, nümayiş məlumatı", _ => "Torpaq analizi tələb olunur — nümunə" },
                    WaterSupply = WaterDescription(index),
                    WaterAccess = WaterAccess[index % WaterAccess.Length],
                    OwnershipType = ownershipForm == "private" ? LandOwnershipType.Private : LandOwnershipType.State,
                    CadastralUnavailable = cadastralUnavailable,
                    CadastralNumber = cadastralUnavailable ? null : $"DEMO-{place.Key.ToUpperInvariant()}-{index + 1:000}",
                    LegalCategory = legalCategory,
                    CategoryConvertible = type.NeedsConstruction ? index % 2 == 0 : null,
                    OwnershipForm = ownershipForm,
                    HasEncumbrance = hasEncumbrance,
                    Encumbrances = hasEncumbrance ? "Nümunə: mövcud icarə öhdəliyi" : null,
                    BoundaryGeoJson = DemoParcelGeometry.CreateBoundary(latitude, longitude, area, index),
                    RoadAccessType = Roads[index % Roads.Length],
                    RoadDistanceKm = Math.Round((index % 12) * 0.7, 1),
                    SettlementDistanceKm = Math.Round((index % 9) * 1.4, 1),
                    CurrentUse = (index % 3) switch { 0 => "Hazırda istifadə edilmir", 1 => "Mövsümi istifadə", _ => "Əkin və ya otlaq sahəsi" },
                    Attributes = BuildAttributes(type, variant),
                    Details = BuildDetails(index),
                    Status = status,
                    ReviewNote = status switch
                    {
                        LandStatus.DocumentsRequested => "Nümunə baxış: torpaq və su analizini əlavə edin.",
                        LandStatus.Rejected => "Nümunə rədd səbəbi: hüquqi kateqoriyanı dəqiqləşdirin.",
                        LandStatus.Draft => "Nümunə qaralama: dərcdən əvvəl sahə məlumatlarını tamamlayın.",
                        _ => null,
                    },
                    SubmittedAt = status is LandStatus.PendingReview or LandStatus.DocumentsRequested or LandStatus.Approved or LandStatus.Rejected
                        ? createdAt.AddDays(1) : null,
                    ReviewedAt = status is LandStatus.DocumentsRequested or LandStatus.Rejected or LandStatus.Approved
                        ? createdAt.AddDays(2) : null,
                    ReviewedById = status is LandStatus.DocumentsRequested or LandStatus.Rejected or LandStatus.Approved ? adminId : null,
                    CreatedAt = createdAt,
                    UpdatedAt = createdAt.AddDays(status == LandStatus.DocumentsRequested ? 2 : 0),
                    EntrySource = LandEntrySource.Admin,
                    CreatedById = adminId,
                    UpdatedById = adminId,
                    Verification = verification,
                    VerifiedById = verification == LandVerificationStatus.Verified ? adminId : null,
                    VerifiedAt = verification == LandVerificationStatus.Verified ? createdAt.AddDays(2) : null,
                    VerificationNote = verification == LandVerificationStatus.Verified ? "Nümunə təsdiqi — real hüquqi yoxlama deyil." : null,
                    PublishedAt = status == LandStatus.Approved ? createdAt.AddDays(3) : null,
                    ArchivedAt = status == LandStatus.Archived ? createdAt.AddDays(4) : null,
                };
                db.Lands.Add(land);
                landsCreated++;
            }
            else
            {
                // Refresh geography only, preserving reviews, user changes to area, and every related record.
                var boundary = DemoParcelGeometry.CreateBoundary(latitude, longitude, existingLand.AreaHectares, index);
                var cadastral = existingLand.CadastralNumber?.StartsWith("DEMO-", StringComparison.Ordinal) == true
                    ? $"DEMO-{place.Key.ToUpperInvariant()}-{index + 1:000}" : existingLand.CadastralNumber;
                if (existingLand.Title != title || existingLand.Description != description || existingLand.Region != place.Key
                    || existingLand.District != place.Name || existingLand.Settlement != place.Settlement
                    || existingLand.Latitude != latitude || existingLand.Longitude != longitude
                    || !SameBoundary(existingLand.BoundaryGeoJson, boundary) || existingLand.CadastralNumber != cadastral)
                {
                    existingLand.Title = title;
                    existingLand.Description = description;
                    existingLand.Region = place.Key;
                    existingLand.District = place.Name;
                    existingLand.Settlement = place.Settlement;
                    existingLand.Latitude = latitude;
                    existingLand.Longitude = longitude;
                    existingLand.BoundaryGeoJson = boundary;
                    existingLand.CadastralNumber = cadastral;
                    existingLand.UpdatedAt = now;
                    landsUpdated++;
                }
            }

            var opportunityId = $"demo-opp-{index + 1:00}";
            var opportunityDescription = LandDescription(type, place);
            if (!existingOpportunities.TryGetValue(opportunityId, out var existingOpportunity))
            {
                db.Opportunities.Add(new InvestmentOpportunity
                {
                    Id = opportunityId,
                    LandId = id,
                    Source = OpportunitySource.Admin,
                    Title = title,
                    Description = opportunityDescription,
                    EligibilityConditions = ["DEMO: Investor profile and project plan required."],
                    RequiredDocuments = index % 3 == 0 ? ["Business plan", "Identity or registration document"] : [],
                    OpeningDate = status == LandStatus.Approved && index % 10 == 4 ? now.AddDays(3) : createdAt,
                    ApplicationDeadline = OpportunityDeadline(index, now),
                    Status = OpportunityStatusFor(index),
                    ContactPhone = string.Empty,
                    ClosedAt = OpportunityStatusFor(index) == OpportunityStatus.Closed ? createdAt.AddDays(30) : null,
                    ClosureReason = OpportunityStatusFor(index) == OpportunityStatus.Closed ? "Nümunə: müraciət müddəti başa çatıb." : null,
                    ReviewNote = OpportunityStatusFor(index) == OpportunityStatus.Draft ? "Nümunə: elan dərc üçün yoxlanılır." : null,
                    ReviewedById = status == LandStatus.Approved ? adminId : null,
                    ReviewedAt = status == LandStatus.Approved ? createdAt.AddDays(2) : null,
                    CreatedById = adminId,
                    CreatedAt = createdAt,
                    UpdatedAt = createdAt,
                });
                opportunitiesCreated++;
            }
            else if (existingOpportunity.Title != title || existingOpportunity.Description != opportunityDescription)
            {
                existingOpportunity.Title = title;
                existingOpportunity.Description = opportunityDescription;
                existingOpportunity.UpdatedAt = now;
                opportunitiesUpdated++;
            }
        }

        if (landsCreated + opportunitiesCreated + landsUpdated + opportunitiesUpdated > 0) await db.SaveChangesAsync(ct);
        return new SeedResult(landsCreated, opportunitiesCreated, existingLands.Count, landsUpdated, opportunitiesUpdated);
    }

    private static LandStatus StatusFor(int index) => index switch
    {
        < 25 => LandStatus.Approved,
        < 33 => LandStatus.PendingReview,
        < 39 => LandStatus.DocumentsRequested,
        < 44 => LandStatus.Draft,
        < 47 => LandStatus.Rejected,
        _ => LandStatus.Archived,
    };

    private static OpportunityStatus OpportunityStatusFor(int index) => index switch
    {
        < 20 => OpportunityStatus.Active,
        < 25 => OpportunityStatus.Closed,
        < 44 => OpportunityStatus.Draft,
        < 47 => OpportunityStatus.Rejected,
        _ => OpportunityStatus.Closed,
    };

    private static DateTimeOffset? OpportunityDeadline(int index, DateTimeOffset now) => index switch
    {
        < 3 => now.AddDays(-5),
        < 20 => now.AddDays(14 + index),
        < 25 => now.AddDays(-10),
        _ => null,
    };

    private static string LegalCategoryFor(LandUseType type, int index)
    {
        if (type.NeedsConstruction)
            return (index % 5) switch { 0 => "agricultural", 1 => "settlement", 2 => "industrial_transport", 3 => "protected", _ => "reserve" };
        return index % 13 == 12 ? "protected" : index % 11 == 10 ? "forest" : "agricultural";
    }

    internal static (double Latitude, double Longitude) Location(int index, (string Key, string Name, string Settlement, double Latitude, double Longitude) place)
    {
        var bearing = index * 2.399963229728653;
        var distanceMetres = 1400 + index % 5 * 250;
        return (Math.Round(place.Latitude + Math.Cos(bearing) * distanceMetres / 111320, 6),
            Math.Round(place.Longitude + Math.Sin(bearing) * distanceMetres / (111320 * Math.Cos(place.Latitude * Math.PI / 180)), 6));
    }

    private static bool SameBoundary(string? existing, string expected)
    {
        var currentRing = AdminLandRules.ReadRing(existing);
        var expectedRing = AdminLandRules.ReadRing(expected);
        // jsonb normalizes whitespace and property ordering when stored in PostgreSQL.
        return currentRing is not null && expectedRing is not null && currentRing.SequenceEqual(expectedRing);
    }

    private static string WaterDescription(int index) => (index % 4) switch
    {
        0 => "Suvarma kanalı — nümunə məlumat",
        1 => "Quyu və damcı suvarma — nümunə məlumat",
        2 => "Yağıntı ilə qidalanan sahə — nümunə məlumat",
        _ => "Su mənbəyi dəqiqləşdirilməlidir — nümunə məlumat",
    };

    private static string BuildAttributes(LandUseType type, int variant)
    {
        var values = new Dictionary<string, object?>();
        foreach (var input in type.Inputs)
        {
            values[input.Key] = input.Kind switch
            {
                InputKind.Number => NumberFor(input.Key, input.Min ?? 0, input.Max ?? 100, variant),
                InputKind.YesNo => BooleanFor(input.Key, variant),
                InputKind.Choice => ChoiceFor(type.Key, input.Key, input.Options ?? [], variant),
                _ => $"Nümunə məlumat: {input.Label.ToLowerInvariant()}",
            };
        }
        return JsonSerializer.Serialize(values);
    }

    private static double NumberFor(string key, double min, double max, int variant)
    {
        var standard = key switch
        {
            "slope_pct" => variant == 0 ? 4 : 18,
            "soil_depth_cm" => variant == 0 ? 110 : 35,
            "distance_housing_m" => variant == 0 ? 1800 : 250,
            "distance_other_farms_m" => variant == 0 ? 1800 : 300,
            "water_points" => variant == 0 ? 4 : 0,
            "electricity_kw" => variant == 0 ? 600 : 0,
            "water_flow_ls" => variant == 0 ? 22 : 3,
            "distance_highway_km" => variant == 0 ? 6 : 28,
            "distance_grid_km" => variant == 0 ? 4 : 15,
            "grid_capacity_mw" => variant == 0 ? 25 : 0,
            "population_nearby" => variant == 0 ? 18000 : 1200,
            "population_served" => variant == 0 ? 15000 : 1800,
            "sun_hours" => variant == 0 ? 8 : 4,
            "distance_school_km" or "distance_hospital_km" => variant == 0 ? 2 : 14,
            _ => min + (max - min) * (variant == 0 ? 0.35 : 0.75),
        };
        return Math.Round(Math.Clamp(standard, min, max), 2);
    }

    private static bool BooleanFor(string key, int variant) => key switch
    {
        "gas_access" or "power_stable" or "ventilation_ok" or "water_rights" => variant == 0,
        "protected_area" => false,
        "highway_frontage" or "entrance_exit_possible" or "utilities" or "water_supply" or "sewage" or "electricity" => variant == 0,
        _ => (variant + key.Length) % 2 == 0,
    };

    private static string ChoiceFor(string type, string key, IReadOnlyList<string> options, int variant)
    {
        var preferred = key switch
        {
            "water_source" => variant == 0 ? "river" : "none",
            "water_quality" => variant == 0 ? "good" : "poor",
            "salinity" => variant == 0 ? "none" : "high",
            "degradation" => variant == 0 ? "none" : "heavy",
            "frost_risk" => variant == 0 ? "low" : "high",
            "zoning" => ZoningFor(type, variant),
            _ => options.ElementAtOrDefault(variant == 0 ? 0 : Math.Max(0, options.Count - 1)),
        };
        return preferred is not null && options.Contains(preferred) ? preferred : options.FirstOrDefault() ?? string.Empty;
    }

    private static string ZoningFor(string type, int variant) => variant == 1 ? "agricultural" : type switch
    {
        "residential" => "residential",
        "commercial" or "roadside" => "commercial",
        "industry" or "logistics" or "processing" or "coldStorage" or "machinery" => "industrial",
        "social" => "public",
        "holidayHomes" or "agrotourism" or "sport" or "camping" => "recreational",
        _ => "agricultural",
    };

    private static string BuildDetails(int index) => JsonSerializer.Serialize(new Dictionary<string, object?>
    {
        ["irrigation"] = index % 2 == 0 ? "drip" : "none",
        ["electricity"] = index % 2 == 0,
        ["gas"] = index % 3 == 0,
        ["water_line"] = index % 2 == 0,
        ["road_condition"] = index % 2 == 0 ? "Yaxşı, asfalt yola çıxış" : "Torpaq yol, mövsümi keçid çətinliyi",
        ["buildings"] = index % 4 == 0 ? "Kiçik yardımçı tikili" : "Tikili yoxdur",
        ["fencing"] = index % 3 == 0,
        ["storage"] = index % 2 == 0 ? "Kiçik anbar" : "Anbar tələb olunur",
        ["slope_pct"] = index % 2 == 0 ? 4 : 18,
        ["climate"] = index % 2 == 0 ? "Mülayim kontinental" : "Yüksək dağlıq, soyuq qış",
        ["flood_risk"] = index % 2 == 0 ? "low" : "high",
        ["environment"] = "Demo məlumatdır; yerində yoxlama tələb olunur.",
        ["crop_history"] = index % 2 == 0 ? "Taxıl və yem bitkiləri" : "Əvvəlki istifadə dəqiqləşdirilməlidir",
        ["soil_analysis"] = index % 2 == 0 ? "Nümunə: münbitlik orta-yüksək" : "Nümunə: laborator analiz tələb olunur",
        ["water_analysis"] = index % 2 == 0 ? "Nümunə: keyfiyyət qənaətbəxş" : "Nümunə: analiz aparılmayıb",
        ["last_income"] = 0,
        ["last_profit"] = 0,
    });

    private static string LandDescription(LandUseType type, (string Key, string Name, string Settlement, double Latitude, double Longitude) place) =>
        $"DEMO DATA ONLY. Nümunə investisiya elanı: {place.Name}, {place.Settlement} ətrafında {type.Name} layihəsi. Kontur və yer təxminidir, real kadastr sərhədi deyil. Müraciət etməzdən əvvəl bütün torpaq və layihə məlumatlarını real sənədlərlə yoxlayın.";
}
