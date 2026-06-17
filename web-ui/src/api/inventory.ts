import { api } from './client';
import { z } from 'zod';

const Platform = z.object({
  vendor: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  count: z.number(),
});

const Software = z.object({
  os: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  count: z.number(),
});

export const Inventory = z.object({
  by_platform: z.array(Platform),
  by_software: z.array(Software),
  total: z.number(),
});

export type Inventory = z.infer<typeof Inventory>;
export type PlatformRow = z.infer<typeof Platform>;
export type SoftwareRow = z.infer<typeof Software>;

export async function getInventory(): Promise<Inventory> {
  const r = await api.get('/inventory');
  return Inventory.parse(r.data);
}
