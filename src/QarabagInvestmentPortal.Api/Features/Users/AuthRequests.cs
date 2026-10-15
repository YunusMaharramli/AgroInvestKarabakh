namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed record ConfirmEmailRequest(string? Token);
public sealed record ResendConfirmationRequest(string? Email);
public sealed record ForgotPasswordRequest(string? Email);
public sealed record ResetPasswordRequest(
    string? Token,
    string? NewPassword,
    string? ConfirmNewPassword);
public sealed record RegistrationResponse(
    string Message,
    bool RequiresEmailConfirmation,
    bool EmailDeliveryFailed);