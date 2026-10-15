namespace QarabagInvestmentPortal.Api.Features.Users;

/// <summary>
/// Role is the only authorization claim. ApplicantType is investor profile data (null for admins and older accounts);
/// NeedsOnboarding is true until the applicant has sent the additional sign-up information.
/// </summary>
public sealed record UserDto(
    string Id, string FirstName, string LastName, string Email, string? Phone, UserRole Role,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    ApplicantType? ApplicantType = null, bool NeedsOnboarding = false, bool EmailConfirmed = false, bool IsVerified = false)
{
    public static UserDto From(User u) => new(u.Id, u.FirstName, u.LastName, u.Email, u.Phone, u.Role, u.CreatedAt, u.UpdatedAt,
        u.ApplicantType, u.NeedsOnboarding, u.EmailConfirmedAt is not null, u.IsVerified);
}

public sealed record ProfileDto(
    string Id, string UserId, string CompanyName, string TaxIdentificationNumber, string BusinessActivity,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    string? ForeignTaxNumber = null, string? Country = null, string? ActivityStatus = null, DateOnly? ActivityStartDate = null,
    string? CeoName = null, string? Address = null, MaritalStatus? MaritalStatus = null, decimal? IncomeLast6Months = null,
    string? ResidencyStatus = null, string? IncomeSource = null, bool? HasCredit = null, decimal? MonthlyCreditPayment = null,
    bool? HasFixedIncome = null, decimal? FixedMonthlyIncome = null, decimal? MinimumFunds = null,
    string? IncomeStability = null, decimal? MonthlyNetIncome = null, string? IncomePeriod = null,
    string? FinancialCurrency = null, decimal? OutstandingDebt = null, decimal? DebtRepaymentAmount = null,
    string? DebtRepaymentFrequency = null, decimal? AnnualRevenue = null, decimal? NetProfitOrLoss = null,
    decimal? OperatingCashFlow = null, string? FinancialReportingPeriod = null, decimal? LiquidFundsAvailable = null,
    decimal? OwnContribution = null, decimal? PostInvestmentReserve = null, decimal? AdditionalFinancingRequired = null,
    string? OperatingAddress = null, string? LegalForm = null, DateOnly? RegistrationDate = null,
    string? RepresentativeRole = null, int? ExperienceYears = null, string? ExperienceDescription = null,
    string? OperationalCapacity = null, string? PreviousProjects = null, string? CitizenshipCountry = null,
    string? ResidenceCountry = null, DateOnly? DateOfBirth = null, string? IdentityDocumentType = null,
    string? IdentityDocumentNumber = null, IReadOnlyList<InvestorProfileDocumentDto>? Documents = null)
{
    public static ProfileDto? From(UserProfile? p) => p is null ? null
        : new(p.Id, p.UserId, p.CompanyName, p.TaxIdentificationNumber, p.BusinessActivity, p.CreatedAt, p.UpdatedAt,
            p.ForeignTaxNumber, p.Country, p.ActivityStatus, p.ActivityStartDate, p.CeoName, p.Address, p.MaritalStatus,
            p.IncomeLast6Months, p.ResidencyStatus, p.IncomeSource, p.HasCredit, p.MonthlyCreditPayment, p.HasFixedIncome,
            p.FixedMonthlyIncome, p.MinimumFunds, p.IncomeStability, p.MonthlyNetIncome, p.IncomePeriod,
            p.FinancialCurrency, p.OutstandingDebt, p.DebtRepaymentAmount, p.DebtRepaymentFrequency, p.AnnualRevenue,
            p.NetProfitOrLoss, p.OperatingCashFlow, p.FinancialReportingPeriod, p.LiquidFundsAvailable, p.OwnContribution,
            p.PostInvestmentReserve, p.AdditionalFinancingRequired, p.OperatingAddress, p.LegalForm, p.RegistrationDate,
            p.RepresentativeRole, p.ExperienceYears, p.ExperienceDescription, p.OperationalCapacity, p.PreviousProjects,
            p.CitizenshipCountry, p.ResidenceCountry, p.DateOfBirth, p.IdentityDocumentType, p.IdentityDocumentNumber,
            p.Documents.OrderBy(d => d.UploadedAt).Select(InvestorProfileDocumentDto.From).ToList());
}

public sealed record InvestorProfileDocumentDto(string Id, string FileName, string Category, string ContentType, long SizeBytes, DateTimeOffset UploadedAt, string Url)
{
    public static InvestorProfileDocumentDto From(InvestorProfileDocument d) =>
        new(d.Id, d.FileName, d.Category, d.ContentType, d.SizeBytes, d.UploadedAt, $"/api/documents/investor-profiles/{d.Id}");
}

/// <summary>Minimal public info about another person (e.g. an investor shown to the land owner).</summary>
public sealed record PersonDto(string Id, string FirstName, string LastName, string Email)
{
    public static PersonDto From(User u) => new(u.Id, u.FirstName, u.LastName, u.Email);
}

