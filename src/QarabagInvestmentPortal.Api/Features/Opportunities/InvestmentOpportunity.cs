using QarabagInvestmentPortal.Api.Features.Lands;

namespace QarabagInvestmentPortal.Api.Features.Opportunities;

/// <summary>Who listed the opportunity. The responsible party is the owner for OWNER listings and admins for ADMIN listings.</summary>
public enum OpportunitySource
{
    Owner,
    Admin,
}

/// <summary>
/// DRAFT: the land is still under review. ACTIVE: published, accepting proposals.
/// CLOSED: no new proposals (winner selected or closed by the responsible party).
/// Only one ACTIVE opportunity per land (enforced by a unique partial index).
/// </summary>
public enum OpportunityStatus
{
    Draft,
    Active,
    Closed,
    Rejected,
}

public sealed class InvestmentOpportunity
{
    public string Id { get; set; } = string.Empty;
    public string LandId { get; set; } = string.Empty;
    public Land? Land { get; set; }

    public OpportunitySource Source { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> EligibilityConditions { get; set; } = [];

    /// <summary>When not empty, investors must attach at least one document to their proposal.</summary>
    public List<string> RequiredDocuments { get; set; } = [];

    public DateTimeOffset? OpeningDate { get; set; }
    public DateTimeOffset? ApplicationDeadline { get; set; }
    public OpportunityStatus Status { get; set; } = OpportunityStatus.Draft;

    /// <summary>Shown only to users who have sent a proposal.</summary>
    public string ContactPhone { get; set; } = string.Empty;

    public string? WinnerProposalId { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public string? ClosureReason { get; set; }
    public string? ReviewNote { get; set; }
    public string? ReviewedById { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? CreatedById { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public bool AcceptsProposals(DateTimeOffset now) =>
        Status == OpportunityStatus.Active && (OpeningDate is null || OpeningDate <= now)
        && (ApplicationDeadline is null || ApplicationDeadline >= now);
}
