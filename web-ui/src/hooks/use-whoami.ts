import { useQuery } from '@tanstack/react-query';
import { whoami } from '@/api/auth';

// Shared identity query. staleTime keeps role checks cheap across components.
export function useWhoami() {
  return useQuery({ queryKey: ['whoami'], queryFn: whoami, staleTime: 30_000, retry: false });
}

// Admin gate for the UI. Mirrors the backend's require_role('admin'); the backend
// still enforces authorization on every /api call — this only controls what the
// SPA shows so non-admins don't see admin-only nav/pages.
export function useIsAdmin(): { isAdmin: boolean; resolved: boolean } {
  const me = useWhoami();
  return {
    isAdmin: !!me.data?.roles?.includes('admin'),
    resolved: me.isSuccess || me.isError,
  };
}
