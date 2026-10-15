namespace QarabagInvestmentPortal.Api.Features.Users;

public enum AuthTokenPurpose
{
    EmailConfirmation,
    PasswordReset,

    /// <summary>
    /// Lets the browser that started a sign-up follow it: see whether the email is confirmed yet and
    /// send the additional information afterwards. Used once, when the sign-up is completed.
    /// </summary>
    SignupContinuation
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