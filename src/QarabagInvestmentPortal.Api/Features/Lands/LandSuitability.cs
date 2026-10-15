namespace QarabagInvestmentPortal.Api.Features.Lands;

public enum SuitabilityLevel
{
    /// <summary>All deal-breakers checked and passed, required data complete.</summary>
    Suitable,

    /// <summary>No deal-breaker failed, but some data is missing so not everything could be checked.</summary>
    NeedsData,

    /// <summary>At least one deal-breaker failed: unsuitable for this use whatever else is true.</summary>
    Unsuitable,
}

public sealed record SuitabilityIssue(string Code, string Message);

/// <summary>Result of the deal-breaker check. Deal-breakers only warn: the land can still be submitted and the admin decides.</summary>
public sealed record SuitabilityResult(
    SuitabilityLevel Level,
    string? LandUse,
    int Completeness,
    IReadOnlyList<SuitabilityIssue> DealBreakers,
    IReadOnlyList<SuitabilityIssue> Warnings,
    IReadOnlyList<string> Missing,
    IReadOnlyList<string> Unchecked);

/// <summary>
/// Checks a land against its land-use type, in the order the requirements ask for:
/// 1) legal category and whether it can be converted (construction uses 16–25), 2) the type's deal-breakers,
/// 3) completeness of the data. A later score (AI or rules) should only run on lands that are not Unsuitable.
/// </summary>
public static class LandSuitability
{
    /// <summary>Common core required for all 25 types (field name → label).</summary>
    public static readonly IReadOnlyList<(string Field, string Label)> CoreFields =
    [
        ("cadastralNumber", "Kadastr nömrəsi"),
        ("legalCategory", "Torpağın kateqoriyası (təyinatı)"),
        ("ownershipType", "Mülkiyyət növü və yüklülüklər"),
        ("boundary", "Sərhəd koordinatları (poliqon)"),
        ("roadAccessType", "Yola çıxış növü və məsafəsi"),
        ("settlementDistanceKm", "Ən yaxın yaşayış məntəqəsinə qədər məsafə"),
        ("photos", "Fotoşəkillər"),
        ("currentUse", "Hazırkı istifadə"),
    ];

    private static readonly HashSet<string> ProtectedAreaTolerant = ["agrotourism", "camping"];

    public static SuitabilityResult Evaluate(Land land) => Evaluate(LandUseCatalog.Find(land.LandUse) ?? LandUseCatalog.Find(land.AgricultureType), LandFacts.From(land));

    public static SuitabilityResult Evaluate(LandUseType? type, LandFacts f)
    {
        var missing = MissingCore(f);
        if (type is null)
            return new(SuitabilityLevel.NeedsData, null, 0, [], [], ["Fəaliyyət növü", .. missing], []);

        var breakers = new List<SuitabilityIssue>();
        var warnings = new List<SuitabilityIssue>();
        var notChecked = new List<string>();

        // 1) Legal category first.
        if (f.LegalCategory == "protected")
        {
            if (ProtectedAreaTolerant.Contains(type.Key))
                warnings.Add(new("protected_area", "Xüsusi mühafizə olunan ərazidir: yalnız xüsusi icazə ilə mümkündür."));
            else
                breakers.Add(new("protected_area", "Xüsusi mühafizə olunan ərazidə bu fəaliyyət mümkün deyil."));
        }
        if (type.NeedsConstruction && f.LegalCategory == "agricultural")
        {
            if (f.CategoryConvertible == false)
                breakers.Add(new("category_not_convertible",
                    "Kənd təsərrüfatı təyinatlı torpaqda tikinti olmaz və kateqoriyanı dəyişmək mümkün deyil."));
            else if (f.CategoryConvertible is null)
                notChecked.Add("Kateqoriyanın dəyişdirilə bilməsi");
            else
                warnings.Add(new("category_change_needed", "Tikinti üçün torpağın kateqoriyası rəsmi dəyişdirilməlidir."));
        }
        if (f.LegalCategory is null) notChecked.Add("Torpağın kateqoriyası (təyinatı)");

        var completeness = Completeness(type, f);
        if (breakers.Count > 0)
            return new(SuitabilityLevel.Unsuitable, type.Key, completeness, breakers, warnings, missing, notChecked);

        // 2) The type's deal-breakers.
        foreach (var d in type.DealBreakers)
        {
            switch (d.Fails(f))
            {
                case true: breakers.Add(new(d.Code, d.Message)); break;
                case null: notChecked.Add(d.Message.TrimEnd('.')); break;
            }
        }

        // 3) Required inputs of the type.
        missing.AddRange(type.Inputs.Where(i => i.Required && !f.Has(i.Key)).Select(i => i.Label));

        var level = breakers.Count > 0 ? SuitabilityLevel.Unsuitable
            : missing.Count > 0 || notChecked.Count > 0 ? SuitabilityLevel.NeedsData
            : SuitabilityLevel.Suitable;
        return new(level, type.Key, completeness, breakers, warnings, missing, notChecked);
    }

    /// <summary>One line for the admin list and the chatbot.</summary>
    public static string Summary(SuitabilityResult r) => r.Level switch
    {
        SuitabilityLevel.Unsuitable => "Uyğun deyil: " + string.Join("; ", r.DealBreakers.Select(d => d.Message.TrimEnd('.'))),
        SuitabilityLevel.NeedsData => $"Məlumat natamamdır ({r.Completeness}%)",
        _ => "Əsas tələblərə uyğundur",
    };

    private static List<string> MissingCore(LandFacts f)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(f.CadastralNumber)) missing.Add(CoreFields[0].Label);
        if (f.LegalCategory is null) missing.Add(CoreFields[1].Label);
        if (f.OwnershipForm is null) missing.Add(CoreFields[2].Label);
        if (f.BoundaryGeoJson is null) missing.Add(CoreFields[3].Label);
        if (f.RoadAccessType is null) missing.Add(CoreFields[4].Label);
        if (f.SettlementDistanceKm is null) missing.Add(CoreFields[5].Label);
        if (f.PhotoCount == 0) missing.Add(CoreFields[6].Label);
        if (string.IsNullOrWhiteSpace(f.CurrentUse)) missing.Add(CoreFields[7].Label);
        return missing;
    }

    private static int Completeness(LandUseType type, LandFacts f)
    {
        var total = CoreFields.Count + type.Inputs.Count;
        var filled = CoreFields.Count - MissingCore(f).Count + type.Inputs.Count(i => f.Has(i.Key));
        return total == 0 ? 100 : (int)Math.Round(100.0 * filled / total);
    }
}
