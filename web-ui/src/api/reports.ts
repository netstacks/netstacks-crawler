import { api } from './client';
import { z } from 'zod';

export const ReportListItem = z.object({
  tag: z.string(),
  category: z.string(),
  label: z.string(),
  provides_csv: z.number().optional(),
  api_endpoint: z.number().optional(),
  supported: z.number().optional(),  // 1 = has Virtual::* resultset reachable from /api; 0 = needs per-report adapter
});
export type ReportListItem = z.infer<typeof ReportListItem>;

export async function listReports(): Promise<ReportListItem[]> {
  const r = await api.get('/report');
  return z.object({ reports: z.array(ReportListItem) }).parse(r.data).reports;
}

export async function runReport(
  category: string,
  tag: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>[]> {
  const r = await api.get(`/report/${encodeURIComponent(category)}/${encodeURIComponent(tag)}`, { params });
  return z.object({ rows: z.array(z.record(z.string(), z.unknown())) }).parse(r.data).rows;
}

export interface ReportParam {
  name: string;
  label: string;
  placeholder?: string;
}

// Reports that accept optional query-string filters. Tag → list of inputs.
export const REPORT_PARAMS: Record<string, ReportParam[]> = {
  nodevendor:  [{ name: 'vendor', label: 'Vendor',  placeholder: 'cisco' }],
  ipinventory: [{ name: 'subnet', label: 'Subnet',  placeholder: '10.0.0' }],
  portlog:     [{ name: 'limit',  label: 'Limit',   placeholder: '500'    }],
};

export function reportCsvUrl(category: string, tag: string): string {
  return `/api/report/${encodeURIComponent(category)}/${encodeURIComponent(tag)}.csv`;
}
