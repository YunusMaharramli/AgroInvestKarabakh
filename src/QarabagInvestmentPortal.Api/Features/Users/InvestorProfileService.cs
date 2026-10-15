using System.Globalization;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;
using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.Api.Features.Users;

public sealed class InvestorProfileService(AppDbContext db, PrivateFileStorage storage, TimeProvider clock)
{
    private static readonly HashSet<string> IncomeStabilities = ["STABLE", "SEASONAL", "IRREGULAR", "OTHER"];
    private static readonly HashSet<string> Periods = ["MONTHLY", "ANNUAL"];
    private static readonly HashSet<string> DocumentCategories = ["IDENTITY", "REGISTRATION", "FINANCIAL", "EXPERIENCE", "OTHER"];
    private const decimal MaxAmount = 1_000_000_000_000m;

    public async Task<Outcome<ProfileDto>> UpdateAsync(string userId, InvestorProfileUpdateRequest req, CancellationToken ct)
    {
        var user = await db.Users.Include(u => u.Profile).ThenInclude(p => p!.Documents)
            .FirstOrDefaultAsync(u => u.Id == userId && u.Role == UserRole.User && u.ApplicantType != null, ct);
        if (user is null) return Fail<ProfileDto>(404, "Investor hesabı tapılmadı.");

        var existing = user.Profile;
        static string Clean(string? value) => value?.Trim() ?? string.Empty;
        var identityChanged =
            (req.CompanyName is not null && Clean(req.CompanyName) != (existing?.CompanyName ?? string.Empty)) ||
            (req.TaxIdentificationNumber is not null && Clean(req.TaxIdentificationNumber) != (existing?.TaxIdentificationNumber ?? string.Empty)) ||
            (req.ForeignTaxNumber is not null && Clean(req.ForeignTaxNumber) != Clean(existing?.ForeignTaxNumber)) ||
            (req.Country is not null && Clean(req.Country).ToUpperInvariant() != Clean(existing?.Country).ToUpperInvariant()) ||
            (req.LegalForm is not null && Clean(req.LegalForm) != Clean(existing?.LegalForm)) ||
            (req.RegistrationDate is not null && req.RegistrationDate != existing?.RegistrationDate) ||
            (req.CitizenshipCountry is not null && Clean(req.CitizenshipCountry).ToUpperInvariant() != Clean(existing?.CitizenshipCountry).ToUpperInvariant()) ||
            (req.ResidenceCountry is not null && Clean(req.ResidenceCountry).ToUpperInvariant() != Clean(existing?.ResidenceCountry).ToUpperInvariant()) ||
            (req.DateOfBirth is not null && req.DateOfBirth != existing?.DateOfBirth) ||
            (req.CeoName is not null && Clean(req.CeoName) != Clean(existing?.CeoName)) ||
            (req.IdentityDocumentType is not null && Clean(req.IdentityDocumentType) != Clean(existing?.IdentityDocumentType)) ||
            (req.IdentityDocumentNumber is not null && Clean(req.IdentityDocumentNumber) != Clean(existing?.IdentityDocumentNumber)) ||
            (req.ResidencyStatus is not null && Clean(req.ResidencyStatus) != Clean(existing?.ResidencyStatus)) ||
            (req.Address is not null && Clean(req.Address) != Clean(existing?.Address)) ||
            (req.RepresentativeRole is not null && Clean(req.RepresentativeRole) != Clean(existing?.RepresentativeRole));
        if (identityChanged && (string.IsNullOrWhiteSpace(req.CurrentPassword) || !BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash)))
            return Fail<ProfileDto>(400, "Həssas məlumatları dəyişmək üçün hazırkı şifrənizi düzgün daxil edin.");

        static string? Text(string? value, int max, string label, out string? error)
        {
            error = null;
            if (value is null) return null;
            var clean = value.Trim();
            if (clean.Length > max) { error = $"{label} ən çox {max} simvol ola bilər."; return null; }
            return clean.Length == 0 ? null : clean;
        }

