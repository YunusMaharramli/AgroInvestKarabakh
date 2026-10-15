using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Proposals;

namespace QarabagInvestmentPortal.Api.Features.Opportunities;

/// <summary>
/// An investment opportunity (was "competition"). ContactPhone is filled only for the responsible party, admins and
/// users who have already sent a proposal. MyProposal tells the viewer about their own proposal, if any.
/// </summary>
public sealed record OpportunityDto(
    string Id, string LandId, string Title, string Description,
    IReadOnlyList<string> EligibilityConditions, IReadOnlyList<string> RequiredDocuments,
    DateTimeOffset? OpeningDate, DateTimeOffset? ApplicationDeadline,
    OpportunityStatus Status, OpportunitySource Source, bool AcceptingProposals, bool ProposalDocumentsRequired,
    int ProposalCount, string? WinnerProposalId, DateTimeOffset? ClosedAt,
    string? ContactPhone, bool IsResponsibleParty, MyProposalSummary? MyProposal,
    LandDto? Land, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    string? ClosureReason, string? ReviewNote);

public sealed record MyProposalSummary(string Id, string ReferenceNumber, ProposalStatus Status);

/// <summary>Who is looking — decides what private fields are included.</summary>
public sealed record Viewer(string? UserId, bool IsAdmin)
{
    public static readonly Viewer Anonymous = new(null, false);
}

public static class OpportunityMapping
{
    /// <summary>
    /// The party managing the listing; ministry approval and winner selection are separate admin-only actions.
    /// For admin listings this is the ministry, or the user an admin assigned to answer investor inquiries.
    /// </summary>
    public static bool IsResponsibleParty(InvestmentOpportunity o, Land land, Viewer viewer) =>
        viewer.UserId is not null && viewer.IsAdmin;

    public static OpportunityDto ToDto(
        InvestmentOpportunity o, Land land, Viewer viewer, int proposalCount, MyProposalSummary? myProposal,
        DateTimeOffset now, bool includeLand = true)
    {
        var responsible = IsResponsibleParty(o, land, viewer);
        var canSeePhone = viewer.IsAdmin || responsible || myProposal is not null;
        return new OpportunityDto(
            o.Id, o.LandId, o.Title, o.Description, o.EligibilityConditions, o.RequiredDocuments,
            o.OpeningDate, o.ApplicationDeadline, o.Status, o.Source, o.AcceptsProposals(now), o.RequiredDocuments.Count > 0,
            proposalCount, o.WinnerProposalId, o.ClosedAt,
            canSeePhone ? o.ContactPhone : null, responsible, myProposal,
            includeLand ? LandDto.From(land, o.Status == OpportunityStatus.Active) : null,
            o.CreatedAt, o.UpdatedAt, o.ClosureReason,
            viewer.IsAdmin || responsible ? o.ReviewNote : null);
    }
}

public sealed record CloseOpportunityRequest(OpportunityStatus? Status, string? Reason);
public sealed record SelectWinnerRequest(string? ProposalId);
