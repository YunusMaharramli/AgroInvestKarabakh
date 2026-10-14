using QarabagInvestmentPortal.Api.Infrastructure.Validation;

namespace QarabagInvestmentPortal.UnitTests;

public sealed class AzerbaijaniPhoneTests
{
    [Theory]
    [InlineData("+994 50 123 45 67", "+994 50 123 45 67")]
    [InlineData("+994501234567", "+994 50 123 45 67")]
    [InlineData("994501234567", "+994 50 123 45 67")]
    [InlineData("00994 55 765 43 21", "+994 55 765 43 21")]
    [InlineData("050 123 45 67", "+994 50 123 45 67")]
    [InlineData("(051) 222-33-44", "+994 51 222 33 44")]
    [InlineData("0702223344", "+994 70 222 33 44")]
    [InlineData("077 222 33 44", "+994 77 222 33 44")]
    [InlineData("099 222 33 44", "+994 99 222 33 44")]
    [InlineData("010 222 33 44", "+994 10 222 33 44")]
    [InlineData("060 222 33 44", "+994 60 222 33 44")]
    [InlineData("+994 12 498 70 00", "+994 12 498 70 00")] // Baku landline
    [InlineData("022 256 78 90", "+994 22 256 78 90")]      // Ganja landline
    [InlineData("036 545 12 34", "+994 36 545 12 34")]      // Nakhchivan landline
    public void Accepts_plausible_numbers_and_normalises_them(string input, string expected)
    {
        Assert.True(AzerbaijaniPhone.TryNormalize(input, out var normalized));
        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345")]
    [InlineData("+994 50 123 45 6")]      // too short
    [InlineData("+994 50 123 45 678")]    // too long
    [InlineData("+994 40 123 45 67")]     // 40 is not an Azerbaijani code
    [InlineData("+994 50 023 45 67")]     // subscriber number cannot start with 0
    [InlineData("+994 50 123 45 6a")]     // letters
    [InlineData("+7 912 345 67 89")]      // another country
    [InlineData("+0501234567")]           // "+" with a local number
    [InlineData("050+1234567")]           // "+" in the middle
    [InlineData("+994 50 123 45 67 ext 2")]
    public void Rejects_implausible_numbers(string? input)
    {
        Assert.False(AzerbaijaniPhone.TryNormalize(input, out _));
        Assert.False(AzerbaijaniPhone.IsValid(input));
    }
}
