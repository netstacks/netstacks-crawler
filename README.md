# NetStacks Crawler

**NetStacks Crawler** is a web-based network discovery and inventory tool. It
walks your network over SNMP / CLI / device APIs, stores everything in
PostgreSQL, and lets you locate a host, audit hardware, control a port, or
chart your fleet from a single SPA.

What you can do with it:

* Locate a machine on the network by MAC or IP and show the switch port it lives at
* Turn off a switch port, or change the VLAN or PoE status of a port
* Inventory your network hardware by model, vendor, software, and operating system
* Render pretty pictures of your topology *(topology view shipping in a later milestone)*

## Origin

NetStacks Crawler began as a working copy of [Netdisco](https://github.com/netdisco/netdisco)
(BSD-3-Clause) and the BSD license headers and `netdisco-mibs` upstream MIB
dependency are retained. The product is independently maintained and not a
fork tracking upstream — backend lifecycle, API surface, and UI are all
NetStacks Crawler's own.

## Quick start

Everything runs from a single `docker-compose.yaml` — PostgreSQL, the API
backend, a discovery worker, and the web UI:

```bash
docker compose up --build -d
```

Then open <http://localhost:5000>. The SPA is served at `/` and the JSON API at
`/api/*`. The database schema is bootstrapped automatically on first start.

Set SNMP communities and other discovery settings from **Admin → SNMP Auth** in
the UI, then add devices to discovery from **Admin → Import** or the search bar.

## Configuration

All settings have sensible defaults, so an empty/absent config works out of the
box. There are three places to configure the stack, in increasing order of
precedence at runtime:

1. **`share/config.yml`** — shipped defaults. **Do not edit.**
2. **`deployment.yml`** — your site config file, mounted into the backend (see
   below). Overrides the shipped defaults.
3. **`CRAWLER_*` environment variables** — overlaid on top of `deployment.yml`
   at container start (`bin/entrypoint.pl`). Handy for compose `.env`.
4. **The UI / database** — most runtime settings (SNMP auth, branding,
   schedules, and the authentication toggle) are stored in the database and
   override everything above, live, without a redeploy.

> **Site-specific files are git-ignored on purpose.** `.env` and
> `/deployment.yml` are listed in `.gitignore` so your passwords, SNMP
> communities, domains, and other install details never land in version
> control. Copy the provided `*.example` templates to create them:
>
> ```bash
> cp .env.example .env                      # compose env overrides
> cp deployment.yml.example deployment.yml  # backend site config
> ```

### `.env` (compose overrides)

```bash
CRAWLER_PORT=8080            # host port for the web UI (default 5000)
POSTGRES_PASSWORD=secret     # database password (default: crawler)
DATABASE_URL=postgresql://crawler:secret@postgres:5432/crawler
CRAWLER_RO_COMMUNITY=public  # SNMPv2c read-only community (or set it in the UI)
```

### `deployment.yml` (backend site config)

Any key from `share/config.yml` can be overridden here. The backend reads it
from `/etc/crawler/deployment.yml` (override the path with `CRAWLER_CONFIG`). To
use it, bind-mount it into the `backend` and `worker` services, e.g. in a
`docker-compose.override.yml`:

```yaml
services:
  backend:
    volumes:
      - ./deployment.yml:/etc/crawler/deployment.yml:ro
  worker:
    volumes:
      - ./deployment.yml:/etc/crawler/deployment.yml:ro
```

## Authentication & SSO

### The model

The backend supports three identity sources, in order:

1. **Session** — a local username/password login (built-in `admin` account, or
   accounts you create under **Admin → Users**), or an API key
   (`Authorization: Apikey …`).
2. **A trusted reverse-proxy header** — when `trust_x_remote_user` is enabled
   (the default), the backend trusts the **`X-Remote-User`** request header as
   the authenticated identity. Any `@domain` suffix is stripped, so
   `jane@example.com` logs in as `jane`. **This is how SSO works:** your
   perimeter authenticates the user and sets this header.
3. **Open mode (`no_auth`)** — when authentication is *disabled*, every request
   is an admin-capable `guest`. This is the out-of-the-box default so you can
   evaluate the tool; turn it off before exposing the app.

> ⚠️ **Trusting `X-Remote-User` is only safe behind a perimeter that sets it.**
> If a client can reach the app directly, it could forge the header. The
> included web (nginx) image strips any client-supplied `X-Remote-User` and
> derives identity **only** from a verified SSO token (see below). If you run
> your own proxy, do the same.

### Turning authentication on/off

The "authentication required" toggle under **Admin → Users** is the same setting
as the backend's `no_auth`, inverted (`auth_required = NOT no_auth`). Flipping it
writes a database override that takes effect immediately — no redeploy, no file
edit. The `no_auth:` value in a config file is only the bootstrap default used
before any override exists.

- **Auth required (recommended for production)** → the UI needs an SSO/local
  login and the API needs a key or session; unauthenticated requests get `401`.
- **Auth disabled** → everyone is an open `guest`.

The built-in `admin` account always works, so you can't lock yourself out.

### Behind AWS Application Load Balancer (OIDC / Cognito)

The web image ships an [njs](https://nginx.org/en/docs/njs/) script
(`alb-auth.js`) that bridges ALB authentication to the backend automatically.
After the ALB completes OIDC/Cognito sign-in it injects a **signed** JWT in the
`x-amzn-oidc-data` header. The script:

1. Parses the JWT header and reads the signing region from its `signer` ARN.
2. Fetches that region's public key from
   `https://public-keys.auth.elb.<region>.amazonaws.com/<kid>` (cached per worker).
3. **Verifies the ES256 signature** and expiry. Only on success does it forward
   the `email` claim (falling back through `preferred_username`, `upn`,
   `cognito:username`, `sub`) to the backend as `X-Remote-User`.

A missing, forged, tampered, or expired token yields an empty value — the
request is then treated as having no identity (guest in open mode, `401` when
auth is enforced). It is never accepted as the claimed user. Because the
signature is verified, a client that bypasses the ALB and forges the header
gains nothing.

**AWS setup:**

1. **Listener** — on the HTTPS (443) listener, add an `authenticate-oidc` (or
   `authenticate-cognito`) action **before** the `forward` action. Use a `:80`
   listener that redirects to `:443`.
2. **Scope** — include `email` in the OIDC scope (e.g. `openid email profile`)
   so the email claim is present in the token.
3. **Target group** — forward to the web container on port **5000** (HTTP),
   target health check path `/`.
4. **Network** — keep the ALB internal (or restrict it) and lock the target's
   security group so port 5000 is reachable **only from the ALB**. Signature
   verification removes the *need* to trust the network, but defense in depth is
   cheap.
5. **Enforce** — once you've confirmed the right username shows in the top-right
   of the UI, flip **Admin → Users → authentication required** to *enabled*.

No NetStacks-Crawler config changes are required for ALB SSO — `trust_x_remote_user`
is on by default and the region/account are derived from the token at runtime.

### Other reverse proxies (oauth2-proxy, Apache, etc.)

Any proxy works as long as it authenticates the user and sets `X-Remote-User`
on the proxied `/api/*` request **while stripping any client-supplied copy**.
Point it at the web container (port 5000) or directly at the backend.

## Stopping / removing

```bash
docker compose down              # stop and remove containers (keeps the DB volume)
docker compose down -v           # also delete the database volume (LOSES ALL DATA)
```

## Images

`docker compose up --build` builds the two images locally — `netstacks-crawler`
(Perl: API backend + worker) and the web image (Vite SPA + nginx with the ALB
auth bridge). For production you can push these to your own registry and
reference them with `image:` in a compose override; this default file is meant
to be simple.

## License

BSD 3-Clause. See `LICENSE.md`.
