using System.Text.RegularExpressions;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Users;

/// <summary>Validated sign-up data (step 1) for one applicant type.</summary>
public sealed record ApplicantRegistration(
    ApplicantType Type,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string Password,
    string CompanyName,
    string Voen,
    string? ForeignTaxNumber);

/// <summary>Validated core eligibility and capacity information required after email confirmation.</summary>
public sealed record ApplicantDetails(
    MaritalStatus? MaritalStatus,
    decimal? IncomeLast6Months,
    bool? HasCredit,
    decimal? MonthlyCreditPayment,
    bool? HasFixedIncome,
    decimal? FixedMonthlyIncome,
    decimal? MinimumFunds,
    string? ResidencyStatus,
    string? Address,
    string? IncomeSource,
    string? Country,
    string? ActivityStatus,
    string? MainActivity,
    DateOnly? ActivityStartDate,
    string? CeoName)
{
    public string? CompanyName { get; init; }
    public string? TaxIdentificationNumber { get; init; }
    public string? ForeignTaxNumber { get; init; }
    public string? LegalForm { get; init; }
    public DateOnly? RegistrationDate { get; init; }
    public string? RepresentativeRole { get; init; }
    public string? IncomeStability { get; init; }
    public decimal? MonthlyNetIncome { get; init; }
    public string? FinancialCurrency { get; init; }
    public string? CitizenshipCountry { get; init; }
    public string? ResidenceCountry { get; init; }
    public decimal? AnnualRevenue { get; init; }
    public decimal? OwnContribution { get; init; }
}

/// <summary>
/// Validates the minimum account signup fields and the mandatory core profile step after email confirmation.
/// <list type="bullet">
/// <item>Every applicant: first name, last name, email, phone and password.</item>
/// <item>Only core eligibility and capacity data is required after confirmation; detailed financial information stays editable in settings.</item>
/// </list>
/// </summary>
public static partial class ApplicantSignupRules
{
    public const int MinPasswordLength = 8;
    public const decimal MaxAmount = 1_000_000_000_000m;

    /// <summary>Foreign individual: living status in Azerbaijan.</summary>
    public static readonly IReadOnlyList<string> ResidencyStatuses =
        ["PERMANENT_RESIDENT", "TEMPORARY_RESIDENT", "NON_RESIDENT"];

