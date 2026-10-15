namespace QarabagInvestmentPortal.Api.Features.Users;

public enum AuthTokenPurpose
{
    EmailConfirmation,
    PasswordReset
}

public sealed class AuthActionToken
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public AuthTokenPurpose Purpose { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}