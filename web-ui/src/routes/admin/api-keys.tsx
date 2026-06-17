import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listApiKeys, createApiKey, setApiKeyActive, deleteApiKey, listUsers, type ApiKey } from '@/api/admin';
import { Copy, Check } from 'lucide-react';

function TokenCell({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-[12px]">{show ? token : `${token.slice(0, 8)}…${token.slice(-4)}`}</code>
      <button onClick={() => setShow((v) => !v)} className="text-[11px] text-[var(--color-text-accent)] hover:underline">{show ? 'hide' : 'show'}</button>
      <button onClick={copy} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="Copy token">
        {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function AdminApiKeys() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const keys = useQuery({ queryKey: ['admin-api-keys'], queryFn: listApiKeys });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
  const add = useMutation({
    mutationFn: ({ username, label }: { username: string; label?: string }) => createApiKey(username, label),
    onSuccess: () => { setFormOpen(false); setErr(null); invalidate(); },
    onError: (e: unknown) => setErr((e as { message?: string })?.message ?? 'Create failed'),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setApiKeyActive(id, active),
    onSuccess: invalidate,
  });
  const del = useMutation({ mutationFn: (id: number) => deleteApiKey(id), onSuccess: invalidate });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Static, non-expiring API keys. Send the token as <code className="font-mono">Authorization: &lt;token&gt;</code>. A key inherits its owner's roles (admin owner ⇒ admin API; otherwise read-only).
        </p>
        <button onClick={() => { setErr(null); setFormOpen((v) => !v); }}
          className="ml-auto h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded"
          data-testid="apikey-add-toggle">
          {formOpen ? 'Cancel' : 'New key'}
        </button>
      </div>

      {err && <div className="mb-3 text-xs text-[var(--color-error)]">{err}</div>}

      {formOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const username = String(fd.get('username') || '');
            if (!username) { setErr('Pick an owner user'); return; }
            add.mutate({ username, label: String(fd.get('label') || '').trim() || undefined });
          }}
          className="mb-4 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded grid grid-cols-2 gap-3 text-[13px]"
          data-testid="apikey-form"
        >
          <label className="text-xs text-[var(--color-text-muted)]">Owner user
            <select name="username" required defaultValue=""
              className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]">
              <option value="" disabled>Select a user…</option>
              {(users.data ?? []).map((u) => <option key={u.username} value={u.username}>{u.username}{u.admin ? ' (admin)' : ''}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--color-text-muted)]">Label
            <input name="label" placeholder="e.g. automation"
              className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]" />
          </label>
          <button type="submit" disabled={add.isPending}
            className="col-span-2 h-8 px-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded text-xs disabled:opacity-50"
            data-testid="apikey-save">Create key</button>
        </form>
      )}

      <table className="w-full text-[13px] border border-[var(--color-border)] rounded overflow-hidden">
        <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-3 py-2">Label</th>
            <th className="text-left px-3 py-2">Owner</th>
            <th className="text-left px-3 py-2">Token</th>
            <th className="text-left px-3 py-2">Active</th>
            <th className="text-left px-3 py-2">Last used</th>
            <th className="text-left px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(keys.data ?? []).map((k: ApiKey) => (
            <tr key={k.id} className="border-t border-[var(--color-border)]" data-testid={`apikey-row-${k.id}`}>
              <td className="px-3 py-1.5">{k.label || <span className="text-[var(--color-text-muted)]">—</span>}</td>
              <td className="px-3 py-1.5 font-mono">{k.username}</td>
              <td className="px-3 py-1.5"><TokenCell token={k.token} /></td>
              <td className="px-3 py-1.5">
                <input type="checkbox" checked={k.active} onChange={(e) => toggle.mutate({ id: k.id, active: e.target.checked })}
                  data-testid={`apikey-active-${k.id}`} />
              </td>
              <td className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">{k.last_used ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">
                <button onClick={() => { if (window.confirm('Revoke this API key? Clients using it will stop working.')) del.mutate(k.id); }}
                  className="text-xs text-[var(--color-error)] hover:underline" data-testid={`apikey-delete-${k.id}`}>Revoke</button>
              </td>
            </tr>
          ))}
          {keys.data && keys.data.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No API keys yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
