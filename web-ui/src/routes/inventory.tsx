import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getInventory, type PlatformRow, type SoftwareRow } from '@/api/inventory';

export function Inventory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
  });
  const [filter, setFilter] = useState('');

  const platforms = useMemo<PlatformRow[]>(
    () => filterRows(data?.by_platform ?? [], filter, (r) => `${r.vendor ?? ''} ${r.model ?? ''}`),
    [data, filter],
  );
  const software = useMemo<SoftwareRow[]>(
    () => filterRows(data?.by_software ?? [], filter, (r) => `${r.os ?? ''} ${r.version ?? ''}`),
    [data, filter],
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold m-0">Inventory</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Fleet snapshot  |  {data?.total ?? '--'} devices across {data?.by_platform.length ?? '--'} platforms and {data?.by_software.length ?? '--'} software releases.
          </p>
        </div>
        <input
          placeholder="Find anything..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] outline-none w-[280px]"
          data-testid="inventory-filter"
        />
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">Loading inventory...</p>}
      {error && <p className="text-sm text-[var(--color-error)]">Failed to load inventory.</p>}

      {data && (
        <div className="grid grid-cols-2 gap-6">
          <section data-testid="inventory-by-platform">
            <h2 className="text-base font-medium mb-2">By Platform</h2>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                  <th className="text-left py-1.5 px-2">Vendor</th>
                  <th className="text-left py-1.5 px-2">Model</th>
                  <th className="text-right py-1.5 px-2 w-20">Count</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">
                    <td className="px-2 py-1.5">{r.vendor || <span className="text-[var(--color-text-muted)]">--</span>}</td>
                    <td className="px-2 py-1.5">
                      {r.model ? (
                        <Link
                          to={`/devices?q=${encodeURIComponent(r.model)}`}
                          className="text-[var(--color-text-accent)] hover:underline"
                        >{r.model}</Link>
                      ) : <span className="text-[var(--color-text-muted)]">unknown</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.count}</td>
                  </tr>
                ))}
                {platforms.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-[var(--color-text-muted)] py-6">No platforms match filter.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section data-testid="inventory-by-software">
            <h2 className="text-base font-medium mb-2">By Software Release</h2>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                  <th className="text-left py-1.5 px-2">OS</th>
                  <th className="text-left py-1.5 px-2">Version</th>
                  <th className="text-right py-1.5 px-2 w-20">Count</th>
                </tr>
              </thead>
              <tbody>
                {software.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">
                    <td className="px-2 py-1.5">
                      {r.os ? (
                        <Link
                          to={`/devices?q=${encodeURIComponent(r.os)}`}
                          className="text-[var(--color-text-accent)] hover:underline"
                        >{r.os}</Link>
                      ) : <span className="text-[var(--color-text-muted)]">--</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.version ? (
                        <Link
                          to={`/devices?q=${encodeURIComponent(r.version)}`}
                          className="text-[var(--color-text-accent)] hover:underline"
                        >{r.version}</Link>
                      ) : <span className="text-[var(--color-text-muted)]">--</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.count}</td>
                  </tr>
                ))}
                {software.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-[var(--color-text-muted)] py-6">No software matches filter.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

function filterRows<T>(rows: T[], q: string, key: (r: T) => string): T[] {
  if (!q.trim()) return rows;
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => key(r).toLowerCase().includes(needle));
}
