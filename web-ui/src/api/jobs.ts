import { api } from './client';

export interface Job {
  job: number;
  device?: string;
  port?: string;
  action?: string;
  status?: string;
  log?: string;
  entered?: string;
  finished?: string;
}

export async function getJob(id: number): Promise<Job> {
  const r = await api.get(`/job/${id}`);
  return r.data as Job;
}

export async function listJobs(params: { limit?: number; status?: string } = {}) {
  const r = await api.get('/job', { params });
  return r.data as { jobs: Job[] };
}

export interface SubmitJobArgs {
  action: string;
  device?: string;
  port?: string;
  subaction?: string;
}

export async function submitJob(args: SubmitJobArgs): Promise<{ job_id: number }> {
  const r = await api.post('/job', args);
  return r.data as { job_id: number };
}
