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
    public string PasswordHash { get; set; } = string.Empty;
    public DateTimeOffset? EmailConfirmedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public UserProfile? Profile { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}

/// <summary>Optional business details (company, tax number, activity).</summary>
public sealed class UserProfile
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string TaxIdentificationNumber { get; set; } = string.Empty;
    public string BusinessActivity { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
