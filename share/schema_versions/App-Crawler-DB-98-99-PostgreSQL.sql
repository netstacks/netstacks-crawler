BEGIN;

-- Mark users that were auto-provisioned from a trusted SSO / reverse-proxy
-- identity (X-Remote-User), as opposed to local / ldap / radius / tacacs
-- accounts. Lets the UI label them and admins manage their roles.
ALTER TABLE users ADD COLUMN IF NOT EXISTS remote boolean DEFAULT false;

COMMIT;
