import { useState } from 'react';
import { allPanelTypes, ENDPOINT_CATALOG } from './panel-registry';
import type { Panel } from '@/api/dashboard';

export function AddPanelDialog({ onCreate, onClose }: { onCreate: (p: Omit<Panel, 'id' | 'x' | 'y'>) => void; onClose: () => void }) {
  const types = allPanelTypes();
  const [type, setType] = useState(types[0]?.type ?? '');
  const compatibleEndpoints = ENDPOINT_CATALOG.filter((e) => e.supports.includes(type));
  const [endpoint, setEndpoint] = useState(compatibleEndpoints[0]?.endpoint ?? '');
  const [title, setTitle] = useState('New panel');
  const [advanced, setAdvanced] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState('');

  const def = types.find((t) => t.type === type);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose} data-testid="add-panel-backdrop">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4">Add panel</h3>

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               className="w-full h-8 px-2 mb-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
               data-testid="add-panel-title" />

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Type</label>
        <select value={type} onChange={(e) => { setType(e.target.value); setEndpoint(''); }}
                className="w-full h-8 px-2 mb-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
                data-testid="add-panel-type">
          {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>

        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Data source</label>
        {!advanced ? (
          <>
            <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full h-8 px-2 mb-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
                    data-testid="add-panel-endpoint">
              <option value="">Select an endpoint...</option>
              {compatibleEndpoints.map((e) => <option key={e.endpoint} value={e.endpoint}>{e.label}</option>)}
            </select>
            <button
              onClick={() => { setAdvanced(true); setCustomEndpoint(''); }}
              className="text-xs text-[var(--color-text-accent)] hover:underline mb-4"
              data-testid="add-panel-advanced-toggle"
            >
              Advanced: enter a custom endpoint
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="/api/devices"
              className="w-full h-8 px-2 mb-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
              data-testid="add-panel-advanced-input"
            />
            <button
              onClick={() => { setAdvanced(false); setEndpoint(compatibleEndpoints[0]?.endpoint ?? ''); }}
              className="text-xs text-[var(--color-text-accent)] hover:underline mb-4"
            >
              Use registered endpoints
            </button>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-8 px-3 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded"
                  data-testid="add-panel-cancel">Cancel</button>
          <button
            disabled={(!advanced && !endpoint) || (advanced && !customEndpoint) || !def}
            onClick={() => {
              if (!def) return;
              let finalEndpoint = advanced ? customEndpoint : endpoint;
              if (!finalEndpoint) return;
              // Strip /api prefix if user included it (axios client will add it).
              // Accept legacy /api/v2 too so older saved layouts and copy-pasted
              // URLs keep working.
              if (finalEndpoint.startsWith('/api/v2/')) {
                finalEndpoint = finalEndpoint.substring(7);
              } else if (finalEndpoint.startsWith('/api/')) {
                finalEndpoint = finalEndpoint.substring(4);
              }
              onCreate({
                type, title,
                w: def.defaultW, h: def.defaultH,
                dataSource: { endpoint: finalEndpoint, refreshSec: 30 },
              });
              onClose();
            }}
            className="h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-50"
            data-testid="add-panel-create"
          >Add</button>
        </div>
      </div>
    </div>
  );
}
