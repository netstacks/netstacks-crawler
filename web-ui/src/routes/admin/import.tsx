import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { extractHostIps } from '@/lib/json-path';
import { api } from '@/api/client';

const LS_KEY = 'crawler:import:netbox';
// Generous safety bounds on a single ad-hoc pull — high enough for very large
// inventories (100k+), low enough that a runaway pagination loop can't spin
// forever. Use a larger `?limit=`/page size in the URL to cut the page count.
const PAGE_CAP = 2000;     // follow at most this many `next` pages
const ROW_CAP = 200_000;   // ...and stop once we've collected this many IPs
const PREVIEW_RENDER = 500; // only render this many rows (selection still covers all)
const QUEUE_BATCH = 1000;   // IPs per /import/queue request

type Remembered = { url: string; headerName: string; path: string; insecure: boolean; maxIps: number; batchSize: number };
function loadRemembered(): Remembered {
  const def: Remembered = { url: '', headerName: 'Authorization', path: 'results[].primary_ip.address', insecure: false, maxIps: ROW_CAP, batchSize: QUEUE_BATCH };
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return {
      url: r.url || '', headerName: r.headerName || 'Authorization', path: r.path || def.path, insecure: !!r.insecure,
      maxIps: clampInt(r.maxIps, 1, ROW_CAP, ROW_CAP),
      batchSize: clampInt(r.batchSize, 1, 10_000, QUEUE_BATCH),
    };
  } catch {
    return def;
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Thrown for failures that already carry a useful message (HTTP status, TLS,
// connection) so the caller can surface it verbatim.
class HttpError extends Error {}

interface ProxyResp { ok: boolean; status: number; reason: string; content: string }

// Fetch one URL through the backend proxy (which handles CORS-free same-origin
// access and optional self-signed TLS), returning the parsed JSON body. The
// browser cannot do either of those itself, so all fetches route through here.
async function proxyGet(url: string, headerName: string, headerValue: string, insecure: boolean): Promise<unknown> {
  let resp: ProxyResp;
  try {
    const r = await api.post('/import/fetch', { url, header_name: headerName, header_value: headerValue, insecure });
    resp = r.data as ProxyResp;
  } catch (e) {
    throw new HttpError(`The crawler backend couldn't run the request: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!resp.ok) {
    const snippet = (resp.content || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    // HTTP::Tiny uses 599 for transport-level failures (DNS / refused / TLS).
    if (resp.status === 599) {
      const tls = /certificate|SSL|verify/i.test(snippet);
      throw new HttpError(
        tls
          ? `TLS verification failed reaching the host. If it uses a self-signed or private-CA certificate, tick "Allow self-signed / untrusted TLS" and try again.\n${snippet}`
          : `Couldn't reach the host: ${snippet || resp.reason}. Check it's resolvable and reachable from the crawler backend, and the port is correct.`,
      );
    }
    const hint = resp.status === 401 || resp.status === 403
      ? ' — check the auth header name/value (NetBox expects "Authorization: Token <key>").'
      : resp.status === 404 ? ' — check the URL path.' : '';
    throw new HttpError(`HTTP ${resp.status} ${resp.reason || ''}`.trim() + hint + (snippet ? `\n${snippet}` : ''));
  }

  try { return JSON.parse(resp.content); }
  catch { throw new HttpError('Response was not JSON. Check the URL returns a JSON API response (not an HTML login/error page).'); }
}

// Fetch through the proxy and, if the response looks paginated (NetBox-style
// `next`), follow the chain up to the caps. Returns merged normalised IPs.
async function fetchAndExtract(url: string, headerName: string, headerValue: string, insecure: boolean, path: string, maxIps: number) {
  const allIps: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  let pages = 0;
  let next: string | null = url;

  while (next && pages < PAGE_CAP && allIps.length < maxIps) {
    const body = await proxyGet(next, headerName, headerValue, insecure);
    const { ips, dropped: d } = extractHostIps(body, path);
    dropped += d;
    for (const ip of ips) { if (!seen.has(ip)) { seen.add(ip); allIps.push(ip); } }
    pages += 1;
    const nx = (body as { next?: unknown })?.next;
    next = typeof nx === 'string' && nx ? nx : null;
  }
  return { ips: allIps.slice(0, maxIps), dropped, pages, truncated: !!next && allIps.length >= maxIps };
}

export function AdminImport() {
  const qc = useQueryClient();
  const remembered = loadRemembered();
  const [url, setUrl] = useState(remembered.url);
  const [headerName, setHeaderName] = useState(remembered.headerName);
  const [token, setToken] = useState('');
  const [path, setPath] = useState(remembered.path);
  const [insecure, setInsecure] = useState(remembered.insecure);
  const [maxIps, setMaxIps] = useState(remembered.maxIps);
  const [batchSize, setBatchSize] = useState(remembered.batchSize);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ips: string[]; dropped: number; pages: number; truncated: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [queueing, setQueueing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [queued, setQueued] = useState<{ ok: number; failed: number } | null>(null);

  const doFetch = async () => {
    setError(null); setResult(null); setQueued(null); setSelected(new Set());
    if (!url.trim()) { setError('Enter a request URL.'); return; }
    if (!path.trim()) { setError('Enter a JSON extraction path.'); return; }
    setFetching(true);
    try {
      const r = await fetchAndExtract(url.trim(), headerName.trim(), token.trim(), insecure, path.trim(), maxIps);
      setResult(r);
      setSelected(new Set(r.ips));
      try { localStorage.setItem(LS_KEY, JSON.stringify({ url: url.trim(), headerName: headerName.trim(), path: path.trim(), insecure, maxIps, batchSize })); } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  const toggle = (ip: string) => setSelected((s) => { const n = new Set(s); n.has(ip) ? n.delete(ip) : n.add(ip); return n; });
  const allChecked = !!result && result.ips.length > 0 && selected.size === result.ips.length;
  const toggleAll = () => setResult((r) => { if (r) setSelected(allChecked ? new Set() : new Set(r.ips)); return r; });

  const addToDiscovery = async () => {
    const ips = [...selected];
    if (!ips.length) return;
    setQueueing(true); setQueued(null); setProgress({ done: 0, total: ips.length });
    let ok = 0, failed = 0;
    try {
      // Send IPs as batched arrays — one /import/queue call per QUEUE_BATCH (the
      // backend inserts each batch in a single transaction). This scales to very
      // large imports without firing one request per IP or one giant request.
      for (let i = 0; i < ips.length; i += batchSize) {
        const batch = ips.slice(i, i + batchSize);
        try {
          const r = await api.post('/import/queue', { ips: batch, action: 'discover' });
          const n = Number((r.data as { queued?: number })?.queued ?? 0);
          ok += n; failed += batch.length - n;
        } catch {
          failed += batch.length;
        }
        setProgress({ done: Math.min(i + batch.length, ips.length), total: ips.length });
      }
      setQueued({ ok, failed });
    } finally {
      setQueueing(false);
      setProgress(null);
      qc.invalidateQueries({ queryKey: ['admin-recent-jobs'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    }
  };

  const inputCls = 'w-full h-9 px-2.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] outline-none focus:border-[var(--color-border-active)]';
  const labelCls = 'block text-xs text-[var(--color-text-muted)] mb-1';

  return (
    <div className="max-w-3xl">
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Quick, ad-hoc pull of device IPs from an external API (e.g. NetBox) into the discovery queue.
        Supply the request URL (add filters in the query string, e.g. <code className="font-mono">?tag=core&amp;manufacturer_id=5</code>),
        an optional auth header, and a JSON path to the IP field. The request runs from the crawler backend
        (no browser CORS limits, and self-signed TLS can be allowed below). This is a one-time import, not a sync.
      </p>

      <div className="space-y-3 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded mb-5">
        <div>
          <label className={labelCls}>Request URL</label>
          <input className={inputCls} data-testid="import-url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://netbox.example.com/api/dcim/devices/?tag=core&limit=500" />
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <div>
            <label className={labelCls}>Auth header name (optional)</label>
            <input className={inputCls} data-testid="import-header-name" value={headerName} onChange={(e) => setHeaderName(e.target.value)}
              placeholder="Authorization" />
          </div>
          <div>
            <label className={labelCls}>Auth header value (optional, not saved)</label>
            <input className={inputCls} data-testid="import-token" type="password" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="Token 0123456789abcdef" autoComplete="off" />
          </div>
        </div>
        <div>
          <label className={labelCls}>JSON extraction path</label>
          <input className={inputCls} data-testid="import-path" value={path} onChange={(e) => setPath(e.target.value)}
            placeholder="results[].primary_ip.address" />
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Dot path; <code className="font-mono">[]</code> spreads an array. CIDR masks like <code className="font-mono">/32</code> are stripped automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none">
          <input type="checkbox" checked={insecure} onChange={(e) => setInsecure(e.target.checked)} data-testid="import-insecure" />
          Allow self-signed / untrusted TLS certificate
          <span className="text-[var(--color-text-muted)]">— skip certificate verification (internal IPAM behind a private CA)</span>
        </label>

        <div>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} data-testid="import-advanced-toggle"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Advanced
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className={labelCls}>Max IPs to fetch</label>
                <input className={inputCls} type="number" min={1} max={ROW_CAP} data-testid="import-maxips"
                  value={maxIps} onChange={(e) => setMaxIps(clampInt(e.target.value, 1, ROW_CAP, ROW_CAP))} />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Safety cap on a single pull (max {ROW_CAP.toLocaleString()}).</p>
              </div>
              <div>
                <label className={labelCls}>Discovery batch size</label>
                <input className={inputCls} type="number" min={1} max={10000} data-testid="import-batchsize"
                  value={batchSize} onChange={(e) => setBatchSize(clampInt(e.target.value, 1, 10_000, QUEUE_BATCH))} />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">IPs queued per request when adding to discovery.</p>
              </div>
            </div>
          )}
        </div>

        <button onClick={doFetch} disabled={fetching}
          data-testid="import-fetch"
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-50">
          {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {fetching ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-5 p-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-error)]/40 rounded text-[var(--color-error)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="whitespace-pre-line break-words">{error}</span>
        </div>
      )}

      {result && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">
              <span className="font-semibold">{result.ips.length}</span> device IP{result.ips.length === 1 ? '' : 's'} found
              <span className="text-[var(--color-text-muted)]">
                {' '}· {result.pages} page{result.pages === 1 ? '' : 's'}
                {result.dropped > 0 ? ` · ${result.dropped} dropped (no/invalid IP)` : ''}
                {result.truncated ? ' · truncated at cap' : ''}
              </span>
            </div>
            <button onClick={addToDiscovery} disabled={queueing || selected.size === 0}
              data-testid="import-add"
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-50">
              {queueing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Add {selected.size.toLocaleString()} to discovery
            </button>
          </div>

          {progress && (
            <div className="mb-3 text-xs text-[var(--color-text-muted)]">
              Queueing… {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
            </div>
          )}
          {queued && (
            <div className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Queued <span className="font-semibold text-[var(--color-success)]">{queued.ok.toLocaleString()}</span> discover job{queued.ok === 1 ? '' : 's'}
              {queued.failed > 0 && <span className="text-[var(--color-error)]"> · {queued.failed.toLocaleString()} failed</span>}. See them on the Jobs tab.
            </div>
          )}

          {result.ips.length > 0 && (
            <div className="border border-[var(--color-border)] rounded overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] text-xs">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} data-testid="import-select-all" />
                <span className="text-[var(--color-text-muted)]">{selected.size} of {result.ips.length} selected</span>
              </div>
              <ul className="max-h-[360px] overflow-auto divide-y divide-[var(--color-border)]/50">
                {result.ips.slice(0, PREVIEW_RENDER).map((ip) => (
                  <li key={ip} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                    <input type="checkbox" checked={selected.has(ip)} onChange={() => toggle(ip)} data-testid={`import-row-${ip}`} />
                    <span className="font-mono">{ip}</span>
                  </li>
                ))}
                {result.ips.length > PREVIEW_RENDER && (
                  <li className="px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
                    …and {(result.ips.length - PREVIEW_RENDER).toLocaleString()} more (all {result.ips.length.toLocaleString()} are selected/queued; list capped for performance).
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
