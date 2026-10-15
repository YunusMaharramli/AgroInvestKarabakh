using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Features.Proposals;

public enum ProposalStatus
{
    Open,
    Selected,
    NotSelected,
    Rejected,
    Cancelled,
}

/// <summary>An investor's offer for an investment opportunity.</summary>
public sealed class Proposal
{
    public string Id { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public string OpportunityId { get; set; } = string.Empty;
    public InvestmentOpportunity? Opportunity { get; set; }
    public string InvestorId { get; set; } = string.Empty;
    public User? Investor { get; set; }

    public decimal ProposedInvestmentAmount { get; set; }
    public string BusinessPlanSummary { get; set; } = string.Empty;
    public string EstimatedImplementationPeriod { get; set; } = string.Empty;

    /// <summary>Snapshot of the investor's phone at the time of sending.</summary>
    public string ContactPhone { get; set; } = string.Empty;

    public ProposalStatus Status { get; set; } = ProposalStatus.Open;
    public DateTimeOffset SubmittedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }

    public List<ProposalDocument> Documents { get; set; } = [];
    public List<ProposalHistoryEntry> History { get; set; } = [];
}

/// <summary>Document attached to a proposal (PDF/JPG/PNG), stored privately and separately from land documents.</summary>
public sealed class ProposalDocument
{
    public string Id { get; set; } = string.Empty;
    public string ProposalId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public DateTimeOffset UploadedAt { get; set; }
}

/// <summary>What happened to a proposal and when (also keeps the imported legacy status history).</summary>
public sealed class ProposalHistoryEntry
{
    public string Id { get; set; } = string.Empty;
    public string ProposalId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ChangedBy { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
