import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil, Plus, RotateCcw, Save as SaveIcon,
  BarChart3, Activity, ListChecks, TrendingUp, AlertTriangle, Layers,
  Server, Globe, Network, Cable, Wifi, Radio, Cpu,
} from 'lucide-react';
import { DashboardGrid } from '@/components/dashboard/grid';
import { PanelShell } from '@/components/dashboard/panel-shell';
import { AddPanelDialog } from '@/components/dashboard/add-panel-dialog';
import { EditSourceDialog } from '@/components/dashboard/edit-source-dialog';
import { getLayout, putLayout, type DashboardLayout, type Panel } from '@/api/dashboard';
import { getPanelType } from '@/components/dashboard/panel-registry';

// Import to trigger registry side-effects
import '@/components/dashboard/panels/counter-row';
import '@/components/dashboard/panels/donut';
import '@/components/dashboard/panels/sparkline';
import '@/components/dashboard/panels/table';
import '@/components/dashboard/panels/list';

type Tint = 'blue'|'green'|'orange'|'red'|'purple'|'cyan'|'pink';

interface PanelChrome { icon: React.ReactNode; tint: Tint; viewAll?: string; viewAllLabel?: string; }

// Per-panel-id chrome for the operational panels at the top of the dashboard.
const PANEL_CHROME: Record<string, PanelChrome> = {
  p1: { icon: <Layers className="w-3.5 h-3.5" />,        tint: 'blue' },
  p2: { icon: <BarChart3 className="w-3.5 h-3.5" />,     tint: 'purple', viewAll: '/reports/Device/inventorybymodelbyos', viewAllLabel: 'Report' },
  p3: { icon: <ListChecks className="w-3.5 h-3.5" />,    tint: 'cyan',   viewAll: '/admin/jobs',                          viewAllLabel: 'All jobs' },
  p4: { icon: <Activity className="w-3.5 h-3.5" />,      tint: 'green' },
  p5: { icon: <TrendingUp className="w-3.5 h-3.5" />,    tint: 'blue' },
  p6: { icon: <AlertTriangle className="w-3.5 h-3.5" />, tint: 'orange' },
  p7: { icon: <Cpu className="w-3.5 h-3.5" />,           tint: 'cyan' },
};

// Icon + tint per category, used to generate chrome for the auto-added
// report panels (one panel per registered report tag).
const CATEGORY_CHROME: Record<string, { icon: React.ReactNode; tint: Tint }> = {
  Device:   { icon: <Server className="w-3.5 h-3.5" />,    tint: 'blue' },
  IP:       { icon: <Globe className="w-3.5 h-3.5" />,     tint: 'cyan' },
  Node:     { icon: <Network className="w-3.5 h-3.5" />,   tint: 'orange' },
  Port:     { icon: <Cable className="w-3.5 h-3.5" />,     tint: 'purple' },
  VLAN:     { icon: <Layers className="w-3.5 h-3.5" />,    tint: 'green' },
  Wireless: { icon: <Wifi className="w-3.5 h-3.5" />,      tint: 'pink' },
};
const WIRELESS_AP_ICON = <Radio className="w-3.5 h-3.5" />;

// Reports whose data is naturally a small set of {label, count} buckets -- render
// these as donut charts. Everything else gets a table panel.
const DONUT_REPORTS = new Set<string>([
  'devicebylocation',
  'inventorybymodelbyos',
  'vlaninventory',
  'vlanmultiplenames',
  'ssidinventory',
  'apchanneldist',
]);

