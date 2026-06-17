import axios from 'axios';
import { Health } from './types';
import './client'; // ensure dev-mode X-Remote-User defaults are installed on axios

export async function getHealth(): Promise<Health> {
  const r = await axios.get<unknown>('/health');
  return Health.parse(r.data);
}

export async function getVersion() {
  const r = await axios.get('/api/version');
  return r.data as { crawler_version: string; schema_version: string; features: Record<string, number> };
}

export async function getInfo() {
  const r = await axios.get('/info');
  return r.data as { service: string; version: string; ui: string; docs: string };
}
