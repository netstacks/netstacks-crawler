import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { listReports, runReport, reportCsvUrl, REPORT_PARAMS } from '@/api/reports';
import { DataTable } from '@/components/common/data-table';
import { CellLink } from '@/components/common/cell-link';
import { Download } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

export function ReportDetail() {
  const { category = '', tag = '' } = useParams();

  const catalog = useQuery({ queryKey: ['reports'], queryFn: listReports });
  const meta = catalog.data?.find((r) => r.category === category && r.tag === tag);

  const paramsConfig = REPORT_PARAMS[tag] ?? [];
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [appliedParams, setAppliedParams] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', category, tag, appliedParams],
    queryFn: () => runReport(category, tag, appliedParams),
  });

  function applyParams() {
    setAppliedParams({ ...paramValues });
  }

  if (isLoading) return <div className="p-6 text-sm text-[var(--color-text-muted)]">Running report...</div>;

  const rows = error ? [] : (data ?? []);
  const columns: ColumnDef<Record<string, unknown>>[] = rows[0]
    ? Object.keys(rows[0]).map((k) => ({
        accessorKey: k,
        header: k,
        cell: ({ getValue, row }) => {
          const v = getValue();
          if (v === null || v === undefined) return '--';
          const o = row.original;
          const deviceIp = o.device ?? o.ip ?? o.switch;
          const remoteIp = o.remote_ip;
          const ctx = typeof deviceIp === 'string'
            ? { device: deviceIp, ...(typeof remoteIp === 'string' ? { remoteDevice: remoteIp } : {}) }
            : undefined;
          return <CellLink field={k} value={v} ctx={ctx} />;
        },
      }))
    : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">{meta?.label ?? tag}</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {category}
            {!error && `  |  ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
          </p>
        </div>
        {meta?.provides_csv ? (
          <a
            href={reportCsvUrl(category, tag)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            data-testid="report-csv-link"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </a>
        ) : null}
      </div>

      {paramsConfig.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          {paramsConfig.map((p) => (
            <input
              key={p.name}
              placeholder={p.placeholder ?? p.label}
              value={paramValues[p.name] ?? ''}
              onChange={(e) => setParamValues((s) => ({ ...s, [p.name]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyParams(); }}
              className="h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] outline-none focus:border-[var(--color-text-accent)]"
              data-testid={`report-param-${p.name}`}
              aria-label={p.label}
            />
          ))}
          <button
            onClick={applyParams}
            className="h-8 px-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded text-xs hover:opacity-90"
            data-testid="report-params-apply"
          >Apply</button>
        </div>
      )}

      {error ? (
        <div className="bg-[rgba(241,76,76,0.08)] border border-[rgba(241,76,76,0.25)] rounded p-4 text-[13px] max-w-3xl">
          <p className="text-[var(--color-error)] font-medium mb-1">Report failed</p>
          <p className="text-[var(--color-text-secondary)] font-mono text-xs">{(error as { message?: string }).message ?? 'Unknown error'}</p>
          <p className="text-[var(--color-text-muted)] mt-3 text-xs">
            Some reports require runtime configuration that the API does not yet
            surface. File the report tag in an issue and it will be added.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No rows.</p>
      ) : (
        <DataTable data={rows} columns={columns} />
      )}
    </div>
  );
}
