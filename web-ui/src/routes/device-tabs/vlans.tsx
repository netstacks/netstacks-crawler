import { useParams } from 'react-router';
import { useDeviceVlans, useDevicePorts } from '@/hooks/use-device';
import { DataTable } from '@/components/common/data-table';
import { CellLink } from '@/components/common/cell-link';
import type { VlanRow } from '@/api/types';
import type { ColumnDef } from '@tanstack/react-table';

export function DeviceVlans() {
  const { ip = '' } = useParams();
  const { data: vlans } = useDeviceVlans(ip);
  const { data: ports } = useDevicePorts(ip);

  const portCountByVlan = new Map<string, number>();
  if (ports) {
    for (const p of ports) {
      if (p.vlan != null) {
        const k = String(p.vlan);
        portCountByVlan.set(k, (portCountByVlan.get(k) ?? 0) + 1);
      }
    }
  }

  const cols: ColumnDef<VlanRow>[] = [
    {
      accessorKey: 'vlan',
      header: 'VLAN ID',
      cell: (c) => <CellLink field="vlan" value={c.getValue()} />,
    },
    { accessorKey: 'description', header: 'Name' },
    {
      id: 'port_count',
      header: 'Ports',
      cell: ({ row }) => {
        const count = portCountByVlan.get(String(row.original.vlan));
        return count != null ? <span className="text-[var(--color-text-muted)]">{count}</span> : '--';
      },
    },
  ];

  if (!vlans) return null;
  if (vlans.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No VLANs discovered.</p>;

  return <DataTable tableId="vlans" data={vlans} columns={cols} />;
}
