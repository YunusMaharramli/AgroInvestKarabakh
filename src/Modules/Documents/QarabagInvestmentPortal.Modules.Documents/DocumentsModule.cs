using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Documents;

public sealed class DocumentsModule : IModule
{
    public string Name => "Documents";
    public string RoutePrefix => "/api/documents";
    public string DatabaseSchema => "documents";
}
