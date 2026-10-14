using System.Security.Cryptography;

namespace QarabagInvestmentPortal.Api.Infrastructure.Http;

/// <summary>Errors are always { "error": "..." } so the frontend can show the message as is.</summary>
public static class ApiResults
{
    public sealed record ErrorResponse(string Error);

    public static IResult Error(int status, string message) => Results.Json(new ErrorResponse(message), statusCode: status);
    public static IResult BadRequest(string message) => Error(StatusCodes.Status400BadRequest, message);
    public static IResult NotFound(string message) => Error(StatusCodes.Status404NotFound, message);
    public static IResult Forbidden(string message = "Bu əməliyyat üçün icazəniz yoxdur.") => Error(StatusCodes.Status403Forbidden, message);
    public static IResult Conflict(string message) => Error(StatusCodes.Status409Conflict, message);
}

/// <summary>Result of a service call: either a value or an error to show to the user.</summary>
public readonly record struct Outcome<T>(T? Value, int Status, string? Error)
{
    public bool Ok => Error is null;
    public static Outcome<T> Success(T value) => new(value, StatusCodes.Status200OK, null);
    public static Outcome<T> Fail(int status, string error) => new(default, status, error);

    public IResult ToResult(Func<T, IResult> onSuccess) => Ok ? onSuccess(Value!) : ApiResults.Error(Status, Error!);
}

/// <summary>Readable string ids like the legacy data ("land-1700000000000-ab12cd34").</summary>
public static class Ids
{
    public static string New(string prefix) =>
        $"{prefix}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant()}";
}
