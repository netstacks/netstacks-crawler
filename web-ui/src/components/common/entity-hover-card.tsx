import { useState, useRef, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { getIpContext } from '@/api/devices';
import { getNode } from '@/api/nodes';
import { isIP, isMAC, normaliseMAC, isCIDR } from '@/lib/cell-link';
import { Server, Network, Clock, Layers, Cpu, ArrowRight, Cable } from 'lucide-react';

type EntityKind = 'device' | 'node' | 'vlan' | 'subnet';

function detectKind(field: string, value: string): { kind: EntityKind; key: string } | null {
  const f = field.toLowerCase();
  if (['ip', 'device', 'remote_ip', 'switch', 'mgmt_ip'].includes(f) && isIP(value))
    return { kind: 'device', key: value };
  if (['mac', 'node', 'switch_mac', 'remote_id', 'chassis_id'].includes(f) && isMAC(value))
    return { kind: 'node', key: normaliseMAC(value) };
  if (['vlan', 'vlan_id', 'native_vlan'].includes(f) && /^\d+$/.test(value))
    return { kind: 'vlan', key: value };
  if (['subnet', 'net', 'cidr'].includes(f) && isCIDR(value))
    return { kind: 'subnet', key: value };
  if (isIP(value)) return { kind: 'device', key: value };
  if (isMAC(value)) return { kind: 'node', key: normaliseMAC(value) };
  return null;
}

function DeviceCard({ ip }: { ip: string }) {
  // Resolve the IP against the DB: a device, a device interface (alias), or a host.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ip-context', ip],
    queryFn: () => getIpContext(ip),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) return <CardShell><div className="text-xs text-[var(--color-text-muted)]">Loading...</div></CardShell>;

  if (isError || !data || data.kind === 'unknown') return (
    <CardShell>
      <div className="flex items-center gap-2 mb-1">
        <Server className="w-4 h-4 text-[var(--color-text-muted)]" />
        <code className="font-mono text-sm">{ip}</code>
      </div>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Not in inventory</Badge>
    </CardShell>
  );

  // Host (endpoint seen on a switch port).
  if (data.kind === 'host') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <code className="font-mono text-sm truncate">{ip}</code>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/40 text-cyan-400">host</Badge>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {data.mac && <KV label="MAC" value={data.mac} mono />}
          {data.switch && <KV label="On switch" value={data.switch} mono />}
          {data.port && <KV label="Port" value={data.port} mono />}
          {data.vlan != null && <KV label="VLAN" value={String(data.vlan)} />}
          {data.last_seen && <KV label="Last seen" value={data.last_seen} icon={<Clock className="w-3 h-3" />} />}
        </div>
        {data.mac && (
          <Link to={`/nodes/${encodeURIComponent(data.mac)}`}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
            View node <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </CardShell>
    );
  }

  // Device or device interface.
  const d = data.device ?? { ip };
  const isIntf = data.kind === 'device-interface';
  const name = (d.dns as string) || (d.name as string) || (d.ip as string) || ip;
  const os = `${d.os ?? ''} ${d.os_ver ?? ''}`.trim();
  return (
    <CardShell>
      <div className="flex items-center gap-2 mb-2">
        {isIntf ? <Cable className="w-4 h-4 text-blue-400" /> : <Server className="w-4 h-4 text-[var(--color-accent)]" />}
        <span className="font-semibold text-sm truncate">{name}</span>
        {isIntf
          ? <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-400">interface</Badge>
          : <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <KV label={isIntf ? 'Interface IP' : 'IP'} value={ip} mono />
        {isIntf && data.port && <KV label="Interface" value={String(data.port)} mono />}
        {isIntf && d.ip && String(d.ip) !== ip && <KV label="Device IP" value={String(d.ip)} mono />}
        {data.subnet && <KV label="Subnet" value={String(data.subnet)} mono />}
        {d.vendor && <KV label="Vendor" value={String(d.vendor)} />}
        {d.model && <KV label="Model" value={String(d.model)} />}
        {os && <KV label="OS" value={os} />}
      </div>
      <Link to={`/devices/${encodeURIComponent(String(d.ip ?? ip))}`}
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
        View device <ArrowRight className="w-3 h-3" />
      </Link>
    </CardShell>
  );
}

function NodeCard({ mac }: { mac: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['node', mac],
    queryFn: () => getNode(mac),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) return <CardShell><div className="text-xs text-[var(--color-text-muted)]">Loading...</div></CardShell>;
  if (isError || !data) return (
    <CardShell>
      <div className="flex items-center gap-2 mb-1">
        <Network className="w-4 h-4 text-[var(--color-text-muted)]" />
        <code className="font-mono text-sm">{mac}</code>
      </div>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Not observed</Badge>
    </CardShell>
  );

  return (
    <CardShell>
      <div className="flex items-center gap-2 mb-2">
        <Network className="w-4 h-4 text-emerald-400" />
        <code className="font-semibold text-sm">{mac}</code>
        {data.active ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400">active</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/40 text-red-400">inactive</Badge>
        )}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {data.switch && <KV label="Switch" value={String(data.switch)} mono />}
        {data.port && <KV label="Port" value={String(data.port)} mono />}
        {data.vlan != null && <KV label="VLAN" value={String(data.vlan)} />}
        {data.time_last && <KV label="Last seen" value={String(data.time_last)} icon={<Clock className="w-3 h-3" />} />}
      </div>
      <Link to={`/nodes/${encodeURIComponent(mac)}`}
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
        View node <ArrowRight className="w-3 h-3" />
      </Link>
    </CardShell>
  );
}

