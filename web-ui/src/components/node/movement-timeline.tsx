import { CellLink } from '@/components/common/cell-link';
import { Badge } from '@/components/ui/badge';
import type { NodeRow } from '@/api/types';

function duration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const diff = e - s;
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function MovementTimeline({ history, currentSwitch }: {
  history: NodeRow[];
  currentSwitch?: string | null;
}) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">No history recorded for this MAC yet.</p>;
  }

  const sorted = [...history].sort((a, b) => {
    const ta = a.time_last ? new Date(a.time_last).getTime() : 0;
    const tb = b.time_last ? new Date(b.time_last).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className="space-y-0">
      {sorted.map((entry, i) => {
        const isFirst = i === 0;
        const isLast = i === sorted.length - 1;
        const isCurrent = isFirst && entry.switch === currentSwitch;
        const dur = duration(entry.time_first, entry.time_last);

        return (
          <div key={i} className="flex items-stretch">
            <div className="flex flex-col items-center w-6 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                isCurrent ? 'border-emerald-500 bg-emerald-500' : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]'
              }`} />
              {!isLast && <div className="w-px flex-1 bg-[var(--color-border)]" />}
            </div>

            <div className="flex-1 pb-3 pl-3">
              <div className={`p-3 rounded-lg border ${
                isCurrent
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.switch && <CellLink field="switch" value={entry.switch} />}
                  {entry.port && (
                    <>
                      <span className="text-[var(--color-text-muted)]">:</span>
                      <CellLink field="port" value={entry.port} ctx={entry.switch ? { device: String(entry.switch) } : undefined} />
                    </>
                  )}
                  {entry.vlan != null && (
                    <>
                      <span className="text-[var(--color-text-muted)]">VLAN</span>
                      <CellLink field="vlan" value={entry.vlan} />
                    </>
                  )}
                  {isCurrent && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-400">
                      current
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                  {entry.time_first && <span>{entry.time_first}</span>}
                  {entry.time_first && entry.time_last && <span>→</span>}
                  {entry.time_last && <span>{entry.time_last}</span>}
                  {dur && <span className="font-mono text-[10px]">({dur})</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
