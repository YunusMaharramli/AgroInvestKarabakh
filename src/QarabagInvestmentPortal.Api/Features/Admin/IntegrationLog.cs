namespace QarabagInvestmentPortal.Api.Features.Admin;

/// <summary>Log of the simulated EKTİS integration (demo only).</summary>
public sealed class IntegrationLog
{
    public string Id { get; set; } = string.Empty;
    public string IntegrationType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    /// <summary>Raw JSON (stored as jsonb).</summary>
    public string RequestPayload { get; set; } = "{}";

    /// <summary>Raw JSON (stored as jsonb).</summary>
    public string ResponsePayload { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
}
