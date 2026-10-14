using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Recommendations;

public sealed class RecommendationsModule : IModule
{
    public string Name => "Recommendations";
    public string RoutePrefix => "/api/recommendations";
    public string DatabaseSchema => "recommendations";
}
