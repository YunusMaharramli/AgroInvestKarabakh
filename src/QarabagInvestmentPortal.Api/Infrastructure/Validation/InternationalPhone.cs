using System.Text;

namespace QarabagInvestmentPortal.Api.Infrastructure.Validation;

/// <summary>Accepts supported Azerbaijani numbers and international E.164-style phone numbers.</summary>
public static class InternationalPhone
{
    public const string InvalidMessage = "Beynəlxalq formatda düzgün telefon nömrəsi yazın.";

    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input)) return false;

        if (AzerbaijaniPhone.TryNormalize(input, out normalized)) return true;

        var trimmed = input.Trim();
        var digits = new StringBuilder();
        foreach (var character in trimmed)
        {
            if (char.IsAsciiDigit(character)) digits.Append(character);
            else if (character is ' ' or '-' or '(' or ')' or '.' or '+' or '\u00a0') continue;
            else return false;
        }

        if (trimmed.IndexOf('+', 1) >= 0) return false;
        var normalizedDigits = digits.ToString();
        if (normalizedDigits.StartsWith("00", StringComparison.Ordinal)) normalizedDigits = normalizedDigits[2..];
        if (normalizedDigits.Length is < 7 or > 15) return false;

        normalized = $"+{normalizedDigits}";
        return true;
    }
}
