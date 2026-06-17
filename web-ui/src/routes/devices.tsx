import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { listDevices } from '@/api/devices';
import { submitGlobalAction } from '@/api/admin';
import { DataTable } from '@/components/common/data-table';
import { BulkActionBar, type BulkAction } from '@/components/common/bulk-action-bar';
import { AddDeviceDialog } from '@/components/device/add-device-dialog';
import { CellLink } from '@/components/common/cell-link';
import type { Device } from '@/api/types';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';

const CORE_COLUMNS: ColumnDef<Device>[] = [
  {
    accessorKey: 'ip',
    header: 'IP',
    enableHiding: false,
    cell: ({ getValue }) => <CellLink field="ip" value={getValue()} />,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <CellLink field="device" value={row.original.ip}>{row.original.name || '--'}</CellLink>,
  },
  {
    accessorKey: 'dns',
    header: 'DNS / FQDN',
    cell: ({ row }) => {
      const dns = row.original.dns;
      const name = row.original.name;
      const display = dns || name || null;
      return display
        ? <CellLink field="device" value={row.original.ip}>{display}</CellLink>
        : <span className="text-[var(--color-text-muted)]">--</span>;
    },
  },
  { accessorKey: 'vendor', header: 'Vendor' },
  {
    accessorKey: 'model',
    header: 'Model',
    cell: ({ row }) => row.original.chassis_model || row.original.model || '',
  },
  {
    accessorKey: 'os',
    header: 'OS',
    cell: ({ row }) => `${row.original.os ?? ''} ${row.original.os_ver ?? ''}`.trim(),
  },
  { accessorKey: 'location', header: 'Location' },
];

const EXTRA_COLUMNS: ColumnDef<Device>[] = [
  { accessorKey: 'serial', header: 'Serial' },
  { accessorKey: 'contact', header: 'Contact' },
  { accessorKey: 'mac', header: 'MAC' },
  { accessorKey: 'chassis_id', header: 'Chassis ID' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'num_ports', header: 'Ports' },
  { accessorKey: 'layers', header: 'Layers' },
  { accessorKey: 'uptime', header: 'Uptime', cell: ({ getValue }) => { const v = getValue() as number | null; return v ? `${Math.floor(v / 8640000)}d` : ''; } },
  { accessorKey: 'last_discover', header: 'Last Discover' },
  { accessorKey: 'last_macsuck', header: 'Last Macsuck' },
  { accessorKey: 'last_arpnip', header: 'Last Arpnip' },
  { accessorKey: 'creation', header: 'Created' },
  { accessorKey: 'snmp_ver', header: 'SNMP Ver' },
  { accessorKey: 'snmp_class', header: 'SNMP Class' },
  { accessorKey: 'snmp_engineid', header: 'Engine ID' },
  { accessorKey: 'os_ver', header: 'OS Version' },
  { accessorKey: 'vtp_domain', header: 'VTP Domain' },
  { accessorKey: 'vtp_mode', header: 'VTP Mode' },
  { accessorKey: 'ps1_type', header: 'PS1 Type' },
  { accessorKey: 'ps1_status', header: 'PS1 Status' },
  { accessorKey: 'ps2_type', header: 'PS2 Type' },
  { accessorKey: 'ps2_status', header: 'PS2 Status' },
  { accessorKey: 'fan', header: 'Fan' },
  { accessorKey: 'slots', header: 'Slots' },
  { accessorKey: 'tags', header: 'Tags', cell: ({ getValue }) => { const v = getValue() as string[] | null; return v?.length ? v.join(', ') : ''; } },
];

const ALL_COLUMNS = [...CORE_COLUMNS, ...EXTRA_COLUMNS];

const DEFAULT_HIDDEN: VisibilityState = Object.fromEntries(
  EXTRA_COLUMNS.map((c) => [(c as { accessorKey: string }).accessorKey, false]),
);