        var stability = req.IncomeStability?.Trim().ToUpperInvariant();
        if (stability is not null && !IncomeStabilities.Contains(stability)) return Fail<ProfileDto>(400, "Gəlirin sabitlik növünü seçin.");
        var incomePeriod = req.IncomePeriod?.Trim().ToUpperInvariant();
        var debtPeriod = req.DebtRepaymentFrequency?.Trim().ToUpperInvariant();
        if (incomePeriod is not null && !Periods.Contains(incomePeriod)) return Fail<ProfileDto>(400, "Gəlir dövrünü seçin.");
        if (debtPeriod is not null && !Periods.Contains(debtPeriod)) return Fail<ProfileDto>(400, "Borc ödənişinin dövrünü seçin.");
        var currency = req.FinancialCurrency?.Trim().ToUpperInvariant();
        if (currency is not null && (currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z'))) return Fail<ProfileDto>(400, "Valyuta kodunu düzgün yazın.");
        if (req.ExperienceYears is < 0 or > 100) return Fail<ProfileDto>(400, "Təcrübə müddəti 0–100 il aralığında olmalıdır.");
        if (req.DateOfBirth is { } dob && (dob > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime) || dob.Year < 1900)) return Fail<ProfileDto>(400, "Doğum tarixi düzgün deyil.");
        if (req.RegistrationDate is { } rd && rd > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime)) return Fail<ProfileDto>(400, "Qeydiyyat tarixi gələcəkdə ola bilməz.");

        var amounts = new (decimal? Value, string Name)[]
        {
            (req.MonthlyNetIncome, "Aylıq gəlir"), (req.OutstandingDebt, "Borc qalığı"),
            (req.DebtRepaymentAmount, "Borc ödənişi"), (req.MonthlyCreditPayment, "Aylıq kredit ödənişi"),
            (req.FixedMonthlyIncome, "Sabit aylıq gəlir"), (req.MinimumFunds, "Minimum vəsait"), (req.AnnualRevenue, "İllik dövriyyə"),
            (req.LiquidFundsAvailable, "Sərbəst vəsait"),
            (req.OwnContribution, "Öz vəsaiti"), (req.PostInvestmentReserve, "Ehtiyat vəsaiti"),
            (req.AdditionalFinancingRequired, "Əlavə maliyyə"),
        };
        foreach (var amount in amounts)
            if (amount.Value is < 0 || amount.Value > MaxAmount) return Fail<ProfileDto>(400, $"{amount.Name} 0–{MaxAmount.ToString(CultureInfo.InvariantCulture)} aralığında olmalıdır.");
        if (req.NetProfitOrLoss is { } pnl && (pnl < -MaxAmount || pnl > MaxAmount)) return Fail<ProfileDto>(400, "Xalis mənfəət və ya zərər məbləği düzgün deyil.");
        if (req.OperatingCashFlow is { } cashFlow && (cashFlow < -MaxAmount || cashFlow > MaxAmount)) return Fail<ProfileDto>(400, "Əməliyyat pul axını düzgün deyil.");

        var now = clock.GetUtcNow();
        var profile = user.Profile ??= new UserProfile { Id = Ids.New("prof"), UserId = user.Id, CreatedAt = now };
        string? SetText(string? value, int max, string name, Action<string?> setter)
        {
            if (value is null) { setter(null); return null; }
            var clean = Text(value, max, name, out var error);
            if (error is not null) return error;
            setter(clean);
            return null;
        }
        var textErrors = new List<string>();
        void Set(string? value, int max, string name, Action<string?> setter) { var error = SetText(value, max, name, setter); if (error is not null) textErrors.Add(error); }

