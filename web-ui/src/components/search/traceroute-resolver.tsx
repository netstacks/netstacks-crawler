import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueries } from '@tanstack/react-query';
import { getIpContext } from '@/api/devices';
import { CellLink } from '@/components/common/cell-link';
import { Badge } from '@/components/ui/badge';
import { parseTraceroute, avgLatency, latencyColor, type TracerouteHop } from '@/lib/traceroute-parser';
import type { IpContext } from '@/api/types';
import { ClipboardPaste, Server, Cable, Network, AlertCircle, HelpCircle, Share2 } from 'lucide-react';

// Build a topology map (nodes + edges) from the resolved trace: each hop that
// maps to a Crawler device (directly, via interface, or via the switch a host
// sits on) becomes a node; consecutive distinct devices are linked in path order.
function buildTraceMap(hops: TracerouteHop[], ctxMap: Map<string, IpContext>) {
  const path: { ip: string; label: string; sub?: string; intf?: string | null; discovered: boolean }[] = [];
  for (const h of hops) {
    if (!h.ip) continue; // skip timed-out hops
    const c = ctxMap.get(h.ip);
    if (c && (c.kind === 'device' || c.kind === 'device-interface') && c.device?.ip) {
      path.push({ ip: c.device.ip, label: c.device.dns || c.device.name || c.device.ip,
        sub: [c.device.vendor, c.device.model].filter(Boolean).join(' ') || undefined, intf: c.port, discovered: true });
    } else if (c && c.kind === 'host' && c.switch) {
      path.push({ ip: c.switch, label: c.switch, sub: c.mac ? `host ${c.mac}` : undefined, intf: c.port, discovered: true });
    } else {
      // Unknown / unresolved hop — still show it (named from the trace's rDNS if
      // available) so the path is complete and the node can be discovered.
      path.push({ ip: h.ip, label: h.host && h.host !== h.ip ? h.host : h.ip, intf: undefined, discovered: false });
    }
  }
  const nodes: Record<string, unknown>[] = [];
  const seenN = new Set<string>();
  let idx = 0;
  for (const e of path) {
    if (seenN.has(e.ip)) continue;
    seenN.add(e.ip);
    nodes.push({ id: e.ip, type: 'device', position: { x: 0, y: idx * 150 },
      data: { ip: e.ip, label: e.label, sub: e.sub, discovered: e.discovered, seed: idx === 0 } });
    idx++;
  }
  const edges: Record<string, unknown>[] = [];
  const seenE = new Set<string>();
  for (let i = 0; i + 1 < path.length; i++) {
    const cur = path[i], next = path[i + 1];
    if (!cur || !next || cur.ip === next.ip) continue;
    const id = `${cur.ip}->${next.ip}`;
    if (seenE.has(id) || seenE.has(`${next.ip}->${cur.ip}`)) continue;
    seenE.add(id);
    edges.push({ id, source: cur.ip, target: next.ip, label: next.intf || undefined,
      // next.intf is the interface the hop IP resolved to on the *target* device,
      // i.e. the remote (ingress) port from the source's perspective. The source's
      // egress port isn't known from a traceroute, so leave localPort null.
      data: { localPort: null, remotePort: next.intf ?? null },
      labelStyle: { fontSize: 9, fill: 'var(--color-text-muted)' }, style: { stroke: 'var(--color-border)' } });
  }
  return { nodes, edges, seed: nodes[0]?.id as string | undefined };
}

// A compact, human-readable summary of the trace that travels with the map so
// the topology view can remind the user what they're looking at.
function buildTraceMeta(hops: TracerouteHop[], ctxMap: Map<string, IpContext>) {
  const rows = hops.map((h) => {
    const c = h.ip ? ctxMap.get(h.ip) : undefined;
    let name = h.host && h.host !== h.ip ? h.host : (h.ip ?? '*');
    let resolved = false;
    if (c && (c.kind === 'device' || c.kind === 'device-interface') && c.device) {
      name = c.device.dns || c.device.name || c.device.ip || name; resolved = true;
    } else if (c && c.kind === 'host' && c.switch) {
      name = `host on ${c.switch}`; resolved = true;
    }
    return { hop: h.hop, ip: h.ip ?? null, name, ms: avgLatency(h), timedOut: !!h.timedOut, resolved };
  });
  const real = rows.filter((r) => r.ip);
  return {
    kind: 'traceroute' as const,
    from: real[0]?.name ?? '?',
    to: real[real.length - 1]?.name ?? '?',
    total: hops.length,
    resolved: rows.filter((r) => r.resolved).length,
    rows,
  };
}