/// <summary>
/// Sign-up, step 1. ApplicantType picks the form: INDIVIDUAL (FullName or First/LastName, Phone), LEGAL_ENTITY
/// (CompanyName, TaxIdentificationNumber = VÖEN), FOREIGN_INDIVIDUAL (FullName), FOREIGN_ENTITY (CompanyName,
/// ForeignTaxNumber, optional VÖEN). Email, Password, ConfirmPassword and AcceptTerms are always needed.
/// </summary>
public sealed record RegisterRequest(
    string? FirstName, string? LastName, string? Email, string? Phone,
    string? Password, string? ConfirmPassword, string? CompanyName,
    string? TaxIdentificationNumber, string? BusinessActivity,
    string? RecaptchaToken = null,
    ApplicantType? ApplicantType = null,
    string? FullName = null,
    string? ForeignTaxNumber = null,
    bool? AcceptTerms = null);

/// <summary>Sign-up: where the browser that started it stands (polled while waiting for the email confirmation).</summary>
public sealed record SignupStatusRequest(string? SignupToken);
public sealed record SignupStatusResponse(string Email, ApplicantType? ApplicantType, bool EmailConfirmed, bool NeedsOnboarding);

/// <summary>
/// Sign-up, last step: additional information. Sent with the sign-up token from step 1, or while signed in
/// (an applicant who left before finishing and logged in later). Only the fields of the applicant's type are read.
/// </summary>
public sealed record InvestorDetailsRequest(
    string? SignupToken = null,
    MaritalStatus? MaritalStatus = null,
    decimal? IncomeLast6Months = null,
    bool? HasCredit = null,
    decimal? MonthlyCreditPayment = null,
    bool? HasFixedIncome = null,
    decimal? FixedMonthlyIncome = null,
    decimal? MinimumFunds = null,
    string? ResidencyStatus = null,
    string? Address = null,
    string? IncomeSource = null,
    string? Country = null,
    string? ActivityStatus = null,
    string? MainActivity = null,
    DateOnly? ActivityStartDate = null,
    string? CeoName = null,
    string? CompanyName = null, string? TaxIdentificationNumber = null, string? ForeignTaxNumber = null,
    string? LegalForm = null, DateOnly? RegistrationDate = null, string? RepresentativeRole = null,
    string? IncomeStability = null, decimal? MonthlyNetIncome = null, string? FinancialCurrency = null,
    string? CitizenshipCountry = null, string? ResidenceCountry = null, decimal? AnnualRevenue = null);

/// <summary>Editable profile data entered by the investor. All fields are optional; applications can request only what they need.</summary>
public sealed record InvestorProfileUpdateRequest(
    string? CompanyName = null, string? TaxIdentificationNumber = null, string? BusinessActivity = null,
    string? ForeignTaxNumber = null, string? Country = null, string? ActivityStatus = null, DateOnly? ActivityStartDate = null,
    string? CeoName = null, string? Address = null, string? OperatingAddress = null, string? LegalForm = null,
    DateOnly? RegistrationDate = null, string? RepresentativeRole = null, string? IncomeSource = null,
    string? IncomeStability = null, decimal? MonthlyNetIncome = null, string? IncomePeriod = null,
    string? FinancialCurrency = null, decimal? OutstandingDebt = null, decimal? DebtRepaymentAmount = null,
    string? DebtRepaymentFrequency = null, decimal? AnnualRevenue = null, decimal? NetProfitOrLoss = null,
    decimal? OperatingCashFlow = null, string? FinancialReportingPeriod = null, decimal? LiquidFundsAvailable = null,
    decimal? OwnContribution = null, decimal? PostInvestmentReserve = null, decimal? AdditionalFinancingRequired = null,
    int? ExperienceYears = null, string? ExperienceDescription = null, string? OperationalCapacity = null,
    string? PreviousProjects = null, string? CitizenshipCountry = null, string? ResidenceCountry = null,
    DateOnly? DateOfBirth = null, string? IdentityDocumentType = null, string? IdentityDocumentNumber = null,
    string? ResidencyStatus = null, bool? HasCredit = null,
    decimal? MonthlyCreditPayment = null, bool? HasFixedIncome = null, decimal? FixedMonthlyIncome = null,
    decimal? MinimumFunds = null,
    string? CurrentPassword = null);

public sealed record LoginRequest(
    string? Email, string? Password, string? RecaptchaToken = null);

public sealed record UpdateProfileRequest(
    string? FirstName, string? LastName, string? Phone, string? CompanyName, string? TaxIdentificationNumber, string? BusinessActivity,
    string? CurrentPassword = null);

public sealed record AuthResponse(string Message, string Token, UserDto User, ProfileDto? Profile);
public sealed record MeResponse(UserDto User, ProfileDto? Profile);
public sealed record ProfileUpdatedResponse(string Message, UserDto User, ProfileDto? Profile);
public sealed record MessageResponse(string Message);
public sealed record ChangePasswordRequest(
    string? CurrentPassword,
    string? NewPassword,
    string? ConfirmNewPassword);
