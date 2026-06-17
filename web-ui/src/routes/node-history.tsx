import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getNodeHistory } from '@/api/nodes';
import { DataTable } from '@/components/common/data-table';
import type { NodeRow } from '@/api/types';
import type { ColumnDef } from '@tanstack/react-table';

export function NodeHistory() {
  const { mac = '' } = useParams();
  const { data } = useQuery({ queryKey: ['node', mac, 'history'], queryFn: () => getNodeHistory(mac) });
  const cols: ColumnDef<NodeRow>[] = [
    { accessorKey: 'time_last', header: 'When' },
    { accessorKey: 'switch',    header: 'Device' },
    { accessorKey: 'port',      header: 'Port' },
    { accessorKey: 'vlan',      header: 'VLAN' },
  ];
  return <div className="p-6">{data && <DataTable tableId="node-history" data={data} columns={cols} />}</div>;
}
