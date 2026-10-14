using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Applicants;

public sealed class ApplicantsModule : IModule
{
    public string Name => "Applicants";
    public string RoutePrefix => "/api/applicants";
    public string DatabaseSchema => "applicants";
}
