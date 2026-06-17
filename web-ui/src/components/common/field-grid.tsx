import { humanizeLabel, formatValue, absoluteTime, isEmptyValue } from '@/lib/format';
import { CellLink } from '@/components/common/cell-link';
import { linkForCell, type LinkContext } from '@/lib/cell-link';

const TS_KEYS = new Set([
  'creation', 'last_discover', 'last_macsuck', 'last_arpnip',
  'time_first', 'time_last', 'time_recent', 'updated_at',
  'started', 'finished', 'entered', 'firstseen', 'lastseen',
]);

// Generic label/value renderer for any DB-row-shaped object. Humanizes column
// names, formats values (timestamps, uptime, layers, booleans), and routes
// entity-shaped fields (ip/mac/vlan/port/subnet…) through <CellLink> so they get
// deep links, OUI chips, and hover cards for free. This is the engine behind
// "expose everything": hand it a row and every populated column shows up, no
// per-field code required.
export function FieldGrid({
  data,
  ctx,
  only,
  omit,
  order,
  showEmpty = false,
  columns = 2,
}: {
  data: Record<string, unknown>;
  ctx?: LinkContext;
  only?: string[];
  omit?: string[];
  order?: string[];
  showEmpty?: boolean;
  columns?: 1 | 2 | 3;
}) {
  let keys = only ? only.filter((k) => k in data) : Object.keys(data);
  if (omit) keys = keys.filter((k) => !omit.includes(k));
  if (!showEmpty) keys = keys.filter((k) => !isEmptyValue(data[k]));

  if (order) {
    const idx = (k: string) => {
      const i = order.indexOf(k);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    keys.sort((a, b) => idx(a) - idx(b) || humanizeLabel(a).localeCompare(humanizeLabel(b)));
  }

  if (keys.length === 0) {
    return <p className="text-[13px] text-[var(--color-text-muted)]">No data.</p>;
  }

  const gridCols = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-x-8 gap-y-1.5 text-[13px]`}>
      {keys.map((k) => {
        const v = data[k];
        const link = linkForCell(k, v, ctx);
        const valueNode = link
          ? <CellLink field={k} value={v} ctx={ctx} />
          : (
            <span title={TS_KEYS.has(k) ? absoluteTime(v) : undefined}>
              {formatValue(k, v)}
            </span>
          );
        return (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] py-1.5 min-w-0">
            <span className="text-[var(--color-text-muted)] shrink-0">{humanizeLabel(k)}</span>
            <span className="font-mono text-right truncate min-w-0">{valueNode}</span>
          </div>
        );
      })}
    </div>
  );
}
