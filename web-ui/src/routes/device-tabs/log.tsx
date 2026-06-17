import { useParams, useSearchParams } from 'react-router';
import { useDeviceLog } from '@/hooks/use-device';
import { DataTable } from '@/components/common/data-table';
import type { PortLogEntry } from '@/api/types';
import type { ColumnDef } from '@tanstack/react-table';

const cols: ColumnDef<PortLogEntry>[] = [
  { accessorKey: 'creation', header: 'When' },
  { accessorKey: 'username', header: 'User' },
  { accessorKey: 'port',     header: 'Port' },
  { accessorKey: 'action',   header: 'Action' },
  { accessorKey: 'reason',   header: 'Reason' },
  { accessorKey: 'log',      header: 'Notes' },
];

export function DeviceLog() {
  const { ip = '' } = useParams();
  const [params] = useSearchParams();
  const portFilter = params.get('port');
  const { data } = useDeviceLog(ip);
  const rows = portFilter ? (data ?? []).filter((r) => r.port === portFilter) : (data ?? []);
  return <DataTable tableId="log" data={rows} columns={cols} />;
}
