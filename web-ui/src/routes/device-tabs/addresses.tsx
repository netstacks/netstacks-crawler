import { useParams } from 'react-router';
import { useDeviceAddresses } from '@/hooks/use-device';
import { DataTable } from '@/components/common/data-table';
import type { AddressRow } from '@/api/types';
import type { ColumnDef } from '@tanstack/react-table';

const cols: ColumnDef<AddressRow>[] = [
  { accessorKey: 'ip',     header: 'Address' },
  { accessorKey: 'dns',    header: 'DNS' },
  { accessorKey: 'port',   header: 'Interface' },
  { accessorKey: 'alias',  header: 'Description' },
  { accessorKey: 'subnet', header: 'Prefix' },
];

export function DeviceAddresses() {
  const { ip = '' } = useParams();
  const { data } = useDeviceAddresses(ip);
  return data ? <DataTable tableId="addresses" data={data} columns={cols} /> : null;
}
