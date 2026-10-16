# AgroInvest Qarabağ

Agricultural investment competition portal for Qarabağ, adapted to the requirements in `Musabiqe.pdf`. Ministry administrators publish farm areas and competitions. Entrepreneurs browse and compare them, apply with a proposed amount, business plan and documents, then follow their application by reference number. Administrators review applications, request additional information and record decisions.

## Project structure

- `src/QarabagInvestmentPortal.Api`: ASP.NET Core API, feature folders and one `AppDbContext` in PostgreSQL schema `portal`.
- `frontend`: React 19 and Vite application. The existing visual design is retained.
- `tests`: unit, architecture and PostgreSQL integration projects.
- `docs/ektis-integration.md`: simulated EKTİS boundary and future integration work.

Roles are `USER` and `ADMIN`. Administrators manage the catalog and review applications; signed-in users submit applications and read their own history. Uploaded documents remain private and are downloaded through authorized `/api/documents/...` endpoints. The old owner-submitted land workflow is no longer available through the portal.

## Local run

See `docs/local-database.md` for database setup. Do not remove the Docker volume if it contains existing data.

```powershell
docker compose up -d
cd frontend
npm install
npm run build
cd ..
dotnet run --project src/QarabagInvestmentPortal.Api
```

The API serves the built site at `http://localhost:3000`. For frontend development, run `npm run dev` inside `frontend` and open `http://localhost:5173`. Email confirmation and password reset messages go to Mailpit at `http://localhost:8025` in development. In Development, the API applies EF Core migrations at startup when `Database:MigrateOnStartup` is enabled.

In VS Code, open the project folder and choose **Terminal → Run Task → Start database**, then **Run Portal**. Build the frontend before the first run or after changing React files. Open `http://localhost:3000` once the API reports that it is listening.

The API uses `ConnectionStrings:Portal` or the `POSTGRES_*` settings. `Storage:RootPath` selects the private document folder. `Gemini:ApiKey` is optional for the assistant. Keep secrets in environment variables or `.env`, never in source control.

## Local demo data

For a populated development portal, set `DemoData:Password` in .NET user secrets for the API project, then run `dotnet run --project src/QarabagInvestmentPortal.Api -- seed-demo-data`. This repeatable command adds 25 clearly marked demo lands, five synthetic investor accounts, and 25 applications through the normal proposal service. It also exercises review, rejection, winner selection, and competition closure. Re-running it skips existing fixtures; it does not delete existing records. The command refuses to run outside Development.

## Competition workflow

1. An admin creates a farm area, adds its geographic and agricultural details, sets competition conditions and a deadline, and publishes it.
2. A visitor searches, filters and compares published opportunities. A registered entrepreneur selects one and submits an application. The API issues an `AGRO-YYYY-NNNN` reference.
3. The applicant sees receipt, review, additional information and decision states in their cabinet, with history and notifications. An additional information request can be answered with a message and private documents.
4. An admin reviews applications, rejects one with a reason, or selects a winner. Selecting a winner closes the competition and records outcomes for the other pending applications. Archiving or withdrawing a competition cancels its pending applications and notifies applicants.

The EKTİS endpoint is an admin-only **simulation**. It exports a versioned payload and records a local simulation receipt. It sends nothing to the government system.

## Admin proposal analysis and statistics

Admins can request advisory analysis for a land from the applications page. The analysis covers all still-open proposals for the land and never records a decision. The provider receives proposal aliases, numeric fields, and server-generated evidence statements only; applicant names, contact details, business-plan text, and private document contents are excluded. Provider reasons and risks are accepted only when they exactly match that evidence. The server computes first-year sensitivity scenarios from the applicant's stated annual revenue and project costs (revenue at 80%/100%/120%, costs at 120%/100%/80%). Project costs are treated as a one-time first-year cost. No profit probability is estimated. Eligibility conditions and document contents still require manual review. If Gemini is unavailable or the input exceeds 30,000 characters, the endpoint returns deterministic evidence, comparisons, and projections without an AI recommendation.

Both AI features can use one Gemini key. Set `GEMINI_API_KEY` in your local, ignored `.env` file, or set `Gemini:ApiKey` through `dotnet user-secrets` or the `Gemini__ApiKey` environment variable. `GeminiAnalysis:ApiKey` optionally overrides the key for admin analysis. Investor land analysis prefers `Gemini:ApiKey`; admin analysis prefers `GeminiAnalysis:ApiKey`; both fall back to the other key and then `GEMINI_API_KEY`. Model overrides are `Gemini:Model` and `GeminiAnalysis:Model` (each defaults to `gemini-3.8-flash` and falls back to the other model override). Optional admin settings: `GeminiAnalysis:Endpoint` (default `https://generativelanguage.googleapis.com/v1beta`) and `GeminiAnalysis:TimeoutSeconds` (default `15`, clamped to 2–60). Keep keys out of committed configuration.

Investor land analysis is available on a land detail page after investor sign-in. It combines the selected land area with that investor's profile and returns illustrative scenarios; a scenario may show a loss. It does not create an application or change a decision.

Statistics filters are applied on the server. Date range means proposal submission date for applications, land creation date for land counts, and competition creation date for active competitions; all dates use UTC boundaries. "Proposed investment" is the sum of applicant offers, not received money. Chart drilldowns carry these filters to the corresponding admin list.

## Checks

```powershell
dotnet build src/QarabagInvestmentPortal.Api
dotnet test tests/QarabagInvestmentPortal.UnitTests
dotnet test tests/QarabagInvestmentPortal.ArchitectureTests
cd frontend
npm run build
```

PostgreSQL integration tests use a separate test database and require a running database server.
