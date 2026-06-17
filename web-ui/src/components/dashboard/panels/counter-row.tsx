import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Server, Globe, Cable, ArrowUpRight, Network, Phone, Wifi } from 'lucide-react';
import { api } from '@/api/client';
import { registerPanelType, type PanelProps } from '../panel-registry';

type Tint = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'pink';

interface CounterDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  tint: Tint;
  href?: string;
  sub?: (latest: Record<string, number>) => string | undefined;
}

const COUNTERS: CounterDef[] = [
  { key: 'device_count',      label: 'Devices',     icon: <Server className="w-4 h-4" />,       tint: 'blue',   href: '/devices' },
  { key: 'device_ip_count',   label: 'Device IPs',  icon: <Globe className="w-4 h-4" />,        tint: 'cyan',   href: '/devices' },
  { key: 'device_port_count', label: 'Ports',       icon: <Cable className="w-4 h-4" />,        tint: 'purple', href: '/reports/Port/portmultinodes',
    sub: (l) => l.device_port_up_count != null ? `${l.device_port_up_count} up` : undefined },
  { key: 'device_link_count', label: 'Links',       icon: <ArrowUpRight className="w-4 h-4" />, tint: 'green',  href: '/devices' },
  { key: 'node_active_count', label: 'Nodes active',icon: <Network className="w-4 h-4" />,      tint: 'orange', href: '/reports/Node/nodevendor',
    sub: (l) => l.node_table_count != null ? `${l.node_table_count} total` : undefined },
  { key: 'phone_count',       label: 'Phones',      icon: <Phone className="w-4 h-4" />,        tint: 'pink',   href: '/reports/Node/nodevendor' },
  { key: 'wap_count',         label: 'WAPs',        icon: <Wifi className="w-4 h-4" />,         tint: 'blue',   href: '/reports/Wireless/ssidinventory' },
];

const TINT: Record<Tint, string> = {
  blue:   'bg-blue-500/10 text-blue-400',
  green:  'bg-emerald-500/10 text-emerald-400',
  orange: 'bg-amber-500/10 text-amber-400',
  red:    'bg-red-500/10 text-red-400',
  purple: 'bg-violet-500/10 text-violet-400',
  cyan:   'bg-cyan-500/10 text-cyan-400',
  pink:   'bg-pink-500/10 text-pink-400',
};

function pickLatest(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const latest = (raw as { latest?: Record<string, unknown> }).latest ?? (raw as Record<string, unknown>);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(latest)) if (typeof v === 'number') out[k] = v;
  return out;
}

function CounterRow({ dataSource }: PanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['panel', dataSource.endpoint, dataSource.params],
    queryFn: async () => (await api.get(dataSource.endpoint, { params: dataSource.params })).data,
    refetchInterval: (dataSource.refreshSec ?? 30) * 1000,
  });

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>;
  if (error)     return <p className="text-xs text-[var(--color-error)]">Failed to load</p>;

  const latest = pickLatest(data);
  const visible = COUNTERS.filter((c) => c.key in latest);
  if (visible.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No counter fields in this endpoint.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {visible.map((c) => {
        const card = (
          <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-md h-full transition-colors hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-accent)] border border-transparent">
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded ${TINT[c.tint]} flex-shrink-0`}>
              {c.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] truncate">{c.label}</div>
              <div className="text-xl font-semibold tabular-nums leading-tight">{latest[c.key]}</div>
              {c.sub && c.sub(latest) && (
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{c.sub(latest)}</div>
              )}
            </div>
          </div>
        );
        return c.href
          ? <Link key={c.key} to={c.href} className="block focus:outline-none">{card}</Link>
          : <div key={c.key}>{card}</div>;
      })}
    </div>
  );
}

registerPanelType({
  type: 'counter-row',
  label: 'Counter row',
  description: 'Stat cards for fleet totals',
  defaultW: 12,
  defaultH: 3,
  render: CounterRow,
});
