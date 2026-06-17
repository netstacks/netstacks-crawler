import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '@/api/client';
import { registerPanelType, type PanelProps } from '../panel-registry';
import { useReportEmpty } from '../panel-empty-context';

interface Slice { label: string; value: number; }

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#a3a3a3'];

function adaptSlices(raw: unknown): Slice[] {
  if (!raw) return [];
  // Reports: { rows: [...] }
  let arr: unknown = raw;
  if (typeof raw === 'object' && raw !== null && 'rows' in raw) arr = (raw as { rows: unknown }).rows;
  if (!Array.isArray(arr)) return [];

  // Find a label column and a numeric column from the first row keys.
  // If there's no numeric column (e.g. raw per-device rows from a report),
  // count rows per label value instead.
  const first = arr[0] as Record<string, unknown> | undefined;
  if (!first) return [];
  const numericKey = Object.keys(first).find((k) => typeof first[k] === 'number');
  const labelKey   = Object.keys(first).find((k) => typeof first[k] === 'string') ?? 'label';

  const buckets = new Map<string, number>();
  for (const row of arr as Record<string, unknown>[]) {
    const l = String(row[labelKey] ?? '').trim() || '(none)';
    const v = numericKey ? Number(row[numericKey] ?? 0) : 1;
    buckets.set(l, (buckets.get(l) ?? 0) + v);
  }
  const entries = Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Keep the chart legible (top slices) WITHOUT distorting the total: roll the
  // long tail into an "Others" slice so the donut total and percentages reflect
  // the whole dataset, not just the slices that fit. (Otherwise the centre total
  // undercounts and every percentage is inflated.)
  const TOP = 7;
  if (entries.length <= TOP + 1) return entries;
  const top = entries.slice(0, TOP);
  const rest = entries.slice(TOP);
  const othersValue = rest.reduce((sum, e) => sum + e.value, 0);
  if (othersValue > 0) top.push({ label: `Others (${rest.length})`, value: othersValue });
  return top;
}

function Donut({ dataSource }: PanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['panel', dataSource.endpoint, dataSource.params],
    queryFn: async () => (await api.get(dataSource.endpoint, { params: dataSource.params })).data,
    refetchInterval: (dataSource.refreshSec ?? 60) * 1000,
  });

  const slices = adaptSlices(data);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  useReportEmpty(!isLoading && !error && total === 0);

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>;
  if (error)     return <p className="text-xs text-[var(--color-error)]">Failed to load</p>;
  if (total === 0) return <p className="text-xs text-[var(--color-text-muted)]">No data</p>;

  // Compute SVG arcs
  const R = 56, r = 38, CX = 64, CY = 64;
  let angle = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const fraction = s.value / total;
    const a2 = angle + fraction * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
    const x2 = CX + R * Math.cos(a2),    y2 = CY + R * Math.sin(a2);
    const x3 = CX + r * Math.cos(a2),    y3 = CY + r * Math.sin(a2);
    const x4 = CX + r * Math.cos(angle), y4 = CY + r * Math.sin(angle);
    const large = fraction > 0.5 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
    angle = a2;
    return <path key={i} d={d} fill={PALETTE[i % PALETTE.length]} />;
  });

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 128 128" className="w-32 h-32">{paths}</svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-semibold tabular-nums leading-none">{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-0.5">total</div>
        </div>
      </div>
      <ul className="text-[12px] space-y-1 flex-1 min-w-0">
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          // Heuristic deep-link: clicking an OS / vendor / model slice should drop the
          // user into the matching report or device list. For the inventory-by-* report
          // we use the legacy report. For other endpoints, point at devices list.
          const href = '/reports/Device/inventorybymodelbyos';
          return (
            <li key={s.label}>
              <Link to={href} className="flex items-center gap-2 px-1 -mx-1 py-0.5 rounded hover:bg-[var(--color-bg-tertiary)]">
                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="truncate text-[var(--color-text-secondary)]">{s.label}</span>
                <span className="ml-auto tabular-nums font-medium">{s.value}</span>
                <span className="tabular-nums text-[10px] text-[var(--color-text-muted)] w-9 text-right">{pct.toFixed(0)}%</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

registerPanelType({ type: 'donut', label: 'Donut chart', description: 'Categorical breakdown',
  defaultW: 4, defaultH: 4, render: Donut });
