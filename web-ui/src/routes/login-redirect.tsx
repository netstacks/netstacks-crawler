import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { login } from '@/api/auth';
import { LogIn, Loader2 } from 'lucide-react';

// Local username/password login. External (SSO / reverse-proxy) auth remains the
// primary path; this is the fallback for deployments without a perimeter, and
// for the built-in admin account.
export function LoginRedirect() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(username.trim(), password);
      await qc.invalidateQueries({ queryKey: ['whoami'] });
      const params = new URLSearchParams(window.location.search);
      nav(params.get('return') || '/');
    } catch (e2) {
      const status = (e2 as { status?: number })?.status;
      setErr(status === 403 ? 'That account is disabled.' : 'Invalid username or password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-screen grid place-items-center p-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <form onSubmit={submit} className="w-full max-w-sm p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl"
        data-testid="login-form">
        <h1 className="text-lg font-semibold mb-1">Sign in</h1>
        <p className="text-xs text-[var(--color-text-muted)] mb-5">
          SSO / proxy authentication is preferred where configured. Use a local account to sign in directly.
        </p>

        {err && <div className="mb-3 text-xs text-[var(--color-error)]" data-testid="login-error">{err}</div>}

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username"
          className="w-full h-9 px-2.5 mb-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] outline-none focus:border-[var(--color-border-active)]"
          data-testid="login-username" />

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          className="w-full h-9 px-2.5 mb-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px] outline-none focus:border-[var(--color-border-active)]"
          data-testid="login-password" />

        <button type="submit" disabled={busy || !username.trim()}
          className="w-full h-9 inline-flex items-center justify-center gap-1.5 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded text-sm disabled:opacity-50"
          data-testid="login-submit">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
