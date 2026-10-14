namespace QarabagInvestmentPortal.BuildingBlocks.Application;

public class Result
{
    protected Result(bool isSuccess, string? error)
    {
        if (isSuccess == (error is not null))
        {
            throw new ArgumentException("A successful result cannot contain an error and a failed result must contain one.");
        }

        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    public string? Error { get; }

    public static Result Success() => new(true, null);

    public static Result Failure(string error)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(error);
        return new Result(false, error);
    }
}
