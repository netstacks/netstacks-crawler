import { Outlet, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Topbar } from './topbar';
import { Sidebar } from './sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { Statusbar } from './statusbar';
import { whoami } from '@/api/auth';

function readRemoteUser(): string | null {
  const m = document.querySelector('meta[name="x-remote-user"]');
  return m?.getAttribute('content') ?? null;
}

export function Shell() {
  // When auth is enforced (no_auth: false) an unauthenticated visitor gets a
  // resolved whoami of {authenticated:false} — send them to the standalone
  // login page rather than rendering the app chrome. In the default open mode
  // whoami reports the guest/remote user as authenticated, so this is a no-op.
  // On a query error (network) we do NOT redirect, to avoid a lockout loop.
  const me = useQuery({ queryKey: ['whoami'], queryFn: whoami, staleTime: 30_000, retry: false });
  if (me.isSuccess && !me.data.authenticated) {
    const ret = encodeURIComponent(window.location.pathname + window.location.search);
    return <Navigate to={`/login?return=${ret}`} replace />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <Topbar remoteUser={readRemoteUser()} />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Breadcrumbs />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <Statusbar />
        </div>
      </div>
    </div>
  );
}
