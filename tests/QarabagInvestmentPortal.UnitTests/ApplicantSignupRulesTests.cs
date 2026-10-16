using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class ApplicantSignupRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 15);

    private static RegisterRequest Req(ApplicantType? type, string? fullName = "Ali Mammadov",
        string? phone = "050 123 45 67", string? company = null, string? voen = null,
        string? foreignTax = null, bool? terms = true, string password = "Parol-2026",
        string? confirm = null) =>
        new(null, null, "Test@Example.az", phone, password, confirm ?? password, company, voen, null,
            ApplicantType: type, FullName: fullName, ForeignTaxNumber: foreignTax, AcceptTerms: terms);

    [Fact]
    public void Individual_registration_requires_name_phone_and_terms()
    {
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual));
        Assert.Null(error);
        Assert.Equal(ApplicantType.Individual, ok!.Type);
        Assert.Equal(("Ali", "Mammadov"), (ok.FirstName, ok.LastName));
        Assert.Equal("test@example.az", ok.Email);
        Assert.Equal("+994 50 123 45 67", ok.Phone);

        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, fullName: "Ali")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, phone: null)).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, phone: "+7 912 345 67 89")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, terms: false)).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, password: "short1")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, confirm: "Other-2026")).Error);
    }

    [Fact]
    public void Requests_without_a_type_keep_the_legacy_individual_form()
    {
        var legacy = new RegisterRequest("Test", "User", "a@b.az", "050 123 45 67",
            "Parol-2026", "Parol-2026", null, null, null);
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(legacy);
        Assert.Null(error);
        Assert.Equal(ApplicantType.Individual, ok!.Type);
        Assert.Equal("User", ok.LastName);
    }

    [Fact]
    public void Legal_entity_registration_retains_company_data_and_requires_contact_name()
    {
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.LegalEntity,
            fullName: "Rashad Aliyev", company: "Aqro MMC", voen: "1234567890"));
        Assert.Null(error);
        Assert.Equal("Rashad", ok!.FirstName);
        Assert.Equal("Aqro MMC", ok.CompanyName);
        Assert.Equal("1234567890", ok.Voen);
        Assert.NotNull(ok.Phone);

        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.LegalEntity, fullName: null)).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.LegalEntity, company: "Aqro MMC", voen: "12345")).Error);
    }

    [Fact]
    public void Foreign_individual_registration_requires_an_international_phone()
    {
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignIndividual,
            fullName: "John Smith", phone: "+49 30 1234 5678"));
        Assert.Null(error);
        Assert.Equal("+493012345678", ok!.Phone);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignIndividual,
            fullName: "John Smith", phone: null)).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignIndividual,
            fullName: "John Smith", phone: "030 1234 5678")).Error);
    }

    [Fact]
    public void Foreign_entity_registration_keeps_its_foreign_tax_number()
    {
        var valid = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignEntity,
            fullName: "Hans Muller", phone: "+49 30 1234 5678", company: "Agro GmbH", foreignTax: "DE-123456789"));
        Assert.Null(valid.Error);
        Assert.Equal("DE-123456789", valid.Value!.ForeignTaxNumber);
        Assert.Equal(string.Empty, valid.Value.Voen);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignEntity,
            fullName: "Hans Muller", phone: "+49 30 1234 5678", foreignTax: "D")).Error);
    }

    [Fact]
    public void Individual_details_use_only_individual_capacity_fields()
    {
        var req = new InvestorDetailsRequest(MinimumFunds: 20000, IncomeStability: "stable",
            MonthlyNetIncome: 1200, HasCredit: true, MonthlyCreditPayment: 500);
        var (details, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.Individual, req, Today);
        Assert.Null(error);
        Assert.Equal("STABLE", details!.IncomeStability);
        Assert.Equal(1200m, details.MonthlyNetIncome);
        Assert.Equal(20000m, details.MinimumFunds);
        Assert.Null(details.HasCredit);
        Assert.Null(details.MonthlyCreditPayment);
        Assert.Null(details.Country);

        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.Individual,
            req with { IncomeStability = null }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.Individual,
            req with { MonthlyNetIncome = null }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.Individual,
            req with { MinimumFunds = -1 }, Today).Error);
    }

    [Fact]
    public void Foreign_individual_details_require_own_countries_and_residency()
    {
        var req = new InvestorDetailsRequest(MinimumFunds: 50000, IncomeStability: "SEASONAL",
            MonthlyNetIncome: 2000, CitizenshipCountry: "US", ResidenceCountry: "AZ",
            ResidencyStatus: "temporary_resident");
        var (details, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignIndividual, req, Today);
        Assert.Null(error);
        Assert.Equal("TEMPORARY_RESIDENT", details!.ResidencyStatus);
        Assert.Equal("US", details.CitizenshipCountry);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignIndividual,
            req with { ResidencyStatus = "TOURIST" }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignIndividual,
            req with { CitizenshipCountry = "AZ" }, Today).Error);
    }

    [Fact]
    public void Foreign_entity_details_require_company_identity_and_finances()
    {
        var req = new InvestorDetailsRequest(CompanyName: "Agro GmbH", LegalForm: "GmbH",
            Address: "Berlin", MainActivity: "Agriculture", RepresentativeRole: "Director",
            RegistrationDate: new DateOnly(2015, 3, 1), AnnualRevenue: 500000, MinimumFunds: 100000,
            Country: "de", ForeignTaxNumber: "DE-123456789");
        var (details, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity, req, Today);
        Assert.Null(error);
        Assert.Equal("DE", details!.Country);
        Assert.Equal("DE-123456789", details.ForeignTaxNumber);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity,
            req with { Country = "AZ" }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity,
            req with { ForeignTaxNumber = null }, Today).Error);
    }

    [Fact]
    public void Legal_entity_details_require_past_registration_and_voen()
    {
        var req = new InvestorDetailsRequest(CompanyName: "Aqro MMC", TaxIdentificationNumber: "1234567890",
            LegalForm: "MMC", Address: "Aghdam", MainActivity: "Crops", RepresentativeRole: "Director",
            RegistrationDate: new DateOnly(2015, 3, 1), AnnualRevenue: 500000, MinimumFunds: 250000);
        Assert.Null(ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity, req, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity,
            req with { RegistrationDate = Today.AddDays(1) }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity,
            req with { TaxIdentificationNumber = "12" }, Today).Error);
    }

    [Fact]
    public void Applying_details_clears_fields_of_other_applicant_types()
    {
        var profile = new UserProfile { HasFixedIncome = true, FixedMonthlyIncome = 999, Country = "TR" };
        var req = new InvestorDetailsRequest(CompanyName: "Aqro MMC", TaxIdentificationNumber: "1234567890",
            LegalForm: "MMC", Address: "Shusha", MainActivity: "Orchards", RepresentativeRole: "Director",
            RegistrationDate: new DateOnly(2020, 1, 1), AnnualRevenue: 500000, MinimumFunds: 1);
        var (details, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity, req, Today);
        Assert.Null(error);
        ApplicantSignupRules.Apply(profile, details!);
        Assert.Null(profile.FixedMonthlyIncome);
        Assert.Null(profile.Country);
        Assert.Equal("Orchards", profile.BusinessActivity);
    }
}
