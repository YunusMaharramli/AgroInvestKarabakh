using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Features.Recommendations;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class OpportunityRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);

    private static Land OwnerLand() => new() { Id = "land-x", OwnerId = "owner", Title = "T", Region = "Ağdam", AgricultureType = "Əkinçilik", AreaHectares = 100, EstimatedInvestmentRequirement = 400_000m };
    private static Land LegacyLand() => new() { Id = "land-1", OwnerId = null, Title = "T", Region = "Füzuli", AgricultureType = "Bağçılıq", AreaHectares = 50, EstimatedInvestmentRequirement = 300_000m };

    private static InvestmentOpportunity Opp(OpportunitySource source, OpportunityStatus status = OpportunityStatus.Active, DateTimeOffset? deadline = null) =>
        new() { Id = "o", LandId = "land-x", Source = source, Status = status, ContactPhone = "+994 50 111 22 33", ApplicationDeadline = deadline };

    [Fact]
    public void Owner_is_responsible_for_owner_listings_and_admins_for_admin_listings()
    {
        Assert.True(OpportunityMapping.IsResponsibleParty(Opp(OpportunitySource.Owner), OwnerLand(), new Viewer("owner", false)));
        Assert.False(OpportunityMapping.IsResponsibleParty(Opp(OpportunitySource.Owner), OwnerLand(), new Viewer("admin", true)));
        Assert.False(OpportunityMapping.IsResponsibleParty(Opp(OpportunitySource.Owner), OwnerLand(), new Viewer("someone", false)));
        Assert.True(OpportunityMapping.IsResponsibleParty(Opp(OpportunitySource.Admin), LegacyLand(), new Viewer("admin", true)));
        Assert.False(OpportunityMapping.IsResponsibleParty(Opp(OpportunitySource.Admin), LegacyLand(), new Viewer("someone", false)));
        Assert.False(OpportunityMapping.IsResponsibleParty(Opp(OpportunitySource.Admin), LegacyLand(), Viewer.Anonymous));
    }

    [Fact]
    public void Contact_phone_is_shown_only_to_proposers_the_responsible_party_and_admins()
    {
        var opp = Opp(OpportunitySource.Owner);
        var land = OwnerLand();
        var mine = new MyProposalSummary("p", "AGRO-2026-0001", ProposalStatus.Open);

        Assert.Null(OpportunityMapping.ToDto(opp, land, Viewer.Anonymous, 0, null, Now).ContactPhone);
        Assert.Null(OpportunityMapping.ToDto(opp, land, new Viewer("investor", false), 0, null, Now).ContactPhone);
        Assert.Equal("+994 50 111 22 33", OpportunityMapping.ToDto(opp, land, new Viewer("investor", false), 1, mine, Now).ContactPhone);
        Assert.Equal("+994 50 111 22 33", OpportunityMapping.ToDto(opp, land, new Viewer("owner", false), 1, null, Now).ContactPhone);
        Assert.Equal("+994 50 111 22 33", OpportunityMapping.ToDto(opp, land, new Viewer("admin", true), 1, null, Now).ContactPhone);
    }

    [Fact]
    public void Only_active_listings_before_the_deadline_accept_proposals()
    {
        Assert.True(Opp(OpportunitySource.Owner).AcceptsProposals(Now));
        Assert.True(Opp(OpportunitySource.Owner, deadline: Now.AddDays(1)).AcceptsProposals(Now));
        Assert.False(Opp(OpportunitySource.Owner, deadline: Now.AddDays(-1)).AcceptsProposals(Now));
        Assert.False(Opp(OpportunitySource.Owner, OpportunityStatus.Closed).AcceptsProposals(Now));
        Assert.False(Opp(OpportunitySource.Owner, OpportunityStatus.Draft).AcceptsProposals(Now));
    }

    [Fact]
    public void Proposal_documents_are_required_only_when_the_listing_lists_them()
    {
        var land = OwnerLand();
        var none = Opp(OpportunitySource.Owner);
        var some = Opp(OpportunitySource.Owner);
        some.RequiredDocuments = ["Biznes plan"];
        Assert.False(OpportunityMapping.ToDto(none, land, Viewer.Anonymous, 0, null, Now).ProposalDocumentsRequired);
        Assert.True(OpportunityMapping.ToDto(some, land, Viewer.Anonymous, 0, null, Now).ProposalDocumentsRequired);
    }

    [Fact]
    public void Recommendation_score_keeps_the_old_weights()
    {
        var land = OwnerLand();
        var dto = OpportunityMapping.ToDto(Opp(OpportunitySource.Owner), land, Viewer.Anonymous, 0, null, Now);
        var perfect = RecommendationEndpoints.Score(land, dto, new RecommendationRequest("Ağdam", 450_000m, "Əkinçilik", 80, null));
        Assert.Equal(100, perfect.MatchScore);

        var wrongRegion = RecommendationEndpoints.Score(land, dto, new RecommendationRequest("Laçın", 450_000m, "Əkinçilik", 80, null));
        Assert.Equal((int)Math.Round(20 * .35 + 100 * .30 + 100 * .20 + 100 * .15), wrongRegion.MatchScore);
        Assert.NotEmpty(wrongRegion.Mismatches);
    }
}
