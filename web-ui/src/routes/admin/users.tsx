import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, updateUser, deleteUser, getAuthRequired, setAuthRequired, type CrawlerUser, type UserInput, type AuthMethod } from '@/api/admin';
import { whoami } from '@/api/auth';
import { ShieldCheck, ShieldOff } from 'lucide-react';

function AuthToggle() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['auth-required'], queryFn: getAuthRequired });
  const m = useMutation({
    mutationFn: (v: boolean) => setAuthRequired(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth-required'] }); qc.invalidateQueries({ queryKey: ['whoami'] }); },
  });
  const required = q.data ?? false;
  const onToggle = () => {
    if (!required) {
      if (!window.confirm('Require authentication for the API and UI? Make sure you can sign in — the built-in admin/admin account is always available. Continue?')) return;
      m.mutate(true);
    } else {
      m.mutate(false);
    }
  };
  return (
    <div className="mb-5 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded flex items-start gap-3">
      {required ? <ShieldCheck className="w-5 h-5 text-[var(--color-success)] mt-0.5" /> : <ShieldOff className="w-5 h-5 text-[var(--color-warning)] mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Authentication {required ? 'required' : 'disabled'}</div>
        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {required
            ? 'The API requires a key or session; the UI requires login or SSO.'
            : 'Everything is open — no login or API key required. Recommended only on a trusted/perimeter-protected network.'}
        </div>
      </div>
      <button onClick={onToggle} disabled={m.isPending || q.isLoading}
        className={`shrink-0 h-8 px-3 text-xs rounded text-white disabled:opacity-50 ${required ? 'bg-[var(--color-warning)] hover:opacity-90' : 'bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)]'}`}
        data-testid="auth-toggle">
        {required ? 'Disable auth' : 'Enable auth'}
      </button>
    </div>
  );
}

export function AdminUsers() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('local');
  const [err, setErr] = useState<string | null>(null);

  const users = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });
  const me = useQuery({ queryKey: ['whoami'], queryFn: whoami, staleTime: 30_000 });
  const myName = me.data?.username?.toLowerCase();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] });
  const showErr = (e: unknown, fallback: string) => setErr((e as { message?: string })?.message ?? fallback);
  const add = useMutation({
    mutationFn: (u: UserInput) => createUser(u),
    onSuccess: () => { setFormOpen(false); setErr(null); setAuthMethod('local'); invalidate(); },
    onError: (e: unknown) => showErr(e, 'Create failed'),
  });
  const upd = useMutation({
    mutationFn: ({ username, u }: { username: string; u: UserInput }) => updateUser(username, u),
    onSuccess: () => { setErr(null); invalidate(); },
    // Surface guards like "you can't remove your own admin role"; refetch to
    // snap the checkbox back to the server's truth.
    onError: (e: unknown) => { showErr(e, 'Update failed'); invalidate(); },
  });
  const del = useMutation({
    mutationFn: (username: string) => deleteUser(username),
    onSuccess: () => { setErr(null); invalidate(); },
    onError: (e: unknown) => showErr(e, 'Delete failed'),
  });

  const resetPassword = (u: CrawlerUser) => {
    const pw = window.prompt(`New password for ${u.username}:`);
    if (pw) upd.mutate({ username: u.username, u: { password: pw } });
  };

  return (
    <div>
      <AuthToggle />
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Local accounts for username/password login and as owners of API keys. SSO/proxy users
          (<span className="font-mono">sso</span> source) are added automatically on first sign-in with read-only
          access — grant them Admin or Port&nbsp;control here.
        </p>
        <button onClick={() => { setErr(null); setFormOpen((v) => !v); }}
          className="ml-auto h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded"
          data-testid="user-add-toggle">
          {formOpen ? 'Cancel' : 'Add user'}
        </button>
      </div>

      {err && <div className="mb-3 text-xs text-[var(--color-error)]">{err}</div>}

      {formOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            add.mutate({
              username: String(fd.get('username') || '').trim(),
              password: authMethod === 'local' ? String(fd.get('password') || '') : '',
              fullname: String(fd.get('fullname') || '').trim(),
              admin: fd.get('admin') === 'on',
              port_control: fd.get('port_control') === 'on',
              auth: authMethod,
            });
          }}
          className="mb-4 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded grid grid-cols-2 gap-3 text-[13px]"
          data-testid="user-form"
        >
          <label className="text-xs text-[var(--color-text-muted)]">Username
            <input name="username" required autoComplete="off"
              className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]" />
          </label>
          <label className="text-xs text-[var(--color-text-muted)]">Auth method
            <select name="auth" value={authMethod} onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
              className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
              data-testid="user-auth">
              <option value="local">Local (password)</option>
              <option value="ldap">LDAP</option>
              <option value="radius">RADIUS</option>
              <option value="tacacs">TACACS+</option>
            </select>
          </label>
          {authMethod === 'local' ? (
            <label className="text-xs text-[var(--color-text-muted)]">Password
              <input name="password" type="password" autoComplete="new-password"
                className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]" />
            </label>
          ) : (
            <div className="text-xs text-[var(--color-text-muted)] self-end pb-1.5">Password is validated by the {authMethod.toUpperCase()} server.</div>
          )}
          <label className="text-xs text-[var(--color-text-muted)] col-span-2">Full name
            <input name="fullname"
              className="mt-0.5 w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]" />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input type="checkbox" name="admin" /> Administrator
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input type="checkbox" name="port_control" /> Port control
          </label>
          <button type="submit" disabled={add.isPending}
            className="col-span-2 h-8 px-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded text-xs disabled:opacity-50"
            data-testid="user-save">Create user</button>
        </form>
      )}

      <table className="w-full text-[13px] border border-[var(--color-border)] rounded overflow-hidden">
        <thead className="bg-[var(--color-bg-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-3 py-2">Username</th>
            <th className="text-left px-3 py-2">Full name</th>
            <th className="text-left px-3 py-2">Auth</th>
            <th className="text-left px-3 py-2">Admin</th>
            <th className="text-left px-3 py-2">Port ctrl</th>
            <th className="text-left px-3 py-2">Active</th>
            <th className="text-left px-3 py-2">Last on</th>
            <th className="text-left px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(users.data ?? []).map((u) => (
            <tr key={u.username} className="border-t border-[var(--color-border)]" data-testid={`user-row-${u.username}`}>
              <td className="px-3 py-1.5 font-mono">
                {u.username}
                {u.builtin && <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">built-in</span>}
              </td>
              <td className="px-3 py-1.5">{u.fullname}</td>
              <td className="px-3 py-1.5">
                <span className="text-[11px] text-[var(--color-text-muted)]">{u.source}{u.source === 'local' && !u.has_password ? ' (no pw)' : ''}</span>
              </td>
              <td className="px-3 py-1.5">
                <input type="checkbox" checked={u.admin}
                  disabled={u.username.toLowerCase() === myName}
                  title={u.username.toLowerCase() === myName ? "You can't change your own admin role" : undefined}
                  onChange={(e) => upd.mutate({ username: u.username, u: { admin: e.target.checked } })}
                  data-testid={`user-admin-${u.username}`} />
              </td>
              <td className="px-3 py-1.5">
                <input type="checkbox" checked={u.port_control} onChange={(e) => upd.mutate({ username: u.username, u: { port_control: e.target.checked } })} />
              </td>
              <td className="px-3 py-1.5">
                <input type="checkbox" checked={u.active} onChange={(e) => upd.mutate({ username: u.username, u: { active: e.target.checked } })}
                  data-testid={`user-active-${u.username}`} />
              </td>
              <td className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">{u.last_on ?? '—'}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-right">
                {u.source !== 'sso' && (
                  <button onClick={() => resetPassword(u)} className="text-xs text-[var(--color-text-accent)] hover:underline mr-3">Set password</button>
                )}
                {u.builtin
                  ? <span className="text-xs text-[var(--color-text-muted)]" title="The built-in admin can be disabled but not deleted">protected</span>
                  : <button onClick={() => { if (window.confirm(`Delete user ${u.username}? This also revokes their API keys.`)) del.mutate(u.username); }}
                      className="text-xs text-[var(--color-error)] hover:underline" data-testid={`user-delete-${u.username}`}>Delete</button>}
              </td>
            </tr>
          ))}
          {users.data && users.data.length === 0 && (
            <tr><td colSpan={8} className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No local users yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
