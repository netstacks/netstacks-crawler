import { api } from './client';
import { z } from 'zod';

export const DataSource = z.object({
  endpoint:    z.string(),
  params:      z.record(z.string(), z.string()).optional(),
  refreshSec:  z.number().optional(),
});
export type DataSource = z.infer<typeof DataSource>;

export const Panel = z.object({
  id:         z.string(),
  type:       z.string(),
  x:          z.number(),
  y:          z.number(),
  w:          z.number(),
  h:          z.number(),
  title:      z.string(),
  dataSource: DataSource,
});
export type Panel = z.infer<typeof Panel>;

export const DashboardLayout = z.object({
  version: z.number(),
  panels:  z.array(Panel),
});
export type DashboardLayout = z.infer<typeof DashboardLayout>;

export async function getLayout(): Promise<DashboardLayout | null> {
  const r = await api.get('/admin/dashboard-layout');
  if (!r.data || !r.data.version) return null;
  return DashboardLayout.parse(r.data);
}

export async function putLayout(layout: DashboardLayout): Promise<void> {
  await api.put('/admin/dashboard-layout', layout);
}
