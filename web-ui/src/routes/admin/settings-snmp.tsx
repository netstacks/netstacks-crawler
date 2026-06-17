import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSnmpSettings, putSnmpSettings,
  listDeviceAuth, addDeviceAuth, deleteDeviceAuth,
  type DeviceAuthEntry,
} from '@/api/admin';

function CommList({ name, items, onChange }: { name: string; items: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="mb-4">
      <label className="text-xs uppercase text-[var(--color-text-muted)] mb-1 block">{name}</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {items.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded text-[13px] font-mono">
            {c}
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
              data-testid={`snmp-${name}-remove-${i}`}
              aria-label={`remove ${c}`}
            >×</button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const v = String(fd.get('v') ?? '').trim();
          if (v) onChange([...items, v]);
          e.currentTarget.reset();
        }}
        className="flex gap-2"
      >
        <input
          name="v"
          placeholder="Add community..."
          className="h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
          data-testid={`snmp-${name}-input`}
        />
        <button className="h-8 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-xs">Add</button>
      </form>
    </div>
  );
}

export function AdminSettingsSnmp() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['snmp-settings'], queryFn: getSnmpSettings });
  const da = useQuery({ queryKey: ['device-auth'], queryFn: listDeviceAuth });

  const save = useMutation({
    mutationFn: (s: { community?: string[]; community_rw?: string[] }) => putSnmpSettings(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snmp-settings'] }),
  });

  const addEntry = useMutation({
    mutationFn: (e: Omit<DeviceAuthEntry, 'id'>) => addDeviceAuth(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-auth'] }),
  });
  const delEntry = useMutation({
    mutationFn: (id: number) => deleteDeviceAuth(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-auth'] }),
  });

  const [formOpen, setFormOpen] = useState(false);

  if (settings.isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>;

  return (
    <div>
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Default SNMP communities</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-3 max-w-2xl">
          The worker tries each community in order until one succeeds. RW communities are only used for write operations (port control, VLAN changes).
        </p>
        <CommList
          name="community"
          items={settings.data?.community ?? []}
          onChange={(next) => save.mutate({ community: next })}
        />
        <CommList
          name="community_rw"
          items={settings.data?.community_rw ?? []}
          onChange={(next) => save.mutate({ community_rw: next })}
        />
        {save.isError && (
          <p className="text-xs text-[var(--color-error)]">Save failed: {(save.error as Error).message}</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">Per-device auth overrides</h2>
            <p className="text-xs text-[var(--color-text-muted)] max-w-2xl">
              For networks where a single community doesn't cover everything. Entries are tried in order before falling back to defaults.
            </p>
          </div>
          <button
            onClick={() => setFormOpen((s) => !s)}
            className="h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
            data-testid="device-auth-add-toggle"
          >{formOpen ? 'Cancel' : '+ Add entry'}</button>
        </div>

        {formOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const entry: Record<string, string> = {};
              ['tag', 'only', 'community', 'user', 'password', 'auth_protocol', 'priv_password', 'priv_protocol', 'driver'].forEach((k) => {
                const v = String(fd.get(k) ?? '').trim();
                if (v) entry[k] = v;
              });
              addEntry.mutate(entry);
              setFormOpen(false);
              e.currentTarget.reset();
            }}
            className="mb-3 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded grid grid-cols-3 gap-2 text-[13px]"
            data-testid="device-auth-form"
          >
            {['tag', 'only', 'community', 'user', 'password', 'auth_protocol', 'priv_password', 'priv_protocol', 'driver'].map((k) => (
              <label key={k} className="text-xs text-[var(--color-text-muted)]">
                {k}
                <input
                  name={k}
                  type={k.includes('password') ? 'password' : 'text'}
                  className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] font-mono"
                />
              </label>
            ))}
            <button
              type="submit"
              className="col-span-3 h-8 px-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded text-xs"
              data-testid="device-auth-save"
            >Save entry</button>
          </form>
        )}

        <table className="w-full text-[13px] border border-[var(--color-border)] rounded overflow-hidden">
          <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Target (only)</th>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Community / User</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(da.data ?? []).map((e) => (
              <tr key={e.id} className="border-t border-[var(--color-border)]" data-testid={`device-auth-row-${e.id}`}>
                <td className="px-3 py-1.5 font-mono">{e.id}</td>
                <td className="px-3 py-1.5 font-mono">{e.only ?? '*'}</td>
                <td className="px-3 py-1.5">{e.tag ?? ''}</td>
                <td className="px-3 py-1.5 font-mono">{e.community ?? e.user ?? ''}</td>
                <td className="px-3 py-1.5">
                  <button
                    onClick={() => delEntry.mutate(e.id)}
                    className="text-xs text-[var(--color-error)] hover:underline"
                    data-testid={`device-auth-delete-${e.id}`}
                  >Delete</button>
                </td>
              </tr>
            ))}
            {!da.data?.length && (
              <tr><td colSpan={5} className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No per-device overrides.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