        var company = user.ApplicantType is ApplicantType.LegalEntity or ApplicantType.ForeignEntity;
        if (company)
        {
            Set(req.CompanyName, 200, "Şirkətin adı", v => profile.CompanyName = v ?? string.Empty);
            Set(req.TaxIdentificationNumber, 20, "VÖEN", v => profile.TaxIdentificationNumber = v ?? string.Empty);
            Set(req.ForeignTaxNumber, 40, "Xarici vergi nömrəsi", v => profile.ForeignTaxNumber = v);
            Set(req.BusinessActivity, 1000, "Fəaliyyət sahəsi", v => profile.BusinessActivity = v ?? string.Empty);
            Set(req.LegalForm, 100, "Hüquqi forma", v => profile.LegalForm = v);
            Set(req.ActivityStatus, 32, "Şirkətin statusu", v => profile.ActivityStatus = v);
            Set(req.CeoName, 200, "Rəhbərin adı", v => profile.CeoName = v);
            Set(req.RepresentativeRole, 100, "Nümayəndənin vəzifəsi", v => profile.RepresentativeRole = v);
            profile.ActivityStartDate = req.ActivityStartDate;
            profile.RegistrationDate = req.RegistrationDate;
            if (user.ApplicantType == ApplicantType.ForeignEntity)
                Set(req.Country, 2, "Qeydiyyat ölkəsi", v => profile.Country = v?.ToUpperInvariant());
        }
        Set(req.Address, 500, "Hüquqi ünvan", v => profile.Address = v);
        Set(req.OperatingAddress, 500, "Fəaliyyət ünvanı", v => profile.OperatingAddress = v);
        Set(req.IncomeSource, 500, "Gəlir mənbəyi", v => profile.IncomeSource = v);
        Set(req.FinancialReportingPeriod, 100, "Hesabat dövrü", v => profile.FinancialReportingPeriod = v);
        Set(req.ExperienceDescription, 2000, "Təcrübə", v => profile.ExperienceDescription = v);
        Set(req.OperationalCapacity, 2000, "Əməliyyat imkanları", v => profile.OperationalCapacity = v);
        Set(req.PreviousProjects, 2000, "Əvvəlki layihələr", v => profile.PreviousProjects = v);

