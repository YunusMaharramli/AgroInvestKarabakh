using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class AuthService(AppDbContext db, SessionStore sessions, TimeProvider clock)
{
    public async Task<Outcome<AuthResponse>> RegisterAsync(RegisterRequest req, HttpResponse response, CancellationToken ct)
    {
        var firstName = req.FirstName?.Trim() ?? string.Empty;
        var lastName = req.LastName?.Trim() ?? string.Empty;
        var email = req.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var password = req.Password ?? string.Empty;

        if (firstName.Length == 0 || lastName.Length == 0 || email.Length == 0 || string.IsNullOrWhiteSpace(req.Phone) || password.Length == 0)
            return Outcome<AuthResponse>.Fail(400, "Bütün məcburi sahələr doldurulmalıdır.");
        if (password != req.ConfirmPassword)
            return Outcome<AuthResponse>.Fail(400, "Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.");
        if (password.Length < 6)
            return Outcome<AuthResponse>.Fail(400, "Şifrə ən azı 6 simvoldan ibarət olmalıdır.");
        if (!AzerbaijaniPhone.TryNormalize(req.Phone, out var phone))
            return Outcome<AuthResponse>.Fail(400, AzerbaijaniPhone.InvalidMessage);
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            return Outcome<AuthResponse>.Fail(409, "Bu elektron poçt ünvanı artıq sistemdə qeydiyyatdan keçib.");

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
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var token = sessions.Create(user, response);
        return Outcome<AuthResponse>.Success(new AuthResponse("Qeydiyyat uğurla tamamlandı.", token, UserDto.From(user), ProfileDto.From(profile)));
    }

    public async Task<Outcome<AuthResponse>> LoginAsync(LoginRequest req, HttpResponse response, CancellationToken ct)
    {
        var email = req.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (email.Length == 0 || string.IsNullOrEmpty(req.Password))
            return Outcome<AuthResponse>.Fail(400, "E-poçt və şifrə daxil edilməlidir.");

        var user = await db.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Outcome<AuthResponse>.Fail(401, "E-poçt və ya şifrə yanlışdır.");

        var token = sessions.Create(user, response);
        return Outcome<AuthResponse>.Success(new AuthResponse("Uğurla daxil oldunuz.", token, UserDto.From(user), ProfileDto.From(user.Profile)));
    }

    public async Task<MeResponse?> MeAsync(string userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : new MeResponse(UserDto.From(user), ProfileDto.From(user.Profile));
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
