import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useDevicePorts, useDevicePoweredPorts } from '@/hooks/use-device';
import { usePortAction } from '@/hooks/use-port-action';
import { DataTable } from '@/components/common/data-table';
import { InlineEdit } from '@/components/common/inline-edit';
import { PortRowActions } from '@/components/device/port-row-actions';
import { CellLink } from '@/components/common/cell-link';
import { isIP } from '@/lib/cell-link';
import { naturalPortCompare } from '@/lib/port-sort';
import type { Port } from '@/api/types';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';

function statusColor(up?: string | null, upAdmin?: string | null): string {
  if (upAdmin === 'down') return 'border-l-amber-500';
  if (up === 'up') return 'border-l-emerald-500';
  return 'border-l-red-500';
}

function relativeTime(ts: unknown): string {
  if (!ts || ts === '0' || ts === 0) return '--';
  const num = typeof ts === 'number' ? ts : parseInt(String(ts), 10);
  if (isNaN(num) || num === 0) return '--';
  const now = Date.now() / 1000;
  const diff = now - num;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const defaultHidden: VisibilityState = {
  up_admin: false,
  duplex: false,
  mtu: false,
  mac: false,
  type: false,
  lastchange: false,
  stp: false,
};

export function DevicePorts() {
  const { ip = '' } = useParams();
  const nav = useNavigate();
  const { data } = useDevicePorts(ip);
  const { data: poePorts } = useDevicePoweredPorts(ip);
  const portAction = usePortAction(ip);
  const [editing, setEditing] = useState<string | null>(null);

  // Only PoE-capable devices get the PoE column (keeps router/switch tables clean).
  const poeByPort = new Map((poePorts ?? []).map((p) => [p.port, p]));
  const poeCol: ColumnDef<Port> | null = poeByPort.size > 0 ? {
    id: 'poe', header: 'PoE',
    cell: ({ row }) => {
      const p = poeByPort.get(row.original.port);
      if (!p) return '--';
      const w = p.power != null ? `${(p.power / 1000).toFixed(1)}W` : null;
      const on = (p.status ?? '').toLowerCase().includes('deliver') || (p.status ?? '').toLowerCase() === 'on';
      return (
        <span className={`inline-flex items-center gap-1 ${on ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`} title={`${p.admin ?? ''} / ${p.status ?? ''}${p.class ? ' / class ' + p.class : ''}`}>
          {w ?? p.status ?? p.admin ?? '--'}
        </span>
      );
    },
  } : null;

  const cols: ColumnDef<Port>[] = [
    {
      accessorKey: 'port',
      header: 'Port',
      sortingFn: (a, b) => naturalPortCompare(a.original.port, b.original.port),
      cell: (c) => {
        const row = c.row.original;
        const color = statusColor(row.up, row.up_admin);
        return (
          <span className={`inline-flex items-center gap-1.5 border-l-2 pl-2 ${color}`}>
            <code className="font-mono">{c.getValue() as string}</code>
          </span>
        );
      },
    },
    {
      accessorKey: 'up',
      header: 'Status',
      cell: (c) => {
        const up = (c.getValue() as string) === 'up';
        return <span className={`inline-flex items-center gap-1.5 ${up ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${up ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`} />
          {String(c.getValue() ?? '--')}
        </span>;
      },
    },
    {
      accessorKey: 'up_admin',
      header: 'Admin',
      cell: (c) => {
        const v = c.getValue() as string | null;
        if (!v) return '--';
        const isDown = v === 'down';
        return <span className={isDown ? 'text-amber-400' : 'text-[var(--color-text-secondary)]'}>{v}</span>;
      },
    },
    { accessorKey: 'speed', header: 'Speed' },
    {
      accessorKey: 'duplex',
      header: 'Duplex',
      cell: (c) => String(c.getValue() ?? '--'),
    },
    {
      accessorKey: 'mtu',
      header: 'MTU',
      cell: (c) => c.getValue() != null ? String(c.getValue()) : '--',
    },
    {
      accessorKey: 'vlan',
      header: 'VLAN',
      cell: (c) => {
        const v = c.getValue();
        if (v == null) return '--';
        return <CellLink field="vlan" value={v} />;
      },
    },
    {
      id: 'neighbor', header: 'Neighbor',
      cell: ({ row }) => {
        const { remote_id, remote_ip, remote_port } = row.original as Record<string, unknown>;
        const remoteDevice = (remote_ip && isIP(String(remote_ip))) ? String(remote_ip)
                           : (remote_id && isIP(String(remote_id))) ? String(remote_id)
                           : undefined;
        return (
          <>
            {remoteDevice
              ? <CellLink field="remote_ip" value={remoteDevice} />
              : remote_id ? <CellLink field="remote_id" value={remote_id} /> : null}
            {(remote_id || remoteDevice) && remote_port && ' '}
            {remote_port && <CellLink field="remote_port" value={remote_port} ctx={remoteDevice ? { device: remoteDevice } : undefined} />}
            {!remote_id && !remoteDevice && !remote_port && '--'}
          </>
        );
      },
    },
    {
      accessorKey: 'mac',
      header: 'MAC',
      cell: (c) => {
        const v = c.getValue() as string | null;
        if (!v) return '--';
        return <CellLink field="mac" value={v} />;
      },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: (c) => String(c.getValue() ?? '--'),
    },
    {
      accessorKey: 'lastchange',
      header: 'Last Change',
      cell: (c) => relativeTime(c.getValue()),
    },
    {
      accessorKey: 'stp',
      header: 'STP',
      cell: (c) => String(c.getValue() ?? '--'),
    },
    ...(poeCol ? [poeCol] : []),
    {
      id: 'name', header: 'Description',
      cell: ({ row }) => (
        <InlineEdit
          value={row.original.name ?? ''}
          editing={editing === row.original.port}
          onSave={(value) => {
            portAction.mutate({ device: ip, port: row.original.port, field: 'c_name', value });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ),
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <PortRowActions
          port={row.original}
          onRename={() => setEditing(row.original.port)}
          onToggleAdmin={() => portAction.mutate({ device: ip, port: row.original.port, field: 'c_port', action: row.original.up_admin === 'up' ? 'down' : 'up' })}
          onChangeVlan={() => {
            const v = window.prompt('New VLAN id', String(row.original.vlan ?? ''));
            if (v) portAction.mutate({ device: ip, port: row.original.port, field: 'c_pvid', value: v });
          }}
          onCyclePoe={() => portAction.mutate({ device: ip, port: row.original.port, field: 'c_power', action: 'cycle' })}
          onViewLog={() => nav(`/devices/${ip}/log?port=${encodeURIComponent(row.original.port)}`)}
        />
      ),
    },
  ];

  return (
    <div>
      {portAction.isPending && <div className="text-xs text-[var(--color-text-muted)] mb-2">Submitting...</div>}
      {data && <DataTable tableId="ports" data={data} columns={cols} getRowId={(row) => row.port} defaultColumnVisibility={defaultHidden} />}
    </div>
  );
}
