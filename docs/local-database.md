# Local PostgreSQL

The portal has a dedicated PostgreSQL 17 + PostGIS container. The database is
`qarabag_investment` and the host endpoint is `127.0.0.1:5433`. Docker stores
the files in the `qarabag-investment-portal_postgres_data` named volume.

From the solution directory:

```powershell
rtk docker compose up -d
rtk docker compose ps
rtk docker compose exec postgres psql -U qarabag_app -d qarabag_investment -c "SELECT PostGIS_Version();"
```

The initial SQL creates a schema for each business module. It runs only when
Docker initializes an empty volume. Never use `docker compose down -v` if you
want to keep the data.

The current C# compatibility API still reads the existing JSON file. This
container prepares the database for the next step: defining EF Core entities,
module DbContexts, migrations, and an explicit one-time import from JSON.
Until that import is complete, the database is not the API's source of truth.

The local password is in `.env`, which is excluded by `.gitignore`. Change it
before sharing the checkout. `.env.example` documents the required variables.
