import { api } from './client';
import { z } from 'zod';

export const WhoAmI = z.object({
  authenticated: z.boolean(),
  username: z.string().optional(),
  fullname: z.string().optional(),
  source: z.string().optional(),
  roles: z.array(z.string()).default([]),
});
export type WhoAmI = z.infer<typeof WhoAmI>;

export async function whoami(): Promise<WhoAmI> {
  const r = await api.get('/auth/whoami');
  return WhoAmI.parse(r.data);
}

export async function login(username: string, password: string): Promise<WhoAmI> {
  const r = await api.post('/auth/login', { username, password });
  // login returns {username, fullname, roles}; normalise to WhoAmI shape
  return WhoAmI.parse({ authenticated: true, ...r.data });
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', {});
}

// Public (unauthenticated) branding for the login page. /api/auth/* is exempt
// from the backend auth hook, unlike the admin-only branding endpoint.
export async function publicBranding(): Promise<string> {
  const r = await api.get('/auth/branding');
  return z.object({ application_name: z.string() }).parse(r.data).application_name;
}
