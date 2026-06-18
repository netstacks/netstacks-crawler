import { useParams } from 'react-router';
import { useDeviceAddresses } from '@/hooks/use-device';
import { DataTable } from '@/components/common/data-table';
import type { AddressRow } from '@/api/types';
import type { ColumnDef } from '@tanstack/react-table';

// On a device's own Addresses tab every row's `ip` is this device's management
// IP (redundant), while `alias` holds the actual address configured on the
// interface. Show `alias` as the Address; the repeated device IP is dropped.
const cols: ColumnDef<AddressRow>[] = [
  { accessorKey: 'alias',  header: 'Address' },
  { accessorKey: 'dns',    header: 'DNS' },
  { accessorKey: 'port',   header: 'Interface' },
  { accessorKey: 'subnet', header: 'Prefix' },
];

export function DeviceAddresses() {
  const { ip = '' } = useParams();
  const { data } = useDeviceAddresses(ip);
  return data ? <DataTable tableId="addresses" data={data} columns={cols} /> : null;
}
