using System.Text.Json;
using System.Text.Json.Nodes;

namespace QarabagInvestmentPortal.Api;

internal sealed class LegacyDatabase(IConfiguration configuration, IWebHostEnvironment environment)
{
    private readonly object _gate = new();
    private readonly string _path = ResolvePath(configuration, environment);
    private JsonObject? _data;

    public T Read<T>(Func<JsonObject, T> action)
    {
        lock (_gate)
        {
            return action(Data);
        }
    }

    public T Write<T>(Func<JsonObject, T> action)
    {
        lock (_gate)
        {
            var result = action(Data);
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            File.WriteAllText(_path, Data.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            return result;
        }
    }

    private JsonObject Data => _data ??= Load();

    private JsonObject Load()
    {
        if (!File.Exists(_path))
        {
            throw new FileNotFoundException(
                "Legacy data file was not found. Configure LegacyBackend:DatabasePath.", _path);
        }

        return JsonNode.Parse(File.ReadAllText(_path))?.AsObject()
            ?? throw new InvalidOperationException($"Invalid JSON database: {_path}");
    }

    private static string ResolvePath(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["LegacyBackend:DatabasePath"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(configured);
        }

        return Path.GetFullPath(Path.Combine(environment.ContentRootPath,
            "..", "..", "..", "..", "agroinvest-fixed", "proj", "data", "agroinvest_db.json"));
    }
}
