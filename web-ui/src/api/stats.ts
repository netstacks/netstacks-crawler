import { api } from './client';
import { z } from 'zod';

const StatsRow = z.record(z.string(), z.unknown());
const SummarySchema = z.object({
  latest:  StatsRow,
  history: z.array(StatsRow),
});
export type StatsSummary = z.infer<typeof SummarySchema>;

export async function getSummary(): Promise<StatsSummary> {
  const r = await api.get('/stats/summary');
  return SummarySchema.parse(r.data);
}

const OperationalSchema = z.object({
  slow_devices:           z.array(z.record(z.string(), z.unknown())),
  timed_out_devices:      z.array(z.record(z.string(), z.unknown())),
  orphaned_devices:       z.array(z.record(z.string(), z.unknown())),
  duplicate_devices:      z.array(z.record(z.string(), z.unknown())),
  undiscovered_neighbors: z.array(z.record(z.string(), z.unknown())),
  job_queue:              z.record(z.string(), z.number()),
});
export type StatsOperational = z.infer<typeof OperationalSchema>;

export async function getOperational(): Promise<StatsOperational> {
  const r = await api.get('/stats/operational');
  return OperationalSchema.parse(r.data);
}
