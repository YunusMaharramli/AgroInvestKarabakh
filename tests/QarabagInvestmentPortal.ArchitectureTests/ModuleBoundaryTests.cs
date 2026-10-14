using System.Reflection;
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

namespace QarabagInvestmentPortal.ArchitectureTests;

public sealed class ModuleBoundaryTests
{
    [Fact]
    public void Business_modules_must_not_reference_other_business_modules()
    {
        Assembly[] modules =
        [
            typeof(IdentityModule).Assembly,
            typeof(ApplicantsModule).Assembly,
            typeof(LandsModule).Assembly,
            typeof(CompetitionsModule).Assembly,
            typeof(ApplicationsModule).Assembly,
            typeof(DocumentsModule).Assembly,
            typeof(NotificationsModule).Assembly,
            typeof(AuditModule).Assembly,
            typeof(IntegrationsModule).Assembly,
            typeof(RecommendationsModule).Assembly
        ];

        foreach (var module in modules)
        {
            var forbiddenReferences = module.GetReferencedAssemblies()
                .Where(reference => reference.Name?.StartsWith("QarabagInvestmentPortal.Modules.", StringComparison.Ordinal) is true)
                .ToArray();

            Assert.Empty(forbiddenReferences);
        }
    }
}
