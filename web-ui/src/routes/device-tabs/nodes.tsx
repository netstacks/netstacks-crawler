import { useParams } from 'react-router';
import { useDeviceNodes } from '@/hooks/use-device';
import { DataTable } from '@/components/common/data-table';
import type { NodeRow } from '@/api/types';
import type { ColumnDef } from '@tanstack/react-table';

const cols: ColumnDef<NodeRow>[] = [
  { accessorKey: 'mac',         header: 'MAC' },
  { accessorKey: 'vlan',        header: 'VLAN' },
  { accessorKey: 'port',        header: 'Port' },
  { accessorKey: 'time_first',  header: 'First seen' },
  { accessorKey: 'time_last',   header: 'Last seen' },
];

export function DeviceNodes() {
  const { ip = '' } = useParams();
  const { data } = useDeviceNodes(ip);
  return data ? <DataTable tableId="nodes" data={data} columns={cols} /> : null;
}
