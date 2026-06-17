import { useState } from 'react';
import { ENDPOINT_CATALOG, getPanelType } from './panel-registry';
import type { Panel } from '@/api/dashboard';

export function EditSourceDialog({ panel, onSave, onClose }: {
  panel: Panel;
  onSave: (next: { dataSource: Panel['dataSource'] }) => void;
  onClose: () => void;
}) {
  const def = getPanelType(panel.type);
  const compatible = ENDPOINT_CATALOG.filter((e) => !def || e.supports.includes(panel.type));
  const [endpoint, setEndpoint] = useState(panel.dataSource.endpoint);
  const [params, setParams]     = useState<Record<string, string>>(panel.dataSource.params ?? {});
  const [refreshSec, setRefreshSec] = useState(String(panel.dataSource.refreshSec ?? 30));

  const epDef = ENDPOINT_CATALOG.find((e) => e.endpoint === endpoint);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose} data-testid="edit-source-backdrop">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4">Edit data source -- {panel.title}</h3>

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Endpoint</label>
        <select value={endpoint} onChange={(e) => { setEndpoint(e.target.value); setParams({}); }}
                className="w-full h-8 px-2 mb-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
                data-testid="edit-source-endpoint">
          {compatible.map((e) => <option key={e.endpoint} value={e.endpoint}>{e.label}</option>)}
        </select>

        {epDef?.params?.map((p) => (
          <div key={p.name} className="mb-3">
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">{p.name}</label>
            <input value={params[p.name] ?? ''} placeholder={p.placeholder}
                   onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))}
                   className="w-full h-8 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
                   data-testid={`edit-source-param-${p.name}`} />
          </div>
        ))}

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Refresh interval (seconds)</label>
        <input value={refreshSec} type="number" min="5"
               onChange={(e) => setRefreshSec(e.target.value)}
               className="w-full h-8 px-2 mb-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
               data-testid="edit-source-refresh" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-8 px-3 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded"
                  data-testid="edit-source-cancel">Cancel</button>
          <button onClick={() => {
            onSave({ dataSource: {
              endpoint,
              params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '')),
              refreshSec: Math.max(5, Number(refreshSec) || 30),
            } });
            onClose();
          }}
                  className="h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded"
                  data-testid="edit-source-save">Save</button>
        </div>
      </div>
    </div>
  );
}
