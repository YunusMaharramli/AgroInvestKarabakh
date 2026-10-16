using QarabagInvestmentPortal.Api.Features.Assistant;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class LandAnalysisRulesTests
{
    [Fact]
    public void Conservative_scenario_can_show_a_loss()
    {
        var scenario = new AnalysisScenario([100, 150], [80, 120], [20, 100], [-100, 20], "Year 4");
        Assert.True(LandAnalysisRules.ValidScenario(scenario));
    }

    [Fact]
    public void Invalid_financial_ranges_are_rejected()
    {
        var valid = new AnalysisScenario([100, 150], [80, 120], [20, 100], [-100, 20], "Year 4");
        Assert.False(LandAnalysisRules.ValidScenario(valid with { StartupCost = [-1, 150] }));
        Assert.False(LandAnalysisRules.ValidScenario(valid with { Revenue = [100, 20] }));
        Assert.False(LandAnalysisRules.ValidScenario(valid with { Profit = [20, -100] }));
        Assert.False(LandAnalysisRules.ValidScenario(valid with { AnnualCost = [80] }));
        Assert.False(LandAnalysisRules.ValidScenario(valid with { BreakEven = " " }));
    }
}