        profile.IncomeStability = stability;
        profile.MonthlyNetIncome = req.MonthlyNetIncome;
        profile.IncomePeriod = incomePeriod;
        profile.FinancialCurrency = currency;
        profile.OutstandingDebt = req.OutstandingDebt;
        profile.DebtRepaymentAmount = req.DebtRepaymentAmount;
        profile.DebtRepaymentFrequency = debtPeriod;
        profile.AnnualRevenue = company ? req.AnnualRevenue : null;
        profile.NetProfitOrLoss = company ? req.NetProfitOrLoss : null;
        profile.OperatingCashFlow = company ? req.OperatingCashFlow : null;
        profile.LiquidFundsAvailable = req.LiquidFundsAvailable;
        profile.OwnContribution = req.OwnContribution;
        profile.PostInvestmentReserve = req.PostInvestmentReserve;
        profile.AdditionalFinancingRequired = req.AdditionalFinancingRequired;
        profile.ExperienceYears = req.ExperienceYears;
        profile.HasCredit = req.HasCredit;
        profile.MonthlyCreditPayment = req.MonthlyCreditPayment;
        profile.HasFixedIncome = req.HasFixedIncome;
        profile.FixedMonthlyIncome = req.FixedMonthlyIncome;
        profile.MinimumFunds = req.MinimumFunds;
        if (user.ApplicantType == ApplicantType.ForeignIndividual)
        {
            Set(req.CitizenshipCountry, 2, "Vətəndaşlıq ölkəsi", v => profile.CitizenshipCountry = v?.ToUpperInvariant());
            Set(req.ResidenceCountry, 2, "Yaşayış ölkəsi", v => profile.ResidenceCountry = v?.ToUpperInvariant());
            profile.DateOfBirth = req.DateOfBirth;
            Set(req.IdentityDocumentType, 50, "Şəxsiyyət sənədinin növü", v => profile.IdentityDocumentType = v);
            Set(req.IdentityDocumentNumber, 100, "Şəxsiyyət sənədinin nömrəsi", v => profile.IdentityDocumentNumber = v);
            Set(req.ResidencyStatus, 32, "Yaşayış statusu", v => profile.ResidencyStatus = v);
        }
        profile.UpdatedAt = now;
        user.UpdatedAt = now;
        if (textErrors.Count > 0) return Fail<ProfileDto>(400, textErrors[0]);
        await db.SaveChangesAsync(ct);
        return Outcome<ProfileDto>.Success(ProfileDto.From(profile)!);
    }

    public async Task<List<InvestorProfileDocumentDto>> ListDocumentsAsync(string userId, CancellationToken ct) =>
        await db.InvestorProfileDocuments.AsNoTracking().Where(d => d.UserId == userId)
            .OrderByDescending(d => d.UploadedAt).Select(d => InvestorProfileDocumentDto.From(d)).ToListAsync(ct);

    public async Task<Outcome<InvestorProfileDocumentDto>> UploadAsync(string userId, IFormCollection form, CancellationToken ct)
    {
        var category = form["category"].ToString().Trim().ToUpperInvariant();
        if (!DocumentCategories.Contains(category)) return Fail<InvestorProfileDocumentDto>(400, "Sənəd növünü seçin.");
        var (files, error) = await PrivateFileStorage.ValidateAsync(form.Files.GetFiles("file"), FileRule.InvestorProfileDocuments, ct);
        if (error is not null) return Fail<InvestorProfileDocumentDto>(400, error);
        var file = files.SingleOrDefault();
        if (file is null) return Fail<InvestorProfileDocumentDto>(400, "Yükləmək üçün fayl seçin.");
        var userExists = await db.Users.AnyAsync(u => u.Id == userId && u.Role == UserRole.User && u.ApplicantType != null, ct);
        if (!userExists) return Fail<InvestorProfileDocumentDto>(404, "Investor hesabı tapılmadı.");
        if (await db.InvestorProfileDocuments.CountAsync(d => d.UserId == userId, ct) >= 10) return Fail<InvestorProfileDocumentDto>(400, "Profilə ən çox 10 sənəd yükləmək olar.");

        var id = Ids.New("idoc");
        var key = await storage.SaveAsync($"investor-profiles/{userId}", id, file, ct);
        try
        {
            var document = new InvestorProfileDocument
            {
                Id = id, UserId = userId, FileName = Path.GetFileName(file.File.FileName)[..Math.Min(Path.GetFileName(file.File.FileName).Length, 255)],
                Category = category, ContentType = file.ContentType, SizeBytes = file.File.Length, StorageKey = key, UploadedAt = clock.GetUtcNow(),
            };
            db.InvestorProfileDocuments.Add(document);
            await db.SaveChangesAsync(ct);
            return Outcome<InvestorProfileDocumentDto>.Success(InvestorProfileDocumentDto.From(document));
        }
        catch { storage.TryDelete(key); throw; }
    }

    public async Task<Outcome<MessageResponse>> DeleteAsync(string userId, string id, CancellationToken ct)
    {
        var doc = await db.InvestorProfileDocuments.FirstOrDefaultAsync(d => d.UserId == userId && d.Id == id, ct);
        if (doc is null) return Fail<MessageResponse>(404, "Sənəd tapılmadı.");
        db.InvestorProfileDocuments.Remove(doc);
        await db.SaveChangesAsync(ct);
        storage.TryDelete(doc.StorageKey);
        return Outcome<MessageResponse>.Success(new MessageResponse("Sənəd silindi."));
    }

    private static Outcome<T> Fail<T>(int status, string message) => Outcome<T>.Fail(status, message);
}
