using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QarabagInvestmentPortal.Api.Features.Notifications;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Chat;

public sealed class ChatService(
    AppDbContext db, TimeProvider clock, NotificationService notifications,
    IHubContext<ChatHub> hub, ILogger<ChatService> logger)
{
    private IQueryable<Proposal> VisibleProposals(Viewer viewer) => db.Proposals.AsNoTracking()
        .Include(p => p.Opportunity).ThenInclude(o => o!.Land)
        .Where(p => viewer.IsAdmin || p.InvestorId == viewer.UserId
            || (p.Opportunity!.Source == OpportunitySource.Owner && p.Opportunity.Land!.OwnerId == viewer.UserId));

    public Task<bool> CanReadAsync(string proposalId, Viewer viewer, CancellationToken ct) =>
        VisibleProposals(viewer).AnyAsync(p => p.Id == proposalId, ct);

    public async Task<List<ChatThreadDto>> ThreadsAsync(Viewer viewer, CancellationToken ct)
    {
        var proposals = await VisibleProposals(viewer).OrderByDescending(p => p.SubmittedAt).ToListAsync(ct);
        var ids = proposals.Select(p => p.Id).ToList();
        var messages = await db.ChatMessages.AsNoTracking().Where(m => ids.Contains(m.ProposalId))
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).ToListAsync(ct);
        var latest = messages.GroupBy(m => m.ProposalId).ToDictionary(g => g.Key, g => ChatMessageDto.From(g.First()));
        return proposals.Select(p => new ChatThreadDto(p.Id, p.ReferenceNumber, p.Opportunity!.Title,
            p.InvestorId, ChatPolicy.CanSend(p, viewer, latest.ContainsKey(p.Id)), latest.GetValueOrDefault(p.Id))).ToList();
    }

    public async Task<Outcome<List<ChatMessageDto>>> MessagesAsync(
        string proposalId, Viewer viewer, DateTimeOffset? before, CancellationToken ct)
    {
        if (!await CanReadAsync(proposalId, viewer, ct))
            return Outcome<List<ChatMessageDto>>.Fail(404, "Yazışma tapılmadı.");
        var query = db.ChatMessages.AsNoTracking().Where(m => m.ProposalId == proposalId);
        if (before is not null) query = query.Where(m => m.CreatedAt < before.Value);
        var rows = await query.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(50).ToListAsync(ct);
        rows.Reverse();
        return Outcome<List<ChatMessageDto>>.Success(rows.Select(ChatMessageDto.From).ToList());
    }

    public async Task<Outcome<ChatMessageDto>> SendAsync(
        string proposalId, string? body, Viewer viewer, CancellationToken ct)
    {
        body = body?.Trim();
        if (string.IsNullOrWhiteSpace(body) || body.Length > 2000)
            return Outcome<ChatMessageDto>.Fail(400, "Mesaj 1–2000 simvol olmalıdır.");

        var opportunityId = await db.Proposals.AsNoTracking().Where(p => p.Id == proposalId)
            .Select(p => p.OpportunityId).FirstOrDefaultAsync(ct);
        if (opportunityId is null) return Outcome<ChatMessageDto>.Fail(404, "Yazışma tapılmadı.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM portal.investment_opportunities WHERE \"Id\" = {0} FOR UPDATE", [opportunityId], ct);
        var proposal = await db.Proposals.Include(p => p.Opportunity).ThenInclude(o => o!.Land)
            .FirstOrDefaultAsync(p => p.Id == proposalId, ct);
        if (proposal is null || !CanRead(proposal, viewer))
            return Outcome<ChatMessageDto>.Fail(404, "Yazışma tapılmadı.");
        var started = await db.ChatMessages.AnyAsync(m => m.ProposalId == proposalId, ct);
        if (!ChatPolicy.CanSend(proposal, viewer, started))
            return Outcome<ChatMessageDto>.Fail(403, "Bu yazışmada mesaj göndərə bilməzsiniz.");

        var message = new ChatMessage
        {
            Id = Ids.New("msg"), ProposalId = proposalId, SenderId = viewer.UserId!,
            Body = body, CreatedAt = clock.GetUtcNow(),
        };
        db.ChatMessages.Add(message);
        var recipientId = proposal.InvestorId == viewer.UserId
            ? proposal.Opportunity!.Land!.OwnerId
            : proposal.InvestorId;
        if (recipientId is not null)
            notifications.Notify(recipientId, "Yeni mesaj",
                $"{proposal.ReferenceNumber} nömrəli təklif üzrə yeni mesajınız var.");
        else if (proposal.InvestorId == viewer.UserId)
            await notifications.NotifyAdminsAsync("Yeni mesaj",
                $"{proposal.ReferenceNumber} nömrəli dövlət elanı təklifi üzrə yeni mesaj var.", ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var dto = ChatMessageDto.From(message);
        try
        {
            await hub.Clients.Group(ChatHub.GroupName(proposalId)).SendAsync("chatMessage", dto, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Chat message {MessageId} was saved but live delivery failed", message.Id);
        }
        return Outcome<ChatMessageDto>.Success(dto);
    }

    private static bool CanRead(Proposal p, Viewer viewer) =>
        viewer.UserId is not null && (viewer.IsAdmin || p.InvestorId == viewer.UserId
            || (p.Opportunity!.Source == OpportunitySource.Owner && p.Opportunity.Land!.OwnerId == viewer.UserId));

}

public static class ChatPolicy
{
    public static bool CanSend(Proposal p, Viewer viewer, bool started)
    {
        var opportunity = p.Opportunity!;
        var eligible = p.Status == ProposalStatus.Open && opportunity.Status == OpportunityStatus.Active
            || p.Status == ProposalStatus.Selected && opportunity.WinnerProposalId == p.Id;
        if (!eligible) return false;
        var isResponsible = opportunity.Source == OpportunitySource.Owner
            ? opportunity.Land!.OwnerId == viewer.UserId
            : viewer.IsAdmin;
        return isResponsible || started && p.InvestorId == viewer.UserId;
    }
}