// Reports by category, in display order (matches /api/report grouping).
// `inventorybymodelbyos` is intentionally omitted -- operational panel p2
// already renders it as a donut with nicer per-panel chrome.
const REPORT_PANELS: { category: string; tag: string; title: string }[] = [
  { category: 'Device',   tag: 'deviceaddrnodns',      title: 'Device IPs missing DNS' },
  { category: 'Device',   tag: 'devicebylocation',     title: 'Devices by location' },
  { category: 'Device',   tag: 'devicednsmismatch',    title: 'Device DNS mismatches' },
  { category: 'Device',   tag: 'devicepoestatus',      title: 'PoE status' },
  { category: 'Device',   tag: 'moduleinventory',      title: 'Module inventory' },
  { category: 'Device',   tag: 'portutilization',      title: 'Port utilization' },
  { category: 'IP',       tag: 'ipinventory',          title: 'IP inventory' },
  { category: 'IP',       tag: 'subnets',              title: 'Subnets' },
  { category: 'Node',     tag: 'netbios',              title: 'NetBIOS nodes' },
  { category: 'Node',     tag: 'nodemultiips',         title: 'Nodes with multiple IPs' },
  { category: 'Node',     tag: 'nodesdiscovered',      title: 'Recently discovered nodes' },
  { category: 'Node',     tag: 'nodevendor',           title: 'Nodes by vendor' },
  { category: 'Port',     tag: 'duplexmismatch',       title: 'Duplex mismatches' },
  { category: 'Port',     tag: 'halfduplex',           title: 'Half-duplex ports' },
  { category: 'Port',     tag: 'portadmindown',        title: 'Admin-down ports' },
  { category: 'Port',     tag: 'portblocking',         title: 'STP-blocking ports' },
  { category: 'Port',     tag: 'portlog',              title: 'Port change log' },
  { category: 'Port',     tag: 'portmultinodes',       title: 'Ports with multiple nodes' },
  { category: 'Port',     tag: 'portssid',             title: 'Ports with SSIDs' },
  { category: 'Port',     tag: 'portvlanmismatch',     title: 'Port VLAN mismatches' },
  { category: 'VLAN',     tag: 'vlaninventory',        title: 'VLAN inventory' },
  { category: 'VLAN',     tag: 'vlanmultiplenames',    title: 'VLANs with multiple names' },
  { category: 'Wireless', tag: 'apchanneldist',        title: 'AP channel distribution' },
  { category: 'Wireless', tag: 'apclients',            title: 'AP client counts' },
  { category: 'Wireless', tag: 'apradiochannelpower',  title: 'AP radio channel + power' },
  { category: 'Wireless', tag: 'ssidinventory',        title: 'SSID inventory' },
];

// Operational panels at the top of the dashboard
const OPERATIONAL_PANELS: Panel[] = [
  { id: 'p1', type: 'counter-row', x: 0, y: 0, w: 12, h: 3,
    title: 'Fleet totals',
    dataSource: { endpoint: '/stats/summary', refreshSec: 30 } },
  { id: 'p2', type: 'donut', x: 0, y: 3, w: 4, h: 4,
    title: 'Devices by vendor/model/OS',
    dataSource: { endpoint: '/report/Device/inventorybymodelbyos', refreshSec: 60 } },
  { id: 'p3', type: 'table', x: 4, y: 3, w: 5, h: 4,
    title: 'Recent jobs',
    dataSource: { endpoint: '/admin/jobs', params: { limit: '10' }, refreshSec: 5 } },
  { id: 'p4', type: 'list', x: 9, y: 3, w: 3, h: 4,
    title: 'Job queue health',
    dataSource: { endpoint: '/stats/operational', params: { field: 'job_queue' }, refreshSec: 10 } },
  { id: 'p5', type: 'sparkline', x: 0, y: 7, w: 4, h: 3,
    title: 'Device count (30d)',
    dataSource: { endpoint: '/stats/summary', params: { field: 'device_count' }, refreshSec: 300 } },
  { id: 'p6', type: 'table', x: 4, y: 7, w: 8, h: 3,
    title: 'Slow devices',
    dataSource: { endpoint: '/stats/operational', params: { field: 'slow_devices' }, refreshSec: 60 } },
  { id: 'p7', type: 'list', x: 0, y: 10, w: 4, h: 4,
    title: 'Worker pool',
    dataSource: { endpoint: '/admin/workers', refreshSec: 30 } },
];

