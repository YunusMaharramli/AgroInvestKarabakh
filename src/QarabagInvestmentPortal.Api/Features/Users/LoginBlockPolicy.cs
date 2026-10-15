namespace QarabagInvestmentPortal.Api.Features.Users;

public static class LoginBlockPolicy
{
    public static TimeSpan? GetRemainingBlock(
        LoginAttemptState state, DateTimeOffset now)
    {
        return state.BlockedUntil is { } until && until > now
            ? until - now
            : null;
    }

    public static TimeSpan? RecordFailure(
        LoginAttemptState state, DateTimeOffset now)
    {
        if (GetRemainingBlock(state, now) is { } remaining)
            return remaining;

        if (state.BlockedUntil is not null)
        {
            state.BlockedUntil = null;
            state.FailedAttempts = 0;
        }

        state.FailedAttempts++;
        state.UpdatedAt = now;

        if (state.FailedAttempts < 3)
            return null;

        var duration = state.CompletedBlocks < 2
            ? TimeSpan.FromMinutes(5)
            : TimeSpan.FromHours(1);

        state.CompletedBlocks = Math.Min(state.CompletedBlocks + 1, 2);
        state.FailedAttempts = 0;
        state.BlockedUntil = now.Add(duration);

        return duration;
    }
}