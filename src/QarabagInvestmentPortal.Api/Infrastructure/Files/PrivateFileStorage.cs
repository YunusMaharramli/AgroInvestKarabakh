namespace QarabagInvestmentPortal.Api.Infrastructure.Files;

/// <summary>What kind of file may be uploaded where.</summary>
public sealed record FileRule(string Purpose, IReadOnlyList<string> AllowedTypes, long MaxBytes, int MaxFiles)
{
    /// <summary>Land ownership documents: photos/scans only.</summary>
    public static readonly FileRule LandDocuments = new("land", ["image/jpeg", "image/png"], 10 * 1024 * 1024, 10);

    /// <summary>Documents an administrator attaches to a land (ownership, lease, authorization, soil/water analysis): PDF or photos/scans.</summary>
    public static readonly FileRule AdminLandDocuments = new("land", ["application/pdf", "image/jpeg", "image/png"], 10 * 1024 * 1024, 10);

    /// <summary>Public land photos: JPG/PNG.</summary>
    public static readonly FileRule LandPhotos = new("land-photo", ["image/jpeg", "image/png"], 10 * 1024 * 1024, 10);

    /// <summary>Investor proposal documents: PDF or photos/scans.</summary>
    public static readonly FileRule ProposalDocuments = new("proposal", ["application/pdf", "image/jpeg", "image/png"], 10 * 1024 * 1024, 10);

    public string AllowedForHumans => string.Join(", ", AllowedTypes.Select(t => t switch
    {
        "application/pdf" => "PDF",
        "image/jpeg" => "JPG",
        "image/png" => "PNG",
        _ => t,
    }));
}

/// <summary>A checked upload ready to be saved.</summary>
public sealed record ValidatedFile(IFormFile File, string ContentType, string Extension);

/// <summary>
/// Stores uploaded documents on disk outside the web root (Storage:RootPath, default App_Data/files).
/// Files are only ever served through endpoints that check permissions.
/// </summary>
public sealed class PrivateFileStorage
{
    private readonly string _root;

    public PrivateFileStorage(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["Storage:RootPath"];
        _root = Path.GetFullPath(string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, "App_Data", "files")
            : configured);
        Directory.CreateDirectory(_root);
    }

    public string RootPath => _root;

    /// <summary>Checks count, size and the real file type (by its first bytes, not by the file name).</summary>
    public static async Task<(List<ValidatedFile> Files, string? Error)> ValidateAsync(IReadOnlyList<IFormFile> files, FileRule rule, CancellationToken ct)
    {
        var result = new List<ValidatedFile>();
        if (files.Count > rule.MaxFiles) return (result, $"Ən çox {rule.MaxFiles} fayl yükləmək olar.");
        foreach (var file in files)
        {
            if (file.Length == 0) return (result, $"“{file.FileName}” faylı boşdur.");
            if (file.Length > rule.MaxBytes)
                return (result, $"“{file.FileName}” çox böyükdür. Ən çox {rule.MaxBytes / (1024 * 1024)} MB ola bilər.");

            var detected = await DetectTypeAsync(file, ct);
            if (detected is null || !rule.AllowedTypes.Contains(detected.Value.ContentType))
                return (result, $"“{file.FileName}” qəbul edilmir. İcazə verilən növlər: {rule.AllowedForHumans}.");
            result.Add(new ValidatedFile(file, detected.Value.ContentType, detected.Value.Extension));
        }
        return (result, null);
    }

    public async Task<string> SaveAsync(string folder, string documentId, ValidatedFile file, CancellationToken ct)
    {
        var key = $"{folder}/{documentId}{file.Extension}";
        var path = FullPath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var target = File.Create(path);
        await file.File.CopyToAsync(target, ct);
        return key;
    }

    public async Task<string> SaveBytesAsync(string key, byte[] content, CancellationToken ct)
    {
        var path = FullPath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllBytesAsync(path, content, ct);
        return key;
    }

    public Stream? OpenRead(string key)
    {
        var path = FullPath(key);
        return File.Exists(path) ? File.OpenRead(path) : null;
    }

    public void TryDelete(string key)
    {
        try { File.Delete(FullPath(key)); }
        catch (IOException) { /* best effort cleanup */ }
    }

    private string FullPath(string key)
    {
        var path = Path.GetFullPath(Path.Combine(_root, key.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(_root, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Invalid storage key.");
        return path;
    }

    internal static async Task<(string ContentType, string Extension)?> DetectTypeAsync(IFormFile file, CancellationToken ct)
    {
        var header = new byte[8];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        return DetectType(header.AsSpan(0, read));
    }

    internal static (string ContentType, string Extension)? DetectType(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return ("image/jpeg", ".jpg");
        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return ("image/png", ".png");
        if (header.Length >= 4 && header[..4].SequenceEqual("%PDF"u8)) return ("application/pdf", ".pdf");
        return null;
    }
}
