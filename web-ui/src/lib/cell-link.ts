// Universal cell-to-URL mapper used across every table/list/kv in the UI.
//
// Decision matrix:
//   1. If the column name matches a known field (`ip`, `mac`, `vlan`, ...), the
//      mapping is unambiguous and we route by field semantics.
//   2. Otherwise we fall back to content-shape detection: if the value LOOKS
//      like an IP / MAC we link it anyway, because backends sometimes name
//      columns unhelpfully (e.g. `address`, `value`).
//   3. If neither matches, return null and the consumer renders plain text.

export interface LinkContext {
  /** Parent device IP (lets us deep-link port/interface anchors). */
  device?: string;
  /** Remote device IP (lets remote_port link to the correct device). */
  remoteDevice?: string;
}

export interface CellLink {
  href: string;
  /** Render hint -- 'mono' wraps the visible label in <code> for IPs/MACs. */
  display?: 'mono' | 'plain';
}

const RE_IPV4    = /^(\d{1,3}\.){3}\d{1,3}$/;
const RE_IPV6    = /^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/;  // permissive -- we only need to recognise
const RE_MAC_COLON = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;
const RE_MAC_DOT   = /^([0-9a-fA-F]{4}\.){2}[0-9a-fA-F]{4}$/;
const RE_MAC_BARE  = /^[0-9a-fA-F]{12}$/;
const RE_CIDR      = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const RE_INTEGER   = /^\d+$/;

export function isIPv4(v: string): boolean { return RE_IPV4.test(v); }
export function isIPv6(v: string): boolean { return RE_IPV6.test(v) && v.includes(':') && !RE_MAC_COLON.test(v); }
export function isIP(v: string): boolean   { return isIPv4(v) || isIPv6(v); }
export function isMAC(v: string): boolean  { return RE_MAC_COLON.test(v) || RE_MAC_DOT.test(v) || RE_MAC_BARE.test(v); }
export function isCIDR(v: string): boolean { return RE_CIDR.test(v); }

/**
 * Convert any MAC form (colon, dash, dot, bare-hex) to canonical lowercase
 * colon-separated `aa:bb:cc:dd:ee:ff`. Returns the input unchanged if not a
 * recognised MAC shape so callers can use it as a no-op safeguard.
 */
export function normaliseMAC(v: string): string {
  if (!isMAC(v)) return v;
  const hex = v.replace(/[:.\-]/g, '').toLowerCase();
  return hex.match(/.{2}/g)!.join(':');
}

// Field-name → URL builder. Each entry returns a CellLink or null if the value
// is the wrong shape for the named field.
const FIELD_BUILDERS: Record<string, (v: string, ctx?: LinkContext) => CellLink | null> = {
  ip:           (v) => isIP(v)  ? { href: `/devices/${encodeURIComponent(v)}`,            display: 'mono' } : null,
  device:       (v) => isIP(v)  ? { href: `/devices/${encodeURIComponent(v)}`,            display: 'mono' } : null,
  remote_ip:    (v) => isIP(v)  ? { href: `/devices/${encodeURIComponent(v)}`,            display: 'mono' } : null,
  switch:       (v) => isIP(v)  ? { href: `/devices/${encodeURIComponent(v)}`,            display: 'mono' } : null,
  mgmt_ip:      (v) => isIP(v)  ? { href: `/devices/${encodeURIComponent(v)}`,            display: 'mono' } : null,

  mac:          (v) => isMAC(v) ? { href: `/nodes/${encodeURIComponent(normaliseMAC(v))}`, display: 'mono' } : null,
  node:         (v) => isMAC(v) ? { href: `/nodes/${encodeURIComponent(normaliseMAC(v))}`, display: 'mono' } : null,
  switch_mac:   (v) => isMAC(v) ? { href: `/nodes/${encodeURIComponent(normaliseMAC(v))}`, display: 'mono' } : null,
  remote_id:    (v) => isMAC(v) ? { href: `/nodes/${encodeURIComponent(normaliseMAC(v))}`, display: 'mono' } : null,
  chassis_id:   (v) => isMAC(v) ? { href: `/nodes/${encodeURIComponent(normaliseMAC(v))}`, display: 'mono' } : null,

  dns:          (v, ctx) => ctx?.device ? { href: `/devices/${encodeURIComponent(ctx.device)}` } : v ? { href: `/devices?q=${encodeURIComponent(v)}` } : null,
  hostname:     (v, ctx) => ctx?.device ? { href: `/devices/${encodeURIComponent(ctx.device)}` } : v ? { href: `/devices?q=${encodeURIComponent(v)}` } : null,
  name:         (v, ctx) => ctx?.device ? { href: `/devices/${encodeURIComponent(ctx.device)}` } : v ? { href: `/devices?q=${encodeURIComponent(v)}` } : null,
  remote_dns:   (v) => v ? { href: `/devices?q=${encodeURIComponent(v)}` } : null,
  device_dns:   (v) => v ? { href: `/devices?q=${encodeURIComponent(v)}` } : null,

  port:         (v, ctx) => ctx?.device ? { href: `/devices/${encodeURIComponent(ctx.device)}/ports#${encodeURIComponent(v)}`, display: 'mono' } : null,
  interface:    (v, ctx) => ctx?.device ? { href: `/devices/${encodeURIComponent(ctx.device)}/ports#${encodeURIComponent(v)}`, display: 'mono' } : null,
  remote_port:  (v, ctx) => (ctx?.remoteDevice ?? ctx?.device) ? { href: `/devices/${encodeURIComponent((ctx?.remoteDevice ?? ctx?.device)!)}/ports#${encodeURIComponent(v)}`, display: 'mono' } : null,

  vlan:         (v) => RE_INTEGER.test(v) ? { href: `/reports/VLAN/vlaninventory?vlan=${encodeURIComponent(v)}` } : null,
  vlan_id:      (v) => RE_INTEGER.test(v) ? { href: `/reports/VLAN/vlaninventory?vlan=${encodeURIComponent(v)}` } : null,
  native_vlan:  (v) => RE_INTEGER.test(v) ? { href: `/reports/VLAN/vlaninventory?vlan=${encodeURIComponent(v)}` } : null,

  subnet:       (v) => isCIDR(v) ? { href: `/reports/IP/subnets?net=${encodeURIComponent(v)}`, display: 'mono' } : null,
  net:          (v) => isCIDR(v) ? { href: `/reports/IP/subnets?net=${encodeURIComponent(v)}`, display: 'mono' } : null,
  cidr:         (v) => isCIDR(v) ? { href: `/reports/IP/subnets?net=${encodeURIComponent(v)}`, display: 'mono' } : null,

  job:          (v) => RE_INTEGER.test(v) ? { href: `/admin/jobs?id=${encodeURIComponent(v)}` } : null,
};

export function linkForCell(field: string, value: unknown, ctx?: LinkContext): CellLink | null {
  if (value == null || typeof value === 'object') return null;
  const v = String(value).trim();
  if (!v) return null;

  // 1. Known field name
  const builder = FIELD_BUILDERS[field.toLowerCase()];
  if (builder) {
    const r = builder(v, ctx);
    if (r) return r;
  }

  // 2. Content-shape fallback
  if (isIP(v))   return { href: `/devices/${encodeURIComponent(v)}`,                              display: 'mono' };
  if (isMAC(v))  return { href: `/nodes/${encodeURIComponent(normaliseMAC(v))}`,                  display: 'mono' };
  if (isCIDR(v)) return { href: `/reports/IP/subnets?net=${encodeURIComponent(v)}`,               display: 'mono' };

  return null;
}
