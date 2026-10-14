using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Identity;

public sealed class IdentityModule : IModule
{
    public string Name => "Identity";
    public string RoutePrefix => "/api/identity";
    public string DatabaseSchema => "identity";
}
