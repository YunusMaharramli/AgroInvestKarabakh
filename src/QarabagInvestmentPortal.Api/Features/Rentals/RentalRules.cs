using System.Net.Mail;
using System.Text.RegularExpressions;

namespace QarabagInvestmentPortal.Api.Features.Rentals;

public static partial class RentalRules
{
    public static readonly string[] ApplicantScopes = ["ALL", "INDIVIDUAL", "LEGAL_ENTITY", "FOREIGN_INDIVIDUAL", "FOREIGN_LEGAL_ENTITY"];

    [GeneratedRegex("^[+0-9][0-9 ()-]{5,24}$", RegexOptions.CultureInvariant)]
    private static partial Regex PhonePattern();

    public static Dictionary<string, string> Validate(ApplicantProfileInput input)
    {
        var errors = new Dictionary<string, string>();
        static string V(string? value) => value?.Trim() ?? string.Empty;
        void Required(string field, string? value, string label, int max = 300)
        {
            var normalized = V(value);
            if (normalized.Length == 0) errors[field] = $"{label} sahəsini doldurun.";
            else if (normalized.Length > max) errors[field] = $"{label} ən çox {max} simvol ola bilər.";
        }

        if (!Enum.IsDefined(input.ApplicantType))
        {
            errors["applicantType"] = "Müraciətçi növü düzgün deyil.";
        }
        else if (input.ApplicantType == ApplicantType.ForeignApplicant)
        {
            if (input.ForeignKind is null || !Enum.IsDefined(input.ForeignKind.Value)) errors["foreignKind"] = "Xarici müraciətçi növünü seçin.";
            if (input.ForeignKind == ForeignApplicantKind.Individual)
            {
                Required("fullLegalName", input.FullLegalName, "Şəxsiyyət sənədindəki tam ad");
                Required("citizenship", input.Citizenship, "Vətəndaşlıq", 100);
                Required("countryOfResidence", input.CountryOfResidence, "Yaşayış ölkəsi", 100);
            }
            else if (input.ForeignKind == ForeignApplicantKind.LegalEntity)
            {
                Required("legalName", input.LegalName, "Hüquqi şəxsin adı");
                Required("legalForm", input.LegalForm, "Hüquqi forma", 100);
                Required("countryOfIncorporation", input.CountryOfIncorporation, "Qeydiyyat ölkəsi", 100);
                Required("registrationIdentifier", input.RegistrationIdentifier, "Qeydiyyat nömrəsi", 100);
                Required("representativeName", input.RepresentativeName, "Səlahiyyətli nümayəndə");
                Required("representativePosition", input.RepresentativePosition, "Nümayəndənin vəzifəsi", 100);
                Required("authorityToAct", input.AuthorityToAct, "Təmsilçilik səlahiyyətinin təsviri", 500);
            }
        }
        else if (input.ApplicantType == ApplicantType.Individual)
        {
            if (input.ForeignKind is not null) errors["foreignKind"] = "Bu müraciətçi növündə xarici alt növ seçilmir.";
            Required("fullLegalName", input.FullLegalName, "Tam hüquqi ad");
        }
        else if (input.ApplicantType == ApplicantType.LegalEntity)
        {
            if (input.ForeignKind is not null) errors["foreignKind"] = "Bu müraciətçi növündə xarici alt növ seçilmir.";
            Required("legalName", input.LegalName, "Hüquqi şəxsin adı");
            Required("legalForm", input.LegalForm, "Hüquqi forma", 100);
            Required("countryOfIncorporation", input.CountryOfIncorporation, "Qeydiyyat ölkəsi", 100);
            Required("registrationIdentifier", input.RegistrationIdentifier, "Qeydiyyat nömrəsi", 100);
            Required("representativeName", input.RepresentativeName, "Səlahiyyətli nümayəndə");
            Required("representativePosition", input.RepresentativePosition, "Nümayəndənin vəzifəsi", 100);
            Required("authorityToAct", input.AuthorityToAct, "Təmsilçilik səlahiyyətinin təsviri", 500);
        }
        else errors["applicantType"] = "Müraciətçi növü düzgün deyil.";

        Required("contactPhone", input.ContactPhone, "Əlaqə telefonu", 32);
        if (V(input.ContactPhone) is { Length: > 0 } phone && (!PhonePattern().IsMatch(phone) || phone.Count(char.IsDigit) is < 7 or > 15))
            errors["contactPhone"] = "Beynəlxalq telefon nömrəsini yoxlayın.";
        Required("contactEmail", input.ContactEmail, "Əlaqə e-poçtu", 256);
        if (V(input.ContactEmail) is { Length: > 0 } email)
        {
            try { _ = new MailAddress(email); }
            catch (FormatException) { errors["contactEmail"] = "Düzgün e-poçt ünvanı yazın."; }
        }
        foreach (var (field, value, max) in new (string, string?, int)[]
        {
            ("citizenship", input.Citizenship, 100), ("countryOfResidence", input.CountryOfResidence, 100),
            ("residenceAddress", input.ResidenceAddress, 500), ("idDocumentType", input.IdDocumentType, 100),
            ("idDocumentNumber", input.IdDocumentNumber, 100), ("fin", input.Fin, 32), ("legalName", input.LegalName, 300),
            ("legalForm", input.LegalForm, 100), ("countryOfIncorporation", input.CountryOfIncorporation, 100),
            ("registrationIdentifier", input.RegistrationIdentifier, 100), ("taxIdentifier", input.TaxIdentifier, 100),
            ("registeredAddress", input.RegisteredAddress, 500), ("contactAddress", input.ContactAddress, 500),
            ("representativeName", input.RepresentativeName, 300), ("representativePosition", input.RepresentativePosition, 100),
            ("authorityToAct", input.AuthorityToAct, 500),
        })
            if ((value?.Trim().Length ?? 0) > max) errors[field] = $"Bu sahə ən çox {max} simvol ola bilər.";

        if (!input.ConsentToProcess) errors["consentToProcess"] = "Müraciət profili üçün şəxsi məlumatların işlənməsinə razılıq tələb olunur.";
        return errors;
    }

