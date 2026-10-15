namespace QarabagInvestmentPortal.Api.Features.Users;

/// <summary>Only two roles. A USER can both list their own land and invest in other people's land.</summary>
public enum UserRole
{
    User,
    Admin,
}

public sealed class User
{
    public string Id { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    /// <summary>Stored in lower case; unique.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Normalised "+994 XX XXX XX XX" when valid. Imported legacy values are kept as they were.</summary>
    public string? Phone { get; set; }

    public UserRole Role { get; set; } = UserRole.User;

    /// <summary>
    /// What kind of investor (applicant) signed up. This is profile data, not an authorization role:
    /// every applicant has the USER role. Null for administrators and for accounts created before applicant types existed.
    /// </summary>
    public ApplicantType? ApplicantType { get; set; }

    /// <summary>Set when the applicant has filled in the additional sign-up information (the last sign-up step).</summary>
    public DateTimeOffset? OnboardingCompletedAt { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public DateTimeOffset? EmailConfirmedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public UserProfile? Profile { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    /// <summary>An applicant who confirmed the email but has not finished the additional information step yet.</summary>
    public bool NeedsOnboarding => Role == UserRole.User && ApplicantType is not null && OnboardingCompletedAt is null;
}

/// <summary>
/// Investor profile: business details plus the additional information collected at sign-up.
/// Which fields are filled depends on the applicant type (see <see cref="ApplicantSignupRules"/>).
/// </summary>
public sealed class UserProfile
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;

    /// <summary>VÖEN (Azerbaijani tax identification number).</summary>
    public string TaxIdentificationNumber { get; set; } = string.Empty;

    /// <summary>Main field of activity (companies).</summary>
    public string BusinessActivity { get; set; } = string.Empty;

    // ---- companies (legal entity, foreign entity)
    public string? ForeignTaxNumber { get; set; }
    /// <summary>ISO 3166-1 alpha-2 country code of a foreign company.</summary>
    public string? Country { get; set; }
    /// <summary>Foreign company's status in Azerbaijan (see <see cref="ApplicantSignupRules.ActivityStatuses"/>).</summary>
    public string? ActivityStatus { get; set; }
    public DateOnly? ActivityStartDate { get; set; }
    public string? CeoName { get; set; }

    // ---- people and companies
    public string? Address { get; set; }

    // ---- individuals (local and foreign)
    public MaritalStatus? MaritalStatus { get; set; }
    /// <summary>Total income over the last 6 months, AZN.</summary>
    public decimal? IncomeLast6Months { get; set; }
    /// <summary>Foreign individual: living status in Azerbaijan (see <see cref="ApplicantSignupRules.ResidencyStatuses"/>).</summary>
    public string? ResidencyStatus { get; set; }
    public string? IncomeSource { get; set; }
    public bool? HasCredit { get; set; }
    public decimal? MonthlyCreditPayment { get; set; }
    public bool? HasFixedIncome { get; set; }
    public decimal? FixedMonthlyIncome { get; set; }

    /// <summary>
    /// Minimum funds the applicant can put in, AZN: for individuals the minimum available for the initial payment,
    /// for the others the minimum (company) funds they would put into a project.
    /// </summary>
    public decimal? MinimumFunds { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