// Auto-generate panels for every report. Donut for aggregations, table for
// detail. 4 cols × 5 rows for donuts, 6 cols × 5 rows for tables, packed
// left-to-right via the column-cursor below.
function generateReportPanels(): Panel[] {
  const panels: Panel[] = [];
  let cursorX = 0;
  let cursorY = 14;  // start after the 7 operational panels (which end at y=14)
  let rowMaxH = 0;

  for (const r of REPORT_PANELS) {
    const isDonut = DONUT_REPORTS.has(r.tag);
    const w = isDonut ? 4 : 6;
    const h = 5;
    if (cursorX + w > 12) {
      cursorX = 0;
      cursorY += rowMaxH;
      rowMaxH = 0;
    }
    panels.push({
      id: `report-${r.tag}`,
      type: isDonut ? 'donut' : 'table',
      x: cursorX,
      y: cursorY,
      w,
      h,
      title: r.title,
      dataSource: {
        endpoint: `/report/${r.category}/${r.tag}`,
        refreshSec: 120,
      },
    });
    cursorX += w;
    rowMaxH = Math.max(rowMaxH, h);
  }
  return panels;
}

const DEFAULT_LAYOUT: DashboardLayout = {
  version: 5,
  panels: [...OPERATIONAL_PANELS, ...generateReportPanels()],
};

// Return chrome for a panel: prefer the per-id map for operational panels,
// otherwise derive from the dataSource endpoint (auto-generated report panels).
function chromeFor(panel: Panel): PanelChrome | undefined {
  if (PANEL_CHROME[panel.id]) return PANEL_CHROME[panel.id];

  // Report endpoint → /reports/{cat}/{tag} link + category icon
  const m = panel.dataSource.endpoint.match(/^\/report\/([^/]+)\/([^/?]+)/);
  if (m) {
    const cat = m[1]!;
    const tag = m[2]!;
    const cat_chrome = CATEGORY_CHROME[cat];
    const icon = tag.startsWith('ap') ? WIRELESS_AP_ICON : (cat_chrome?.icon ?? <BarChart3 className="w-3.5 h-3.5" />);
    return {
      icon,
      tint: cat_chrome?.tint ?? 'blue',
      viewAll: `/reports/${cat}/${tag}`,
      viewAllLabel: 'Open report',
    };
  }
  return undefined;
}

