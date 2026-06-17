import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { registerPanelType, type PanelProps } from '../panel-registry';
import { usePanelSearch } from '../panel-search-context';
import { useReportEmpty } from '../panel-empty-context';
import { EmptyState } from '../empty-state';
import { CellLink } from '@/components/common/cell-link';
import { isIP } from '@/lib/cell-link';

// Render a single cell value to a string. DBIC prefetch puts nested rows into
// fields as objects -- `[object Object]` would otherwise leak; instead pull a
// useful identifier or fall back to compact JSON.
function renderCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length === 0 ? '' : `${v.length} items`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // Prefer human-meaningful identifiers in this order
    const pick = ['dns', 'name', 'ip', 'mac', 'label', 'id'];
    for (const k of pick) {
      const candidate = o[k];
      if (candidate != null && typeof candidate !== 'object') return String(candidate);
    }
    // Fall back to compact join of primitive values
    const parts: string[] = [];
    for (const val of Object.values(o)) {
      if (val == null) continue;
      if (typeof val !== 'object') parts.push(String(val));
      if (parts.length >= 2) break;
    }
    return parts.join(' / ');
  }
  return String(v);
}

export function adaptRows(raw: unknown, field?: string): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === 'object') {
    // Explicit field selection always wins. Endpoints like /stats/operational
    // return an object of several arrays; relying on key order (a Perl hash, so
    // non-deterministic) would render the wrong dataset under the panel title.
    if (field) {
      const picked = (raw as Record<string, unknown>)[field];
      return Array.isArray(picked) ? (picked as Record<string, unknown>[]) : [];
    }
    if ('rows' in raw && Array.isArray((raw as { rows: unknown[] }).rows)) {
      return (raw as { rows: Record<string, unknown>[] }).rows;
    }
    if ('jobs' in raw && Array.isArray((raw as { jobs: unknown[] }).jobs)) {
      return (raw as { jobs: Record<string, unknown>[] }).jobs;
    }
    // Fallback: first array field (only safe when there's a single array).
    for (const v of Object.values(raw)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v as Record<string, unknown>[];
    }
  }
  return [];
}

function TablePanel({ dataSource }: PanelProps) {
  const filter = usePanelSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ['panel', dataSource.endpoint, dataSource.params],
    queryFn: async () => (await api.get(dataSource.endpoint, { params: dataSource.params })).data,
    refetchInterval: (dataSource.refreshSec ?? 30) * 1000,
  });

  const rows = adaptRows(data, dataSource.params?.field as string | undefined);
  useReportEmpty(!isLoading && !error && rows.length === 0);

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>;
  if (error)     return <p className="text-xs text-[var(--color-error)]">Failed to load</p>;

  if (!rows.length) {
    return <EmptyState message="No matching rows" hint="This report has no data for the current fleet." />;
  }
  let filteredRows = rows;
  if (filter) {
    filteredRows = filteredRows.filter((r) =>
      Object.values(r).some((v) => String(renderCell(v)).toLowerCase().includes(filter)),
    );
    if (!filteredRows.length) return <EmptyState message={`No rows match "${filter}"`} />;
  }
  const first = filteredRows[0];
  if (!first) return <EmptyState message="No rows" />;

  // Prefer the most informative columns; demote noisy fields
  const ALL_COLS = Object.keys(first);
  const NOISE = new Set(['debug', 'device_key', 'subaction', 'username', 'backend', 'entered']);
  const cols = [
    ...ALL_COLS.filter((c) => !NOISE.has(c)),
    ...ALL_COLS.filter((c) =>  NOISE.has(c)),
  ].slice(0, 6);
  const displayRows = filteredRows;

  function statusPill(v: string) {
    const l = v.toLowerCase();
    if (l === 'done')        return 'bg-emerald-500/15 text-emerald-400';
    if (l === 'error')       return 'bg-red-500/15     text-red-400';
    if (l === 'queued')      return 'bg-blue-500/15    text-blue-400';
    if (l === 'in-progress' || l === 'in_progress') return 'bg-amber-500/15 text-amber-400';
    return '';
  }

  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {cols.map((c) => <th key={c} className="text-left px-2 py-1.5 font-medium">{c.replaceAll('_', ' ')}</th>)}
        </tr>
      </thead>
      <tbody>
        {displayRows.slice(0, 30).map((r, i) => {
          // Row context: prefer the device IP on this row so port/interface cells deep-link correctly
          const deviceIp = (typeof r.ip === 'string' && isIP(r.ip)) ? r.ip
                         : (typeof r.device === 'string' && isIP(r.device)) ? r.device
                         : (typeof r.switch === 'string' && isIP(String(r.switch))) ? String(r.switch)
                         : undefined;
          const remoteIp = (typeof r.remote_ip === 'string' && isIP(r.remote_ip)) ? r.remote_ip : undefined;
          return (
            <tr key={i} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]/50 transition-colors">
              {cols.map((c) => {
                const raw = r[c];
                const v = renderCell(raw);
                if (c === 'status' && v) {
                  return (
                    <td key={c} className="px-2 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusPill(v)}`}>{v}</span>
                    </td>
                  );
                }
                if (v === '') {
                  return <td key={c} className="px-2 py-1.5 text-[var(--color-text-muted)]">--</td>;
                }
                return (
                  <td key={c} className="px-2 py-1.5 truncate max-w-[18ch] text-[var(--color-text-secondary)]" title={v}>
                    <CellLink field={c} value={v} ctx={{ device: deviceIp, remoteDevice: remoteIp }} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

registerPanelType({ type: 'table', label: 'Table', description: 'Tabular data',
  defaultW: 6, defaultH: 5, render: TablePanel });
