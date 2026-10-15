namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class LoginAttemptState
{
    public string IpAddress { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int FailedAttempts { get; set; }
    public int CompletedBlocks { get; set; }
    public DateTimeOffset? BlockedUntil { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}