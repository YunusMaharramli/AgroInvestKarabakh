namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class AuthLinkOptions
{
    public const string SectionName = "AuthLinks";

    public string PublicBaseUrl { get; set; } = string.Empty;
}