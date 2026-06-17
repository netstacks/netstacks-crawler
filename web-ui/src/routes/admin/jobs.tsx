import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listJobs, cancelJob, cancelQueuedJobs } from '@/api/admin';
import { CellLink } from '@/components/common/cell-link';

const STATUSES = ['', 'queued', 'in-progress', 'done', 'error', 'info'] as const;

const statusColor = (s: string | null | undefined) => {
  switch (s) {
    case 'done':        return 'text-[var(--color-success)]';
    case 'error':       return 'text-[var(--color-error)]';
    case 'in-progress': return 'text-[var(--color-warning)]';
    case 'queued':      return 'text-[var(--color-text-accent)]';
    default:            return 'text-[var(--color-text-muted)]';
  }
};

export function AdminJobs() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const jobs = useQuery({
    queryKey: ['admin-jobs', status],
    queryFn: () => listJobs(status || undefined, 200),
    refetchInterval: 5000,
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });

  // Bulk-cancel only ever targets queued (not-yet-started) jobs. It never
  // touches running/finished jobs, the skiplist, or scheduled runners.
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const bulkCancel = useMutation({
    mutationFn: () => cancelQueuedJobs(),
    onSuccess: (n) => { setCancelMsg(`Cancelled ${n} queued job${n === 1 ? '' : 's'}.`); qc.invalidateQueries({ queryKey: ['admin-jobs'] }); },
    onError: () => setCancelMsg('Cancel failed.'),
  });
  const onBulkCancel = () => {
    setCancelMsg(null);
    if (window.confirm('Cancel ALL queued jobs that no worker has started yet? Running and finished jobs, the skiplist and scheduled runners are left untouched.')) {
      bulkCancel.mutate();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-[var(--color-text-muted)]">Status:</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] px-2"
          data-testid="admin-jobs-status-filter"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'all'}</option>
          ))}
        </select>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['admin-jobs'] })}
          className="h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          data-testid="admin-jobs-refresh"
        >Refresh</button>
        <button
          onClick={onBulkCancel}
          disabled={bulkCancel.isPending}
          className="h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-error)]/40 text-[var(--color-error)] rounded hover:bg-[var(--color-error)]/10 disabled:opacity-50"
          data-testid="admin-jobs-cancel-all"
        >Cancel queued jobs</button>
        {cancelMsg && <span className="text-xs text-[var(--color-text-secondary)]">{cancelMsg}</span>}
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
          Auto-refreshing every 5s
        </span>
      </div>

      <table className="w-full text-[13px] border border-[var(--color-border)] rounded overflow-hidden">
        <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-3 py-2">ID</th>
            <th className="text-left px-3 py-2">Action</th>
            <th className="text-left px-3 py-2">Device</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Entered</th>
            <th className="text-left px-3 py-2">Finished</th>
            <th className="text-left px-3 py-2">Log</th>
            <th className="text-left px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(jobs.data ?? []).map((j) => (
            <tr key={j.job} className="border-t border-[var(--color-border)]" data-testid={`admin-job-row-${j.job}`}>
              <td className="px-3 py-1.5 font-mono">{j.job}</td>
              <td className="px-3 py-1.5">{j.action ?? ''}</td>
              <td className="px-3 py-1.5 font-mono"><CellLink field="device" value={j.device} /></td>
              <td className={`px-3 py-1.5 ${statusColor(j.status)}`}>{j.status ?? ''}</td>
              <td className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">{j.entered ?? ''}</td>
              <td className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">{j.finished ?? ''}</td>
              <td className="px-3 py-1.5 text-xs font-mono truncate max-w-[28ch]" title={j.log ?? ''}>{j.log ?? ''}</td>
              <td className="px-3 py-1.5">
                {j.status === 'queued' && j.started == null && (
                  <button
                    onClick={() => cancel.mutate(j.job)}
                    className="text-xs text-[var(--color-error)] hover:underline"
                    data-testid={`admin-job-cancel-${j.job}`}
                  >Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
