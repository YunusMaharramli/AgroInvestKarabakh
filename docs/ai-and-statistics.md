# AI analysis and statistics

## Admin proposal analysis

Admins can request advisory analysis for a land from the applications page. The analysis covers all still-open proposals for the land and never records a decision.

- The provider receives proposal aliases, numeric fields and server-generated evidence statements only. Applicant names, contact details, business-plan text and private document contents are excluded.
- Provider reasons and risks are accepted only when they exactly match that evidence.
- The server computes first-year sensitivity scenarios from the applicant's stated annual revenue and project costs (revenue at 80% / 100% / 120%, costs at 120% / 100% / 80%). Project costs are treated as a one-time first-year cost. No profit probability is estimated.
- Eligibility conditions and document contents still require manual review.
- If Gemini is unavailable or the input exceeds 30,000 characters, the endpoint returns deterministic evidence, comparisons and projections without an AI recommendation.

## Investor land analysis

Available on a land detail page after investor sign-in. It combines the selected land area with that investor's profile and returns illustrative scenarios; a scenario may show a loss. It does not create an application or change a decision.

## Gemini configuration

Both AI features can use one Gemini key. Set it in one of these places (never in committed configuration):

- `GEMINI_API_KEY` in your local, ignored `.env` file
- `Gemini:ApiKey` through `dotnet user-secrets`
- the `Gemini__ApiKey` environment variable

Key resolution:

| Setting | Purpose |
| --- | --- |
| `GeminiAnalysis:ApiKey` | Optional override for admin analysis |
| `Gemini:ApiKey` | Preferred by investor land analysis |
| `GEMINI_API_KEY` | Final fallback for both |

Investor analysis prefers `Gemini:ApiKey`; admin analysis prefers `GeminiAnalysis:ApiKey`. Each falls back to the other key, then to `GEMINI_API_KEY`.

Other settings:

| Setting | Default |
| --- | --- |
| `Gemini:Model`, `GeminiAnalysis:Model` | `gemini-3.8-flash` (each falls back to the other override) |
| `GeminiAnalysis:Endpoint` | `https://generativelanguage.googleapis.com/v1beta` |
| `GeminiAnalysis:TimeoutSeconds` | `15` (clamped to 2–60) |

## Statistics

Statistics filters are applied on the server. All dates use UTC boundaries.

- **Date range** means proposal submission date for applications, land creation date for land counts, and competition creation date for active competitions.
- **Proposed investment** is the sum of applicant offers, not money received.
- Chart drilldowns carry these filters to the corresponding admin list.
