# Public API

The crawler exposes a curated, read-only **public API** for external clients,
separate from the full internal API that backs the web UI.

| Surface | Spec | Browsable UI | Audience | Auth |
|---------|------|--------------|----------|------|
| **Public** | `GET /api/openapi.json` | `GET /api/docs` | External API-key clients | API key |
| **Internal** (full) | `GET /swagger.json` | `GET /swagger-ui` | Operators, the SPA | SSO / API key (behind the SSO perimeter) |

Both docs endpoints are intentionally reachable **without** a credential; the API
endpoints they document are not.

## Authentication

`/api/*` is **always credential-gated.** Every API request must present one of:

- **An API key** — `Authorization: Apikey <token>` (or `Bearer <token>`).
  Keys are created and revoked under **Admin → API Keys** (`/api/admin/api-keys`).
  A key inherits the roles of its owner user, so scope a key by giving its owner
  only the roles it needs (read-only owners get the `api` role; writes require
  `admin` / `api_admin` / `port_control`).
- **A verified SSO identity** — the browser SPA authenticates its `/api/*` calls
  via a reverse-proxy-verified `X-Remote-User` header (see the perimeter section).
  This path is for the UI only.

Unauthenticated `/api/*` requests always receive a clean `401`:

```json
{ "error": "authentication required" }
```

### The API is never opened by the `no_auth` toggle

The **Admin → Settings → “authentication required”** switch (`no_auth`) only
controls the *browser UI* open-mode. It does **not** grant API access: even with
authentication turned off, `/api/*` still requires an API key (or a real SSO
identity), and a key still only gets its owner’s assigned roles. This keeps the
API controlled solely by the API-keys admin UI.

Implementation: `lib/App/Crawler/Web/AuthN.pm` (the `no_guest` guard on API
paths + the path-based 401 guard) and `lib/App/Crawler/Web/Auth/Provider/DBIC.pm`
(`get_user_roles` grants blanket roles only to the row-less open-mode UI guest,
never to a credentialed API/SSO user).

### Quick check

```bash
# No credential -> 401
curl -s -H 'Accept: application/json' https://<crawler-host>/api/devices

# With a key -> 200
curl -s -H 'Accept: application/json' \
     -H 'Authorization: Apikey <token>' \
     https://<crawler-host>/api/devices
```

## Curating the public surface

The public spec is the full Swagger doc filtered down to an allow-list. To add or
remove endpoints, edit **`%PUBLIC_PATHS`** in
`lib/App/Crawler/Web/API/PublicDocs.pm` — the single source of truth. Keys are the
paths exactly as they appear in `/swagger.json` (brace form, e.g.
`/api/device/{ip}`); values are the HTTP methods to expose. The filter also drops
the internal `X-REMOTE_USER` header parameter, forces API-key-only security, and
prunes empty tag sections in the public spec.

The current baseline is read-only: device inventory + detail tabs, nodes, search,
type-ahead, reports, inventory, statistics, and `/api/version`.

---

# Perimeter / SSO

In a typical deployment the crawler sits behind a reverse proxy / load balancer
that performs OIDC SSO for the browser UI. The nginx `web` container runs
`alb-auth.js`, which verifies the proxy's OIDC JWT (e.g. an AWS ALB
`x-amzn-oidc-data` header, ES256) and sets `X-Remote-User` to the verified email —
overwriting anything the client sent. A forged/absent token yields an empty
header, so `X-Remote-User` cannot be spoofed by a client reaching the container
directly.

## Enabling programmatic API access behind an SSO proxy

**Problem:** if the SSO proxy applies OIDC authentication to **every** path, a
programmatic client (curl + API key) hitting `/api/*` is redirected to the
interactive OIDC login and never reaches the backend — only browser SSO sessions
work.

**Fix:** carve out `/api/*` so unauthenticated requests are *allowed through* to
the backend (which then enforces the API key), while the browser shell still
requires SSO. On an AWS ALB this means a higher-priority listener rule matching
`host = <crawler-host>` **AND** `path = /api/*` whose `authenticate-oidc` action
uses `OnUnauthenticatedRequest=allow`:

- A browser with a valid OIDC session still gets its identity header injected
  (`allow` only changes the *no-session* case), so the SPA keeps working.
- A programmatic / expired-session client passes through unauthenticated; the
  backend then enforces the API key (or returns 401).

The default/shell rule stays on `OnUnauth=authenticate`, so browsers are still
redirected to SSO for the app itself.

### AWS ALB example

Replace the placeholders with your own values. The OIDC client secret must be
supplied when creating a new `authenticate-oidc` rule (AWS rejects
`UseExistingClientSecret` for a brand-new rule); source it from a secret store
(e.g. SSM SecureString / Secrets Manager) so it never lands in shell history.

```bash
LISTENER=<https-listener-arn>
CRAWLER_RULE=<existing-broad-crawler-rule-arn>
TG=<crawler-target-group-arn>
CRAWLER_HOST=<crawler-host>            # e.g. crawler.example.com

# 1) Make room: move the broad crawler rule to a higher priority number.
aws elbv2 set-rule-priorities --rule-priorities RuleArn=$CRAWLER_RULE,Priority=10

# 2) Create the /api/* rule at a lower priority number with OnUnauth=allow.
SECRET="$(aws ssm get-parameter --name <oidc-client-secret-param> \
            --with-decryption --query 'Parameter.Value' --output text)"
python3 - "$TG" "$SECRET" > /tmp/actions.json <<'PY'
import sys, json
tg, secret = sys.argv[1], sys.argv[2]
json.dump([
  {"Type":"authenticate-oidc","Order":1,"AuthenticateOidcConfig":{
     "Issuer":"<oidc-issuer>",
     "AuthorizationEndpoint":"<oidc-authorize-endpoint>",
     "TokenEndpoint":"<oidc-token-endpoint>",
     "UserInfoEndpoint":"<oidc-userinfo-endpoint>",
     "ClientId":"<oidc-client-id>","ClientSecret":secret,
     "SessionCookieName":"AWSELBAuthSessionCookie","Scope":"openid email profile",
     "SessionTimeout":604800,"OnUnauthenticatedRequest":"allow"}},
  {"Type":"forward","Order":2,"TargetGroupArn":tg}], sys.stdout)
PY
aws elbv2 create-rule --listener-arn "$LISTENER" --priority 5 \
  --conditions \
     "Field=host-header,HostHeaderConfig={Values=[$CRAWLER_HOST]}" \
     'Field=path-pattern,PathPatternConfig={Values=[/api/*]}' \
  --actions file:///tmp/actions.json
rm -f /tmp/actions.json; unset SECRET
```

No nginx change is needed: `/api/*` already flows through `alb_auth.authAndForward`
→ the backend, and `alb-auth.js` fails closed (no/invalid JWT → empty
`X-Remote-User`). Roll back by deleting the new rule and restoring the crawler
rule’s original priority.

### Verify after applying

```bash
# programmatic client with a key -> 200 (not a 302 to the IdP)
curl -s -H 'Accept: application/json' -H 'Authorization: Apikey <token>' \
     https://<crawler-host>/api/devices -o /dev/null -w '%{http_code}\n'

# no credential -> 401 JSON (not admin data, not a redirect)
curl -s -H 'Accept: application/json' \
     https://<crawler-host>/api/devices -o /dev/null -w '%{http_code}\n'

# public docs reachable without SSO
curl -s https://<crawler-host>/api/openapi.json -o /dev/null -w '%{http_code}\n'
```

Then confirm the browser SPA still logs in via SSO and loads data normally.
