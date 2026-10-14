namespace QarabagInvestmentPortal.BuildingBlocks.Abstractions;

public interface IModule
{
    string Name { get; }

    string RoutePrefix { get; }

    string DatabaseSchema { get; }
}
