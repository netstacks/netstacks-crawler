// Shared value + label formatting for surfacing raw DB columns in the UI.
// Used by the generic <FieldGrid> and anywhere we render device/port/node rows,
// so the rich Netdisco data reads well without bespoke code per field.

// Acronyms that should stay uppercased in humanized labels.
const ACRONYMS: Record<string, string> = {
  ip: 'IP', dns: 'DNS', mac: 'MAC', os: 'OS', snmp: 'SNMP', vtp: 'VTP',
  vlan: 'VLAN', mtu: 'MTU', ssid: 'SSID', bssid: 'BSSID', poe: 'PoE',
  id: 'ID', url: 'URL', stp: 'STP', lldp: 'LLDP', cdp: 'CDP', vrf: 'VRF',
  ifindex: 'ifIndex', pae: '802.1X', fru: 'FRU', hw: 'HW', fw: 'FW', sw: 'SW',
  ver: 'Version', rw: 'RW', ro: 'RO', oui: 'OUI', nbt: 'NetBIOS',
};

// A few whole-key overrides where word-by-word humanizing reads poorly.
const LABEL_OVERRIDES: Record<string, string> = {
  os_ver: 'OS Version',
  os: 'OS',
  ip: 'IP',
  dns: 'DNS Name',
  last_discover: 'Last Discover',
  last_macsuck: 'Last Macsuck',
  last_arpnip: 'Last Arpnip',
  snmp_ver: 'SNMP Version',
  snmp_comm: 'SNMP Community',
  snmp_class: 'SNMP Class',
  snmp_engineid: 'SNMP Engine ID',
  num_ports: 'Port Count',
  chassis_id: 'Chassis ID',
  chassis_model: 'Chassis Model',
  up_admin: 'Admin Status',
  duplex_admin: 'Admin Duplex',
  speed_admin: 'Admin Speed',
  pae_is_enabled: '802.1X Enabled',
  is_pseudo: 'Pseudo Device',
  remote_ip: 'Neighbor IP',
  remote_port: 'Neighbor Port',
  remote_id: 'Neighbor ID',
  remote_type: 'Neighbor Type',
  remote_dns: 'Neighbor DNS',
  remote_vendor: 'Neighbor Vendor',
  remote_model: 'Neighbor Model',
  remote_os_ver: 'Neighbor OS Version',
  remote_serial: 'Neighbor Serial',
};

export function humanizeLabel(key: string): string {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  return key
    .split(/[_\s]+/)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// Keys whose values are absolute timestamps.
const TS_KEYS = new Set([
  'creation', 'last_discover', 'last_macsuck', 'last_arpnip',
  'time_first', 'time_last', 'time_recent', 'updated_at',
  'started', 'finished', 'entered', 'firstseen', 'lastseen',
]);

export function relativeTime(ts: unknown): string {
  if (ts == null || ts === '') return '--';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : String(ts));
  const ms = d.getTime();
  if (Number.isNaN(ms)) return String(ts);
  const diff = (Date.now() - ms) / 1000;
  if (diff < 0) return d.toLocaleString();
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function absoluteTime(ts: unknown): string {
  if (ts == null || ts === '') return '';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : String(ts));
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

// SNMP uptime / sysUpTime is in hundredths of a second (TimeTicks).
export function formatUptime(ticks: unknown): string {
  const n = typeof ticks === 'number' ? ticks : Number(ticks);
  if (!Number.isFinite(n) || n <= 0) return '--';
  const secs = Math.floor(n / 100);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Netdisco `layers` is an 8-char binary string of SNMP sysServices; bit position
// N (counting from the right, 1-based) set means the device operates at OSI
// layer N. e.g. "00000110" -> L2, L3.
export function decodeLayers(layers: unknown): string {
  const s = String(layers ?? '');
  if (!/^[01]+$/.test(s)) return s || '--';
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[s.length - 1 - i] === '1') out.push(`L${i + 1}`);
  }
  return out.length ? out.join(', ') : '--';
}

// Format a raw DB value for display, dispatching on the column name. Returns a
// string; entity-linking/hover is layered on separately by <FieldGrid>/CellLink.
export function formatValue(key: string, value: unknown): string {
  if (value == null || value === '') return '--';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'uptime') return formatUptime(value);
  if (key === 'layers') return decodeLayers(value);
  if (TS_KEYS.has(key)) return relativeTime(value);
  if (Array.isArray(value)) return value.length ? value.join(', ') : '--';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Whether a value is "empty" for the purpose of hiding blank fields.
export function isEmptyValue(value: unknown): boolean {
  return value == null || value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);
}
