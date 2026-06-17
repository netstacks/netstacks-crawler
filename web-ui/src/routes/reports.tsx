import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listReports } from '@/api/reports';
import { Download } from 'lucide-react';

export function Reports() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports'],
    queryFn: listReports,
  });

  if (isLoading) return <div className="p-6 text-sm text-[var(--color-text-muted)]">Loading reports...</div>;
  if (error) return <div className="p-6 text-sm text-[var(--color-error)]">Error loading reports.</div>;
  if (!data || data.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--color-text-muted)]">No reports registered. Check that <code className="font-mono text-xs">Report::*</code> plugins are tagged <code className="font-mono text-xs">kind: both</code> in <code className="font-mono text-xs">share/config.yml</code>.</p>
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, typeof data> = {};
  for (const r of data) {
    grouped[r.category] = grouped[r.category] ?? [];
    grouped[r.category]!.push(r);
  }

  const supportedCount = data.filter((r) => r.supported === 1).length;
  const deferredCount  = data.length - supportedCount;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-2">Reports</h1>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        {data.length} reports across {Object.keys(grouped).length} categories.
      </p>
      {deferredCount > 0 && (
        <div className="mb-6 max-w-3xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded p-3 text-xs text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">{supportedCount}</strong> reports work in the new API today (those with a backing <code className="font-mono">Virtual::*</code> resultset).
          The remaining <strong className="text-[var(--color-text-primary)]">{deferredCount}</strong> use custom Perl handlers and will be wired up in SP4 (Admin + per-report adapters) -- they're shown greyed below with an <span className="px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-[10px] font-semibold">SP4</span> badge.
        </div>
      )}
      <div className="grid grid-cols-2 gap-6">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
          <div key={cat} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded p-4">
            <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3">{cat}</h2>
            <ul className="space-y-1.5">
              {items.sort((a, b) => a.label.localeCompare(b.label)).map((r) => {
                const supported = r.supported === 1;
                return (
                  <li key={r.tag} className="flex items-center justify-between text-[13px]">
                    {supported ? (
                      <Link
                        to={`/reports/${encodeURIComponent(r.category)}/${encodeURIComponent(r.tag)}`}
                        className="text-[var(--color-text-accent)] hover:underline"
                        data-testid={`report-link-${r.tag}`}
                      >
                        {r.label}
                      </Link>
                    ) : (
                      <span
                        className="text-[var(--color-text-muted)] cursor-not-allowed"
                        title="Needs SP4 per-report adapter"
                        data-testid={`report-link-${r.tag}`}
                        data-deferred="report-needs-sp4"
                      >
                        {r.label}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      {!supported && (
                        <span className="px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-[9px] font-semibold border border-[var(--color-border)]">SP4</span>
                      )}
                      {r.provides_csv && supported ? (
                        <Download className="w-3 h-3 text-[var(--color-text-muted)]" aria-label="CSV available" />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
