# Qarabag Investment Portal agent instructions

@C:\Users\acer_\.codex\RTK.md

## Architecture rules

- Run every shell command through `rtk`.
- There is one backend project, `src/QarabagInvestmentPortal.Api`, organised by
  folders: `Features/<Area>` for business code and `Infrastructure` for technical code.
- Use the single `AppDbContext` (schema `portal`). Change the model only through
  EF Core migrations (`dotnet ef migrations add <Name> --project src/QarabagInvestmentPortal.Api`).
- Use typed request/response DTOs. Keep endpoints thin and put rules in services.
- Roles are `USER` and `ADMIN` only. Protect every private endpoint with the
  `SignedIn` or `Admin` policy.
- Uploaded documents stay private and are served only through `/api/documents/...`.
- Never delete the Docker volume and never commit `.env` or API keys.
- Preserve the existing React design; change only what a task needs.
