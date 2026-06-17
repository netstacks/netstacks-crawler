import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitGlobalAction } from '@/api/admin';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Per-device admin actions -- equivalents of the legacy Netdisco "Admin Tasks"
// row. Each posts to /api/job with {action, device: ip} and shows the
// queued job-id inline so the user has feedback.
const NORMAL_ACTIONS = [
  { key: 'discover', label: 'Discover', desc: 'SNMP re-poll: refresh device properties' },
  { key: 'arpnip',   label: 'Arpnip',   desc: 'Refresh ARP cache from this device' },
  { key: 'macsuck',  label: 'Macsuck',  desc: 'Refresh MAC tables from this device' },
  { key: 'nbtstat',  label: 'NBTstat',  desc: 'NetBIOS name lookup for nodes seen here' },
  { key: 'snapshot', label: 'Snapshot', desc: 'Capture full SNMP snapshot for diagnostics' },
] as const;

export function DeviceActionBar({ ip }: { ip: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [lastResult, setLastResult] = useState<{ action: string; jobId?: number; error?: string } | null>(null);

  const mut = useMutation({
    mutationFn: ({ action }: { action: string }) =>
      submitGlobalAction(action, { device: ip }),
    onSuccess: (jobId, vars) => {
      setLastResult({ action: vars.action, jobId });
      qc.invalidateQueries({ queryKey: ['admin-recent-jobs'] });
    },
    onError: (err: { message?: string }, vars) => {
      setLastResult({ action: vars.action, error: err?.message ?? 'submit failed' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => submitGlobalAction('delete', { device: ip }),
    onSuccess: (jobId) => {
      setLastResult({ action: 'delete', jobId });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['admin-recent-jobs'] });
      // Bounce back to the devices list -- this device is going away.
      setTimeout(() => nav('/devices'), 500);
    },
    onError: (err: { message?: string }) => {
      setLastResult({ action: 'delete', error: err?.message ?? 'submit failed' });
    },
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {NORMAL_ACTIONS.map((a) => (
        <button
          key={a.key}
          onClick={() => mut.mutate({ action: a.key })}
          disabled={mut.isPending}
          title={a.desc}
          data-testid={`device-action-${a.key}`}
          className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {a.label}
        </button>
      ))}

      <div className="flex-1" />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            data-testid="device-action-delete"
            className="text-xs px-3 py-1.5 rounded border border-[rgba(239,83,80,0.4)] bg-[rgba(239,83,80,0.08)] text-[var(--color-error)] hover:bg-[rgba(239,83,80,0.16)]"
          >Delete device</button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete <code className="font-mono">{ip}</code>?</AlertDialogTitle>
            <AlertDialogDescription>
              Queues a <code className="font-mono">delete</code> job that removes the device and its history.
              Discovery will re-add it if the device responds to a future <code className="font-mono">pingsweep</code> or
              <code className="font-mono"> discoverall</code>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              data-testid="device-action-delete-confirm"
              className="bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lastResult && (
        <div
          data-testid="device-action-result"
          className={`basis-full text-xs mt-1 ${lastResult.error ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          {lastResult.error
            ? `${lastResult.action} failed: ${lastResult.error}`
            : `Queued ${lastResult.action} as job #${lastResult.jobId}`}
        </div>
      )}
    </div>
  );
}
