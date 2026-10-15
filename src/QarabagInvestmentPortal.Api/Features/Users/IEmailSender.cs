namespace QarabagInvestmentPortal.Api.Features.Users;

public interface IEmailSender
{
    Task SendAsync(
        string recipientEmail,
        string subject,
        string body,
        CancellationToken ct);
}