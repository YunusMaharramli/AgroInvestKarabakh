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

/// <summary>Validated additional information (last sign-up step). Only the fields of the applicant's type are set.</summary>
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
    string? CeoName);

/// <summary>
/// What each applicant type fills in, and the checks. Pure functions, so the rules are unit-tested on their own.
/// <list type="bullet">
/// <item>Individual: name, email, phone, password → marital status, last 6 months income, credit (+ monthly payment),
/// fixed income (+ amount), minimum funds for the initial payment.</item>
/// <item>Legal entity: company name, company email, VÖEN, password → address, field of activity, activity start date,
/// CEO, minimum company funds for a project.</item>
/// <item>Foreign individual: name, email, password → living status in Azerbaijan, address, income source,
/// credit (+ monthly payment), minimum funds for a project.</item>
/// <item>Foreign entity: company name, foreign tax number, VÖEN in Azerbaijan (if any), company email, password →
/// country, status in Azerbaijan, address, main field of activity, CEO.</item>
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
            {
                var (first, last) = SplitName(req);
                if (first.Length == 0 || last.Length == 0)
                    return Fail("Ad və soyadı tam yazın.");
                if (first.Length > 100 || last.Length > 100)
                    return Fail("Ad və ya soyad çox uzundur.");

                string? phone = null;
                if (type == ApplicantType.Individual)
                {
                    if (string.IsNullOrWhiteSpace(req.Phone))
                        return Fail("Bütün məcburi sahələr doldurulmalıdır.");
                    if (!AzerbaijaniPhone.TryNormalize(req.Phone, out var normalized))
                        return Fail(AzerbaijaniPhone.InvalidMessage);
                    phone = normalized;
                }
                return (new ApplicantRegistration(type, first, last, email, phone, password, string.Empty, string.Empty, null), null);
            }

            case ApplicantType.LegalEntity:
            case ApplicantType.ForeignEntity:
            {
                var company = req.CompanyName?.Trim() ?? string.Empty;
                if (company.Length < 2)
                    return Fail("Şirkətin adını yazın.");
                if (company.Length > 200)
                    return Fail("Şirkətin adı çox uzundur.");

                var voen = req.TaxIdentificationNumber?.Trim() ?? string.Empty;
                string? foreignTax = null;
                if (type == ApplicantType.LegalEntity)
                {
                    if (!IsVoen(voen))
                        return Fail("VÖEN 10 rəqəmdən ibarət olmalıdır.");
                }
                else
                {
                    foreignTax = req.ForeignTaxNumber?.Trim() ?? string.Empty;
                    if (!ForeignTaxPattern().IsMatch(foreignTax))
                        return Fail("Xarici vergi nömrəsini düzgün yazın (3–40 simvol: hərf, rəqəm, '-', '/', '.').");
                    if (voen.Length > 0 && !IsVoen(voen))
                        return Fail("Azərbaycandakı VÖEN 10 rəqəmdən ibarət olmalıdır (yoxdursa boş saxlayın).");
                }

                // The account's display name is the company name.
                return (new ApplicantRegistration(type, company.Length > 100 ? company[..100] : company, string.Empty, email,
                    null, password, company, voen, foreignTax), null);
            }

            default:
                return Fail("Müraciətçi növü düzgün deyil.");
        }
    }

    /// <summary>Last sign-up step: the additional information for the applicant's type.</summary>
    public static (ApplicantDetails? Value, string? Error) ValidateDetails(ApplicantType type, InvestorDetailsRequest req, DateOnly today)
    {
        string? Text(string? v, int max) => string.IsNullOrWhiteSpace(v) ? null : v.Trim().Length > max ? v.Trim()[..max] : v.Trim();

        var address = Text(req.Address, 500);
        var ceo = Text(req.CeoName, 200);
        var activity = Text(req.MainActivity, 1000);

        string? amountError = null;
        decimal? Amount(decimal? v, string label, bool required, bool positive = false)
        {
            if (v is null) { if (required) amountError ??= $"{label} daxil edilməlidir."; return null; }
            if (v < 0 || (positive && v == 0)) { amountError ??= $"{label} müsbət məbləğ olmalıdır."; return null; }
            if (v > MaxAmount) { amountError ??= $"{label} çox böyükdür."; return null; }
            return decimal.Round(v.Value, 2);
        }

        switch (type)
        {
            case ApplicantType.Individual:
            {
                if (req.MaritalStatus is null) return FailDetails("Ailə vəziyyətini seçin.");
                if (req.HasCredit is null) return FailDetails("Kredit mövcudluğunu seçin.");
                if (req.HasFixedIncome is null) return FailDetails("Sabit gəlirin mövcudluğunu seçin.");
                var income = Amount(req.IncomeLast6Months, "Son 6 ay üzrə gəlir", required: true);
                var payment = req.HasCredit == true ? Amount(req.MonthlyCreditPayment, "Mövcud kreditin aylıq ödənişi", required: true, positive: true) : null;
                var fixedIncome = req.HasFixedIncome == true ? Amount(req.FixedMonthlyIncome, "Sabit gəlirin aylıq məbləği", required: true, positive: true) : null;
                var funds = Amount(req.MinimumFunds, "İlkin ödəniş üçün minimum vəsait", required: true);
                if (amountError is not null) return FailDetails(amountError);
                return (new ApplicantDetails(req.MaritalStatus, income, req.HasCredit, payment, req.HasFixedIncome, fixedIncome, funds,
                    null, null, null, null, null, null, null, null), null);
            }

            case ApplicantType.ForeignIndividual:
            {
                var residency = req.ResidencyStatus?.Trim().ToUpperInvariant();
                if (residency is null || !ResidencyStatuses.Contains(residency)) return FailDetails("Azərbaycanda yaşayış statusunu seçin.");
                if (address is null) return FailDetails("Ünvanı yazın.");
                var source = Text(req.IncomeSource, 500);
                if (source is null) return FailDetails("Gəlir mənbəyini yazın.");
                if (req.HasCredit is null) return FailDetails("Mövcud kreditin olub-olmadığını seçin.");
                var payment = req.HasCredit == true ? Amount(req.MonthlyCreditPayment, "Mövcud kreditin aylıq ödənişi", required: true, positive: true) : null;
                var funds = Amount(req.MinimumFunds, "Layihəyə qoyacağınız minimum vəsait", required: true);
                if (amountError is not null) return FailDetails(amountError);
                return (new ApplicantDetails(null, null, req.HasCredit, payment, null, null, funds,
                    residency, address, source, null, null, null, null, null), null);
            }

            case ApplicantType.ForeignEntity:
            {
                var country = req.Country?.Trim().ToUpperInvariant();
                if (country is null || !CountryPattern().IsMatch(country) || country == "AZ") return FailDetails("Şirkətin ölkəsini siyahıdan seçin.");
                var status = req.ActivityStatus?.Trim().ToUpperInvariant();
                if (status is null || !ActivityStatuses.Contains(status)) return FailDetails("Fəaliyyət statusunu seçin.");
                if (address is null) return FailDetails("Ünvanı yazın.");
                if (activity is null) return FailDetails("Əsas fəaliyyət sahəsini yazın.");
                if (ceo is null) return FailDetails("Şirkətin rəhbərini (CEO) yazın.");
                return (new ApplicantDetails(null, null, null, null, null, null, null,
                    null, address, null, country, status, activity, null, ceo), null);
            }

            case ApplicantType.LegalEntity:
            {
                if (address is null) return FailDetails("Ünvanı yazın.");
                if (activity is null) return FailDetails("Fəaliyyət sahəsini yazın.");
                if (req.ActivityStartDate is not { } started) return FailDetails("Fəaliyyətə başlama tarixini seçin.");
                if (started > today || started.Year < 1900) return FailDetails("Fəaliyyətə başlama tarixi düzgün deyil.");
                if (ceo is null) return FailDetails("Şirkətin rəhbərini (CEO) yazın.");
                var funds = Amount(req.MinimumFunds, "Layihəyə ayrılacaq minimum şirkət vəsaiti", required: true);
                if (amountError is not null) return FailDetails(amountError);
                return (new ApplicantDetails(null, null, null, null, null, null, funds,
                    null, address, null, null, null, activity, started, ceo), null);
            }

            default:
                return FailDetails("Müraciətçi növü düzgün deyil.");
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
        profile.ResidencyStatus = d.ResidencyStatus;
        profile.Address = d.Address;
        profile.IncomeSource = d.IncomeSource;
        profile.Country = d.Country;
        profile.ActivityStatus = d.ActivityStatus;
        profile.ActivityStartDate = d.ActivityStartDate;
        profile.CeoName = d.CeoName;
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
