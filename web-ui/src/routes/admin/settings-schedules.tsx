import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getSchedule, putSchedule, type ScheduleEntry } from '@/api/admin';

export function AdminSettingsSchedules() {
  const qc = useQueryClient();
  const sched = useQuery({ queryKey: ['schedule'], queryFn: getSchedule });
  const save = useMutation({
    mutationFn: ({ action, entry }: { action: string; entry: Partial<ScheduleEntry> }) =>
      putSchedule(action, entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });

  if (sched.isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>;

  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-2xl">
        Cron expressions follow standard 5-field format (<code className="font-mono">min hour day month dow</code>). Changes take effect at the scheduler's next 60-second tick.
      </p>
      <table className="w-full text-[13px] border border-[var(--color-border)] rounded overflow-hidden">
        <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-3 py-2">Action</th>
            <th className="text-left px-3 py-2">Cron expression</th>
            <th className="text-left px-3 py-2">Enabled</th>
            <th className="text-left px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(sched.data ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([action, entry]) => (
            <ScheduleRow key={action} action={action} entry={entry} save={save.mutate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleRow({ action, entry, save }: { action: string; entry: ScheduleEntry; save: (v: { action: string; entry: Partial<ScheduleEntry> }) => void }) {
  const [whenVal, setWhenVal] = useState(entry.when ?? '');
  const [enabledVal, setEnabledVal] = useState(!!entry.enabled);
  const dirty = whenVal !== (entry.when ?? '') || enabledVal !== !!entry.enabled;
  return (
    <tr className="border-t border-[var(--color-border)]" data-testid={`schedule-row-${action}`}>
      <td className="px-3 py-1.5 font-mono">{action}</td>
      <td className="px-3 py-1.5">
        <input
          value={whenVal}
          onChange={(e) => setWhenVal(e.target.value)}
          className="w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] font-mono"
          placeholder="e.g. 0 4 * * *"
          data-testid={`schedule-when-${action}`}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          checked={enabledVal}
          onChange={(e) => setEnabledVal(e.target.checked)}
          data-testid={`schedule-enabled-${action}`}
        />
      </td>
      <td className="px-3 py-1.5">
        {dirty && (
          <button
            onClick={() => save({ action, entry: { when: whenVal, enabled: enabledVal ? 1 : 0 } })}
            className="text-xs px-3 py-1 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded"
            data-testid={`schedule-save-${action}`}
          >Save</button>
        )}
      </td>
    </tr>
  );
}
