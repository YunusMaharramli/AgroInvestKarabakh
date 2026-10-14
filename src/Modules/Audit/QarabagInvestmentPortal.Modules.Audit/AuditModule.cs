using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Audit;

public sealed class AuditModule : IModule
{
    public string Name => "Audit";
    public string RoutePrefix => "/api/audit";
    public string DatabaseSchema => "audit";
}
