import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { login, publicBranding } from '@/api/auth';
import { LogIn, Loader2 } from 'lucide-react';

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const w0 = words[0];
  const w1 = words[1];
  if (w0 && w1) return (w0[0]! + w1[0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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

  // Public branding (works unauthenticated) so the login page matches the
  // configured application name set under Admin → Branding.
  const branding = useQuery({ queryKey: ['public-branding'], queryFn: publicBranding, staleTime: 300_000, retry: false });
  const appName = branding.data ?? 'NetStacks Crawler';
  useEffect(() => { document.title = appName; }, [appName]);

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
      <div className="w-full max-w-sm">
        {/* Branded header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 mb-3 bg-[var(--color-accent)] rounded-xl grid place-items-center text-white text-lg font-bold tracking-wider shadow-lg">
            {initials(appName)}
          </div>
          <h1 className="text-xl font-semibold" data-testid="login-appname">{appName}</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={submit} className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl"
          data-testid="login-form">
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
    </div>
  );
}
