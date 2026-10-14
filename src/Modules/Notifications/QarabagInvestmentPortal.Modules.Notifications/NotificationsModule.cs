using QarabagInvestmentPortal.BuildingBlocks.Abstractions;

namespace QarabagInvestmentPortal.Modules.Notifications;

public sealed class NotificationsModule : IModule
{
    public string Name => "Notifications";
    public string RoutePrefix => "/api/notifications";
    public string DatabaseSchema => "notifications";
}
