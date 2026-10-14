using QarabagInvestmentPortal.BuildingBlocks.Abstractions;
using QarabagInvestmentPortal.Modules.Applicants;
using QarabagInvestmentPortal.Modules.Applications;
using QarabagInvestmentPortal.Modules.Audit;
using QarabagInvestmentPortal.Modules.Competitions;
using QarabagInvestmentPortal.Modules.Documents;
using QarabagInvestmentPortal.Modules.Identity;
using QarabagInvestmentPortal.Modules.Integrations;
using QarabagInvestmentPortal.Modules.Lands;
using QarabagInvestmentPortal.Modules.Notifications;
using QarabagInvestmentPortal.Modules.Recommendations;

namespace QarabagInvestmentPortal.Api;

internal static class ModuleRegistration
{
    internal static IServiceCollection AddApplicationModules(this IServiceCollection services)
    {
        services.AddSingleton<IModule, IdentityModule>();
        services.AddSingleton<IModule, ApplicantsModule>();
        services.AddSingleton<IModule, LandsModule>();
        services.AddSingleton<IModule, CompetitionsModule>();
        services.AddSingleton<IModule, ApplicationsModule>();
        services.AddSingleton<IModule, DocumentsModule>();
        services.AddSingleton<IModule, NotificationsModule>();
        services.AddSingleton<IModule, AuditModule>();
        services.AddSingleton<IModule, IntegrationsModule>();
        services.AddSingleton<IModule, RecommendationsModule>();

        return services;
    }
}
