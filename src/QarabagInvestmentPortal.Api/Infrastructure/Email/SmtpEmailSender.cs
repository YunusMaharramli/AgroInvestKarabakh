using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using QarabagInvestmentPortal.Api.Features.Users;

namespace QarabagInvestmentPortal.Api.Infrastructure.Email;

public sealed class SmtpEmailSender(IOptions<SmtpEmailOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(
        string recipientEmail,
        string subject,
        string body,
        CancellationToken ct)
    {
        var settings = options.Value;

        var message = new MimeMessage();
        var from = string.IsNullOrWhiteSpace(settings.FromEmail) ? settings.Username : settings.FromEmail;
        message.From.Add(new MailboxAddress(settings.FromName, from));
        message.To.Add(MailboxAddress.Parse(recipientEmail));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        if (string.IsNullOrWhiteSpace(settings.Host) || settings.Port <= 0)
            throw new InvalidOperationException(
                "SMTP is not configured (Email:Smtp:Host / Port). In development run 'docker compose up -d' for Mailpit.");

        // Port 465 = TLS from the start (Gmail SSL). 587 = STARTTLS (Gmail).
        // Mailpit (1025) has no TLS, so STARTTLS is only used when the server offers it.
        var security = settings.Port == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;

        using var client = new SmtpClient();
        await client.ConnectAsync(settings.Host, settings.Port, security, ct);

        // Mailpit accepts mail without a login; Gmail needs the address + an app password.
        if (!string.IsNullOrEmpty(settings.Username))
            await client.AuthenticateAsync(settings.Username, settings.Password, ct);

        logger.LogInformation("Sending email \"{Subject}\" to {Recipient} via {Host}:{Port}",
            subject, recipientEmail, settings.Host, settings.Port);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}