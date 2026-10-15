using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Rentals;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.IntegrationTests;

[Collection(PortalCollection.Name)]
public sealed class SignupApplicantTypeTests(PortalFactory factory)
{
    [Fact]
    public async Task Registration_persists_each_applicant_type_and_foreign_subtype()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var cases = new[]
        {
            (Email: $"individual-{suffix}@test.az", Phone: "+994 50 123 45 67", Type: "INDIVIDUAL", ForeignKind: (string?)null, LegalName: "", Country: "", FullName: "Aysel Məmmədova"),
            (Email: $"entity-{suffix}@test.az", Phone: "+994 12 498 70 00", Type: "LEGAL_ENTITY", ForeignKind: (string?)null, LegalName: "Qarabağ MMC", Country: "Azerbaijan", FullName: "Leyla Əliyeva"),
            (Email: $"foreign-person-{suffix}@test.az", Phone: "+1 202 555 0183", Type: "FOREIGN_APPLICANT", ForeignKind: (string?)"INDIVIDUAL", LegalName: "", Country: "", FullName: "Alex Doe"),
            (Email: $"foreign-entity-{suffix}@test.az", Phone: "+49 30 123456", Type: "FOREIGN_APPLICANT", ForeignKind: (string?)"LEGAL_ENTITY", LegalName: "Example GmbH", Country: "Germany", FullName: "Morgan Example"),
        };

        foreach (var applicant in cases)
        {
            using var client = factory.Anonymous();
            var response = await client.PostAsJsonAsync("/api/auth/register", new
            {
                firstName = applicant.FullName.Split(' ')[0],
                lastName = applicant.FullName[(applicant.FullName.IndexOf(' ') + 1)..],
                email = applicant.Email,
                phone = applicant.Phone,
                password = "Parol-2026",
                confirmPassword = "Parol-2026",
                applicantProfile = new
                {
                    applicantType = applicant.Type,
                    foreignKind = applicant.ForeignKind,
                    fullLegalName = applicant.Type == "INDIVIDUAL" || applicant.ForeignKind == "INDIVIDUAL" ? applicant.FullName : "",
                    citizenship = applicant.ForeignKind == "INDIVIDUAL" ? "Canadian" : "Azerbaijan",
                    countryOfResidence = applicant.ForeignKind == "INDIVIDUAL" ? "Canada" : "Azerbaijan",
                    residenceAddress = "",
                    idDocumentType = "Passport",
                    idDocumentNumber = "TEST-123",
                    fin = "",
                    legalName = applicant.LegalName,
                    legalForm = applicant.LegalName.Length > 0 ? "Limited company" : "",
                    countryOfIncorporation = applicant.Country,
                    registrationIdentifier = applicant.LegalName.Length > 0 ? "REG-123" : "",
                    taxIdentifier = "",
                    registeredAddress = "",
                    contactPhone = applicant.Phone,
                    contactEmail = applicant.Email,
                    contactAddress = "",
                    representativeName = applicant.LegalName.Length > 0 ? applicant.FullName : "",
                    representativePosition = applicant.LegalName.Length > 0 ? "Director" : "",
                    authorityToAct = applicant.LegalName.Length > 0 ? "Company authorization" : "",
                    consentToProcess = true,
                },
            });

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        await using var db = factory.NewDbContext();
        foreach (var applicant in cases)
        {
            var user = await db.Users.SingleAsync(x => x.Email == applicant.Email);
            var profile = await db.RentalApplicantProfiles.SingleAsync(x => x.UserId == user.Id);
            Assert.Equal(UserRole.User, user.Role);
            var expectedType = applicant.Type switch
            {
                "INDIVIDUAL" => ApplicantType.Individual,
                "LEGAL_ENTITY" => ApplicantType.LegalEntity,
                _ => ApplicantType.ForeignApplicant,
            };
            var expectedForeignKind = applicant.ForeignKind switch
            {
                "INDIVIDUAL" => ForeignApplicantKind.Individual,
                "LEGAL_ENTITY" => ForeignApplicantKind.LegalEntity,
                _ => (ForeignApplicantKind?)null,
            };
            Assert.Equal(expectedType, profile.ApplicantType);
            Assert.Equal(expectedForeignKind, profile.ForeignKind);
        }
    }
}
