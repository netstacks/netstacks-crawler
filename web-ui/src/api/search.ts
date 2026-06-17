import { api } from './client';
import { z } from 'zod';

export type SearchType = 'device' | 'node' | 'port' | 'vlan';

export async function search(q: string, type: SearchType) {
  const r = await api.get('/search', { params: { q, type } });
  return z.object({ matches: z.array(z.record(z.string(), z.unknown())) }).parse(r.data).matches;
}

const NodeSearchResult = z.object({
  mac: z.string().optional(),
  ip: z.string().optional(),
  dns: z.string().nullable().optional(),
  vrf: z.string().optional(),
  active: z.union([z.number(), z.boolean()]).optional(),
  manufacturer: z.string().nullable().optional(),
  router_name: z.string().nullable().optional(),
  router_ip: z.string().nullable().optional(),
  time_first: z.string().nullable().optional(),
  time_last: z.string().nullable().optional(),
  time_first_stamp: z.string().nullable().optional(),
  time_last_stamp: z.string().nullable().optional(),
  seen_on_router_last: z.string().nullable().optional(),
  seen_on_router_first: z.string().nullable().optional(),
}).passthrough();
export type NodeSearchResult = z.infer<typeof NodeSearchResult>;

export async function searchNodes(q: string): Promise<NodeSearchResult[]> {
  const r = await api.get('/search', { params: { q, type: 'node' } });
  const data = r.data as Record<string, unknown>;
  const macs = data.macs ?? data.matches ?? [];
  if (!Array.isArray(macs)) return [];
  return macs.map((m: unknown) => NodeSearchResult.parse(m));
}

export type TypeaheadKind = 'device' | 'device-ip' | 'device-name' | 'port' | 'subnet';

export async function typeahead(kind: TypeaheadKind, q: string) {
  const r = await api.get(`/typeahead/${kind}`, { params: { q } });
  return z.object({ matches: z.array(z.unknown()) }).parse(r.data).matches;
}
