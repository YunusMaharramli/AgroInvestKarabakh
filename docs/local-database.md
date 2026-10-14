# Local PostgreSQL

The portal uses one PostgreSQL 17 database, `qarabag_investment`, on
`127.0.0.1:5433`. All tables live in the `portal` schema and are created by
EF Core migrations; there are no hand-written SQL migrations.

## With Docker (recommended)

```powershell
rtk docker compose up -d
rtk docker compose ps
```

Docker keeps the data in the `qarabag-investment-portal_postgres_data` named volume.
Never use `docker compose down -v` — it deletes the data. The scripts in `db/init`
run only when Docker initialises an empty volume; they are older and harmless
(the application uses the `portal` schema only).

The password is in `.env` (excluded by `.gitignore`); `.env.example` lists the
variables. The API reads `.env` automatically when `ConnectionStrings:Portal`
is not set.

## Without Docker

Any PostgreSQL 17 server works. Create the user and database, then point the API
at it with `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD` (environment or `.env`) or with `ConnectionStrings__Portal`.

## Schema

```powershell
dotnet tool restore
dotnet ef database update --project src/QarabagInvestmentPortal.Api
```

In Development the API also applies migrations on start.

## One-time import of the old JSON data

The old API stored everything in `agroinvest_db.json`. Import it once:

```powershell
dotnet run --project src/QarabagInvestmentPortal.Api -- import-legacy D:\path\to\agroinvest_db.json
```

The import keeps all IDs and relationships (users, lands, listings, proposals,
history, favorites, notifications, integration logs), runs in one transaction and
records itself in `portal.import_runs`, so running it again does nothing. The old
demo documents had no real files; the import creates small placeholder PDFs for them.
Old "competitions" become admin investment opportunities; old applications become
proposals. Old entrepreneur accounts become `USER`.
