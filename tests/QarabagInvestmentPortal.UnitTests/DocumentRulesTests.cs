using QarabagInvestmentPortal.Api.Infrastructure.Files;
using QarabagInvestmentPortal.Api.Infrastructure.Import;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class DocumentRulesTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];
    private static readonly byte[] Jpg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0];
    private static readonly byte[] Pdf = "%PDF-1.7\n"u8.ToArray();
    private static readonly byte[] Exe = [0x4D, 0x5A, 0x90, 0x00];

    [Fact]
    public void Detects_file_type_from_content_not_name()
    {
        Assert.Equal(("image/png", ".png"), PrivateFileStorage.DetectType(Png));
        Assert.Equal(("image/jpeg", ".jpg"), PrivateFileStorage.DetectType(Jpg));
        Assert.Equal(("application/pdf", ".pdf"), PrivateFileStorage.DetectType(Pdf));
        Assert.Null(PrivateFileStorage.DetectType(Exe));
        Assert.Null(PrivateFileStorage.DetectType([]));
    }

    [Fact]
    public void Land_documents_allow_only_images_and_proposal_documents_also_pdf()
    {
        Assert.Equal(new[] { "image/jpeg", "image/png" }, FileRule.LandDocuments.AllowedTypes);
        Assert.Contains("application/pdf", FileRule.ProposalDocuments.AllowedTypes);
        Assert.Equal(10 * 1024 * 1024, FileRule.LandDocuments.MaxBytes);
        Assert.Equal(10 * 1024 * 1024, FileRule.ProposalDocuments.MaxBytes);
    }

    [Fact]
    public void Legacy_documents_without_real_content_become_a_valid_placeholder_pdf()
    {
        var (bytes, type, ext) = LegacyJsonImporter.DocumentContent("JVBERi0xLjQKJcTl8uXr...", "Biznes_Plan_Ağdam.pdf");
        Assert.Equal("application/pdf", type);
        Assert.Equal(".pdf", ext);
        Assert.Equal(("application/pdf", ".pdf"), PrivateFileStorage.DetectType(bytes));
        Assert.Contains("%%EOF", System.Text.Encoding.ASCII.GetString(bytes), StringComparison.Ordinal);
    }

    [Fact]
    public void Legacy_documents_with_real_content_keep_their_bytes()
    {
        var real = Convert.ToBase64String(Png);
        var (bytes, type, _) = LegacyJsonImporter.DocumentContent($"data:image/png;base64,{real}", "x.png");
        Assert.Equal("image/png", type);
        Assert.Equal(Png, bytes);
    }
}
