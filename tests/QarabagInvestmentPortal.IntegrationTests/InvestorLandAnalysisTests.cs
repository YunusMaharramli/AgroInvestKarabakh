using System.Net;
using System.Net.Http.Json;

namespace QarabagInvestmentPortal.IntegrationTests;

[Collection(PortalCollection.Name)]
public sealed class InvestorLandAnalysisTests(PortalFactory factory)
{
    [Fact]
    public async Task Investor_analysis_requires_sign_in()
    {
        var response = await factory.Anonymous().PostAsJsonAsync("/api/ai/land-analysis", new { areaHa = 2.0 });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Admin_cannot_request_an_investor_specific_analysis()
    {
        var admin = await factory.AdminAsync();
        var response = await admin.PostAsJsonAsync("/api/ai/land-analysis", new { areaHa = 2.0 });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
