using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Competitions;

public sealed class CompetitionsModule : IModule
{
    public string Name => "Competitions";
    public string RoutePrefix => "/api/competitions";
    public string DatabaseSchema => "competitions";
}
