using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Integrations;

public sealed class IntegrationsModule : IModule
{
    public string Name => "Integrations";
    public string RoutePrefix => "/api/integrations";
    public string DatabaseSchema => "integrations";
}