    public static bool MatchesScope(string? scope, ApplicantType type, ForeignApplicantKind? foreignKind)
    {
        var normalized = scope?.Trim().ToUpperInvariant();
        return normalized switch
        {
            "ALL" => true,
            "INDIVIDUAL" => type == ApplicantType.Individual,
            "LEGAL_ENTITY" => type == ApplicantType.LegalEntity,
            "FOREIGN_INDIVIDUAL" => type == ApplicantType.ForeignApplicant && foreignKind == ForeignApplicantKind.Individual,
            "FOREIGN_LEGAL_ENTITY" => type == ApplicantType.ForeignApplicant && foreignKind == ForeignApplicantKind.LegalEntity,
            _ => false,
        };
    }

    public static bool CanTransition(RentalApplicationStatus from, RentalApplicationStatus to) => (from, to) switch
    {
        (RentalApplicationStatus.Draft, RentalApplicationStatus.Submitted) => true,
        (RentalApplicationStatus.Draft, RentalApplicationStatus.Withdrawn) => true,
        (RentalApplicationStatus.Submitted, RentalApplicationStatus.UnderReview or RentalApplicationStatus.Withdrawn) => true,
        (RentalApplicationStatus.UnderReview, RentalApplicationStatus.AdditionalInformationRequired or RentalApplicationStatus.Approved or RentalApplicationStatus.Rejected or RentalApplicationStatus.Withdrawn) => true,
        (RentalApplicationStatus.AdditionalInformationRequired, RentalApplicationStatus.UnderReview or RentalApplicationStatus.Withdrawn) => true,
        _ => false,
    };

