import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { registerPanelType, type PanelProps } from '../panel-registry';
import { useReportEmpty } from '../panel-empty-context';

function adaptSeries(raw: unknown, fieldHint?: string): { x: string; y: number }[] {
  if (!raw) return [];
  // /stats/summary shape
  if (typeof raw === 'object' && raw !== null && 'history' in raw) {
    const hist = (raw as { history: Record<string, unknown>[] }).history ?? [];
    if (!hist.length) return [];
    const first = hist[0];
    if (!first) return [];
    const field = fieldHint ?? Object.keys(first).find((k) => typeof first[k] === 'number') ?? '';
    const out = hist.map((r) => ({ x: String(r.day ?? ''), y: Number(r[field] ?? 0) }));
    // `history` is the daily stats snapshot (table-driven, lags reality). Append
    // the live current value so the headline agrees with Fleet totals and the
    // trend ends at "now" instead of the last snapshot day.
    const latest = (raw as { latest?: Record<string, unknown> }).latest;
    if (latest && typeof latest[field] === 'number') {
      const liveY = Number(latest[field]);
      const last = out[out.length - 1];
      if (!last || last.y !== liveY) out.push({ x: 'now', y: liveY });
    }
    return out;
  }
  // Generic { rows: [...] }
  const arr = Array.isArray(raw) ? raw : ((raw as { rows?: unknown[] }).rows ?? []);
  if (!Array.isArray(arr) || !arr.length) return [];
  const first = arr[0] as Record<string, unknown>;
  const ykey = fieldHint ?? Object.keys(first).find((k) => typeof first[k] === 'number') ?? '';
  return arr.map((r, i) => ({ x: String((r as Record<string, unknown>).day ?? i), y: Number((r as Record<string, unknown>)[ykey] ?? 0) }));
}

function Sparkline({ dataSource }: PanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['panel', dataSource.endpoint, dataSource.params],
    queryFn: async () => (await api.get(dataSource.endpoint, { params: dataSource.params })).data,
    refetchInterval: (dataSource.refreshSec ?? 60) * 1000,
  });

  const series = adaptSeries(data, dataSource.params?.field);
  useReportEmpty(!isLoading && !error && series.length === 0);

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>;
  if (error)     return <p className="text-xs text-[var(--color-error)]">Failed to load</p>;
  if (!series.length) return <p className="text-xs text-[var(--color-text-muted)]">No series data</p>;

  const W = 300, H = 80, PAD = 4;
  const ys = series.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = (maxY - minY) || 1;
  const stepX = (W - PAD * 2) / Math.max(1, series.length - 1);

  const points = series.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p.y - minY) / range) * (H - PAD * 2);
    return { x, y };
  });
  const linePts = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPts = `${PAD},${H - PAD} ${linePts} ${PAD + (series.length - 1) * stepX},${H - PAD}`;

  const latest    = series[series.length - 1];
  const previous  = series.length > 1 ? series[series.length - 2] : undefined;
  if (!latest) return <p className="text-xs text-[var(--color-text-muted)]">No data point</p>;

  const delta = previous != null ? latest.y - previous.y : 0;
  const deltaPct = previous != null && previous.y !== 0 ? (delta / previous.y) * 100 : 0;
  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-[var(--color-text-muted)]';
  const deltaSign  = delta > 0 ? '+' : '';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-semibold tabular-nums leading-none">{latest.y}</div>
          {previous != null && (
            <div className={`text-[11px] font-medium ${deltaColor} tabular-nums`}>
              {deltaSign}{delta} ({deltaSign}{deltaPct.toFixed(1)}%)
            </div>
          )}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{latest.x}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-text-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-text-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="url(#spark-fill)" stroke="none" points={areaPts} />
        <polyline fill="none" stroke="var(--color-text-accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" points={linePts} />
        {points.length > 0 && points[points.length - 1] && (
          <circle cx={points[points.length - 1]!.x} cy={points[points.length - 1]!.y} r="2.5" fill="var(--color-text-accent)" />
        )}
      </svg>
    </div>
  );
}

registerPanelType({ type: 'sparkline', label: 'Sparkline', description: 'Time series',
  defaultW: 4, defaultH: 3, render: Sparkline });
