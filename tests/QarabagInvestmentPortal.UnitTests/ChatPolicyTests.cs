using QarabagInvestmentPortal.Api.Features.Chat;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class ChatPolicyTests
{
    private static Proposal ProposalFor(OpportunitySource source = OpportunitySource.Owner)
    {
        var opportunity = new InvestmentOpportunity
        {
            Id = "opp-1", Status = OpportunityStatus.Active, Source = source,
            Land = new Land { OwnerId = source == OpportunitySource.Owner ? "owner" : null },
        };
        return new Proposal { Id = "proposal-1", InvestorId = "investor", Status = ProposalStatus.Open, Opportunity = opportunity };
    }

    [Fact]
    public void Owner_starts_and_investor_can_only_reply_after_first_message()
    {
        var proposal = ProposalFor();
        Assert.True(ChatPolicy.CanSend(proposal, new Viewer("owner", false), started: false));
        Assert.False(ChatPolicy.CanSend(proposal, new Viewer("investor", false), started: false));
        Assert.True(ChatPolicy.CanSend(proposal, new Viewer("investor", false), started: true));
        Assert.False(ChatPolicy.CanSend(proposal, new Viewer("admin", true), started: true));
    }

    [Fact]
    public void Ministry_starts_state_land_conversation()
    {
        var proposal = ProposalFor(OpportunitySource.Admin);
        Assert.True(ChatPolicy.CanSend(proposal, new Viewer("admin", true), started: false));
        Assert.False(ChatPolicy.CanSend(proposal, new Viewer("investor", false), started: false));
        Assert.True(ChatPolicy.CanSend(proposal, new Viewer("investor", false), started: true));
    }

    [Fact]
    public void Only_winning_conversation_stays_writable_after_selection()
    {
        var proposal = ProposalFor();
        proposal.Status = ProposalStatus.Selected;
        proposal.Opportunity!.Status = OpportunityStatus.Closed;
        proposal.Opportunity.WinnerProposalId = proposal.Id;
        Assert.True(ChatPolicy.CanSend(proposal, new Viewer("owner", false), started: true));
        Assert.True(ChatPolicy.CanSend(proposal, new Viewer("investor", false), started: true));

        proposal.Status = ProposalStatus.NotSelected;
        Assert.False(ChatPolicy.CanSend(proposal, new Viewer("owner", false), started: true));
        proposal.Status = ProposalStatus.Cancelled;
        Assert.False(ChatPolicy.CanSend(proposal, new Viewer("investor", false), started: true));
    }
}
