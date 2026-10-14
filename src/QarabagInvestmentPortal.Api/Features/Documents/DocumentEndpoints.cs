using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using QarabagInvestmentPortal.Api.Features.Opportunities;
using QarabagInvestmentPortal.Api.Features.Proposals;
using QarabagInvestmentPortal.Api.Infrastructure.Auth;
using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Http;
using QarabagInvestmentPortal.Api.Infrastructure.Persistence;

namespace QarabagInvestmentPortal.Api.Features.Documents;

/// <summary>
/// The only way to read stored documents.
/// Land documents: admins and the land owner. Proposal documents: admins, the investor and the listing's responsible party.
/// </summary>
public static class DocumentEndpoints
{
    public static RouteGroupBuilder MapDocumentEndpoints(this RouteGroupBuilder api)
    {
        var docs = api.MapGroup("/documents").RequireAuthorization(Policies.SignedIn);

        docs.MapGet("/lands/{id}", async (string id, bool? download, ClaimsPrincipal user, AppDbContext db, PrivateFileStorage storage, HttpResponse response, CancellationToken ct) =>
        {
            var row = await db.LandDocuments.AsNoTracking()
                .Join(db.Lands, d => d.LandId, l => l.Id, (d, l) => new { Doc = d, l.OwnerId })
                .FirstOrDefaultAsync(x => x.Doc.Id == id, ct);
            if (row is null) return ApiResults.NotFound("Sənəd tapılmadı.");
            if (!user.IsAdmin() && row.OwnerId != user.UserId()) return ApiResults.Forbidden("Bu sənədə baxmaq icazəniz yoxdur.");
            return Serve(storage, row.Doc.StorageKey, row.Doc.ContentType, row.Doc.FileName, download == true, response);
        });

        docs.MapGet("/proposals/{id}", async (string id, bool? download, ClaimsPrincipal user, AppDbContext db, PrivateFileStorage storage, HttpResponse response, CancellationToken ct) =>
        {
            var doc = await db.ProposalDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct);
            if (doc is null) return ApiResults.NotFound("Sənəd tapılmadı.");
            var proposal = await db.Proposals.AsNoTracking().Include(p => p.Opportunity).ThenInclude(o => o!.Land)
                .FirstAsync(p => p.Id == doc.ProposalId, ct);
            if (!ProposalService.CanView(proposal, new Viewer(user.UserId(), user.IsAdmin())))
                return ApiResults.Forbidden("Bu sənədə baxmaq icazəniz yoxdur.");
            return Serve(storage, doc.StorageKey, doc.ContentType, doc.FileName, download == true, response);
        });

        return api;
    }

    private static IResult Serve(PrivateFileStorage storage, string key, string contentType, string fileName, bool download, HttpResponse response)
    {
        var stream = storage.OpenRead(key);
        if (stream is null) return ApiResults.NotFound("Fayl serverdə tapılmadı.");
        response.Headers[HeaderNames.CacheControl] = "private, no-store";
        response.Headers["X-Content-Type-Options"] = "nosniff";
        return download
            ? Results.File(stream, contentType, fileName)
            : Results.Stream(stream, contentType, enableRangeProcessing: true);
    }
}
