BEGIN;

CREATE TABLE IF NOT EXISTS setting_override (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_by  TEXT
);

COMMIT;
