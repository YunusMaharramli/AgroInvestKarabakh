using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Infrastructure.Email;

public sealed class SmtpEmailSender(IOptions<SmtpEmailOptions> options) : IEmailSender
{
    public async Task SendAsync(
        string recipientEmail,
        string subject,
        string body,
        CancellationToken ct)
    {
        var settings = options.Value;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(recipientEmail));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(
            settings.Host,
            settings.Port,
            SecureSocketOptions.StartTls,
            ct);

        await client.AuthenticateAsync(settings.Username, settings.Password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}