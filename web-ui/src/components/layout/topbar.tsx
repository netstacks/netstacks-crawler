import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { getBranding } from '@/api/admin';
import { whoami, logout } from '@/api/auth';
import { Typeahead } from '@/components/search/typeahead';

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const w0 = words[0];
  const w1 = words[1];
  if (w0 && w1) return (w0[0]! + w1[0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props { remoteUser: string | null; }

export function Topbar({ remoteUser }: Props) {
  const qc = useQueryClient();
  const branding = useQuery({ queryKey: ['branding'], queryFn: getBranding, staleTime: 60_000 });
  const appName = branding.data?.application_name ?? 'NetStacks Crawler';

  // Keep the browser tab/title in sync with the configured branding name.
  useEffect(() => { document.title = appName; }, [appName]);

  const me = useQuery({ queryKey: ['whoami'], queryFn: whoami, staleTime: 30_000, retry: false });
  const user = me.data?.authenticated ? (me.data.username ?? null) : remoteUser;
  const source = me.data?.source;

  const doLogout = useMutation({
    mutationFn: () => logout(),
    // Hard redirect (not client nav) so the whole app + query cache resets and
    // auth is re-evaluated from scratch — guarantees we land on the login page.
    onSuccess: () => { qc.clear(); window.location.assign('/login'); },
    onError: () => { window.location.assign('/login'); },
  });

  return (
    <div className="flex items-center gap-4 px-4 h-12 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] shrink-0">
      <div className="flex items-center gap-2.5 font-semibold text-sm">
        <div className="w-[26px] h-[26px] bg-[var(--color-accent)] rounded grid place-items-center text-white text-[11px] font-bold tracking-wider">{initials(appName)}</div>
        {appName}
      </div>
      <Typeahead />
      <div className="flex-1" />
      <div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-secondary)]" data-testid="topbar-user">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
        {user ?? '(unauthenticated)'}
      </div>
      {/* Logout only makes sense for a local session; proxy/SSO users are re-authed upstream. */}
      {source === 'session' && (
        <button onClick={() => doLogout.mutate()} disabled={doLogout.isPending}
          className="flex items-center gap-1 h-7 px-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded"
          data-testid="topbar-logout" title="Log out">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      )}
    </div>
  );
}
