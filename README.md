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

### Configuration

All settings have sensible defaults. To override, copy `.env.example` to `.env`:

```bash
CRAWLER_PORT=8080        # host port for the web UI (default 5000)
POSTGRES_PASSWORD=secret # database password (default: crawler)
```

### Stopping / removing

```bash
docker compose down              # stop and remove containers (keeps the DB volume)
docker compose down -v           # also delete the database volume (LOSES ALL DATA)
```

### Images

`docker compose up --build` builds the two images locally — `netstacks-crawler`
(Perl: API backend + worker) and the web image (Vite SPA + nginx). For
production you can push these to your own registry and reference them with
`image:` in a compose override; this default file is meant to be simple.

## License

BSD 3-Clause. See `LICENSE.md`.
