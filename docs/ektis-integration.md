# EKTİS integration boundary

The hackathon implementation uses a local simulation. The admin-only API exposes a versioned snapshot of entrepreneurs, farm areas, competitions and applications, plus a simulated sync action that stores a receipt in `IntegrationLogs`. It does not call a government endpoint.

Before production integration, obtain the official EKTİS API contract and authorization method, map its identifiers and required fields, agree on consent and retention for personal data and documents, and implement retries, idempotency, error reconciliation and audit logging. Replace the simulation behind `EktisIntegrationService` while keeping the public competition workflow independent of EKTİS availability.
