import { api } from './client';
import { z } from 'zod';

const Job = z.object({
  job: z.number(),
  action: z.string().nullable().optional(),
  device: z.string().nullable().optional(),
  port: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  log: z.string().nullable().optional(),
  entered: z.string().nullable().optional(),
  started: z.string().nullable().optional(),
  finished: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
});
export type Job = z.infer<typeof Job>;

export async function listJobs(status?: string, limit = 200): Promise<Job[]> {
  const r = await api.get('/admin/jobs', { params: { status, limit } });
  return z.object({ jobs: z.array(Job) }).parse(r.data).jobs;
}

export async function cancelJob(id: number): Promise<void> {
  await api.delete(`/admin/job/${id}`);
}

// Cancel all queued (not-yet-started) jobs, optionally restricted to one action.
// Only removes unstarted queued jobs — running/finished jobs, the skiplist and
// schedules are untouched. Returns how many were cancelled.
export async function cancelQueuedJobs(action?: string): Promise<number> {
  const r = await api.delete('/admin/jobs/queued', { params: action ? { action } : {} });
  return Number((r.data as { cancelled?: number })?.cancelled ?? 0);
}

export interface SnmpSettings { community: string[]; community_rw: string[]; }
const SnmpSettingsSchema = z.object({ community: z.array(z.string()), community_rw: z.array(z.string()) });

export async function getSnmpSettings(): Promise<SnmpSettings> {
  const r = await api.get('/admin/settings/snmp');
  return SnmpSettingsSchema.parse(r.data);
}
export async function putSnmpSettings(s: Partial<SnmpSettings>): Promise<SnmpSettings> {
  const r = await api.put('/admin/settings/snmp', s);
  return SnmpSettingsSchema.parse(r.data);
}

export interface DeviceAuthEntry {
  id: number;
  tag?: string;
  community?: string;
  user?: string;
  password?: string;
  priv_password?: string;
  auth_protocol?: string;
  priv_protocol?: string;
  driver?: string;
  only?: string;
  no?: string;
}
const DeviceAuthEntrySchema = z.object({
  id: z.number(),
}).catchall(z.unknown()) as unknown as z.ZodType<DeviceAuthEntry>;

export async function listDeviceAuth(): Promise<DeviceAuthEntry[]> {
  const r = await api.get('/admin/device-auth');
  return z.object({ entries: z.array(DeviceAuthEntrySchema) }).parse(r.data).entries;
}
export async function addDeviceAuth(e: Omit<DeviceAuthEntry, 'id'>): Promise<void> {
  await api.post('/admin/device-auth', e);
}
export async function updateDeviceAuth(id: number, e: Omit<DeviceAuthEntry, 'id'>): Promise<void> {
  await api.put(`/admin/device-auth/${id}`, e);
}
export async function deleteDeviceAuth(id: number): Promise<void> {
  await api.delete(`/admin/device-auth/${id}`);
}

export interface ScheduleEntry { when: string | null; enabled: number; }
export async function getSchedule(): Promise<Record<string, ScheduleEntry>> {
  const r = await api.get('/admin/schedule');
  return z.object({
    schedule: z.record(z.string(), z.object({ when: z.string().nullable(), enabled: z.number() })),
  }).parse(r.data).schedule;
}
export async function putSchedule(action: string, entry: Partial<ScheduleEntry>): Promise<void> {
  await api.put(`/admin/schedule/${encodeURIComponent(action)}`, entry);
}

export interface BrandingSettings { application_name: string; }
const BrandingSchema = z.object({ application_name: z.string() });

export async function getBranding(): Promise<BrandingSettings> {
  const r = await api.get('/admin/settings/branding');
  return BrandingSchema.parse(r.data);
}
export async function putBranding(s: Partial<BrandingSettings>): Promise<BrandingSettings> {
  const r = await api.put('/admin/settings/branding', s);
  return BrandingSchema.parse(r.data);
}

export async function submitGlobalAction(action: string, extras?: { device?: string; subaction?: string }): Promise<number> {
  const r = await api.post('/job', { action, ...extras });
  return z.object({ job_id: z.number() }).parse(r.data).job_id;
}

// ---- Local users -----------------------------------------------------------

export const CrawlerUser = z.object({
  username: z.string(),
  fullname: z.string().default(''),
  note: z.string().default(''),
  admin: z.boolean(),
  port_control: z.boolean(),
  active: z.boolean(),
  builtin: z.boolean().default(false),
  has_password: z.boolean(),
  source: z.string(),
  last_on: z.string().nullable().optional(),
  created: z.string().nullable().optional(),
});
export type CrawlerUser = z.infer<typeof CrawlerUser>;

export interface UserInput {
  username?: string;
  password?: string;
  fullname?: string;
  note?: string;
  admin?: boolean;
  port_control?: boolean;
  active?: boolean;
}

export async function listUsers(): Promise<CrawlerUser[]> {
  const r = await api.get('/admin/users');
  return z.object({ users: z.array(CrawlerUser) }).parse(r.data).users;
}
export async function createUser(u: UserInput): Promise<CrawlerUser> {
  const r = await api.post('/admin/users', u);
  return z.object({ user: CrawlerUser }).parse(r.data).user;
}
export async function updateUser(username: string, u: UserInput): Promise<CrawlerUser> {
  const r = await api.put(`/admin/users/${encodeURIComponent(username)}`, u);
  return z.object({ user: CrawlerUser }).parse(r.data).user;
}
export async function deleteUser(username: string): Promise<void> {
  await api.delete(`/admin/users/${encodeURIComponent(username)}`);
}

// ---- Static API keys -------------------------------------------------------

export const ApiKey = z.object({
  id: z.number(),
  label: z.string().default(''),
  username: z.string(),
  token: z.string(),
  active: z.boolean(),
  created: z.string().nullable().optional(),
  last_used: z.string().nullable().optional(),
});
export type ApiKey = z.infer<typeof ApiKey>;

export async function listApiKeys(): Promise<ApiKey[]> {
  const r = await api.get('/admin/api-keys');
  return z.object({ keys: z.array(ApiKey) }).parse(r.data).keys;
}
export async function createApiKey(username: string, label?: string): Promise<ApiKey> {
  const r = await api.post('/admin/api-keys', { username, label });
  return z.object({ key: ApiKey }).parse(r.data).key;
}
export async function setApiKeyActive(id: number, active: boolean): Promise<ApiKey> {
  const r = await api.put(`/admin/api-keys/${id}`, { active });
  return z.object({ key: ApiKey }).parse(r.data).key;
}
export async function deleteApiKey(id: number): Promise<void> {
  await api.delete(`/admin/api-keys/${id}`);
}

// ---- Authentication enforcement -------------------------------------------

export async function getAuthRequired(): Promise<boolean> {
  const r = await api.get('/admin/settings/auth');
  return z.object({ auth_required: z.boolean() }).parse(r.data).auth_required;
}
export async function setAuthRequired(auth_required: boolean): Promise<boolean> {
  const r = await api.put('/admin/settings/auth', { auth_required });
  return z.object({ auth_required: z.boolean() }).parse(r.data).auth_required;
}
