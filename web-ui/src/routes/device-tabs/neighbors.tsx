import { useParams } from 'react-router';
import { useDeviceNeighbors } from '@/hooks/use-device';
import { DataTable } from '@/components/common/data-table';
import { Badge } from '@/components/ui/badge';
import { CellLink } from '@/components/common/cell-link';
import type { ColumnDef } from '@tanstack/react-table';

// One row per link (a neighbor can connect on several ports / a LAG). Carries
// the LLDP neighbor inventory (vendor/model/os/serial) the discover captured —
// shown even for neighbors that aren't themselves discovered devices.
interface NeighborLinkRow {
  ip: string;
  dns?: string | null;
  name?: string | null;
  discovered?: boolean;
  vendor?: string | null;
  model?: string | null;
  os?: string | null;
  serial?: string | null;
  local_port?: string | null;
  remote_port?: string | null;
  remote_id?: string | null;
}

const cols: ColumnDef<NeighborLinkRow>[] = [
  {
    accessorKey: 'local_port',
    header: 'Local Port',
    cell: (c) => {
      const v = c.getValue() as string | null;
      return v ? <code className="font-mono text-[var(--color-text-accent)]">{v}</code> : '--';
    },
  },
  {
    accessorKey: 'ip',
    header: 'Neighbor',
    cell: (c) => {
      const r = c.row.original;
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${r.discovered ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`}
                title={r.discovered ? 'Discovered device' : 'Seen via LLDP/CDP only'} />
          <CellLink field="remote_ip" value={r.ip} />
          {(r.dns || r.name) && <span className="text-[var(--color-text-muted)] text-[11px] truncate max-w-[18ch]">{r.dns || r.name}</span>}
        </span>
      );
    },
  },
  {
    accessorKey: 'remote_port',
    header: 'Remote Port',
    cell: (c) => {
      const v = c.getValue() as string | null;
      const r = c.row.original;
      return v ? <CellLink field="remote_port" value={v} ctx={{ device: r.ip }} /> : '--';
    },
  },
  { accessorKey: 'vendor', header: 'Vendor', cell: (c) => (c.getValue() as string) || '--' },
  { accessorKey: 'model',  header: 'Model',  cell: (c) => (c.getValue() as string) || '--' },
  {
    accessorKey: 'os',
    header: 'OS',
    cell: (c) => { const v = c.getValue() as string | null; return v ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{v}</Badge> : '--'; },
  },
  {
    accessorKey: 'serial',
    header: 'Serial',
    cell: (c) => { const v = c.getValue() as string | null; return v ? <code className="font-mono text-[11px]">{v}</code> : '--'; },
  },
];

export function DeviceNeighbors() {
  const { ip = '' } = useParams();
  const { data: neighbors, isLoading } = useDeviceNeighbors(ip);

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">Loading neighbors...</p>;
  if (!neighbors || neighbors.length === 0)
    return <p className="text-xs text-[var(--color-text-muted)]">No LLDP/CDP neighbors discovered on any port.</p>;

  const rows: NeighborLinkRow[] = [];
  for (const n of neighbors) {
    const base = { ip: n.ip, dns: n.dns, name: n.name, discovered: n.discovered,
                   vendor: n.vendor, model: n.model, os: n.os, serial: n.serial };
    if (n.links.length === 0) {
      rows.push({ ...base });
    } else {
      for (const l of n.links) rows.push({ ...base, local_port: l.local_port, remote_port: l.remote_port, remote_id: l.remote_id });
    }
  }

  return <DataTable tableId="neighbors" data={rows} columns={cols} />;
}