function VlanCard({ vlan }: { vlan: string }) {
  return (
    <CardShell>
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-purple-400" />
        <span className="font-semibold text-sm">VLAN {vlan}</span>
      </div>
      <Link to={`/reports/VLAN/vlaninventory?vlan=${encodeURIComponent(vlan)}`}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
        View VLAN report <ArrowRight className="w-3 h-3" />
      </Link>
    </CardShell>
  );
}

function SubnetCard({ cidr }: { cidr: string }) {
  return (
    <CardShell>
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <code className="font-semibold text-sm">{cidr}</code>
      </div>
      <Link to={`/reports/IP/subnets?net=${encodeURIComponent(cidr)}`}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
        View subnet report <ArrowRight className="w-3 h-3" />
      </Link>
    </CardShell>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return <div className="min-w-[240px] max-w-[320px]">{children}</div>;
}

function KV({ label, value, mono, icon }: { label: string; value?: string | null; mono?: boolean; icon?: ReactNode }) {
  if (!value) return null;
  return (
    <>
      <span className="text-[var(--color-text-muted)] flex items-center gap-1">{icon}{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </>
  );
}

export function EntityHoverCard({
  field, value, children,
}: {
  field: string;
  value: unknown;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const v = value == null ? '' : String(value).trim();
  const entity = v ? detectKind(field, v) : null;

  const clearTimers = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  // Open after a short hover; close after a short grace period so the cursor can
  // travel from the trigger into the card (and onto the "View ..." link) without
  // it vanishing. Entering the card cancels the pending close.
  const scheduleOpen = useCallback(() => {
    if (!entity) return;
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    openTimer.current = setTimeout(() => setOpen(true), 300);
  }, [entity]);
  const scheduleClose = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);
  const keepOpen = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  if (!entity) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) clearTimers(); setOpen(o); }}>
      <PopoverTrigger asChild onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
        <span>{children}</span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="p-3 w-auto"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        {entity.kind === 'device' && <DeviceCard ip={entity.key} />}
        {entity.kind === 'node' && <NodeCard mac={entity.key} />}
        {entity.kind === 'vlan' && <VlanCard vlan={entity.key} />}
        {entity.kind === 'subnet' && <SubnetCard cidr={entity.key} />}
      </PopoverContent>
    </Popover>
  );
}
