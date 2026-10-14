# Qarabag Investment Portal

Backend skeleton for a modular monolith built with ASP.NET Core and .NET 10.

## Projects

- `QarabagInvestmentPortal.Api` is the single HTTP host and composition root.
- `QarabagInvestmentPortal.BuildingBlocks` contains technical primitives shared by every module.
- Every folder under `src/Modules` is an independently owned business module and assembly.
- `tests` contains unit, integration, and architecture test projects.

## Module internals

Each business module is organized into these folders:

- `Domain`: aggregates, entities, value objects, domain services, and domain events.
- `Application`: use cases, commands, queries, handlers, DTOs, and validation.
- `Infrastructure`: persistence, external adapters, and module configuration.
- `Endpoints`: HTTP endpoint definitions owned by the module.
- `Contracts`: the small public surface other modules may consume.

## Dependency rules

```text
Api -> BuildingBlocks
Api -> Business Modules
Business Module -> BuildingBlocks
Business Module -X-> Another Business Module
```

Modules exchange identifiers rather than Entity Framework navigation properties. Cross-module work is performed through contracts or integration events.

## Database ownership

The application uses one PostgreSQL database with a schema and DbContext per module:

| Module | Schema |
| --- | --- |
| Identity | `identity` |
| Applicants | `applicants` |
| Lands | `lands` |
| Competitions | `competitions` |
| Applications | `applications` |
| Documents | `documents` |
| Notifications | `notifications` |
| Audit | `audit` |
| Integrations | `integrations` |
| Recommendations | `recommendations` |

## Initial implementation order

1. Platform foundation and cross-cutting building blocks.
2. Identity and authorization.
3. Applicant profiles.
4. Land registry and map geometry.
5. Competitions and competition lots.
6. Applications and status history.
7. Documents and administrative review.
