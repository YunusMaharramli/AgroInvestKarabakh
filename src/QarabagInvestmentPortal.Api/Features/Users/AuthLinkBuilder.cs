using Microsoft.Extensions.Options;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class AuthLinkBuilder(IOptions<AuthLinkOptions> options)
{
    public string Confirmation(string token) =>
        Build("confirm-email", token);

    public string PasswordReset(string token) =>
        Build("reset-password", token);

    private string Build(string path, string token)
    {
        var baseUrl = options.Value.PublicBaseUrl.TrimEnd('/');

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out _))
            throw new InvalidOperationException(
                "AuthLinks:PublicBaseUrl düzgün təyin edilməyib.");

        return $"{baseUrl}/{path}?token={Uri.EscapeDataString(token)}";
    }
}