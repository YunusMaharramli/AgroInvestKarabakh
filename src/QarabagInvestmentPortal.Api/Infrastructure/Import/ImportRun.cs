namespace QarabagInvestmentPortal.Api.Infrastructure.Import;

/// <summary>Marks a one-time import as done so it never runs twice.</summary>
public sealed class ImportRun
{
    public string Id { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public DateTimeOffset ImportedAt { get; set; }
    public string Summary { get; set; } = string.Empty;
}
