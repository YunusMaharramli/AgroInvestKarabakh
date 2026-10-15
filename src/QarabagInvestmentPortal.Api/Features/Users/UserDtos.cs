namespace QarabagInvestmentPortal.Api.Features.Users;

using QarabagInvestmentPortal.Api.Features.Rentals;

public sealed record UserDto(
    string Id, string FirstName, string LastName, string Email, string? Phone, UserRole Role,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static UserDto From(User u) => new(u.Id, u.FirstName, u.LastName, u.Email, u.Phone, u.Role, u.CreatedAt, u.UpdatedAt);
}

public sealed record ProfileDto(
    string Id, string UserId, string CompanyName, string TaxIdentificationNumber, string BusinessActivity,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static ProfileDto? From(UserProfile? p) => p is null ? null
        : new(p.Id, p.UserId, p.CompanyName, p.TaxIdentificationNumber, p.BusinessActivity, p.CreatedAt, p.UpdatedAt);
}

/// <summary>Minimal public info about another person (e.g. an investor shown to the land owner).</summary>
public sealed record PersonDto(string Id, string FirstName, string LastName, string Email)
{
    public static PersonDto From(User u) => new(u.Id, u.FirstName, u.LastName, u.Email);
}

public sealed record RegisterRequest(
    string? FirstName, string? LastName, string? Email, string? Phone,
    string? Password, string? ConfirmPassword, string? CompanyName,
    string? TaxIdentificationNumber, string? BusinessActivity,
    string? RecaptchaToken = null,
    ApplicantProfileInput? ApplicantProfile = null);

public sealed record LoginRequest(
    string? Email, string? Password, string? RecaptchaToken = null,
    ApplicantType? ApplicantType = null);

public sealed record UpdateProfileRequest(
    string? FirstName, string? LastName, string? Phone, string? CompanyName, string? TaxIdentificationNumber, string? BusinessActivity);

public sealed record AuthResponse(string Message, string Token, UserDto User, ProfileDto? Profile);
public sealed record MeResponse(UserDto User, ProfileDto? Profile);
public sealed record ProfileUpdatedResponse(string Message, UserDto User, ProfileDto? Profile);
public sealed record MessageResponse(string Message);
public sealed record ChangePasswordRequest(
    string? CurrentPassword,
    string? NewPassword,
    string? ConfirmNewPassword);
