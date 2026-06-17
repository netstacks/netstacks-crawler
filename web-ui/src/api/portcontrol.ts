import { api } from './client';

export type PortControlField = 'c_port' | 'c_name' | 'c_pvid' | 'c_power' | 'location' | 'contact';

export interface PortControlArgs {
  device: string;
  port?: string;
  field: PortControlField;
  action?: string;
  value?: string;
  reason?: string;
  log?: string;
}

export async function submitPortControl(args: PortControlArgs) {
  const r = await api.post('/portcontrol', args);
  return r.data as { job_id: number };
}

export async function getPortControlLog(limit = 100) {
  const r = await api.get('/portcontrol/log', { params: { limit } });
  return r.data as { entries: Record<string, unknown>[] };
}
