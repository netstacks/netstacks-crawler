import { api } from './client';
import { NodeRow } from './types';
import { z } from 'zod';

export async function getNode(mac: string): Promise<NodeRow> {
  const r = await api.get(`/node/${mac}`);
  return NodeRow.parse(r.data);
}

export async function getNodeHistory(mac: string): Promise<NodeRow[]> {
  const r = await api.get(`/node/${mac}/history`);
  return z.object({ history: z.array(NodeRow) }).parse(r.data).history;
}
