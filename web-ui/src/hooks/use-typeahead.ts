import { useEffect, useState } from 'react';
import { search, searchNodes, typeahead } from '@/api/search';

export type SearchResult =
  | {
      kind: 'device';
      ip: string;
      name?: string;
      label: string;
      matched?: { field: string; value: string };
    }
  | { kind: 'node'; mac: string; ip?: string; routerName?: string; label: string }
  | { kind: 'port'; ip: string; port: string; device?: string; label: string }
  | { kind: 'vlan'; vlan: string | number; description?: string; label: string }
  | { kind: 'subnet'; net: string; label: string };

// Per-category result buckets. Categories resolve independently and the merged,
// ordered view is recomputed each time one lands.
type Buckets = {
  device: SearchResult[]; node: SearchResult[]; port: SearchResult[];
  vlan: SearchResult[]; subnet: SearchResult[];
};
const EMPTY: Buckets = { device: [], node: [], port: [], vlan: [], subnet: [] };

function merge(b: Buckets): SearchResult[] {
  return [...b.device, ...b.node, ...b.port, ...b.vlan, ...b.subnet].slice(0, 20);
}

export function useTypeahead(q: string) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const [data, setData] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) { setData([]); setLoading(false); return; }
    let cancelled = false;
    const acc: Buckets = { ...EMPTY };
    let pending = 5;

    setData([]);
    setLoading(true);
    const flush = () => { if (!cancelled) setData(merge(acc)); };
    const done = () => { if (cancelled) return; pending -= 1; if (pending <= 0) setLoading(false); };

    // Each searchable entity the backend exposes is queried independently so a
    // slow category (node lookups can take seconds on a large DB) never blocks
    // the fast ones — results stream into the dropdown as they arrive.
    search(term, 'device').then((devices) => {
      acc.device = (devices as Record<string, unknown>[]).slice(0, 8).flatMap((d) => {
        const ip = String(d.ip ?? ''); if (!ip) return [];
        const name = (d.dns as string) || (d.name as string) || undefined;
        const matched = d._match as { field: string; value: string } | undefined;
        return [{ kind: 'device' as const, ip, name, label: name ? `${name} (${ip})` : ip, matched }];
      });
      flush();
    }).catch(() => {}).finally(done);

    searchNodes(term).then((nodes) => {
      acc.node = nodes.slice(0, 5).flatMap((n) => {
        const mac = n.mac; if (!mac) return [];
        const ip = n.ip || undefined;
        return [{ kind: 'node' as const, mac, ip, routerName: n.router_name ?? undefined, label: ip ? `${mac} (${ip})` : mac }];
      });
      flush();
    }).catch(() => {}).finally(done);

    search(term, 'port').then((ports) => {
      acc.port = (ports as Record<string, unknown>[]).slice(0, 5).flatMap((p) => {
        const ip = String(p.ip ?? ''); const port = String(p.port ?? '');
        if (!ip || !port) return [];
        const dev = p.device as { name?: string; dns?: string } | undefined;
        const devName = dev?.dns || dev?.name || ip;
        return [{ kind: 'port' as const, ip, port, device: devName, label: `${port} on ${devName}` }];
      });
      flush();
    }).catch(() => {}).finally(done);

    search(term, 'vlan').then((vlans) => {
      // One row per device carries the VLAN — collapse to one entry per VLAN id.
      const seen = new Set<string>();
      const out: SearchResult[] = [];
      for (const v of (vlans as Record<string, unknown>[])) {
        const info = v.vlans as { vlan?: number | string; description?: string } | undefined;
        const id = info?.vlan; if (id == null) continue;
        const key = String(id); if (seen.has(key)) continue;
        seen.add(key);
        const desc = info?.description || undefined;
        out.push({ kind: 'vlan', vlan: id, description: desc, label: desc ? `VLAN ${key} — ${desc}` : `VLAN ${key}` });
        if (out.length >= 5) break;
      }
      acc.vlan = out;
      flush();
    }).catch(() => {}).finally(done);

    typeahead('subnet', term).then((subnets) => {
      acc.subnet = (subnets as unknown[]).slice(0, 4).flatMap((s) => {
        const net = String(s); return net ? [{ kind: 'subnet' as const, net, label: net }] : [];
      });
      flush();
    }).catch(() => {}).finally(done);

    return () => { cancelled = true; };
  }, [debounced]);

  return { data, loading };
}
