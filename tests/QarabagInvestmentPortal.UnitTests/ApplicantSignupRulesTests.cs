using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class ApplicantSignupRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 15);

    private static RegisterRequest Req(ApplicantType? type, string? fullName = "Əli Məmmədov", string? phone = "050 123 45 67",
        string? company = null, string? voen = null, string? foreignTax = null, bool? terms = true, string password = "Parol-2026",
        string? confirm = null) =>
        new(null, null, "Test@Example.az", phone, password, confirm ?? password, company, voen, null,
            ApplicantType: type, FullName: fullName, ForeignTaxNumber: foreignTax, AcceptTerms: terms);

    [Fact]
    public void Individual_needs_full_name_phone_and_terms()
    {
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual));
        Assert.Null(error);
        Assert.Equal(ApplicantType.Individual, ok!.Type);
        Assert.Equal(("Əli", "Məmmədov"), (ok.FirstName, ok.LastName));
        Assert.Equal("test@example.az", ok.Email);
        Assert.Equal("+994 50 123 45 67", ok.Phone);

        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, fullName: "Əli")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, phone: null)).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, phone: "+7 912 345 67 89")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, terms: false)).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, password: "short1")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.Individual, confirm: "Başqa-2026")).Error);
    }

    [Fact]
    public void Requests_without_a_type_keep_the_older_individual_form()
    {
        var legacy = new RegisterRequest("Test", "İstifadəçi", "a@b.az", "050 123 45 67", "Parol-2026", "Parol-2026", null, null, null);
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(legacy);
        Assert.Null(error);
        Assert.Equal(ApplicantType.Individual, ok!.Type);
        Assert.Equal("İstifadəçi", ok.LastName);
    }

    [Fact]
    public void Legal_entity_needs_company_name_and_a_10_digit_voen()
    {
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.LegalEntity, fullName: null, phone: null, company: "Aqro MMC", voen: "1234567890"));
        Assert.Null(error);
        Assert.Equal("Aqro MMC", ok!.CompanyName);
        Assert.Equal("Aqro MMC", ok.FirstName);
        Assert.Equal("1234567890", ok.Voen);
        Assert.Null(ok.Phone);

        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.LegalEntity, company: "Aqro MMC", voen: "12345")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.LegalEntity, company: "", voen: "1234567890")).Error);
    }

    [Fact]
    public void Foreign_individual_needs_no_phone()
    {
        var (ok, error) = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignIndividual, fullName: "John Smith", phone: null));
        Assert.Null(error);
        Assert.Equal(ApplicantType.ForeignIndividual, ok!.Type);
        Assert.Null(ok.Phone);
    }

    [Fact]
    public void Foreign_entity_needs_a_foreign_tax_number_and_the_voen_is_optional()
    {
        var withoutVoen = ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignEntity, company: "Agro GmbH", foreignTax: "DE-123456789"));
        Assert.Null(withoutVoen.Error);
        Assert.Equal("DE-123456789", withoutVoen.Value!.ForeignTaxNumber);
        Assert.Equal(string.Empty, withoutVoen.Value.Voen);

        Assert.Null(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignEntity, company: "Agro GmbH", foreignTax: "DE123456789", voen: "9876543210")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignEntity, company: "Agro GmbH", foreignTax: "")).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateRegistration(Req(ApplicantType.ForeignEntity, company: "Agro GmbH", foreignTax: "DE1", voen: "12")).Error);
    }

    [Fact]
    public void Individual_details_open_the_credit_and_fixed_income_amounts_only_when_answered_yes()
    {
        var noCredit = new InvestorDetailsRequest(MaritalStatus: MaritalStatus.Single, IncomeLast6Months: 12000, HasCredit: false,
            MonthlyCreditPayment: 500, HasFixedIncome: false, FixedMonthlyIncome: 900, MinimumFunds: 20000);
        var (d, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.Individual, noCredit, Today);
        Assert.Null(error);
        Assert.Null(d!.MonthlyCreditPayment);   // ignored when there is no credit
        Assert.Null(d.FixedMonthlyIncome);      // ignored when there is no fixed income

        var withCredit = noCredit with { HasCredit = true, MonthlyCreditPayment = null };
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.Individual, withCredit, Today).Error);
        var withFixed = noCredit with { HasFixedIncome = true, FixedMonthlyIncome = 1500 };
        Assert.Equal(1500, ApplicantSignupRules.ValidateDetails(ApplicantType.Individual, withFixed, Today).Value!.FixedMonthlyIncome);

        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.Individual, noCredit with { MaritalStatus = null }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.Individual, noCredit with { MinimumFunds = -1 }, Today).Error);
    }

    [Fact]
    public void Foreign_individual_details()
    {
        var req = new InvestorDetailsRequest(ResidencyStatus: "temporary_resident", Address: "Bakı, Nizami küç. 1", IncomeSource: "Maaş",
            HasCredit: true, MonthlyCreditPayment: 300, MinimumFunds: 50000);
        var (d, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignIndividual, req, Today);
        Assert.Null(error);
        Assert.Equal("TEMPORARY_RESIDENT", d!.ResidencyStatus);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignIndividual, req with { ResidencyStatus = "TOURIST" }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignIndividual, req with { IncomeSource = " " }, Today).Error);
    }

    [Fact]
    public void Foreign_entity_details_need_a_country_from_the_list()
    {
        var req = new InvestorDetailsRequest(Country: "de", ActivityStatus: "BRANCH", Address: "Berlin", MainActivity: "Taxılçılıq", CeoName: "Hans Müller");
        var (d, error) = ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity, req, Today);
        Assert.Null(error);
        Assert.Equal("DE", d!.Country);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity, req with { Country = "Germany" }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity, req with { Country = "AZ" }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.ForeignEntity, req with { CeoName = null }, Today).Error);
    }

    [Fact]
    public void Legal_entity_details_need_a_past_start_date()
    {
        var req = new InvestorDetailsRequest(Address: "Ağdam", MainActivity: "Pambıqçılıq", ActivityStartDate: new DateOnly(2015, 3, 1),
            CeoName: "Rəşad Əliyev", MinimumFunds: 250000);
        Assert.Null(ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity, req, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity, req with { ActivityStartDate = Today.AddDays(1) }, Today).Error);
        Assert.NotNull(ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity, req with { MinimumFunds = null }, Today).Error);
    }

    [Fact]
    public void Applying_details_clears_fields_of_other_types()
    {
        var profile = new UserProfile { HasFixedIncome = true, FixedMonthlyIncome = 999, Country = "TR" };
        var (d, _) = ApplicantSignupRules.ValidateDetails(ApplicantType.LegalEntity,
            new InvestorDetailsRequest(Address: "Şuşa", MainActivity: "Bağçılıq", ActivityStartDate: new DateOnly(2020, 1, 1), CeoName: "X Y", MinimumFunds: 1), Today);
        ApplicantSignupRules.Apply(profile, d!);
        Assert.Null(profile.FixedMonthlyIncome);
        Assert.Null(profile.Country);
        Assert.Equal("Bağçılıq", profile.BusinessActivity);
    }
}
