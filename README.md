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

## Competition workflow

1. An admin creates a farm area, adds its geographic and agricultural details, sets competition conditions and a deadline, and publishes it.
2. A visitor searches, filters and compares published opportunities. A registered entrepreneur selects one and submits an application. The API issues an `AGRO-YYYY-NNNN` reference.
3. The applicant sees receipt, review, additional information and decision states in their cabinet, with history and notifications. An additional information request can be answered with a message and private documents.
4. An admin reviews applications, rejects one with a reason, or selects a winner. Selecting a winner closes the competition and records outcomes for the other pending applications. Archiving or withdrawing a competition cancels its pending applications and notifies applicants.

The EKTİS endpoint is an admin-only **simulation**. It exports a versioned payload and records a local simulation receipt. It sends nothing to the government system.

## Checks

```powershell
dotnet build src/QarabagInvestmentPortal.Api
dotnet test tests/QarabagInvestmentPortal.UnitTests
dotnet test tests/QarabagInvestmentPortal.ArchitectureTests
cd frontend
npm run build
```

PostgreSQL integration tests use a separate test database and require a running database server.
