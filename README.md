# AgroInvest Qarabağ

**An agricultural investment competition portal for the Qarabağ region.**

The ministry publishes farm areas as investment competitions. Entrepreneurs browse and compare them, apply with a proposed amount, a business plan and documents, and follow their application by reference number. Ministry administrators review the applications, talk to applicants in real time and record decisions.

Team project (2 developers) · Oct 2026

---

## How the competition works

1. **Publish.** An admin creates a farm area, adds its geographic and agricultural details, sets competition conditions and a deadline, and publishes it.
2. **Apply.** A visitor searches, filters and compares published opportunities. A registered entrepreneur submits an application and receives an `AGRO-YYYY-NNNN` reference number.
3. **Follow.** The applicant sees receipt, review, additional-information and decision states in their cabinet, with history and notifications. A request for more information can be answered with a message and private documents.
4. **Decide.** An admin reviews applications, rejects one with a reason, or selects a winner. Selecting a winner closes the competition and records outcomes for the other pending applications. Archiving or withdrawing a competition cancels its pending applications and notifies applicants.

## Features

| Area | Features |
| --- | --- |
| **Competitions** | Farm area catalog, search, filters, side-by-side comparison, map with parcel boundaries |
| **Applications** | Reference numbers, status history, notifications, private document upload and download |
| **Ministry review** | Review workflow, additional-information requests, rejection with reason, winner selection |
| **Real-time chat** | Proposal chat between applicant and ministry over SignalR, with access checks per proposal |
| **Security** | Email confirmation and password reset, Google reCAPTCHA on sign-up, login and password reset, per-client API rate limiting, role-based access (`USER`, `ADMIN`) |
| **AI and statistics** | Advisory proposal analysis for admins, land analysis for investors (Gemini), statistics with drilldowns — see [docs/ai-and-statistics.md](docs/ai-and-statistics.md) |
| **EKTİS** | An admin-only **simulation** of the government system export — it sends nothing; see [docs/ektis-integration.md](docs/ektis-integration.md) |

Uploaded documents stay private and are downloaded only through authorized `/api/documents/...` endpoints.

## Project structure

| Folder | Contents |
| --- | --- |
| `src/QarabagInvestmentPortal.Api` | ASP.NET Core API organized by feature folders, one `AppDbContext` in PostgreSQL schema `portal` |
| `frontend` | React 19 + Vite application |
| `tests` | Unit, architecture and PostgreSQL integration test projects |
| `docs` | Database setup, EKTİS boundary, AI and statistics, investor sign-up, land use |

## Tech stack

.NET 10 · ASP.NET Core · Entity Framework Core · PostgreSQL · SignalR · Google reCAPTCHA · Gemini API · React 19 · Vite · Docker · xUnit

## Run locally

**Requirements:** .NET 10 SDK, Node.js, Docker.

See [docs/local-database.md](docs/local-database.md) for database setup. Do not remove the Docker volume if it contains existing data.

```powershell
docker compose up -d
cd frontend
npm install
npm run build
cd ..
dotnet run --project src/QarabagInvestmentPortal.Api
```

Open `http://localhost:3000` — the API serves the built site.

| Need | How |
| --- | --- |
| Frontend development | Run `npm run dev` inside `frontend` and open `http://localhost:5173` |
| See confirmation and reset emails | Mailpit at `http://localhost:8025` (Development only) |
| Apply migrations at startup | Enable `Database:MigrateOnStartup` (Development only) |
| Run from VS Code | **Terminal → Run Task → Start database**, then **Run Portal** |

Build the frontend before the first run and after changing React files.

### Configuration

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:Portal` or `POSTGRES_*` | Database connection |
| `Storage:RootPath` | Folder for private documents |
| `Gemini:ApiKey` | Optional, enables the AI features |

Keep secrets in environment variables, `.env` or `dotnet user-secrets` — never in source control.

### Demo data

To fill a development database:

1. Set `DemoData:Password` in .NET user secrets for the API project.
2. Run:
   ```bash
   dotnet run --project src/QarabagInvestmentPortal.Api -- seed-demo-data
   ```

This adds 25 clearly marked demo lands, five synthetic investor accounts and 25 applications through the normal proposal service, and exercises review, rejection, winner selection and competition closure. Re-running it skips existing fixtures and never deletes records. It refuses to run outside Development.

## Tests

```powershell
dotnet build src/QarabagInvestmentPortal.Api
dotnet test tests/QarabagInvestmentPortal.UnitTests
dotnet test tests/QarabagInvestmentPortal.ArchitectureTests
cd frontend
npm run build
```

PostgreSQL integration tests use a separate test database and need a running database server.

## Team

| Developer | Main areas |
| --- | --- |
| [Yunus Maharramli](https://github.com/YunusMaharramli) | Initial backend and PostgreSQL setup, first React frontend, reCAPTCHA in auth flows, API rate limiting with tests, ministry review workflow and SignalR proposal chat |
| [ziyabilov403-arch](https://github.com/ziyabilov403-arch) | Frontend redesign, email-link confirmation, map and parcel boundaries, admin panel, AI land and proposal analysis, statistics, demo data tooling |
