namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class ConfirmationResendState
{
    public string IpAddress { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int SentInWindow { get; set; }
    public DateTimeOffset? WindowStartedAt { get; set; }
    public DateTimeOffset? BlockedUntil { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}