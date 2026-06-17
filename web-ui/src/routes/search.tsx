import { useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { search, searchNodes, typeahead, type NodeSearchResult } from '@/api/search';
import { Badge } from '@/components/ui/badge';
import { normaliseMAC } from '@/lib/cell-link';
import {
  Search as SearchIcon, Server, Network, Globe, ArrowRight, Clock,
  MapPin, Cpu, Router,
} from 'lucide-react';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const nav = useNavigate();

  const devices = useQuery({
    queryKey: ['search', 'device', q],
    queryFn: () => search(q, 'device'),
    enabled: !!q,
  });

  const nodes = useQuery({
    queryKey: ['search', 'node', q],
    queryFn: () => searchNodes(q),
    enabled: !!q,
  });

  const subnets = useQuery({
    queryKey: ['search', 'subnet', q],
    queryFn: () => typeahead('subnet', q),
    enabled: !!q,
  });

  const deviceResults = (devices.data ?? []) as Record<string, unknown>[];
  const nodeResults = nodes.data ?? [];
  const subnetResults = (subnets.data ?? []) as string[];
  const totalResults = deviceResults.length + nodeResults.length + subnetResults.length;
  const isLoading = devices.isLoading || nodes.isLoading || subnets.isLoading;

  useEffect(() => {
    if (!isLoading && totalResults === 1) {
      const firstDevice = deviceResults[0];
      const firstNode = nodeResults[0];
      if (deviceResults.length === 1 && firstDevice) {
        const ip = String(firstDevice.ip);
        if (ip) nav(`/devices/${encodeURIComponent(ip)}`, { replace: true });
      } else if (nodeResults.length === 1 && firstNode?.mac) {
        nav(`/nodes/${encodeURIComponent(normaliseMAC(firstNode.mac))}`, { replace: true });
      }
    }
  }, [isLoading, totalResults, deviceResults, nodeResults, nav]);

  return (
    <div className="p-6 max-w-5xl">
      {q && (
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          {isLoading ? 'Searching...' : `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${q}"`}
        </p>
      )}

      {deviceResults.length > 0 && (
        <ResultSection
          icon={<Server className="w-4 h-4" />}
          title="Devices"
          count={deviceResults.length}
          color="blue"
        >
          <div className="grid gap-2">
            {deviceResults.map((d, i) => (
              <DeviceCard key={i} device={d} />
            ))}
          </div>
        </ResultSection>
      )}

      {nodeResults.length > 0 && (
        <ResultSection
          icon={<Network className="w-4 h-4" />}
          title="Nodes / MACs"
          count={nodeResults.length}
          color="emerald"
        >
          <div className="grid gap-2">
            {nodeResults.map((n, i) => (
              <NodeResultCard key={i} node={n} />
            ))}
          </div>
        </ResultSection>
      )}

      {subnetResults.length > 0 && (
        <ResultSection
          icon={<Globe className="w-4 h-4" />}
          title="Subnets"
          count={subnetResults.length}
          color="purple"
        >
          <div className="grid gap-2">
            {subnetResults.map((s, i) => (
              <Link
                key={i}
                to={`/reports/IP/subnets?net=${encodeURIComponent(s)}`}
                className="flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-purple-500/40 transition-colors"
              >
                <Cpu className="w-4 h-4 text-purple-400" />
                <code className="font-mono text-sm">{s}</code>
                <ArrowRight className="w-3 h-3 ml-auto text-[var(--color-text-muted)]" />
              </Link>
            ))}
          </div>
        </ResultSection>
      )}

      {!isLoading && totalResults === 0 && q && (
        <div className="text-center py-12">
          <SearchIcon className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">No results found for "{q}"</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Try a different IP, MAC, hostname, or serial number</p>
        </div>
      )}

      {!q && (
        <div className="text-center py-16">
          <SearchIcon className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-secondary)]">Use the search bar above to find devices, nodes, MACs, or subnets</p>
        </div>
      )}
    </div>
  );
}

function ResultSection({ icon, title, count, color, children }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-${color}-400`}>{icon}</span>
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
      </div>
      {children}
    </section>
  );
}

function DeviceCard({ device }: { device: Record<string, unknown> }) {
  const ip = String(device.ip ?? '');
  const name = (device.dns as string) || (device.name as string) || '';
  const vendor = device.vendor as string | undefined;
  const model = (device.chassis_model as string) || (device.model as string) || '';
  const os = `${device.os ?? ''} ${device.os_ver ?? ''}`.trim();
  const location = device.location as string | undefined;

  return (
    <Link
      to={`/devices/${encodeURIComponent(ip)}`}
      className="flex items-start gap-4 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-blue-500/40 transition-colors group"
    >
      <Server className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{name || ip}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-[var(--color-text-muted)]">
          <code className="font-mono">{ip}</code>
          {vendor && <span>{vendor} {model}</span>}
          {os && <span>{os}</span>}
          {location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{location}</span>}
        </div>
      </div>
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionPill to={`/devices/${encodeURIComponent(ip)}/ports`}>Ports</ActionPill>
        <ActionPill to={`/devices/${encodeURIComponent(ip)}/details`}>Details</ActionPill>
      </div>
    </Link>
  );
}

function NodeResultCard({ node }: { node: NodeSearchResult }) {
  const mac = normaliseMAC(node.mac ?? '');
  return (
    <Link
      to={`/nodes/${encodeURIComponent(mac)}`}
      className="flex items-start gap-4 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-emerald-500/40 transition-colors group"
    >
      <Network className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="font-semibold text-sm font-mono">{mac}</code>
          {node.active ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400">active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/40 text-red-400">inactive</Badge>
          )}
          {node.manufacturer && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{node.manufacturer}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-[var(--color-text-muted)]">
          {node.ip && <code className="font-mono">{node.ip}</code>}
          {node.router_name && (
            <span className="flex items-center gap-1">
              <Router className="w-3 h-3" />
              {node.router_name}
            </span>
          )}
          {node.time_last_stamp && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {node.time_last_stamp}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionPill to={`/nodes/${encodeURIComponent(mac)}`}>History</ActionPill>
      </div>
    </Link>
  );
}

function ActionPill({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="px-2 py-1 text-[10px] font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:border-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      {children}
    </Link>
  );
}
