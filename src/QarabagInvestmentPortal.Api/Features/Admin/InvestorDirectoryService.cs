using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Users;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Admin;

public sealed record InvestorDirectoryItem(UserDto User, ProfileDto? Profile, int ApplicationCount, decimal ProposedInvestment);
public sealed record InvestorDirectoryPage(IReadOnlyList<InvestorDirectoryItem> Items, int Total, int Page, int PageSize);

public sealed class InvestorDirectoryService(AppDbContext db)
{
    public async Task<UserDto?> SetVerificationAsync(string userId, bool isVerified, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Role == UserRole.User, ct);
        if (user is null) return null;
        user.IsVerified = isVerified;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return UserDto.From(user);
    }

    public async Task<InvestorDirectoryPage> ListAsync(string? search, int page, CancellationToken ct)
    {
        const int pageSize = 25;
        page = Math.Clamp(page, 1, 100_000);
        var query = db.Users.AsNoTracking().Where(u => u.Role == UserRole.User);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("%", "").Replace("_", "")}%";
            query = query.Where(u => EF.Functions.ILike(u.FirstName, pattern) || EF.Functions.ILike(u.LastName, pattern)
                || EF.Functions.ILike(u.Email, pattern) || (u.Phone != null && EF.Functions.ILike(u.Phone, pattern))
                || (u.Profile != null && (EF.Functions.ILike(u.Profile.CompanyName, pattern)
                    || EF.Functions.ILike(u.Profile.TaxIdentificationNumber, pattern))));
        }

        var total = await query.CountAsync(ct);
        var users = await query.Include(u => u.Profile).ThenInclude(p => p!.Documents).OrderByDescending(u => u.CreatedAt).ThenBy(u => u.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var ids = users.Select(u => u.Id).ToList();
        var totals = await db.Proposals.AsNoTracking().Where(p => ids.Contains(p.InvestorId))
            .GroupBy(p => p.InvestorId)
            .Select(g => new { Id = g.Key, Count = g.Count(), Amount = g.Sum(p => p.ProposedInvestmentAmount) })
            .ToDictionaryAsync(x => x.Id, ct);
        return new InvestorDirectoryPage(users.Select(u =>
        {
            totals.TryGetValue(u.Id, out var summary);
            return new InvestorDirectoryItem(UserDto.From(u), ProfileDto.From(u.Profile), summary?.Count ?? 0, summary?.Amount ?? 0);
        }).ToList(), total, page, pageSize);
    }
}
