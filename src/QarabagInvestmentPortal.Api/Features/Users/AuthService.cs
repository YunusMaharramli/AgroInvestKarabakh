using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class AuthService(
    AppDbContext db,
    SessionStore sessions,
    TimeProvider clock,
    LoginAttemptService loginAttempts,
    EmailConfirmationService emailConfirmation,
    AuthActionTokenService tokens,
    ILogger<AuthService> logger)
{
    public static readonly TimeSpan SignupTokenLifetime = TimeSpan.FromHours(24);

    /// <summary>Sign-up step 1 for any applicant type: creates the account (role USER) and emails the confirmation link.</summary>
    public async Task<Outcome<RegistrationResponse>> RegisterAsync(
        RegisterRequest req,
        CancellationToken ct)
    {
        var (input, error) = ApplicantSignupRules.ValidateRegistration(req);
        if (input is null)
            return Outcome<RegistrationResponse>.Fail(400, error!);

        if (await db.Users.AnyAsync(u => u.Email == input.Email, ct))
            return Outcome<RegistrationResponse>.Fail(409, "Bu elektron poçt ünvanı artıq sistemdə qeydiyyatdan keçib.");

        if (input.Type is ApplicantType.LegalEntity or ApplicantType.ForeignEntity && input.Voen.Length > 0 &&
            await db.Users.AnyAsync(u => u.ApplicantType != null && u.Profile != null && u.Profile.TaxIdentificationNumber == input.Voen, ct))
            return Outcome<RegistrationResponse>.Fail(409, "Bu VÖEN ilə artıq hesab yaradılıb.");

        var now = clock.GetUtcNow();
        var userId = Ids.New("usr");
        var profile = new UserProfile
        {
            Id = Ids.New("prof"),
            UserId = userId,
            CompanyName = input.CompanyName,
            TaxIdentificationNumber = input.Voen,
            BusinessActivity = req.ApplicantType is null ? req.BusinessActivity?.Trim() ?? string.Empty : string.Empty,
            ForeignTaxNumber = input.ForeignTaxNumber,
            CreatedAt = now,
            UpdatedAt = now,
        };
        var user = new User
        {
            Id = userId,
            FirstName = input.FirstName,
            LastName = input.LastName,
            Email = input.Email,
            Phone = input.Phone,
            Role = UserRole.User,
            // Older clients (no applicant type) keep the previous one-step sign-up.
            ApplicantType = req.ApplicantType,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.Password),
            CreatedAt = now,
            UpdatedAt = now,
            Profile = profile,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var signupToken = req.ApplicantType is null ? null
            : await tokens.IssueAsync(user.Id, AuthTokenPurpose.SignupContinuation, SignupTokenLifetime, ct);

        try
        {
            await emailConfirmation.SendAsync(user, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex,
                "Confirmation email could not be sent for user {UserId}", user.Id);

            return Outcome<RegistrationResponse>.Success(
                new RegistrationResponse(
                    "Hesab yaradıldı, amma təsdiq məktubu göndərilə bilmədi. Bir neçə dəqiqədən sonra yenidən göndərməyi yoxlayın.",
                    true,
                    true,
                    signupToken));
        }

        return Outcome<RegistrationResponse>.Success(
            new RegistrationResponse(
                "Hesab yaradıldı. E-poçtunuza göndərilən linklə ünvanınızı təsdiqləyin.",
                true,
                false,
                signupToken));
    }

    /// <summary>Sign-up: is the email confirmed yet? Read with the sign-up token; the token is not used up.</summary>
    public async Task<Outcome<SignupStatusResponse>> SignupStatusAsync(string? signupToken, CancellationToken ct)
    {
        var userId = await tokens.PeekAsync(signupToken, AuthTokenPurpose.SignupContinuation, ct);
        var user = userId is null ? null : await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Outcome<SignupStatusResponse>.Fail(404, "Qeydiyyat sessiyası tapılmadı və ya vaxtı bitib. Daxil olub qeydiyyatı tamamlayın.");

        return Outcome<SignupStatusResponse>.Success(new SignupStatusResponse(
            user.Email, user.ApplicantType, user.EmailConfirmedAt is not null, user.NeedsOnboarding));
    }

    /// <summary>
    /// Sign-up, last step: saves the additional information and signs the applicant in.
    /// The applicant is found by the signed-in session or, right after sign-up, by the sign-up token.
    /// </summary>
    public async Task<Outcome<AuthResponse>> CompleteOnboardingAsync(
        string? signedInUserId, InvestorDetailsRequest req, HttpResponse response, CancellationToken ct)
    {
        // The sign-up token wins: a browser may still carry another account's session cookie.
        var userId = await tokens.PeekAsync(req.SignupToken, AuthTokenPurpose.SignupContinuation, ct) ?? signedInUserId;
        if (userId is null)
            return Outcome<AuthResponse>.Fail(401, "Qeydiyyat sessiyası tapılmadı və ya vaxtı bitib. Daxil olub qeydiyyatı tamamlayın.");

        var user = await db.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Outcome<AuthResponse>.Fail(401, "Giriş tələb olunur.");
        if (user.Role != UserRole.User || user.ApplicantType is not { } type)
            return Outcome<AuthResponse>.Fail(403, "Bu hesab üçün əlavə məlumat tələb olunmur.");
        if (user.EmailConfirmedAt is null)
            return Outcome<AuthResponse>.Fail(403, "Əvvəlcə e-poçt ünvanınızı təsdiqləyin.");
        if (user.OnboardingCompletedAt is not null)
            return Outcome<AuthResponse>.Fail(409, "Qeydiyyat artıq tamamlanıb. Daxil olun.");

        var now = clock.GetUtcNow();
        var (details, error) = ApplicantSignupRules.ValidateDetails(type, req, DateOnly.FromDateTime(now.UtcDateTime));
        if (details is null)
            return Outcome<AuthResponse>.Fail(400, error!);

        user.Profile ??= new UserProfile { Id = Ids.New("prof"), UserId = user.Id, CreatedAt = now };
        ApplicantSignupRules.Apply(user.Profile, details);
        user.Profile.UpdatedAt = now;
        user.OnboardingCompletedAt = now;
        user.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        // The sign-up is finished: any sign-up token of this account is no longer needed.
        await db.AuthActionTokens
            .Where(t => t.UserId == user.Id && t.Purpose == AuthTokenPurpose.SignupContinuation && t.UsedAt == null)
            .ExecuteUpdateAsync(x => x.SetProperty(t => t.UsedAt, (DateTimeOffset?)now), ct);

        var token = sessions.Create(user, response);
        return Outcome<AuthResponse>.Success(new AuthResponse(
            "Qeydiyyat tamamlandı. İnvestor kabinetinizə xoş gəlmisiniz.", token, UserDto.From(user), ProfileDto.From(user.Profile)));
    }

    public async Task<Outcome<AuthResponse>> LoginAsync(
    LoginRequest req,
    string ipAddress,
    HttpResponse response,
    CancellationToken ct)
    {
        var email = req.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var password = req.Password ?? string.Empty;

        if (email.Length == 0 || email.Length > 256 || password.Length == 0)
            return Outcome<AuthResponse>.Fail(400, "E-poçt və şifrə daxil edilməlidir.");

        var result = await loginAttempts.AuthenticateAsync(
            email, password, ipAddress, ct);

        if (!result.Ok)
            return Outcome<AuthResponse>.Fail(result.Status, result.Error!);

        var user = result.Value!;

        if (user.EmailConfirmedAt is null)
            return Outcome<AuthResponse>.Fail(
                403, "Giriş üçün əvvəlcə e-poçt ünvanınızı təsdiqləyin.");

        var token = sessions.Create(user, response);

        return Outcome<AuthResponse>.Success(
            new AuthResponse(
                "Uğurla daxil oldunuz.",
                token,
                UserDto.From(user),
                ProfileDto.From(user.Profile)));
    }

    public async Task<MeResponse?> MeAsync(string userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : new MeResponse(UserDto.From(user), ProfileDto.From(user.Profile));
    }

    public async Task<Outcome<MessageResponse>> ChangePasswordAsync(
    string userId,
    ChangePasswordRequest req,
    HttpResponse response,
    CancellationToken ct)
    {
        if (await db.Users.AnyAsync(u => u.Id == userId && u.Role == UserRole.Admin, ct))
            return Outcome<MessageResponse>.Fail(403, AdminAccounts.PasswordLockedMessage);

        if (string.IsNullOrEmpty(req.CurrentPassword) ||
            string.IsNullOrEmpty(req.NewPassword) ||
            string.IsNullOrEmpty(req.ConfirmNewPassword))
            return Outcome<MessageResponse>.Fail(400, "Bütün şifrə sahələri doldurulmalıdır.");

        if (req.NewPassword != req.ConfirmNewPassword)
            return Outcome<MessageResponse>.Fail(400, "Yeni şifrələr uyğun gəlmir.");

        if (req.NewPassword.Length < ApplicantSignupRules.MinPasswordLength)
            return Outcome<MessageResponse>.Fail(400, $"Şifrə ən azı {ApplicantSignupRules.MinPasswordLength} simvol olmalıdır.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Outcome<MessageResponse>.Fail(401, "Giriş tələb olunur.");

        if (user.Role == UserRole.Admin)
            return Outcome<MessageResponse>.Fail(403, AdminAccounts.PasswordLockedMessage);

        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return Outcome<MessageResponse>.Fail(400, "Hazırkı şifrə yanlışdır.");

        if (BCrypt.Net.BCrypt.Verify(req.NewPassword, user.PasswordHash))
            return Outcome<MessageResponse>.Fail(400, "Yeni şifrə əvvəlki şifrədən fərqli olmalıdır.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.UpdatedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);

        sessions.RemoveAllForUser(userId);
        response.Cookies.Delete(SessionStore.CookieName);

        return Outcome<MessageResponse>.Success(
            new MessageResponse("Şifrə dəyişdirildi. Yenidən daxil olun."));
    }

    public async Task<Outcome<ProfileUpdatedResponse>> UpdateProfileAsync(string userId, UpdateProfileRequest req, CancellationToken ct)
    {
        var user = await db.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Outcome<ProfileUpdatedResponse>.Fail(401, "Giriş tələb olunur.");

        if (req.Phone is not null)
        {
            if (req.Phone.Trim().Length == 0) user.Phone = null;
            else if (AzerbaijaniPhone.TryNormalize(req.Phone, out var phone)) user.Phone = phone;
            else return Outcome<ProfileUpdatedResponse>.Fail(400, AzerbaijaniPhone.InvalidMessage);
        }
        if (!string.IsNullOrWhiteSpace(req.FirstName)) user.FirstName = req.FirstName.Trim();
        if (!string.IsNullOrWhiteSpace(req.LastName)) user.LastName = req.LastName.Trim();

        var now = clock.GetUtcNow();
        user.UpdatedAt = now;
        user.Profile ??= new UserProfile { Id = Ids.New("prof"), UserId = user.Id, CreatedAt = now };
        if (req.CompanyName is not null) user.Profile.CompanyName = req.CompanyName.Trim();
        if (req.TaxIdentificationNumber is not null) user.Profile.TaxIdentificationNumber = req.TaxIdentificationNumber.Trim();
        if (req.BusinessActivity is not null) user.Profile.BusinessActivity = req.BusinessActivity.Trim();
        user.Profile.UpdatedAt = now;

        await db.SaveChangesAsync(ct);
        return Outcome<ProfileUpdatedResponse>.Success(new ProfileUpdatedResponse("Profil məlumatları yeniləndi.", UserDto.From(user), ProfileDto.From(user.Profile)));
    }
}
