import { useSearchParams, useNavigate } from 'react-router';
import { useSearch } from '@/hooks/use-search';
import type { SearchType } from '@/api/search';

const TYPES: SearchType[] = ['device', 'node', 'port', 'vlan'];

export function SearchResults() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = (params.get('type') as SearchType | null) ?? 'device';
  const { data, isLoading, error } = useSearch(q, type);
  const nav = useNavigate();

  function setType(t: SearchType) {
    setParams({ q, type: t });
  }

  function rowClick(row: Record<string, unknown>) {
    if (type === 'device') nav(`/devices/${row.ip}`);
    else if (type === 'node') nav(`/nodes/${row.mac}`);
    else if (type === 'port') nav(`/devices/${row.device}#port-${row.port}`);
  }

  function exportCsv() {
    if (!data || data.length === 0) return;
    const cols = Object.keys(data[0]!);
    const csv = [cols.join(','), ...data.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `search-${type}-${q}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            data-testid={`type-tab-${t}`}
            className={`px-3 py-1 text-sm rounded border ${t === type ? 'bg-[var(--color-accent)] text-white border-transparent' : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
          >{t}</button>
        ))}
        <div className="flex-1" />
        <button onClick={exportCsv} className="text-xs px-3 py-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]" data-testid="export-csv">Export CSV</button>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">Searching...</p>}
      {error && <p className="text-sm text-[var(--color-error)]">Error</p>}
      {!isLoading && data?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No results.</p>}

      {data && data.length > 0 && (
        <table className="w-full text-[13px]" data-testid="search-results-table">
          <thead>
            <tr>{Object.keys(data[0]!).map((c) => <th key={c} className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">{c}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} onClick={() => rowClick(row)} className="cursor-pointer hover:bg-[var(--color-bg-hover)]">
                {Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 border-b border-[var(--color-border)]">{String(v ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
