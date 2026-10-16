using QarabagInvestmentPortal.Api.Features.Admin;
using QarabagInvestmentPortal.Api.Features.Lands;
using QarabagInvestmentPortal.Api.Features.Proposals;
using Microsoft.Extensions.Configuration;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class AdminAnalysisAndAnalyticsTests
{
    [Fact]
    public void Profit_scenarios_use_only_applicant_revenue_and_costs()
    {
        var p = ProposalAnalysisRules.Project(1000m, 500m);
        Assert.Equal(200m, p.Pessimistic);
        Assert.Equal(500m, p.Base);
        Assert.Equal(800m, p.Optimistic);
        Assert.Equal("Insufficient data", p.Probability);
        Assert.Null(ProposalAnalysisRules.Project(null, 500m).Base);
    }

    [Fact]
    public void Unknown_provider_aliases_are_discarded()
    {
        var fallback = EmptyAnalysis() with { Reasons = [new AnalysisEvidence("prop-1", "Offered 1000 AZN")] };
        var candidate = new GeminiAnalysis("Proposal X",
            [new("Proposal A", "Offered 1000 AZN"), new("Proposal A", "Invented evidence"), new("Proposal X", "Unknown")],
            [new("Proposal X", "Unknown")]);
        var result = ProposalAnalysisRules.Validate(fallback, candidate, new Dictionary<string, string> { ["Proposal A"] = "prop-1" });
        Assert.Null(result.RecommendedProposalId);
        Assert.Equal("prop-1", Assert.Single(result.Reasons).ProposalId);
        Assert.Empty(result.Risks);
    }

    [Fact]
    public void Invalid_provider_json_is_rejected()
    {
        Assert.Null(ProposalAnalysisRules.ParseProviderJson("not json"));
        Assert.Null(ProposalAnalysisRules.ParseProviderJson("{\"recommendedAlias\":\"Proposal A\"}"));
        Assert.Null(ProposalAnalysisRules.ParseProviderJson("{\"reasons\":[{\"alias\":4,\"text\":\"x\"}],\"risks\":[]}"));
        Assert.NotNull(ProposalAnalysisRules.ParseProviderJson("{\"recommendedAlias\":null,\"reasons\":[],\"risks\":[]}"));
    }

    [Fact]
    public void Private_identifiers_are_stripped_and_prompt_uses_aliases()
    {
        var scrubbed = ProposalAnalysisRules.StripPii("a@example.com +994 50 123 45 67 ABC1234");
        Assert.DoesNotContain("a@example.com", scrubbed);
        Assert.DoesNotContain("123 45 67", scrubbed);
        Assert.DoesNotContain("ABC1234", scrubbed);
        Assert.Equal("1000000", ProposalAnalysisRules.StripPii("1000000"));
        var prompt = new AnalysisPrompt("crops", "agdam", 10, 1000,
            [new(ProposalAnalysisRules.Alias(0), 1200, 1, 1, 0, 200, 100, null, null, ProposalAnalysisRules.Project(200, 100), [], [])]);
        Assert.DoesNotContain("prop-1", System.Text.Json.JsonSerializer.Serialize(prompt));
        Assert.Equal("Proposal A", prompt.Proposals[0].Alias);
        Assert.Equal("Proposal AA", ProposalAnalysisRules.Alias(26));
    }

    [Fact]
    public async Task Provider_failure_preserves_comparison_and_projections()
    {
        var fallback = EmptyAnalysis() with { Comparison = [new ProposalComparison("prop-1", "Proposal A", 1000m, true, 1, 1, 0, null, null,
            ProposalAnalysisRules.Project(1000, 500))] };
        var result = await ProposalAnalysisRules.WithProviderFallbackAsync(fallback,
            new AnalysisPrompt("crops", "agdam", 10, 100, []), new Dictionary<string, string>(), new ThrowingProvider(), CancellationToken.None);
        Assert.Equal("providerUnavailable", result.Status);
        Assert.Equal(500m, Assert.Single(result.Comparison).ProfitProjection.Base);
    }

    [Fact]
    public async Task Gemini_request_is_structured_and_contains_only_anonymous_numeric_data()
    {
        var handler = new RecordingHandler();
        using var client = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["GeminiAnalysis:ApiKey"] = "test-key", ["GeminiAnalysis:Model"] = "mock-model",
            ["GeminiAnalysis:Endpoint"] = "https://unit.test/v1beta", ["GeminiAnalysis:TimeoutSeconds"] = "3"
        }).Build();
        var provider = new GeminiProposalAnalysisProvider(client, config);
        var prompt = new AnalysisPrompt("crops", "aghdam", 10, 1000,
            [new AnalysisPromptProposal("Proposal A", 1500, 1, 1, 0, 500, 200, null, null, ProposalAnalysisRules.Project(500, 200), [], [])]);
        var result = await provider.AnalyzeAsync(prompt, CancellationToken.None);
        Assert.Equal("Proposal A", result?.RecommendedAlias);
        Assert.Equal("/v1beta/models/mock-model:generateContent", handler.Path);
        Assert.Contains("responseSchema", handler.Body);
        Assert.Contains("Proposal A", handler.Body);
        Assert.DoesNotContain("test-key", handler.Body);
        Assert.DoesNotContain("ApplicantName", handler.Body);
    }

    [Fact]
    public async Task Admin_analysis_can_reuse_the_investor_Gemini_key_and_model()
    {
        var handler = new RecordingHandler();
        using var client = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Gemini:ApiKey"] = "shared-test-key", ["Gemini:Model"] = "shared-test-model",
            ["GeminiAnalysis:Endpoint"] = "https://unit.test/v1beta"
        }).Build();
        var provider = new GeminiProposalAnalysisProvider(client, config);
        var prompt = new AnalysisPrompt("crops", "aghdam", 10, 1000,
            [new AnalysisPromptProposal("Proposal A", 1500, 1, 1, 0, 500, 200, null, null, ProposalAnalysisRules.Project(500, 200), [], [])]);

        Assert.NotNull(await provider.AnalyzeAsync(prompt, CancellationToken.None));
        Assert.Equal("shared-test-key", handler.ApiKey);
        Assert.Equal("/v1beta/models/shared-test-model:generateContent", handler.Path);
    }

    [Fact]
    public void Analytics_filters_validate_and_aggregate_only_selected_rows()
    {
        var from = new DateOnly(2026, 10, 1); var to = new DateOnly(2026, 10, 31);
        var filter = new AnalyticsFilter(from, to, null, "crops", null);
        Assert.True(filter.IsValid);
        Assert.False((filter with { From = to.AddDays(1) }).IsValid);
        Assert.False((filter with { Activity = "no-such-activity" }).IsValid);
        Assert.Equal(new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), filter.EndExclusive);
        var rows = new[] {
            new AnalyticsProposal(ProposalStatus.Open, 100m, new DateTimeOffset(2026, 10, 2, 0, 0, 0, TimeSpan.Zero), "agdam", "crops"),
            new AnalyticsProposal(ProposalStatus.Selected, 200m, new DateTimeOffset(2026, 10, 3, 0, 0, 0, TimeSpan.Zero), "agdam", "crops")
        };
        var result = AnalyticsProjection.Build(rows, [new AnalyticsLand(LandStatus.Draft), new AnalyticsLand(LandStatus.Approved),
            new AnalyticsLand(LandStatus.Archived)], 1, []);
        Assert.Equal(2, result.TotalApplications);
        Assert.Equal(300m, result.TotalProposedInvestment);
        Assert.Equal(1, result.ActiveCompetitions);
        Assert.Equal(1, result.PublishedLands);
        Assert.Equal("2026-10", Assert.Single(result.Timeline).Month);
        Assert.Equal(1, result.ApplicationsByStatus.Single(x => x.Status == "SELECTED").Count);
        Assert.Equal(0, result.ApplicationsByStatus.Single(x => x.Status == "REJECTED").Count);
        Assert.Equal(1, result.LandPipeline.Draft);
        Assert.Equal(1, result.LandPipeline.Archived);
    }

    private static ProposalAnalysisDto EmptyAnalysis() => new(null, [], [], [], [], "mock", DateTimeOffset.UtcNow, "providerUnavailable");
    private sealed class ThrowingProvider : IProposalAnalysisProvider
    {
        public string ModelVersion => "mock";
        public Task<GeminiAnalysis?> AnalyzeAsync(AnalysisPrompt prompt, CancellationToken ct) => throw new HttpRequestException("offline");
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public string Body { get; private set; } = "";
        public string Path { get; private set; } = "";
        public string? ApiKey { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            Path = request.RequestUri!.AbsolutePath;
            ApiKey = request.Headers.GetValues("x-goog-api-key").Single();
            var answer = System.Text.Json.JsonSerializer.Serialize(new
            {
                recommendedAlias = "Proposal A",
                reasons = new[] { new { alias = "Proposal A", text = "Offered 1500 AZN" } },
                risks = Array.Empty<object>()
            });
            var response = System.Text.Json.JsonSerializer.Serialize(new
            {
                candidates = new[] { new { content = new { parts = new[] { new { text = answer } } } } }
            });
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            { Content = new StringContent(response, System.Text.Encoding.UTF8, "application/json") };
        }
    }
}
