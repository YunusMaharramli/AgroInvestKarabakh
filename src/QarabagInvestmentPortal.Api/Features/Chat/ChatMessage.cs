namespace QarabagInvestmentPortal.Api.Features.Chat;

/// <summary>One durable, append-only conversation per proposal.</summary>
public sealed class ChatMessage
{
    public string Id { get; set; } = string.Empty;
    public string ProposalId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed record ChatMessageDto(string Id, string ProposalId, string SenderId, string Body, DateTimeOffset CreatedAt)
{
    public static ChatMessageDto From(ChatMessage message) =>
        new(message.Id, message.ProposalId, message.SenderId, message.Body, message.CreatedAt);
}

public sealed record SendChatMessageRequest(string? Body);
public sealed record ChatThreadDto(string ProposalId, string ReferenceNumber, string OpportunityTitle,
    string InvestorId, bool CanSend, ChatMessageDto? LastMessage);
