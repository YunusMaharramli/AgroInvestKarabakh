namespace QarabagInvestmentPortal.BuildingBlocks.Domain;

public interface IDomainEvent
{
    DateTimeOffset OccurredAtUtc { get; }
}
