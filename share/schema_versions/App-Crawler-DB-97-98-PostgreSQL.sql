BEGIN;

-- Static, non-expiring API keys (tied to a user, who supplies the roles).
CREATE TABLE IF NOT EXISTS api_key (
    id          serial PRIMARY KEY,
    label       text,
    token       text NOT NULL UNIQUE,
    username    varchar(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    active      boolean DEFAULT true,
    created     timestamp DEFAULT LOCALTIMESTAMP,
    last_used   timestamp
);
CREATE INDEX IF NOT EXISTS api_key_username_idx ON api_key (username);

-- Accounts can be disabled without being deleted.
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Built-in recovery admin so first boot is usable out of the box (admin/admin).
-- Stored as an MD5 hash (legacy format the auth provider accepts); the first
-- successful login upgrades it to bcrypt when safe_password_store is on. This
-- account may be disabled but is protected from deletion in the API.
INSERT INTO users (username, password, admin, active, fullname)
VALUES ('admin', md5('admin'), true, true, 'Built-in Administrator')
ON CONFLICT (username) DO NOTHING;

COMMIT;
