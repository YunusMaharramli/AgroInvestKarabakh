using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;

namespace QarabagInvestmentPortal.Api.Features.Chat;

[Authorize(Policy = Policies.SignedIn)]
public sealed class ChatHub(ChatService chat) : Hub
{
    public static string GroupName(string proposalId) => $"proposal:{proposalId}";

    public async Task JoinProposal(string proposalId)
    {
        var viewer = new Viewer(Context.User?.UserId(), Context.User?.IsAdmin() ?? false);
        if (!await chat.CanReadAsync(proposalId, viewer, Context.ConnectionAborted))
            throw new HubException("Yazışmaya giriş icazəniz yoxdur.");
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(proposalId), Context.ConnectionAborted);
    }

    public Task LeaveProposal(string proposalId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(proposalId), Context.ConnectionAborted);
}