export function TracerouteResolver() {
  const [raw, setRaw] = useState('');
  const [hops, setHops] = useState<TracerouteHop[]>([]);
  const [parsed, setParsed] = useState(false);
  const nav = useNavigate();

  const uniqueIps = [...new Set(hops.filter((h) => h.ip).map((h) => h.ip!))];

  const ctxQueries = useQueries({
    queries: uniqueIps.map((ip) => ({
      queryKey: ['ip-context', ip],
      queryFn: () => getIpContext(ip),
      staleTime: 60_000,
      enabled: parsed,
    })),
  });

  const ctxMap = new Map<string, IpContext>();
  uniqueIps.forEach((ip, i) => {
    const d = ctxQueries[i]?.data;
    if (d) ctxMap.set(ip, d);
  });

  function doParse() {
    setHops(parseTraceroute(raw));
    setParsed(true);
  }

  const traceMap = buildTraceMap(hops, ctxMap);
  function openMap() {
    if (!traceMap.seed || traceMap.nodes.length < 1) return;
    const meta = buildTraceMeta(hops, ctxMap);
    try { localStorage.setItem('crawler:topology:pending', JSON.stringify({ ...traceMap, meta })); } catch { /* ignore */ }
    nav(`/topology?ip=${encodeURIComponent(traceMap.seed)}`);
  }

  return (
    <div>
      {!parsed ? (
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Paste a traceroute (Linux, Cisco IOS, or Junos) — each hop is resolved against discovered devices, interfaces and hosts.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`traceroute to example.com (93.184.216.34), 30 hops max\n 1  gateway (10.0.0.1)  1.234 ms  1.123 ms  1.456 ms\n 2  10.79.4.1  3.456 ms  3.234 ms  3.678 ms\n 3  * * *`}
            className="w-full h-48 p-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded font-mono text-xs text-[var(--color-text-primary)] resize-y focus:border-[var(--color-accent)] outline-none"
          />
          <button onClick={doParse} disabled={!raw.trim()}
            className="mt-3 px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4" /> Resolve Traceroute
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => { setParsed(false); setHops([]); }}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded hover:border-[var(--color-accent)] text-[var(--color-text-secondary)]">
              Paste another
            </button>
            <button onClick={openMap} disabled={traceMap.nodes.length < 2}
              title={traceMap.nodes.length < 2 ? 'Need at least two resolved devices to map' : 'Open this path in the topology map'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-40">
              <Share2 className="w-3.5 h-3.5" /> Map ({traceMap.nodes.length})
            </button>
          </div>

          {hops.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Could not parse any hops from that input.</p>
          ) : (
            <div className="space-y-0">
              {hops.map((hop, i) => {
                const ctx = hop.ip ? ctxMap.get(hop.ip) : undefined;
                const avg = avgLatency(hop);
                const isLast = i === hops.length - 1;
                const known = ctx && ctx.kind !== 'unknown';
                const dotColor = hop.timedOut ? 'border-[var(--color-text-muted)] bg-transparent'
                  : ctx?.kind === 'host' ? 'border-cyan-500 bg-cyan-500'
                  : known ? 'border-blue-500 bg-blue-500'
                  : 'border-yellow-500 bg-yellow-500/30';

                return (
                  <div key={hop.hop} className="flex items-stretch">
                    <div className="flex flex-col items-center w-8 shrink-0">
                      <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${dotColor}`} />
                      {!isLast && <div className="w-px flex-1 bg-[var(--color-border)]" />}
                    </div>

                    <div className="flex-1 pb-3">
                      <div className="flex items-start gap-3 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono shrink-0">{hop.hop}</Badge>

                        {hop.timedOut ? (
                          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                            <HelpCircle className="w-3.5 h-3.5" /><span>* * * (no response)</span>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {hop.ip && <CellLink field="ip" value={hop.ip} />}
                              {hop.host && hop.host !== hop.ip && (
                                <span className="text-xs text-[var(--color-text-muted)]">{hop.host}</span>
                              )}
                              {hop.ip && <HopBadge ctx={ctx} loading={!ctx && parsed} />}
                            </div>
                            {ctx && ctx.kind !== 'unknown' && <HopDetail ctx={ctx} />}
                            {avg != null && (
                              <div className={`text-[11px] mt-1 font-mono ${latencyColor(avg)}`}>
                                {avg.toFixed(2)} ms avg
                                {hop.latencies.length > 1 && (
                                  <span className="text-[var(--color-text-muted)] ml-2">
                                    ({hop.latencies.map((l) => `${l.toFixed(1)}`).join(' / ')} ms)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HopBadge({ ctx, loading }: { ctx?: IpContext; loading: boolean }) {
  if (loading) return <span className="text-[10px] text-[var(--color-text-muted)]">resolving…</span>;
  if (!ctx || ctx.kind === 'unknown')
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/40 text-yellow-400"><AlertCircle className="w-2.5 h-2.5 mr-1" />unknown</Badge>;
  if (ctx.kind === 'host')
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/40 text-cyan-400"><Network className="w-2.5 h-2.5 mr-1" />host</Badge>;
  if (ctx.kind === 'device-interface')
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-400"><Cable className="w-2.5 h-2.5 mr-1" />interface</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-400"><Server className="w-2.5 h-2.5 mr-1" />device</Badge>;
}

function HopDetail({ ctx }: { ctx: IpContext }) {
  if (ctx.kind === 'device' || ctx.kind === 'device-interface') {
    const d = ctx.device;
    const name = d?.dns || d?.name || d?.ip;
    return (
      <div className="text-[11px] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {d?.ip ? <CellLink field="ip" value={d.ip}><span className="text-[var(--color-text-accent)] font-medium">{name}</span></CellLink>
               : <span className="font-medium">{name}</span>}
        {(d?.vendor || d?.model) && <span className="text-[var(--color-text-muted)]">{[d?.vendor, d?.model].filter(Boolean).join(' ')}</span>}
        {ctx.port && <span className="text-[var(--color-text-muted)]">· intf <code className="font-mono text-[var(--color-text-secondary)]">{ctx.port}</code></span>}
        {ctx.subnet && <span className="text-[var(--color-text-muted)]">· {ctx.subnet}</span>}
      </div>
    );
  }
  // host
  return (
    <div className="text-[11px] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {ctx.mac && <CellLink field="mac" value={ctx.mac} />}
      {ctx.switch && (
        <span className="text-[var(--color-text-muted)]">on <CellLink field="ip" value={ctx.switch} />{ctx.port ? <> <code className="font-mono text-[var(--color-text-secondary)]">{ctx.port}</code></> : null}</span>
      )}
      {ctx.vlan != null && <span className="text-[var(--color-text-muted)]">· VLAN {String(ctx.vlan)}</span>}
      {ctx.active === false && <span className="text-[var(--color-text-muted)] italic">· last seen {ctx.last_seen ?? ''}</span>}
    </div>
  );
}
