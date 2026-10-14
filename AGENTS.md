# Qarabag Investment Portal agent instructions

@C:\Users\acer_\.codex\RTK.md

## Architecture rules

- Run every shell command through `rtk`.
- Preserve the modular monolith boundaries described in `README.md`.
- A business module must not reference another business module.
- Modules communicate through contracts, identifiers, and integration events.
- Keep one PostgreSQL database with a separate schema and DbContext per module.
