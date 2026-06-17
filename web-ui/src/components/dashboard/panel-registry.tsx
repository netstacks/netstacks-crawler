import type { ComponentType } from 'react';
import type { DataSource } from '@/api/dashboard';

export interface PanelProps {
  title: string;
  dataSource: DataSource;
  isEditing: boolean;
}

export interface PanelTypeDef {
  type: string;
  label: string;
  description: string;
  defaultW: number;
  defaultH: number;
  render: ComponentType<PanelProps>;
}

const registry = new Map<string, PanelTypeDef>();

export function registerPanelType(def: PanelTypeDef) {
  registry.set(def.type, def);
}

export function getPanelType(type: string): PanelTypeDef | undefined {
  return registry.get(type);
}

export function allPanelTypes(): PanelTypeDef[] {
  return Array.from(registry.values()).sort((a, b) => a.label.localeCompare(b.label));
}

// Built-in data-source catalog. Add more here as endpoints become panel-worthy.
export interface EndpointDef {
  endpoint: string;
  label: string;
  description: string;
  supports: string[];  // panel type keys that can render this endpoint
  params?: { name: string; placeholder: string }[];
}

export const ENDPOINT_CATALOG: EndpointDef[] = [
  { endpoint: '/stats/summary',     label: 'Fleet summary (latest + 30d history)',
    description: 'device/port/node counters + sparkline series',
    supports: ['counter-row', 'sparkline'] },
  { endpoint: '/stats/operational', label: 'Operational health',
    description: 'slow/timed-out/orphaned/undiscovered + queue health',
    supports: ['table', 'list'] },
  { endpoint: '/admin/jobs',        label: 'Recent jobs',
    description: 'Job queue rows', supports: ['table'],
    params: [{ name: 'limit', placeholder: '10' }] },
  { endpoint: '/report/Device/inventorybymodelbyos', label: 'Devices by vendor/model/OS',
    description: 'aggregated device inventory', supports: ['donut', 'table'] },
  { endpoint: '/report/Node/nodevendor', label: 'Nodes by vendor',
    description: 'MAC vendor breakdown', supports: ['table', 'donut'],
    params: [{ name: 'vendor', placeholder: 'cisco' }] },
];