export function Dashboard() {
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [addOpen, setAddOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [editingTitle, setEditingTitle] = useState<{ id: string; value: string } | null>(null);
  const [emptyPanels, setEmptyPanels] = useState<Set<string>>(new Set());
  const markEmpty = useCallback((id: string, empty: boolean) => {
    setEmptyPanels((prev) => {
      const has = prev.has(id);
      if (empty === has) return prev;
      const next = new Set(prev);
      if (empty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const visiblePanels = useMemo(
    () => isEditing ? layout.panels : layout.panels.filter((p) => !emptyPanels.has(p.id)),
    [layout.panels, emptyPanels, isEditing],
  );

  const q = useQuery({ queryKey: ['dashboard-layout'], queryFn: getLayout, staleTime: Infinity });
  useEffect(() => {
    // Treat saved layouts older than the current DEFAULT_LAYOUT.version as stale --
    // they pre-date the auto-generated report panels and would otherwise stick around
    // even after a reset-to-default in the source code.
    if (q.data && q.data.panels.length > 0 && (q.data.version ?? 0) >= DEFAULT_LAYOUT.version) {
      setLayout(q.data);
    }
  }, [q.data]);

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (l: DashboardLayout) => putLayout(l),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['dashboard-layout'] }),
  });

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    save.mutate(DEFAULT_LAYOUT);
  }

  function addPanel(p: Omit<Panel, 'id' | 'x' | 'y'>) {
    const id = `p${Date.now()}`;
    const maxY = Math.max(0, ...layout.panels.map((q) => q.y + q.h));
    setLayout((l) => ({ ...l, panels: [...l.panels, { ...p, id, x: 0, y: maxY }] }));
  }

  function removePanel(id: string) {
    setLayout((l) => {
      const next = { ...l, panels: l.panels.filter((p) => p.id !== id) };
      // Persist immediately -- deleting is a high-intent action; nobody wants to
      // remove 5 panels and then realise their changes were lost on refresh.
      save.mutate(next);
      return next;
    });
  }

  function updatePanel(id: string, patch: Partial<Panel>) {
    setLayout((l) => ({ ...l, panels: l.panels.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Fleet health and recent activity. Every panel is configurable; every row links to the underlying detail.</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <button onClick={() => setAddOpen(true)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:border-[var(--color-text-accent)]"
                      data-testid="dashboard-add-panel"><Plus className="w-3 h-3" /> Add panel</button>
              <button onClick={() => save.mutate(layout)} disabled={save.isPending}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-50"
                      data-testid="dashboard-save"><SaveIcon className="w-3 h-3" /> Save</button>
              <button onClick={resetLayout}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
                      data-testid="dashboard-reset"><RotateCcw className="w-3 h-3" /> Reset</button>
            </>
          )}
          <button
            onClick={() => setIsEditing((s) => !s)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:border-[var(--color-text-accent)]"
            data-testid="dashboard-edit-toggle"
          >
            <Pencil className="w-3 h-3" /> {isEditing ? 'Done editing' : 'Edit layout'}
          </button>
        </div>
      </div>

      <DashboardGrid
        panels={visiblePanels}
        isEditing={isEditing}
        onLayoutChange={(panels) => setLayout((l) => ({ ...l, panels }))}
      >
        {(p) => {
          const def = getPanelType(p.type);
          if (!def) {
            return <PanelShell title={`${p.title} (unknown type: ${p.type})`} isEditing={isEditing}>--</PanelShell>;
          }
          const Render = def.render;
          const chrome = chromeFor(p);
          const searchable = p.type === 'table' || p.type === 'list';
          const panelIsEmpty = emptyPanels.has(p.id);
          return (
            <PanelShell
              title={p.title}
              icon={chrome?.icon}
              iconTint={chrome?.tint}
              viewAllHref={chrome?.viewAll}
              viewAllLabel={chrome?.viewAllLabel}
              searchable={searchable}
              isEditing={isEditing}
              isEmpty={panelIsEmpty}
              onEmpty={(empty) => markEmpty(p.id, empty)}
              onRemove={() => removePanel(p.id)}
              onEditTitle={() => setEditingTitle({ id: p.id, value: p.title })}
              onEditSource={() => setEditingPanel(p)}
            >
              <Render title={p.title} dataSource={p.dataSource} isEditing={isEditing} />
            </PanelShell>
          );
        }}
      </DashboardGrid>

      {addOpen && <AddPanelDialog onClose={() => setAddOpen(false)} onCreate={(p) => addPanel(p)} />}

      {editingPanel && (
        <EditSourceDialog
          panel={editingPanel}
          onClose={() => setEditingPanel(null)}
          onSave={(patch) => updatePanel(editingPanel.id, patch)}
        />
      )}

      {editingTitle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingTitle(null)} data-testid="edit-title-backdrop">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Rename panel</h3>
            <input value={editingTitle.value}
                   onChange={(e) => setEditingTitle({ ...editingTitle, value: e.target.value })}
                   className="w-full h-8 px-2 mb-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
                   data-testid="edit-title-input" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingTitle(null)} className="h-8 px-3 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded">Cancel</button>
              <button onClick={() => { updatePanel(editingTitle.id, { title: editingTitle.value }); setEditingTitle(null); }}
                      className="h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded"
                      data-testid="edit-title-save">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
