using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class InternationalPhoneTests
{
    [Theory]
    [InlineData("+1 202 555 0183", "+12025550183")]
    [InlineData("+44 (20) 7946-0958", "+442079460958")]
    [InlineData("0049 30 123456", "+4930123456")]
    public void Normalizes_international_numbers(string input, string expected)
    {
        Assert.True(InternationalPhone.TryNormalize(input, out var normalized));
        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData("not a phone")]
    [InlineData("12345")]
    [InlineData("+1234567890123456")]
    [InlineData("+1+2025550183")]
    public void Rejects_invalid_international_numbers(string input)
    {
        Assert.False(InternationalPhone.TryNormalize(input, out _));
    }
}
