using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Features.Proposals;

/// <summary>
/// A proposal as shown to the investor, the responsible party or an admin (same shape the frontend used for
/// "applications": user, land, documents, statusHistory; "competition" is now "opportunity").
/// </summary>
public sealed record ProposalDto(
    string Id, string ReferenceNumber, string UserId, string OpportunityId,
    decimal ProposedInvestmentAmount, string BusinessPlanSummary, string EstimatedImplementationPeriod,
    string ContactPhone, ProposalStatus Status, DateTimeOffset SubmittedAt, DateTimeOffset UpdatedAt, DateTimeOffset? DecidedAt,
    PersonDto? User, OpportunityDto? Opportunity, LandDto? Land,
    IReadOnlyList<ProposalDocumentDto> Documents, IReadOnlyList<ProposalHistoryDto> StatusHistory,
    bool CanSelectWinner, string ApplicantType, string ApplicantName, string? TaxNumber,
    decimal? ProjectCosts = null, decimal? FundingGap = null, decimal? AdditionalFinancingRequested = null,
    decimal? ExpectedAnnualRevenue = null, string? ExpectedProduction = null);

public sealed record ProposalDocumentDto(string Id, string FileName, string MimeType, long FileSize, DateTimeOffset UploadedAt, string Url)
{
    public static ProposalDocumentDto From(ProposalDocument d) =>
        new(d.Id, d.FileName, d.ContentType, d.SizeBytes, d.UploadedAt, $"/api/documents/proposals/{d.Id}");
}

public sealed record ProposalHistoryDto(string Id, string NewStatus, string ChangedBy, string Comment, DateTimeOffset CreatedAt)
{
    public static ProposalHistoryDto From(ProposalHistoryEntry h) => new(h.Id, h.Status, h.ChangedBy, h.Comment, h.CreatedAt);
}

public sealed record WinnerSelectedResponse(string Message, OpportunityDto Opportunity, int NotSelectedCount);
public sealed record RejectProposalRequest(string? Reason);

public sealed record ReviewApplicationRequest(ProposalStatus Status, string? Comment);
