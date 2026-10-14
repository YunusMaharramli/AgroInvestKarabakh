CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS applicants;
CREATE SCHEMA IF NOT EXISTS lands;
CREATE SCHEMA IF NOT EXISTS competitions;
CREATE SCHEMA IF NOT EXISTS applications;
CREATE SCHEMA IF NOT EXISTS documents;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS integrations;
CREATE SCHEMA IF NOT EXISTS recommendations;

CREATE SCHEMA IF NOT EXISTS infrastructure;
CREATE TABLE IF NOT EXISTS infrastructure.schema_versions (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO infrastructure.schema_versions (version)
VALUES ('001_create_schemas')
ON CONFLICT (version) DO NOTHING;
