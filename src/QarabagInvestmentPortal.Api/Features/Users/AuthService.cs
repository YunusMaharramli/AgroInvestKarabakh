using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Rentals;
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
    ILogger<AuthService> logger)
{
    public async Task<Outcome<RegistrationResponse>> RegisterAsync(
        RegisterRequest req,
        CancellationToken ct)
    {
        var firstName = req.FirstName?.Trim() ?? string.Empty;
        var lastName = req.LastName?.Trim() ?? string.Empty;
        var email = req.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var password = req.Password ?? string.Empty;

        if (firstName.Length == 0 || lastName.Length == 0 || email.Length == 0 || string.IsNullOrWhiteSpace(req.Phone) || password.Length == 0)
            return Outcome<RegistrationResponse>.Fail(400, "Bütün məcburi sahələr doldurulmalıdır.");
        if (password != req.ConfirmPassword)
            return Outcome<RegistrationResponse>.Fail(400, "Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.");
        if (password.Length < 6)
            return Outcome<RegistrationResponse>.Fail(400, "Şifrə ən azı 6 simvoldan ibarət olmalıdır.");
        if (!InternationalPhone.TryNormalize(req.Phone, out var phone))
            return Outcome<RegistrationResponse>.Fail(400, InternationalPhone.InvalidMessage);
        if (req.ApplicantProfile is null)
            return Outcome<RegistrationResponse>.Fail(400, "Müraciətçi növünü və profil məlumatlarını daxil edin.");

        var applicantInput = req.ApplicantProfile with { ContactPhone = phone, ContactEmail = email };
        var applicantErrors = RentalRules.Validate(applicantInput);
        if (applicantErrors.Count > 0)
            return Outcome<RegistrationResponse>.Fail(400, string.Join(" ", applicantErrors.Values));
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            return Outcome<RegistrationResponse>.Fail(409, "Bu elektron poçt ünvanı artıq sistemdə qeydiyyatdan keçib.");

        var now = clock.GetUtcNow();
        var userId = Ids.New("usr");
        var profile = new UserProfile
        {
            Id = Ids.New("prof"),
            UserId = userId,
            CompanyName = req.CompanyName?.Trim() ?? string.Empty,
            TaxIdentificationNumber = req.TaxIdentificationNumber?.Trim() ?? string.Empty,
            BusinessActivity = req.BusinessActivity?.Trim() ?? string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
        };
        var user = new User
        {
            Id = userId,
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            Phone = phone,
            Role = UserRole.User,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            CreatedAt = now,
            UpdatedAt = now,
            Profile = profile,
        };
        var applicantProfile = new RentalApplicantProfile
        {
            Id = Ids.New("rprofile"),
            UserId = userId,
            ApplicantType = applicantInput.ApplicantType,
            ForeignKind = applicantInput.ForeignKind,
            FullLegalName = applicantInput.FullLegalName?.Trim() ?? string.Empty,
            Citizenship = applicantInput.Citizenship?.Trim() ?? string.Empty,
            CountryOfResidence = applicantInput.CountryOfResidence?.Trim() ?? string.Empty,
            ResidenceAddress = applicantInput.ResidenceAddress?.Trim() ?? string.Empty,
            IdDocumentType = applicantInput.IdDocumentType?.Trim() ?? string.Empty,
            IdDocumentNumber = applicantInput.IdDocumentNumber?.Trim() ?? string.Empty,
            Fin = applicantInput.Fin?.Trim() ?? string.Empty,
            LegalName = applicantInput.LegalName?.Trim() ?? string.Empty,
            LegalForm = applicantInput.LegalForm?.Trim() ?? string.Empty,
            CountryOfIncorporation = applicantInput.CountryOfIncorporation?.Trim() ?? string.Empty,
            RegistrationIdentifier = applicantInput.RegistrationIdentifier?.Trim() ?? string.Empty,
            TaxIdentifier = applicantInput.TaxIdentifier?.Trim() ?? string.Empty,
            RegisteredAddress = applicantInput.RegisteredAddress?.Trim() ?? string.Empty,
            ContactPhone = phone,
            ContactEmail = email,
            ContactAddress = applicantInput.ContactAddress?.Trim() ?? string.Empty,
            RepresentativeName = applicantInput.RepresentativeName?.Trim() ?? string.Empty,
            RepresentativePosition = applicantInput.RepresentativePosition?.Trim() ?? string.Empty,
            AuthorityToAct = applicantInput.AuthorityToAct?.Trim() ?? string.Empty,
            ConsentGrantedAt = now,
            ConsentVersion = "rental-profile-v1",
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Users.Add(user);
        db.RentalApplicantProfiles.Add(applicantProfile);
        await db.SaveChangesAsync(ct);

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
                    true));
        }

        return Outcome<RegistrationResponse>.Success(
            new RegistrationResponse(
                "Hesab yaradıldı. E-poçtunuza göndərilən linklə ünvanınızı təsdiqləyin.",
                true,
                false));
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

        if (user.Role != UserRole.Admin && req.ApplicantType is { } selectedType)
        {
            if (!Enum.IsDefined(selectedType))
                return Outcome<AuthResponse>.Fail(400, "Müraciətçi növü düzgün deyil.");

            var savedType = await db.RentalApplicantProfiles.AsNoTracking()
                .Where(profile => profile.UserId == user.Id)
                .Select(profile => (ApplicantType?)profile.ApplicantType)
                .SingleOrDefaultAsync(ct);

            if (savedType is not null && savedType != selectedType)
                return Outcome<AuthResponse>.Fail(400, "Seçilmiş müraciətçi növü ilə hesab uyğun gəlmir.");
        }

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
        if (string.IsNullOrEmpty(req.CurrentPassword) ||
            string.IsNullOrEmpty(req.NewPassword) ||
            string.IsNullOrEmpty(req.ConfirmNewPassword))
            return Outcome<MessageResponse>.Fail(400, "Bütün şifrə sahələri doldurulmalıdır.");

        if (req.NewPassword != req.ConfirmNewPassword)
            return Outcome<MessageResponse>.Fail(400, "Yeni şifrələr uyğun gəlmir.");

        // Hələlik qeydiyyatdakı mövcud qayda ilə eynidir.
        if (req.NewPassword.Length < 6)
            return Outcome<MessageResponse>.Fail(400, "Şifrə ən azı 6 simvol olmalıdır.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Outcome<MessageResponse>.Fail(401, "Giriş tələb olunur.");

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
            else if (InternationalPhone.TryNormalize(req.Phone, out var phone)) user.Phone = phone;
            else return Outcome<ProfileUpdatedResponse>.Fail(400, InternationalPhone.InvalidMessage);
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
