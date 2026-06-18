import { NavLink, Outlet, useParams, Link } from 'react-router';
import { Maximize2 } from 'lucide-react';
import { DeviceHero } from '@/components/device/device-hero';
import { TopologyGraph } from '@/components/topology/topology-graph';
import { useDeviceDetails, useDeviceNeighbors } from '@/hooks/use-device';
import { cn } from '@/lib/utils';

const tabs = [
  { to: 'details',   label: 'Details' },
  { to: 'ports',     label: 'Ports', countKey: 'ports' as const },
  { to: 'nodes',     label: 'Nodes', countKey: 'nodes' as const },
  { to: 'addresses', label: 'Addresses', countKey: 'addresses' as const },
  { to: 'neighbors', label: 'Neighbors', countKey: 'neighbors' as const },
  { to: 'vlans',     label: 'VLANs', countKey: 'vlans' as const },
  { to: 'modules',   label: 'Modules', countKey: 'modules' as const },
  { to: 'log',       label: 'Log' },
];

export function DeviceDetail() {
  const { ip = '' } = useParams();
  const { data } = useDeviceDetails(ip);
  const { data: neighbors } = useDeviceNeighbors(ip);
  // Tab counts: backend provides ports/nodes/vlans/modules; neighbors is derived
  // client-side from the (already-loaded) neighbors query.
  const counts: Record<string, number | undefined> = {
    ...(data?.counts as Record<string, number> | undefined),
    neighbors: neighbors?.length,
  };

  return (
    <div className="p-6">
      <DeviceHero ip={ip} />

      {/* Same interactive topology engine as the /topology page, seeded here.
          Click a neighbor to expand its neighbors and walk outward. */}
      {(neighbors?.length ?? 0) > 0 && (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Topology</span>
            <Link to={`/topology?ip=${encodeURIComponent(ip)}`}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
              <Maximize2 className="w-3 h-3" /> Open full map
            </Link>
          </div>
          <div className="h-[420px]">
            <TopologyGraph seed={ip} />
          </div>
        </div>
      )}
      <div className="flex border-b border-[var(--color-border)] mb-3 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to}
            className={({ isActive }) => cn(
              'px-4 py-2.5 text-[13px] border-b-2 -mb-px',
              isActive
                ? 'text-[var(--color-text-primary)] border-[var(--color-accent)] font-medium'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]',
            )}
            data-testid={`tab-${t.to}`}>
            {t.label}
            {t.countKey && counts[t.countKey] != null && (
              <span className="ml-1 text-[var(--color-text-muted)] text-[11px]">{counts[t.countKey]}</span>
            )}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
