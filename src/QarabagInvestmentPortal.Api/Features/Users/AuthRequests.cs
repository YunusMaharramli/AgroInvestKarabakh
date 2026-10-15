namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed record ConfirmEmailRequest(string? Token);
public sealed record ResendConfirmationRequest(
    string? Email, string? RecaptchaToken = null);

public sealed record ForgotPasswordRequest(
    string? Email, string? RecaptchaToken = null);
public sealed record ResetPasswordRequest(
    string? Token,
    string? NewPassword,
    string? ConfirmNewPassword);
/// <summary>SignupToken lets this browser follow the sign-up (email confirmed yet?) and finish it with the additional information.</summary>
public sealed record RegistrationResponse(
    string Message,
    bool RequiresEmailConfirmation,
    bool EmailDeliveryFailed,
    string? SignupToken = null);