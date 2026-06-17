import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { submitGlobalAction, listJobs } from '@/api/admin';
import { CellLink } from '@/components/common/cell-link';

interface ActionParam { name: 'device' | 'subaction'; placeholder: string; required?: boolean }
const ACTION_PARAMS: Record<string, ActionParam[] | undefined> = {
  pingsweep: [{ name: 'device', placeholder: '10.0.0.0/24', required: true }],
  expire:    [{ name: 'subaction', placeholder: 'devices=30,nodes=60 (optional)' }],
};

const ACTIONS = [
  { key: 'discoverall', label: 'Discover all',  desc: 'Re-discover every known device' },
  { key: 'macwalk',     label: 'MAC walk',      desc: 'Queue macsuck on all devices' },
  { key: 'arpwalk',     label: 'ARP walk',      desc: 'Queue arpnip on all devices' },
  { key: 'nbtwalk',     label: 'NBT walk',      desc: 'NetBIOS scan all devices' },
  { key: 'expire',      label: 'Expire stale',  desc: 'Clean nodes per expire_nodes setting' },
  { key: 'pingsweep',   label: 'Ping sweep',    desc: 'ICMP discover new devices in host_groups' },
  { key: 'loadmibs',    label: 'Load MIBs',     desc: 'Refresh MIB tree after image update' },
  { key: 'worker-restart', label: 'Restart workers', desc: 'Tell the worker daemon to re-exec -- picks up plugin/config changes' },
] as const;

export function AdminActions() {
  const qc = useQueryClient();
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});

  const recent = useQuery({
    queryKey: ['admin-recent-jobs'],
    queryFn: () => listJobs(undefined, 10),
    refetchInterval: 5000,
  });

  const mut = useMutation({
    mutationFn: ({ action, extras }: { action: string; extras?: { device?: string; subaction?: string } }) =>
      submitGlobalAction(action, extras),
    onSuccess: (id) => {
      setLastJobId(id);
      qc.invalidateQueries({ queryKey: ['admin-recent-jobs'] });
    },
  });

  const handleRun = (action: string) => {
    const params = ACTION_PARAMS[action];
    if (!params) {
      mut.mutate({ action });
      return;
    }
    const actionInputs = inputs[action] ?? {};
    const extras: { device?: string; subaction?: string } = {};
    for (const p of params) {
      if (p.name === 'device' && actionInputs.device) extras.device = actionInputs.device;
      if (p.name === 'subaction' && actionInputs.subaction) extras.subaction = actionInputs.subaction;
    }
    mut.mutate({ action, extras });
  };

  const canRun = (action: string) => {
    const params = ACTION_PARAMS[action];
    if (!params) return true;
    const actionInputs = inputs[action] ?? {};
    return params.every((p) => !p.required || !!actionInputs[p.name]);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTIONS.map((a) => {
          const params = ACTION_PARAMS[a.key];
          if (params) {
            return (
              <div
                key={a.key}
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
              >
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1 mb-3">{a.desc}</div>
                {params.map((p) => (
                  <input
                    key={p.name}
                    type="text"
                    placeholder={p.placeholder}
                    value={inputs[a.key]?.[p.name] ?? ''}
                    onChange={(e) =>
                      setInputs((prev) => ({
                        ...prev,
                        [a.key]: { ...(prev[a.key] ?? {}), [p.name]: e.target.value },
                      }))
                    }
                    className="w-full h-8 px-2 mb-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-xs"
                    data-testid={`admin-action-input-${a.key}-${p.name}`}
                  />
                ))}
                <button
                  onClick={() => handleRun(a.key)}
                  disabled={mut.isPending || !canRun(a.key)}
                  data-testid={`admin-action-run-${a.key}`}
                  className="w-full h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-50"
                >
                  Run
                </button>
              </div>
            );
          }
          return (
            <div
              key={a.key}
              className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
            >
              <div className="text-sm font-medium">{a.label}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 mb-3">{a.desc}</div>
              <button
                onClick={() => handleRun(a.key)}
                disabled={mut.isPending}
                data-testid={`admin-action-run-${a.key}`}
                className="w-full h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-50"
              >
                Run
              </button>
            </div>
          );
        })}
      </div>

      {lastJobId !== null && (
        <div className="mb-4 text-xs text-[var(--color-text-secondary)]">
          Queued job <span className="font-mono">#{lastJobId}</span>. See it below or on the Jobs tab.
        </div>
      )}
      {mut.isError && (
        <div className="mb-4 text-xs text-[var(--color-error)]">
          Failed to queue job: {(mut.error as Error).message}
        </div>
      )}

      <h2 className="text-sm font-semibold mb-2">Recent jobs</h2>
      <table className="w-full text-[13px] border border-[var(--color-border)] rounded overflow-hidden">
        <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-3 py-2">ID</th>
            <th className="text-left px-3 py-2">Action</th>
            <th className="text-left px-3 py-2">Device</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Finished</th>
          </tr>
        </thead>
        <tbody>
          {(recent.data ?? []).map((j) => (
            <tr key={j.job} className="border-t border-[var(--color-border)]" data-testid={`admin-recent-row-${j.job}`}>
              <td className="px-3 py-1.5 font-mono">{j.job}</td>
              <td className="px-3 py-1.5">{j.action ?? ''}</td>
              <td className="px-3 py-1.5 font-mono"><CellLink field="device" value={j.device} /></td>
              <td className="px-3 py-1.5">{j.status ?? ''}</td>
              <td className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">{j.finished ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
