import { useDeviceDetails, useDeviceAddresses } from '@/hooks/use-device';
import { CellLink } from '@/components/common/cell-link';
import { DeviceActionBar } from '@/components/device/device-action-bar';
import { Globe, ExternalLink, TerminalSquare } from 'lucide-react';

export function DeviceHero({ ip }: { ip: string }) {
  const { data, isLoading } = useDeviceDetails(ip);
  const { data: addresses } = useDeviceAddresses(ip);
  if (isLoading || !data) return <div className="h-20 bg-[var(--color-bg-secondary)] rounded animate-pulse" />;

  const model = data.chassis_model || data.model || '';
  const osLine = `${data.os ?? ''} ${data.os_ver ?? ''}`.trim() || '--';

  const dnsRecords = (addresses ?? [])
    .filter((a) => a.dns)
    .map((a) => ({ dns: a.dns!, ip: a.alias ?? a.ip, port: a.port }));

  const primaryFqdn = data.dns ?? data.name ?? data.ip;

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-5 mb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold m-0">{primaryFqdn}</h1>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] bg-[rgba(78,201,176,0.12)] text-[var(--color-success)] border border-[rgba(78,201,176,0.25)] rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
          up  |  polled recently
        </span>
      </div>
      <div className="mt-2 text-xs text-[var(--color-text-secondary)] font-mono">
        {data.ip}  |  {data.vendor ?? '--'} {model}  |  {osLine}  |  {data.location ?? '--'}
      </div>

      {/* Quick connect to the device itself (like Netdisco's device links). */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <a href={`https://${ip}`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[var(--color-text-accent)] hover:underline">
          <ExternalLink className="w-3 h-3" /> Web UI
        </a>
        <a href={`http://${ip}`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:underline">
          HTTP
        </a>
        <a href={`ssh://${ip}`}
          className="inline-flex items-center gap-1 text-[var(--color-text-accent)] hover:underline">
          <TerminalSquare className="w-3 h-3" /> SSH
        </a>
      </div>

      {dnsRecords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Globe className="w-3 h-3 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
          {dnsRecords.map((r, i) => (
            <span key={i} className="text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-accent)]">{r.dns}</span>
              <span className="text-[var(--color-text-muted)] ml-1">({r.ip} on {r.port})</span>
            </span>
          ))}
        </div>
      )}

      <DeviceActionBar ip={ip} />
    </div>
  );
}
