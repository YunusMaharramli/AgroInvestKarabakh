using System.Text;

namespace QarabagInvestmentPortal.Api.Infrastructure.Validation;

/// <summary>
/// Checks that a phone number is a plausible Azerbaijani number (no SMS check) and normalises it to "+994 XX XXX XX XX".
/// Accepted input: "+994 50 123 45 67", "994501234567", "050 123 45 67", "(050) 123-45-67", "00994 50 ...".
/// Valid: 9 national digits = 2-digit code + 7-digit subscriber number (not starting with 0).
/// Codes: mobile 10, 50, 51, 55, 60, 70, 77, 99; landline 12 (Baku), 18 (Sumqayıt), 20–26 (regions), 36 (Naxçıvan).
/// </summary>
public static class AzerbaijaniPhone
{
    private static readonly HashSet<string> Codes =
    [
        "10", "50", "51", "55", "60", "70", "77", "99",
        "12", "18", "20", "21", "22", "23", "24", "25", "26", "36",
    ];

    public const string InvalidMessage =
        "Telefon nömrəsi düzgün deyil. Azərbaycan nömrəsi yazın, məsələn: +994 50 123 45 67 və ya 050 123 45 67.";

    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input)) return false;

        var trimmed = input.Trim();
        var digits = new StringBuilder();
        foreach (var c in trimmed)
        {
            if (char.IsAsciiDigit(c)) digits.Append(c);
            else if (c is ' ' or '-' or '(' or ')' or '.' or '+' or ' ') continue;
            else return false; // letters or other symbols
        }
        if (trimmed.IndexOf('+', 1) >= 0) return false; // "+" only at the start

        var d = digits.ToString();
        string national;
        if (d.StartsWith("00994", StringComparison.Ordinal) && d.Length == 14) national = d[5..];
        else if (d.StartsWith("994", StringComparison.Ordinal) && d.Length == 12) national = d[3..];
        else if (d.StartsWith('0') && d.Length == 10 && !trimmed.StartsWith('+')) national = d[1..];
        else if (d.Length == 9 && !trimmed.StartsWith('+')) national = d;
        else return false;

        var code = national[..2];
        var subscriber = national[2..];
        if (!Codes.Contains(code) || subscriber[0] == '0') return false;

        normalized = $"+994 {code} {subscriber[..3]} {subscriber[3..5]} {subscriber[5..]}";
        return true;
    }

    public static bool IsValid(string? input) => TryNormalize(input, out _);
}