    /// <summary>Foreign company: how it operates in Azerbaijan.</summary>
    public static readonly IReadOnlyList<string> ActivityStatuses =
        ["BRANCH", "REPRESENTATIVE_OFFICE", "SUBSIDIARY", "NOT_REGISTERED"];

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^\d{10}$")]
    private static partial Regex VoenPattern();

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9 ./-]{2,39}$")]
    private static partial Regex ForeignTaxPattern();

    [GeneratedRegex(@"^[A-Z]{2}$")]
    private static partial Regex CountryPattern();

    public static bool IsVoen(string? value) => value is not null && VoenPattern().IsMatch(value);

    /// <summary>
    /// Step 1. A request without an applicant type is an individual using the older form
    /// (first and last name sent separately, terms not sent), so existing clients keep working.
    /// </summary>
    public static (ApplicantRegistration? Value, string? Error) ValidateRegistration(RegisterRequest req)
    {
        var type = req.ApplicantType ?? ApplicantType.Individual;
        var legacy = req.ApplicantType is null;

        var email = req.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var password = req.Password ?? string.Empty;

        if (email.Length == 0 || password.Length == 0)
            return Fail("Bütün məcburi sahələr doldurulmalıdır.");
        if (email.Length > 256 || !EmailPattern().IsMatch(email))
            return Fail("E-poçt ünvanı düzgün deyil.");
        if (password != req.ConfirmPassword)
            return Fail("Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.");
        if (password.Length < MinPasswordLength)
            return Fail($"Şifrə ən azı {MinPasswordLength} simvoldan ibarət olmalıdır.");
        if (password.Length > 128)
            return Fail("Şifrə çox uzundur.");
        if (!legacy && req.AcceptTerms != true)
            return Fail("Davam etmək üçün istifadə şərtlərini və məxfilik siyasətini qəbul edin.");

        switch (type)
        {
            case ApplicantType.Individual:
            case ApplicantType.ForeignIndividual:
            case ApplicantType.LegalEntity:
            case ApplicantType.ForeignEntity:
            {
                var (first, last) = SplitName(req);
                if (first.Length == 0 || last.Length == 0)
                    return Fail("Ad və soyadı tam yazın.");
                if (first.Length > 100 || last.Length > 100)
                    return Fail("Ad və ya soyad çox uzundur.");

                if (string.IsNullOrWhiteSpace(req.Phone)) return Fail("Telefon nömrəsini yazın.");
                string? phone;
                if (type is ApplicantType.ForeignIndividual or ApplicantType.ForeignEntity)
                {
                    var digits = new string(req.Phone.Where(char.IsDigit).ToArray());
                    if (!req.Phone.TrimStart().StartsWith('+') || digits.Length is < 8 or > 15)
                        return Fail("Telefon nömrəsini beynəlxalq formatda, ölkə kodu ilə yazın.");
                    phone = "+" + digits;
                }
                else
                {
                    if (!AzerbaijaniPhone.TryNormalize(req.Phone, out var normalized)) return Fail(AzerbaijaniPhone.InvalidMessage);
                    phone = normalized;
                }

                var company = req.CompanyName?.Trim() ?? string.Empty;
                if (company.Length > 200) return Fail("Şirkətin adı çox uzundur.");
                var voen = req.TaxIdentificationNumber?.Trim() ?? string.Empty;
                if (voen.Length > 0 && !IsVoen(voen)) return Fail("VÖEN 10 rəqəmdən ibarət olmalıdır.");
                var foreignTax = req.ForeignTaxNumber?.Trim();
                if (!string.IsNullOrEmpty(foreignTax) && !ForeignTaxPattern().IsMatch(foreignTax))
                    return Fail("Xarici vergi nömrəsini düzgün yazın.");
                if (type is ApplicantType.Individual or ApplicantType.ForeignIndividual)
                {
                    company = string.Empty; voen = string.Empty; foreignTax = null;
                }
                return (new ApplicantRegistration(type, first, last, email, phone, password, company, voen, foreignTax), null);
            }

            default:
                return Fail("Müraciətçi növü düzgün deyil.");
        }
    }

    /// <summary>Last sign-up step: the additional information for the applicant's type.</summary>
    public static (ApplicantDetails? Value, string? Error) ValidateDetails(ApplicantType type, InvestorDetailsRequest req, DateOnly today)
    {
        const string currencyDefault = "AZN";
        string? error = null;
        string? RequiredText(string? input, int max, string label)
        {
            var value = input?.Trim();
            if (string.IsNullOrWhiteSpace(value)) { error ??= $"{label} daxil edilməlidir."; return null; }
            if (value.Length > max) { error ??= $"{label} çox uzundur."; return null; }
            return value;
        }
        decimal? Amount(decimal? value, string label)
        {
            if (value is null) { error ??= $"{label} daxil edilməlidir."; return null; }
            if (value < 0 || value > MaxAmount) { error ??= $"{label} düzgün məbləğ deyil."; return null; }
            return decimal.Round(value.Value, 2);
        }
        DateOnly? RegistrationDate()
        {
            if (req.RegistrationDate is not { } date) { error ??= "Qeydiyyat tarixini daxil edin."; return null; }
            if (date.Year < 1900 || date > today) { error ??= "Qeydiyyat tarixi düzgün deyil."; return null; }
            return date;
        }
        string? Currency()
        {
            var value = (req.FinancialCurrency ?? currencyDefault).Trim().ToUpperInvariant();
            if (value.Length != 3 || value.Any(c => c is < 'A' or > 'Z')) { error ??= "Valyuta kodunu düzgün seçin."; return null; }
            return value;
        }
        string? Stability()
        {
            var value = req.IncomeStability?.Trim().ToUpperInvariant();
            if (value is not ("STABLE" or "SEASONAL" or "IRREGULAR" or "OTHER")) { error ??= "Gəlirin sabitliyini seçin."; return null; }
            return value;
        }

        var funds = Amount(req.MinimumFunds, "Layihəyə qoyula bilən öz vəsaiti");
        switch (type)
        {
            case ApplicantType.Individual:
            case ApplicantType.ForeignIndividual:
            {
                var stability = Stability();
                var income = Amount(req.MonthlyNetIncome, "Aylıq xalis gəlir");
                var currency = Currency();
                string? citizenship = null, residence = null, residency = null;
                if (type == ApplicantType.ForeignIndividual)
                {
                    citizenship = RequiredText(req.CitizenshipCountry, 2, "Vətəndaşlıq ölkəsi")?.ToUpperInvariant();
                    residence = RequiredText(req.ResidenceCountry, 2, "Yaşayış ölkəsi")?.ToUpperInvariant();
                    if (citizenship is null || !CountryPattern().IsMatch(citizenship) || citizenship == "AZ"
                        || residence is null || !CountryPattern().IsMatch(residence)) error ??= "Əcnəbi vətəndaşlığı və yaşayış ölkəsini düzgün seçin.";
                    residency = req.ResidencyStatus?.Trim().ToUpperInvariant();
                    if (residency is null || !ResidencyStatuses.Contains(residency)) error ??= "Azərbaycanda yaşayış statusunu seçin.";
                }
                if (error is not null) return FailDetails(error);
                return (new ApplicantDetails(null, null, null, null, null, null, funds, residency, null, null, null, null, null, null, null)
                {
                    IncomeStability = stability, MonthlyNetIncome = income, FinancialCurrency = currency,
                    CitizenshipCountry = citizenship, ResidenceCountry = residence, OwnContribution = funds,
                }, null);
            }
            case ApplicantType.LegalEntity:
            case ApplicantType.ForeignEntity:
            {
                var companyName = RequiredText(req.CompanyName, 200, "Şirkətin hüquqi adı");
                var legalForm = RequiredText(req.LegalForm, 100, "Hüquqi forma");
                var address = RequiredText(req.Address, 500, "Hüquqi ünvan");
                var activity = RequiredText(req.MainActivity, 1000, "Fəaliyyət sahəsi");
                var representativeRole = RequiredText(req.RepresentativeRole, 100, "Nümayəndənin vəzifəsi");
                var registrationDate = RegistrationDate();
                var annualRevenue = Amount(req.AnnualRevenue, "İllik dövriyyə");
                string? voen = null, foreignTax = null, country = null;
                if (type == ApplicantType.LegalEntity)
                {
                    voen = req.TaxIdentificationNumber?.Trim();
                    if (!IsVoen(voen)) error ??= "VÖEN 10 rəqəmdən ibarət olmalıdır.";
                    if (voen?.Length > 20) error ??= "VÖEN düzgün deyil.";
                }
                else
                {
                    country = req.Country?.Trim().ToUpperInvariant();
                    if (country is null || !CountryPattern().IsMatch(country) || country == "AZ") error ??= "Şirkətin qeydiyyat ölkəsini seçin.";
                    foreignTax = RequiredText(req.ForeignTaxNumber, 40, "Xarici vergi nömrəsi");
                    if (foreignTax is not null && !ForeignTaxPattern().IsMatch(foreignTax)) error ??= "Xarici vergi nömrəsi düzgün deyil.";
                }
                if (error is not null) return FailDetails(error);
                return (new ApplicantDetails(null, null, null, null, null, null, funds, null, address, null,
                    country, null, activity, null, null)
                {
                    CompanyName = companyName, TaxIdentificationNumber = voen, ForeignTaxNumber = foreignTax,
                    LegalForm = legalForm, RegistrationDate = registrationDate, RepresentativeRole = representativeRole,
                    AnnualRevenue = annualRevenue, OwnContribution = funds, FinancialCurrency = "AZN",
                }, null);
            }
            default: return FailDetails("Müraciətçi növü düzgün deyil.");
        }
    }

    /// <summary>Copies validated details onto the profile; fields of other applicant types are cleared.</summary>
    public static void Apply(UserProfile profile, ApplicantDetails d)
    {
        profile.MaritalStatus = d.MaritalStatus;
        profile.IncomeLast6Months = d.IncomeLast6Months;
        profile.HasCredit = d.HasCredit;
        profile.MonthlyCreditPayment = d.MonthlyCreditPayment;
        profile.HasFixedIncome = d.HasFixedIncome;
        profile.FixedMonthlyIncome = d.FixedMonthlyIncome;
        profile.MinimumFunds = d.MinimumFunds;
        profile.OwnContribution = d.OwnContribution;
        profile.ResidencyStatus = d.ResidencyStatus;
        if (d.Address is not null) profile.Address = d.Address;
        if (d.IncomeSource is not null) profile.IncomeSource = d.IncomeSource;
        profile.Country = d.Country;
        profile.ActivityStatus = d.ActivityStatus;
        profile.ActivityStartDate = d.ActivityStartDate;
        profile.CeoName = d.CeoName;
        if (d.CompanyName is not null) profile.CompanyName = d.CompanyName;
        if (d.TaxIdentificationNumber is not null) profile.TaxIdentificationNumber = d.TaxIdentificationNumber;
        if (d.ForeignTaxNumber is not null) profile.ForeignTaxNumber = d.ForeignTaxNumber;
        if (d.LegalForm is not null) profile.LegalForm = d.LegalForm;
        if (d.RegistrationDate is not null) profile.RegistrationDate = d.RegistrationDate;
        if (d.RepresentativeRole is not null) profile.RepresentativeRole = d.RepresentativeRole;
        if (d.AnnualRevenue is not null) profile.AnnualRevenue = d.AnnualRevenue;
        profile.IncomeStability = d.IncomeStability;
        profile.MonthlyNetIncome = d.MonthlyNetIncome;
        profile.FinancialCurrency = d.FinancialCurrency;
        profile.CitizenshipCountry = d.CitizenshipCountry;
        profile.ResidenceCountry = d.ResidenceCountry;
        if (d.MainActivity is not null) profile.BusinessActivity = d.MainActivity;
    }

    private static (string First, string Last) SplitName(RegisterRequest req)
    {
        if (!string.IsNullOrWhiteSpace(req.FullName))
        {
            var parts = req.FullName.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length < 2 ? (parts.FirstOrDefault() ?? string.Empty, string.Empty) : (parts[0], string.Join(' ', parts[1..]));
        }
        return (req.FirstName?.Trim() ?? string.Empty, req.LastName?.Trim() ?? string.Empty);
    }

    private static (ApplicantRegistration?, string?) Fail(string error) => (null, error);
    private static (ApplicantDetails?, string?) FailDetails(string error) => (null, error);
}
