using QarabagInvestmentPortal.Api.Features.Rentals;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class RentalRulesTests
{
    [Theory]
    [MemberData(nameof(ValidApplicantProfiles))]
    public void Validates_each_applicant_subtype_without_requiring_local_identifiers(ApplicantProfileInput profile)
    {
        Assert.Empty(RentalRules.Validate(profile));
    }

    public static IEnumerable<object[]> ValidApplicantProfiles =>
    [
        [Profile(ApplicantType.Individual, null, fullName: "Aysel Məmmədova", phone: "+1 202 555 0183")],
        [Profile(ApplicantType.LegalEntity, null, legalName: "Qarabağ MMC", phone: "+994 50 123 45 67")],
        [Profile(ApplicantType.ForeignApplicant, ForeignApplicantKind.Individual, fullName: "Alex Doe", citizenship: "Canadian", residenceCountry: "Canada", phone: "+44 20 7946 0958")],
        [Profile(ApplicantType.ForeignApplicant, ForeignApplicantKind.LegalEntity, legalName: "Example GmbH", countryOfIncorporation: "Germany", phone: "+49 30 123456")],
    ];

    [Fact]
    public void Fins_and_local_tax_identifiers_are_optional_and_contact_phone_accepts_international_format()
    {
        var individual = Profile(ApplicantType.Individual, null, fullName: "Aysel Məmmədova", phone: "+81 3 1234 5678");
        var entity = Profile(ApplicantType.LegalEntity, null, legalName: "Qarabağ MMC", phone: "+971 4 123 4567");

        Assert.Empty(RentalRules.Validate(individual));
        Assert.Empty(RentalRules.Validate(entity));
        Assert.Equal(string.Empty, individual.Fin);
        Assert.Equal(string.Empty, entity.TaxIdentifier);
    }

    [Theory]
    [InlineData("not a phone")]
    [InlineData("12345")]
    [InlineData("+994 50 abc 12 34")]
    public void Rejects_invalid_international_phone_numbers(string phone)
    {
        var errors = RentalRules.Validate(Profile(ApplicantType.Individual, null, fullName: "Aysel Məmmədova", phone: phone));
        Assert.Contains("contactPhone", errors.Keys);
    }

    [Fact]
    public void Requires_foreign_subtype_and_required_identity_and_representation_fields()
    {
        var noSubtype = Profile(ApplicantType.ForeignApplicant, null, fullName: "", phone: "+1 202 555 0183");
        Assert.Contains("foreignKind", RentalRules.Validate(noSubtype).Keys);

        var foreignPerson = Profile(ApplicantType.ForeignApplicant, ForeignApplicantKind.Individual, fullName: "", citizenship: "", residenceCountry: "", phone: "+1 202 555 0183");
        var personErrors = RentalRules.Validate(foreignPerson);
        Assert.Contains("fullLegalName", personErrors.Keys);
        Assert.Contains("citizenship", personErrors.Keys);
        Assert.Contains("countryOfResidence", personErrors.Keys);

        var foreignCompany = Profile(ApplicantType.ForeignApplicant, ForeignApplicantKind.LegalEntity, legalName: "", countryOfIncorporation: "", phone: "+49 30 123456") with
        {
            RepresentativeName = "", AuthorityToAct = "",
        };
        var companyErrors = RentalRules.Validate(foreignCompany);
        Assert.Contains("legalName", companyErrors.Keys);
        Assert.Contains("countryOfIncorporation", companyErrors.Keys);
        Assert.Contains("representativeName", companyErrors.Keys);
        Assert.Contains("authorityToAct", companyErrors.Keys);
    }

    [Fact]
    public void Rejects_unknown_applicant_enums_and_unsafe_listing_photo_urls()
    {
        var invalidApplicant = Profile((ApplicantType)99, null, fullName: "Applicant");
        Assert.Contains("applicantType", RentalRules.Validate(invalidApplicant).Keys);

        var invalidListing = Listing() with
        {
            PropertyType = (RentalPropertyType)99,
            PhotoUrls = ["http://images.example.test/photo.jpg", "//external.example.test/photo.jpg"],
            DocumentRequirements = [new RentalRequirementInput(null!, "identity", "Identity document")],
        };
        var errors = RentalRules.ValidateListing(invalidListing);
        Assert.Contains("propertyType", errors.Keys);
        Assert.Contains("photoUrls", errors.Keys);
        Assert.Contains("documentRequirements", errors.Keys);
    }

    [Theory]
    [InlineData("ALL", ApplicantType.Individual, null, true)]
    [InlineData("INDIVIDUAL", ApplicantType.Individual, null, true)]
    [InlineData("LEGAL_ENTITY", ApplicantType.LegalEntity, null, true)]
    [InlineData("FOREIGN_INDIVIDUAL", ApplicantType.ForeignApplicant, ForeignApplicantKind.Individual, true)]
    [InlineData("FOREIGN_LEGAL_ENTITY", ApplicantType.ForeignApplicant, ForeignApplicantKind.LegalEntity, true)]
    [InlineData("FOREIGN_INDIVIDUAL", ApplicantType.ForeignApplicant, ForeignApplicantKind.LegalEntity, false)]
    [InlineData("LEGAL_ENTITY", ApplicantType.ForeignApplicant, ForeignApplicantKind.LegalEntity, false)]
    public void Matches_listing_document_scopes_by_applicant_subtype(string scope, ApplicantType type, ForeignApplicantKind? kind, bool expected) =>
        Assert.Equal(expected, RentalRules.MatchesScope(scope, type, kind));

    [Fact]
    public void Allows_only_the_defined_application_status_transitions()
    {
        Assert.True(RentalRules.CanTransition(RentalApplicationStatus.Draft, RentalApplicationStatus.Submitted));
        Assert.True(RentalRules.CanTransition(RentalApplicationStatus.UnderReview, RentalApplicationStatus.Approved));
        Assert.True(RentalRules.CanTransition(RentalApplicationStatus.AdditionalInformationRequired, RentalApplicationStatus.UnderReview));
        Assert.False(RentalRules.CanTransition(RentalApplicationStatus.Submitted, RentalApplicationStatus.Approved));
        Assert.False(RentalRules.CanTransition(RentalApplicationStatus.Approved, RentalApplicationStatus.Rejected));
        Assert.False(RentalRules.CanTransition(RentalApplicationStatus.Rejected, RentalApplicationStatus.UnderReview));
    }

    private static ApplicantProfileInput Profile(
        ApplicantType type,
        ForeignApplicantKind? foreignKind,
        string fullName = "",
        string citizenship = "",
        string residenceCountry = "",
        string legalName = "",
        string countryOfIncorporation = "Azerbaijan",
        string phone = "+994 50 123 45 67") => new(
            type, foreignKind, fullName, citizenship, residenceCountry, "", "", "", "", legalName,
            "Limited company", countryOfIncorporation, "REG-123", "", "", phone, "applicant@example.test", "",
            "Leyla Əliyeva", "Director", "Company authorization", true);

    private static RentalListingInput Listing() => new(
        RentalPropertyType.Land, "Test listing", "Test description", RentalOwnerCategory.Private,
        "Agricultural", "Ağdam", "Ağdam", 10, "ha", "Crop production", 100, "AZN", "month", 6, 36,
        0, "", "Water", [], "Authority basis", "REF-1", true, RentalProcedure.Direct, "", "", "",
        [new RentalRequirementInput("ALL", "identity", "Identity document")]);
}
