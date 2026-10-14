# Qarabag Investment Portal

AgroInvest Qarabağ: a portal where land owners in Karabakh find investors for their
agricultural land, and investors send proposals. ASP.NET Core (.NET 10) backend,
React 19 + Vite frontend, PostgreSQL database.

## Layout

```text
src/QarabagInvestmentPortal.Api     the only backend project (HTTP host + all features)
  Features/                         one folder per business area
    Users/          register, login, profile (roles: USER, ADMIN)
    Lands/          owner land submission, admin review queue
    Opportunities/  "Investment Opportunities" (one active listing per land)
    Proposals/      investor proposals, winner selection
    Documents/      authorized download of private documents
    Favorites/  Notifications/  Recommendations/  Admin/  Assistant/
  Infrastructure/
    Persistence/    AppDbContext (single DbContext, schema "portal") + EF Core migrations
    Auth/           session authentication, policies SignedIn / Admin
    Files/          private file storage (outside the web root)
    Validation/     Azerbaijani phone number rules
    Import/         one-time import of the legacy JSON demo data
    Frontend/       serves the built React app
frontend/                           React app (Vite, Tailwind)
tests/                              unit, integration (real PostgreSQL), architecture tests
```

It is a folder-based modular monolith: features live in folders inside one project and
share one `AppDbContext`. Each feature keeps its entities, DTOs, services and endpoints
together. Endpoints stay thin; rules live in focused services.

## Business rules

- Two roles only. A `USER` can submit their own land and also send proposals to
  other people's land. An `ADMIN` reviews land and can see everything.
- Only the land owner submits land, with JPG/PNG ownership documents. The admin
  approves it (the land profile and its listing are published), requests more
  documents, or rejects it.
- Each land has at most one active investment opportunity (enforced by a partial
  unique index). The responsible party is the owner for owner listings and the admin
  for older admin (demo) listings.
- Investors send proposals with the existing form. A contact phone is asked only if
  the user's profile has none; it is validated as an Azerbaijani number and a
  snapshot is saved with the proposal. Proposal documents (PDF/JPG/PNG, 10 MB each)
  are required only when the listing lists required documents.
- The listing's phone number is shown as plain text only to users who sent a
  proposal (and to the responsible party / admins).
- The responsible party selects one winner. In one transaction the listing is closed,
  new proposals are blocked, the other open proposals become `NOT_SELECTED`, and
  everyone is notified.
- Documents are stored privately (land and proposal documents separately). Admins
  can view all; owners can view proposals and documents only for their listings.

## Run locally

See `docs/local-database.md` for the database. Then:

```powershell
cd frontend; npm install; npm run build; cd ..
dotnet run --project src/QarabagInvestmentPortal.Api
```

In Development the API applies EF Core migrations on start
(`Database:MigrateOnStartup`). Configuration keys:

| Key | Purpose |
| --- | --- |
| `ConnectionStrings:Portal` | Optional. Otherwise built from `POSTGRES_*` variables or the `.env` file |
| `Storage:RootPath` | Private document folder (default `App_Data/files`) |
| `Frontend:Path` | Folder with the built frontend (`frontend/dist`) |
| `Gemini:ApiKey`, `Gemini:Model` | Optional AI assistant. Never commit the key |

## Tests

```powershell
dotnet test tests/QarabagInvestmentPortal.UnitTests
dotnet test tests/QarabagInvestmentPortal.ArchitectureTests
dotnet test tests/QarabagInvestmentPortal.IntegrationTests   # needs PostgreSQL
```

Integration tests create and drop their own database, `qarabag_investment_test`,
on the same server.
