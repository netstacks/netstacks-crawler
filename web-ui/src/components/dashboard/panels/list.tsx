import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '@/api/client';
import { registerPanelType, type PanelProps } from '../panel-registry';
import { usePanelSearch } from '../panel-search-context';
import { useReportEmpty } from '../panel-empty-context';
import { EmptyState } from '../empty-state';
import { CellLink } from '@/components/common/cell-link';
import { linkForCell } from '@/lib/cell-link';

function adaptItems(raw: unknown, field?: string): { label: string; badge?: string }[] {
  if (!raw) return [];
  // Drill into `field` first if specified (e.g. /stats/operational with field=job_queue)
  if (field && typeof raw === 'object' && raw !== null && field in raw) {
    return adaptItems((raw as Record<string, unknown>)[field]);
  }
  if (Array.isArray(raw)) {
    return raw.slice(0, 30).map((v) => {
      if (typeof v === 'string') return { label: v };
      if (typeof v === 'object' && v !== null) {
        const r = v as Record<string, unknown>;
        const label = String(r.name ?? r.label ?? r.dns ?? r.ip ?? r.device ?? Object.values(r)[0] ?? '');
        const badge = r.count != null ? String(r.count) : r.status != null ? String(r.status) : undefined;
        return { label, badge };
      }
      return { label: String(v) };
    });
  }
  if (typeof raw === 'object') {
    if ('rows' in raw && Array.isArray((raw as { rows: unknown[] }).rows)) return adaptItems((raw as { rows: unknown[] }).rows);
    // Generic object: render keys + values. Render array-valued keys as their length so
    // composite responses (e.g. /stats/operational) don't print "[object Object]".
    return Object.entries(raw as Record<string, unknown>).slice(0, 30).map(([k, v]) => {
      let badge: string;
      if (Array.isArray(v))                 badge = String(v.length);
      else if (v && typeof v === 'object')  badge = String(Object.keys(v).length);
      else                                  badge = String(v);
      return { label: k, badge };
    });
  }
  return [];
}

function ListPanel({ dataSource }: PanelProps) {
  const filter = usePanelSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ['panel', dataSource.endpoint, dataSource.params],
    queryFn: async () => (await api.get(dataSource.endpoint, { params: dataSource.params })).data,
    refetchInterval: (dataSource.refreshSec ?? 30) * 1000,
  });

  const items = adaptItems(data, dataSource.params?.field);
  useReportEmpty(!isLoading && !error && items.length === 0);

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>;
  if (error)     return <p className="text-xs text-[var(--color-error)]">Failed to load</p>;

  let filteredItems = items;
  if (!filteredItems.length) return <EmptyState message="No items" />;
  if (filter) {
    filteredItems = filteredItems.filter((it) =>
      it.label.toLowerCase().includes(filter) || (it.badge ?? '').toLowerCase().includes(filter),
    );
    if (!filteredItems.length) return <EmptyState message={`No items match "${filter}"`} />;
  }

  function tintFor(label: string): string {
    const l = label.toLowerCase();
    if (l.includes('error'))     return 'bg-red-500/15     text-red-400';
    if (l.includes('queued'))    return 'bg-blue-500/15    text-blue-400';
    if (l.includes('done'))      return 'bg-emerald-500/15 text-emerald-400';
    if (l.includes('progress'))  return 'bg-amber-500/15   text-amber-400';
    if (l.includes('slow') || l.includes('timed_out') || l.includes('orphan'))
                                 return 'bg-amber-500/15   text-amber-400';
    return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]';
  }

  function dotFor(label: string): string | null {
    const l = label.toLowerCase();
    if (l.includes('error'))    return 'bg-red-500';
    if (l.includes('queued'))   return 'bg-blue-500';
    if (l.includes('done'))     return 'bg-emerald-500';
    if (l.includes('progress')) return 'bg-amber-500';
    return null;
  }

  function hrefFor(label: string): string | null {
    const l = label.toLowerCase();
    if (l === 'queued')                          return '/admin/jobs?status=queued';
    if (l === 'in_progress' || l === 'in-progress') return '/admin/jobs?status=in-progress';
    if (l === 'done_24h')                        return '/admin/jobs?status=done';
    if (l === 'error_24h')                       return '/admin/jobs?status=error';
    return null;
  }

  return (
    <ul className="text-[13px] space-y-1.5">
      {filteredItems.map((it, i) => {
        const dot  = dotFor(it.label);
        const href = hrefFor(it.label);
        // If the label looks like an IP/MAC/CIDR, CellLink will route to the
        // entity detail (e.g. "10.0.0.1" → /devices/10.0.0.1).
        const entityLink = linkForCell('value', it.label);

        const labelEl = entityLink
          ? <span className="truncate flex-1"><CellLink field="value" value={it.label} /></span>
          : <span className="truncate flex-1">{it.label}</span>;

        const content = (
          <>
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />}
            {labelEl}
            {it.badge != null && (
              <span className={`ml-auto px-2 py-0.5 rounded text-[11px] tabular-nums font-medium ${tintFor(it.label)}`}>
                {it.badge}
              </span>
            )}
          </>
        );

        // Status-key links (queued/done/error) take priority over entity links,
        // since the row's meaning is "the count for this status".
        if (href) {
          return (
            <li key={i}>
              <Link to={href} className="flex items-center gap-2 px-1 -mx-1 py-0.5 rounded hover:bg-[var(--color-bg-tertiary)]">
                {content}
              </Link>
            </li>
          );
        }
        return <li key={i} className="flex items-center gap-2 px-1">{content}</li>;
      })}
    </ul>
  );
}

registerPanelType({ type: 'list', label: 'List', description: 'Key/value or labelled items',
  defaultW: 4, defaultH: 4, render: ListPanel });
