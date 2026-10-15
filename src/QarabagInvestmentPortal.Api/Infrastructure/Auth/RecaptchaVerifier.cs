using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace QarabagInvestmentPortal.Api.Infrastructure.Auth;

public sealed class RecaptchaVerifier(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<RecaptchaVerifier> logger,
    IHostEnvironment environment)
{
    /// <summary>
    /// Recaptcha:Enabled = false switches the check off (automated tests only).
    /// In Development, appsettings.Development.json uses Google's public test keys, which always pass.
    /// </summary>
    public async Task<bool> VerifyAsync(string? token, CancellationToken ct)
    {
        if (!configuration.GetValue("Recaptcha:Enabled", true))
            return true;

        if (string.IsNullOrWhiteSpace(token))
            return false;

        var secret = configuration["Recaptcha:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret) && environment.IsDevelopment())
        {
            // Google-published v2 test key; it always passes and must never be used in production.
            secret = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";
        }

        if (string.IsNullOrWhiteSpace(secret))
        {
            logger.LogError("reCAPTCHA secret key konfiqurasiya edilməyib.");
            return false;
        }

        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["secret"] = secret,
            ["response"] = token
        });

        try
        {
            using var response = await httpClient.PostAsync(
                "https://www.google.com/recaptcha/api/siteverify", content, ct);

            if (!response.IsSuccessStatusCode)
                return false;

            var result = await response.Content.ReadFromJsonAsync<SiteVerifyResponse>(
                cancellationToken: ct);
            return result?.Success == true;
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "reCAPTCHA yoxlamasına qoşulmaq alınmadı.");
            return false;
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("reCAPTCHA yoxlamasının vaxtı bitdi.");
            return false;
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "reCAPTCHA cavabı oxunmadı.");
            return false;
        }
    }

    private sealed class SiteVerifyResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }
    }
}