    public static Dictionary<string, string> ValidateListing(RentalListingInput input)
    {
        var errors = new Dictionary<string, string>();
        void Required(string field, string? value, int max)
        {
            if (string.IsNullOrWhiteSpace(value)) errors[field] = "Bu sahə tələb olunur.";
            else if (value.Trim().Length > max) errors[field] = $"Ən çox {max} simvol ola bilər.";
        }
        Required("title", input.Title, 200);
        Required("description", input.Description, 4000);
        Required("legalDesignation", input.LegalDesignation, 200);
        Required("region", input.Region, 100);
        Required("address", input.Address, 500);
        Required("permittedUse", input.PermittedUse, 1000);
        Required("authorityBasis", input.AuthorityBasis, 1000);
        Required("authorityReference", input.AuthorityReference, 300);
        if (!Enum.IsDefined(input.PropertyType)) errors["propertyType"] = "Əmlak növünü seçin.";
        if (!Enum.IsDefined(input.OwnerCategory)) errors["ownerCategory"] = "Mülkiyyət kateqoriyasını seçin.";
        if (!Enum.IsDefined(input.Procedure)) errors["procedure"] = "Proseduru seçin.";
        if (input.Area <= 0) errors["area"] = "Sahə sıfırdan böyük olmalıdır.";
        if (input.AreaUnit is not ("ha" or "m2")) errors["areaUnit"] = "Ölçü vahidini seçin.";
        if (input.RentAmount <= 0) errors["rentAmount"] = "İcarə haqqı sıfırdan böyük olmalıdır.";
        if (input.Currency is null || !Regex.IsMatch(input.Currency.Trim(), "^[A-Za-z]{3}$", RegexOptions.CultureInvariant)) errors["currency"] = "Valyutanı 3 hərfli kodla daxil edin.";
        if (input.PaymentPeriod is not ("month" or "year" or "day")) errors["paymentPeriod"] = "Ödəniş dövrünü seçin.";
        if (input.MinimumLeaseMonths is <= 0 || input.MaximumLeaseMonths is <= 0) errors["leaseMonths"] = "İcarə müddəti müsbət aylarla göstərilməlidir.";
        if (input.MinimumLeaseMonths is { } min && input.MaximumLeaseMonths is { } max && min > max) errors["leaseMonths"] = "Minimum müddət maksimumdan çox ola bilməz.";
        if (input.DepositAmount < 0) errors["depositAmount"] = "Depozit mənfi ola bilməz.";
        if (input.AdditionalCharges?.Length > 1000 || input.Infrastructure?.Length > 2000) errors["additionalCharges"] = "Əlavə məlumat çox uzundur.";
        if (input.PhotoUrls is { Length: > 12 }) errors["photoUrls"] = "Ən çox 12 foto ünvanı əlavə etmək olar.";
        if (input.PhotoUrls?.Any(IsInvalidPhotoUrl) == true)
            errors["photoUrls"] = "Foto ünvanı https:// və ya sayt daxilində yol olmalıdır.";
        if (input.EligibilityRules?.Length > 3000 || input.ProcedureNotes?.Length > 3000) errors["eligibilityRules"] = "Mətn çox uzundur.";
        if (input.DocumentRequirements?.Count > 20) errors["documentRequirements"] = "Ən çox 20 sənəd tələbi əlavə etmək olar.";
        if (input.DocumentRequirements?.Any(r => r is null
            || string.IsNullOrWhiteSpace(r.ApplicantScope)
            || !ApplicantScopes.Contains(r.ApplicantScope.Trim().ToUpperInvariant())
            || string.IsNullOrWhiteSpace(r.Kind) || r.Kind.Length > 64
            || string.IsNullOrWhiteSpace(r.Label) || r.Label.Length > 200) == true)
            errors["documentRequirements"] = "Sənəd tələblərindən birinin növü, əhatə dairəsi və ya adı düzgün deyil.";
        var validRules = input.DocumentRequirements?.Where(r => r is not null && !string.IsNullOrWhiteSpace(r.ApplicantScope) && !string.IsNullOrWhiteSpace(r.Kind)) ?? [];
        if (validRules.GroupBy(r => (Scope: r.ApplicantScope.Trim().ToUpperInvariant(), Kind: r.Kind.Trim().ToLowerInvariant())).Any(group => group.Count() > 1))
            errors["documentRequirements"] = "Eyni əhatə dairəsi üçün eyni sənəd növü yalnız bir dəfə qeyd edilə bilər.";
        return errors;
    }

    private static bool IsInvalidPhotoUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        var url = value.Trim();
        if (url.StartsWith('/') && !url.StartsWith("//", StringComparison.Ordinal)) return false;
        return !Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || string.IsNullOrWhiteSpace(uri.Host);
    }

    public static string ApplicantScope(ApplicantType type, ForeignApplicantKind? kind) => type == ApplicantType.ForeignApplicant
        ? kind == ForeignApplicantKind.Individual ? "FOREIGN_INDIVIDUAL" : "FOREIGN_LEGAL_ENTITY"
        : type == ApplicantType.Individual ? "INDIVIDUAL" : "LEGAL_ENTITY";
}
