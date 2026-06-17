import { isIP } from './cell-link';

// A tiny extraction mini-language for pulling a flat list of leaf values out of
// an arbitrary JSON response. Path is dot-separated; a `[]` suffix on a token
// (or a bare `[]`) spreads an array and continues per element.
//
//   results[].primary_ip.address   // NetBox device list -> each primary IP
//   data.devices[].mgmt.ip
//   []                             // root is itself an array of scalars
//   addresses[]                    // array of scalar strings under a key
//
// Returns every non-null leaf coerced to a trimmed string. Missing keys and
// non-arrays where an array was expected simply yield nothing (no throw), so a
// slightly-wrong path degrades to an empty result rather than an error.
export function extractByPath(data: unknown, path: string): string[] {
  const tokens = parsePath(path);
  const out: string[] = [];
  walk(data, tokens, 0, out);
  return out;
}

type Token = { key: string; spread: boolean };

function parsePath(path: string): Token[] {
  return path
    .split('.')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const spread = raw.endsWith('[]');
      const key = spread ? raw.slice(0, -2) : raw;
      return { key, spread };
    });
}

function walk(node: unknown, tokens: Token[], i: number, out: string[]): void {
  if (node == null) return;

  if (i >= tokens.length) {
    pushLeaf(node, out);
    return;
  }

  const tok = tokens[i]!;
  // `key` may be empty for a bare `[]` token (spread the current node).
  const target = tok.key ? (isRecord(node) ? node[tok.key] : undefined) : node;
  if (target == null) return;

  if (tok.spread) {
    if (!Array.isArray(target)) return;
    for (const el of target) walk(el, tokens, i + 1, out);
  } else {
    walk(target, tokens, i + 1, out);
  }
}

function pushLeaf(node: unknown, out: string[]): void {
  // A leaf may itself be an array of scalars (e.g. a path ending before a `[]`).
  if (Array.isArray(node)) {
    for (const el of node) pushLeaf(el, out);
    return;
  }
  if (node == null || isRecord(node)) return;
  const s = String(node).trim();
  if (s) out.push(s);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Normalise a raw value to a bare host IP: strip a trailing CIDR mask
// (`10.0.0.1/32` -> `10.0.0.1`), trim, and validate. Returns null if it isn't a
// usable IP address.
export function toHostIp(value: string): string | null {
  const host = value.split('/')[0]?.trim() ?? '';
  return host && isIP(host) ? host : null;
}

// Extract + normalise + dedupe in one step. Returns the unique valid host IPs in
// first-seen order, plus how many extracted values were dropped as unusable.
export function extractHostIps(data: unknown, path: string): { ips: string[]; dropped: number } {
  const raw = extractByPath(data, path);
  const seen = new Set<string>();
  const ips: string[] = [];
  let dropped = 0;
  for (const v of raw) {
    const ip = toHostIp(v);
    if (!ip) { dropped += 1; continue; }
    if (seen.has(ip)) continue;
    seen.add(ip);
    ips.push(ip);
  }
  return { ips, dropped };
}
