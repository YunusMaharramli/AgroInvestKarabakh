using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Applications;

public sealed class ApplicationsModule : IModule
{
    public string Name => "Applications";
    public string RoutePrefix => "/api/applications";
    public string DatabaseSchema => "applications";
}
