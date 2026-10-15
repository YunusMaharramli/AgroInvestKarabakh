namespace QarabagInvestmentPortal.Api.Features.Users;

public enum ConfirmationResendDecision
{
    Send,
    WaitFiveMinutes,
    Blocked
}

public static class ConfirmationResendPolicy
{
    public static ConfirmationResendDecision CheckAndRecord(
        ConfirmationResendState state,
        DateTimeOffset now,
        DateTimeOffset? lastLinkCreatedAt)
    {
        if (state.BlockedUntil is { } blockedUntil && blockedUntil > now)
            return ConfirmationResendDecision.Blocked;

        if (state.BlockedUntil is not null ||
            state.WindowStartedAt is { } start &&
            now >= start.AddHours(24))
        {
            state.SentInWindow = 0;
            state.WindowStartedAt = null;
            state.BlockedUntil = null;
        }

        DateTimeOffset? lastSendAt = lastLinkCreatedAt;

        if (state.SentInWindow > 0 &&
            (lastSendAt is null || state.UpdatedAt > lastSendAt.Value))
        {
            lastSendAt = state.UpdatedAt;
        }

        if (lastSendAt is { } last &&
            now < last.AddMinutes(5))
        {
            return ConfirmationResendDecision.WaitFiveMinutes;
        }

        if (state.SentInWindow >= 3)
        {
            state.BlockedUntil = now.AddHours(24);
            state.UpdatedAt = now;
            return ConfirmationResendDecision.Blocked;
        }

        state.WindowStartedAt ??= now;
        state.SentInWindow++;
        state.UpdatedAt = now;
        return ConfirmationResendDecision.Send;
    }
}