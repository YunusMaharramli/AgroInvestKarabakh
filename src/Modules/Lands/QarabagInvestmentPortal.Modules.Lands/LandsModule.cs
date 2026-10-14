using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Lands;

public sealed class LandsModule : IModule
{
    public string Name => "Lands";
    public string RoutePrefix => "/api/lands";
    public string DatabaseSchema => "lands";
}