const BULK_ACTIONS: BulkAction<Device>[] = [
  {
    key: 'discover', label: 'Discover',
    onExecute: (rows) => Promise.all(rows.map(async (d) => {
      try { const id = await submitGlobalAction('discover', { device: d.ip }); return { id: d.ip, success: true, message: `Job #${id}` }; }
      catch (e) { return { id: d.ip, success: false, message: (e as { message?: string }).message ?? 'failed' }; }
    })),
  },
  {
    key: 'macsuck', label: 'Macsuck',
    onExecute: (rows) => Promise.all(rows.map(async (d) => {
      try { const id = await submitGlobalAction('macsuck', { device: d.ip }); return { id: d.ip, success: true, message: `Job #${id}` }; }
      catch (e) { return { id: d.ip, success: false, message: (e as { message?: string }).message ?? 'failed' }; }
    })),
  },
  {
    key: 'arpnip', label: 'Arpnip',
    onExecute: (rows) => Promise.all(rows.map(async (d) => {
      try { const id = await submitGlobalAction('arpnip', { device: d.ip }); return { id: d.ip, success: true, message: `Job #${id}` }; }
      catch (e) { return { id: d.ip, success: false, message: (e as { message?: string }).message ?? 'failed' }; }
    })),
  },
  {
    key: 'delete', label: 'Delete', variant: 'destructive',
    needsConfirmation: true,
    confirmTitle: 'Delete selected devices?',
    confirmDescription: 'This will queue delete jobs for all selected devices. Discovery may re-add them if they respond to a future pingsweep.',
    onExecute: (rows) => Promise.all(rows.map(async (d) => {
      try { const id = await submitGlobalAction('delete', { device: d.ip }); return { id: d.ip, success: true, message: `Job #${id}` }; }
      catch (e) { return { id: d.ip, success: false, message: (e as { message?: string }).message ?? 'failed' }; }
    })),
  },
];

export function Devices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const setQ = (next: string) => {
    const sp = new URLSearchParams(searchParams);
    if (next) sp.set('q', next); else sp.delete('q');
    setSearchParams(sp, { replace: true });
    setPage(1);
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['devices', page, pageSize, q],
    queryFn: () => listDevices({ page, page_size: pageSize, q }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <input
          placeholder="Filter..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] outline-none"
          data-testid="devices-filter"
        />
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]" data-testid="devices-page-size">
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <div className="flex-1" />
        <a href={`/api/devices.csv?q=${encodeURIComponent(q)}`} className="text-xs px-3 py-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]" data-testid="devices-export-csv">Export CSV</a>
        <AddDeviceDialog />
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>}
      {data && (
        <>
          {data.total === 0 ? (
            <div className="py-16 text-center" data-testid="devices-empty-state">
              {q ? (
                <>
                  <p className="text-[var(--color-text-secondary)] mb-4">
                    No devices match <code className="font-mono">{q}</code>.
                  </p>
                  <button
                    onClick={() => setQ('')}
                    className="text-xs px-3 py-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]"
                    data-testid="devices-clear-filter"
                  >Clear filter</button>
                </>
              ) : (
                <>
                  <p className="text-[var(--color-text-secondary)] mb-4">No devices yet -- add one to start discovery.</p>
                  <AddDeviceDialog triggerLabel="Add your first device" />
                </>
              )}
            </div>
          ) : (
            <>
              <DataTable
                data={data.devices}
                columns={ALL_COLUMNS}
                onRowClick={(d) => nav(`/devices/${d.ip}`)}
                getRowId={(d) => d.ip}
                tableId="devices"
                defaultColumnVisibility={DEFAULT_HIDDEN}
                enableRowSelection
                onSelectionChange={setSelectedDevices}
              />
              <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-text-secondary)]">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="page-prev" className="px-2 py-1 border border-[var(--color-border)] rounded disabled:opacity-40">Prev</button>
                <span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.page_size))} ({data.total} total)</span>
                <button disabled={page * pageSize >= data.total} onClick={() => setPage((p) => p + 1)} data-testid="page-next" className="px-2 py-1 border border-[var(--color-border)] rounded disabled:opacity-40">Next</button>
              </div>
            </>
          )}

          {selectedDevices.length > 0 && (
            <BulkActionBar
              selectedRows={selectedDevices}
              actions={BULK_ACTIONS}
              getRowLabel={(d) => d.name || d.dns || d.ip}
              onClearSelection={() => setSelectedDevices([])}
            />
          )}
        </>
      )}
    </div>
  );
}
