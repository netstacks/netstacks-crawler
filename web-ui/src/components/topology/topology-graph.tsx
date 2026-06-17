import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, useNodesState, useEdgesState,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './topology.css';
import {
  Server, Router as RouterIcon, Wifi, Shield, Monitor, Plus,
  ExternalLink, TerminalSquare, Trash2, Save, FolderOpen, Play, X, Check, ArrowRight, RefreshCw,
  Route as RouteIcon, ChevronDown, ChevronRight,
} from 'lucide-react';
import { getDeviceNeighbors, getDevicePorts, getDeviceDetails, getIpContext } from '@/api/devices';
import { submitJob } from '@/api/jobs';
import type { DeviceNeighbor, Port } from '@/api/types';
import { formatUptime, relativeTime, decodeLayers } from '@/lib/format';

// Interactive topology canvas (NetBrain-style manual mapping). The map starts as
// a single seed device; clicking the + on a node opens a neighbor picker listing
// that device's neighbors with interface stats, and you choose which to add.
// Used full-page on /topology and embedded on the device detail page.

interface DevNodeData extends Record<string, unknown> {
  ip: string;
  label: string;
  sub?: string;
  discovered: boolean;
  seed?: boolean;
}
type GNode = Node<DevNodeData>;

const PickerCtx = createContext<{ open: (ip: string, x: number, y: number) => void }>({ open: () => {} });

function iconFor(type?: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('router')) return RouterIcon;
  if (t.includes('wireless') || t.includes('ap') || t.includes('aironet')) return Wifi;
  if (t.includes('firewall') || t.includes('asa')) return Shield;
  if (t.includes('host') || t.includes('server')) return Monitor;
  return Server;
}

function DeviceNode({ data }: NodeProps) {
  const d = data as DevNodeData;
  const picker = useContext(PickerCtx);

  // If the node only has a bare IP for a label, resolve it to a real device
  // name (and vendor/model) so the boxes read well. Cached + only when needed.
  const bare = d.label === d.ip;
  const { data: ctx } = useQuery({
    queryKey: ['ip-context', d.ip], queryFn: () => getIpContext(d.ip),
    enabled: bare, staleTime: 60_000, retry: false,
  });
  let label = d.label, sub = d.sub, discovered = d.discovered;
  if (bare && ctx && (ctx.kind === 'device' || ctx.kind === 'device-interface') && ctx.device) {
    label = ctx.device.dns || ctx.device.name || d.ip;
    sub = [ctx.device.vendor, ctx.device.model].filter(Boolean).join(' ') || sub;
    discovered = true;
  }
  const Icon = iconFor(sub);

  return (
    <div
      className={`group relative rounded-lg border px-3 py-2 min-w-[150px] max-w-[210px] shadow-sm ${
        d.seed
          ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]'
          : discovered
            ? 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
            : 'bg-[var(--color-bg-tertiary)] border-dashed border-[var(--color-border)]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--color-border)] !w-1.5 !h-1.5" />
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${d.seed ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} />
        <div className="min-w-0">
          <div className="text-[12px] font-medium truncate text-[var(--color-text-primary)]">{label}</div>
          {sub && <div className="text-[10px] text-[var(--color-text-muted)] truncate">{sub}</div>}
        </div>
      </div>
      {/* Add-neighbors button */}
      <button
        className="nodrag absolute -right-2.5 -bottom-2.5 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow hover:brightness-110"
        title="Add neighbors"
        onClick={(e) => { e.stopPropagation(); picker.open(d.ip, e.clientX, e.clientY); }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--color-border)] !w-1.5 !h-1.5" />
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

function arc(cx: number, cy: number, count: number, radius = 260) {
  const out: { x: number; y: number }[] = [];
  const spread = Math.min(Math.PI * 1.7, 0.6 + count * 0.35);
  const start = Math.PI / 2 - spread / 2;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? Math.PI / 2 : start + (spread * i) / (count - 1);
    out.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return out;
}

function neighborLabel(n: DeviceNeighbor): { label: string; sub?: string } {
  const label = n.dns || n.name || n.ip;
  const bits = [n.vendor, n.model].filter(Boolean).join(' ');
  return { label, sub: bits || (label !== n.ip ? n.ip : undefined) || undefined };
}

export const seedKey = (seed: string) => `topology:${seed}`;
export const MAPS_KEY = 'crawler:topology:maps';
type SavedMap = { nodes: GNode[]; edges: Edge[] };
// Summary of a traceroute that was imported into the map (via the Traceroute
// page's "Map" button), shown so the user can recall what the map represents.
type TraceMeta = {
  kind: 'traceroute';
  from: string; to: string; total: number; resolved: number;
  rows: { hop: number; ip: string | null; name: string; ms: number | null; timedOut: boolean; resolved: boolean }[];
};
function readMaps(): Record<string, SavedMap> {
  try { return JSON.parse(localStorage.getItem(MAPS_KEY) || '{}'); } catch { return {}; }
}
function writeMaps(m: Record<string, SavedMap>) {
  try { localStorage.setItem(MAPS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

// A device map summary for the Topologies library page.
export type MapSummary = { name: string; seed?: string; seedLabel?: string; devices: number };

function summarize(nodes: GNode[]): { seed?: string; seedLabel?: string; devices: number } {
  const seedNode = nodes.find((n) => (n.data as DevNodeData)?.seed) ?? nodes[0];
  const sd = seedNode?.data as DevNodeData | undefined;
  return { seed: seedNode?.id, seedLabel: sd?.label, devices: nodes.length };
}

// Named, explicitly-saved maps.
export function listSavedMaps(): MapSummary[] {
  const m = readMaps();
  return Object.entries(m).map(([name, map]) => ({ name, ...summarize(map.nodes || []) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function deleteSavedMap(name: string) {
  const m = readMaps(); delete m[name]; writeMaps(m);
}

// Auto-persisted per-seed explorations (every map you build is kept under its seed).
export function listExplorations(): MapSummary[] {
  const out: MapSummary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('topology:')) continue;
      const seed = k.slice('topology:'.length);
      try {
        const map = JSON.parse(localStorage.getItem(k) || '{}') as SavedMap;
        if (!map.nodes?.length) continue;
        out.push({ name: seed, ...summarize(map.nodes) });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => b.devices - a.devices);
}
export function deleteExploration(seed: string) {
  try { localStorage.removeItem(seedKey(seed)); } catch { /* ignore */ }
}

// ---- Neighbor picker -------------------------------------------------------

function speedShort(s?: string | null) {
  if (!s) return '';
  return String(s).replace(/\s+/g, '');
}

function NeighborPicker({ ip, x, y, present, onAdd, onClose }: {
  ip: string; x: number; y: number; present: Set<string>;
  onAdd: (chosen: DeviceNeighbor[]) => void; onClose: () => void;
}) {
  const { data: neighbors, isLoading } = useQuery({ queryKey: ['device', ip, 'neighbors'], queryFn: () => getDeviceNeighbors(ip) });
  const { data: ports } = useQuery({ queryKey: ['device', ip, 'ports'], queryFn: () => getDevicePorts(ip) });
  const portByName = new Map<string, Port>((ports ?? []).map((p) => [p.port, p]));
  const [sel, setSel] = useState<Set<string>>(new Set());

  const addable = (neighbors ?? []).filter((n) => !present.has(n.ip));
  const toggle = (ip2: string) => setSel((s) => { const n = new Set(s); n.has(ip2) ? n.delete(ip2) : n.add(ip2); return n; });
  const allSelected = addable.length > 0 && addable.every((n) => sel.has(n.ip));

  // Clamp to viewport.
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1600) - 380);
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 900) - 420);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 w-[360px] max-h-[420px] flex flex-col bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl"
        style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <span className="text-[12px] font-medium">Add neighbors of <code className="font-mono text-[var(--color-text-accent)]">{ip}</code></span>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="px-3 py-4 text-xs text-[var(--color-text-muted)]">Loading neighbors…</div>}
          {!isLoading && (neighbors?.length ?? 0) === 0 && <div className="px-3 py-4 text-xs text-[var(--color-text-muted)]">No neighbors discovered.</div>}
          {!isLoading && (neighbors ?? []).map((n) => {
            const onMap = present.has(n.ip);
            const link = n.links?.[0];
            const port = link?.local_port ? portByName.get(link.local_port) : undefined;
            const up = port?.up === 'up';
            const { label, sub } = neighborLabel(n);
            return (
              <label key={n.ip}
                className={`flex items-start gap-2 px-3 py-2 border-b border-[var(--color-border)] text-[12px] ${onMap ? 'opacity-50' : 'cursor-pointer hover:bg-[var(--color-bg-tertiary)]'}`}>
                <span className="mt-0.5 shrink-0">
                  {onMap
                    ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
                    : <input type="checkbox" checked={sel.has(n.ip)} onChange={() => toggle(n.ip)} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${n.discovered ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`} />
                    <span className="font-medium truncate">{label}</span>
                    {onMap && <span className="text-[10px] text-[var(--color-text-muted)]">on map</span>}
                  </span>
                  {sub && <span className="block text-[10px] text-[var(--color-text-muted)] truncate">{sub}</span>}
                  {link && (
                    <span className="block text-[10px] text-[var(--color-text-muted)] font-mono truncate">
                      {link.local_port}
                      {port && (
                        <span className={up ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}>
                          {' '}[{up ? 'up' : 'down'}{port.speed ? ` ${speedShort(port.speed)}` : ''}]
                        </span>
                      )}
                      {link.remote_port ? ` → ${link.remote_port}` : ''}
                      {n.links && n.links.length > 1 ? `  (+${n.links.length - 1} more)` : ''}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--color-border)]">
          <button
            onClick={() => setSel(allSelected ? new Set() : new Set(addable.map((n) => n.ip)))}
            className="text-[11px] text-[var(--color-text-accent)] hover:underline disabled:opacity-40"
            disabled={addable.length === 0}>
            {allSelected ? 'Clear' : 'Select all'}
          </button>
          <button
            onClick={() => { onAdd((neighbors ?? []).filter((n) => sel.has(n.ip))); onClose(); }}
            disabled={sel.size === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded disabled:opacity-40">
            <Plus className="w-3 h-3" /> Add {sel.size > 0 ? `(${sel.size})` : ''}
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Canvas ----------------------------------------------------------------

interface MenuState { x: number; y: number; node: GNode }

function makeNode(ip: string, pos: { x: number; y: number }, n?: DeviceNeighbor, seed?: boolean): GNode {
  const lbl = n ? neighborLabel(n) : { label: ip, sub: undefined };
  return { id: ip, type: 'device', position: pos,
    data: { ip, label: lbl.label, sub: lbl.sub, discovered: n ? !!n.discovered : true, seed } };
}

function Canvas({ seed, openMap: openMapName }: { seed: string; openMap?: string }) {
  const nav = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState<GNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const known = useRef<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [picker, setPicker] = useState<{ ip: string; x: number; y: number } | null>(null);
  const [maps, setMaps] = useState<string[]>(() => Object.keys(readMaps()));
  const [traceMeta, setTraceMeta] = useState<TraceMeta | null>(null);
  // `pinned` node cards (opened by clicking a node) stay open until you click
  // empty canvas or pan — so the card's buttons (View device / Re-discover) are
  // reachable. Edge cards are transient hover popups with a close grace period.
  const [hover, setHover] = useState<{ kind: 'node' | 'edge'; x: number; y: number; ip?: string; edge?: Edge; pinned?: boolean } | null>(null);
  const hoverClose = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoverClose = useCallback(() => { if (hoverClose.current) { clearTimeout(hoverClose.current); hoverClose.current = null; } }, []);
  const openHover = useCallback((h: { kind: 'node' | 'edge'; x: number; y: number; ip?: string; edge?: Edge; pinned?: boolean }) => { cancelHoverClose(); setHover(h); }, [cancelHoverClose]);
  // Grace period so the cursor can travel from the edge into the card without it
  // vanishing (transient hover cards only — pinned node cards don't auto-close).
  const closeHoverSoon = useCallback(() => { cancelHoverClose(); hoverClose.current = setTimeout(() => setHover(null), 160); }, [cancelHoverClose]);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Queue a (re)discover for a node's IP. The backend runs it asynchronously.
  const discover = useCallback((ip: string) => {
    submitJob({ action: 'discover', device: ip })
      .then(() => showToast(`Discover queued for ${ip}`))
      .catch(() => showToast(`Could not queue discover for ${ip}`));
  }, [showToast]);

  const persist = useCallback((ns: GNode[], es: Edge[]) => {
    try { localStorage.setItem(seedKey(seed), JSON.stringify({ nodes: ns, edges: es })); } catch { /* ignore */ }
  }, [seed]);

  const addNeighbors = useCallback((parentIp: string, chosen: DeviceNeighbor[]) => {
    setNodes((ns) => {
      const center = ns.find((n) => n.id === parentIp)?.position ?? { x: 0, y: 0 };
      const fresh = chosen.filter((n) => !known.current.has(n.ip) && n.ip !== parentIp);
      const pts = arc(center.x, center.y, fresh.length);
      const add = fresh.map((n, i) => { known.current.add(n.ip); return makeNode(n.ip, pts[i] ?? { x: center.x, y: center.y + 200 }, n); });
      return [...ns, ...add];
    });
    setEdges((es) => {
      const seen = new Set(es.map((e) => e.id));
      const add: Edge[] = [];
      for (const n of chosen) {
        const id = `${parentIp}->${n.ip}`;
        if (seen.has(id) || seen.has(`${n.ip}->${parentIp}`)) continue;
        const port = n.links?.[0];
        add.push({ id, source: parentIp, target: n.ip,
          label: port ? [port.local_port, port.remote_port].filter(Boolean).join(' → ') : undefined,
          labelStyle: { fontSize: 9, fill: 'var(--color-text-muted)' }, style: { stroke: 'var(--color-border)' },
          data: { localPort: port?.local_port ?? null, remotePort: port?.remote_port ?? null,
                  remoteType: port?.type ?? null, links: n.links?.length ?? 0 } });
      }
      return [...es, ...add];
    });
  }, [setNodes, setEdges]);

  const removeNode = useCallback((ip: string) => {
    if (ip === seed) return;
    known.current.delete(ip);
    setNodes((ns) => ns.filter((n) => n.id !== ip));
    setEdges((es) => es.filter((e) => e.source !== ip && e.target !== ip));
  }, [seed, setNodes, setEdges]);

  const startHere = useCallback(() => {
    setTraceMeta(null);
    known.current = new Set([seed]);
    setNodes([makeNode(seed, { x: 0, y: 0 }, undefined, true)]);
    setEdges([]);
  }, [seed, setNodes, setEdges]);

  // Restore a named saved map (opened from the Topologies library), else a
  // pending prebuilt map (e.g. from the traceroute "Map" button), else the saved
  // exploration for this seed, else start clean (single node).
  useEffect(() => {
    if (!seed) return;
    known.current = new Set();
    if (openMapName) {
      const m = readMaps()[openMapName];
      if (m?.nodes?.length) {
        setTraceMeta(null);
        m.nodes.forEach((n) => known.current.add(n.id));
        setNodes(m.nodes); setEdges(m.edges || []);
        return;
      }
    }
    try {
      const praw = localStorage.getItem('crawler:topology:pending');
      if (praw) {
        const pend = JSON.parse(praw) as SavedMap & { seed?: string; meta?: TraceMeta };
        if (pend?.seed === seed && pend.nodes?.length) {
          localStorage.removeItem('crawler:topology:pending');
          pend.nodes.forEach((n) => known.current.add(n.id));
          setNodes(pend.nodes); setEdges(pend.edges || []);
          setTraceMeta(pend.meta ?? null);
          return;
        }
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(seedKey(seed));
      if (raw) {
        const saved = JSON.parse(raw) as SavedMap;
        if (saved.nodes?.length) {
          saved.nodes.forEach((n) => known.current.add(n.id));
          setNodes(saved.nodes); setEdges(saved.edges || []);
          return;
        }
      }
    } catch { /* ignore */ }
    startHere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, openMapName]);

  useEffect(() => { if (seed && nodes.length) persist(nodes, edges); }, [seed, nodes, edges, persist]);

  const saveMap = useCallback(() => {
    const name = window.prompt('Save map as:')?.trim();
    if (!name) return;
    const m = readMaps(); m[name] = { nodes, edges }; writeMaps(m); setMaps(Object.keys(m));
  }, [nodes, edges]);

  const loadMap = useCallback((name: string) => {
    const m = readMaps()[name]; if (!m) return;
    setTraceMeta(null);
    known.current = new Set(m.nodes.map((n) => n.id));
    setNodes(m.nodes); setEdges(m.edges || []);
  }, [setNodes, setEdges]);

  const closeMenu = useCallback(() => { setMenu(null); setHover(null); }, []);

  return (
    <PickerCtx.Provider value={{ open: (ip, x, y) => { setMenu(null); setPicker({ ip, x, y }); } }}>
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeContextMenu={(e, n) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, node: n as GNode }); }}
          onNodeClick={(e, n) => { e.stopPropagation(); setMenu(null); openHover({ kind: 'node', x: e.clientX, y: e.clientY, ip: n.id, pinned: true }); }}
          onEdgeMouseEnter={(e, ed) => openHover({ kind: 'edge', x: e.clientX, y: e.clientY, edge: ed as Edge })}
          onEdgeMouseLeave={closeHoverSoon}
          onPaneClick={closeMenu}
          onMoveStart={() => { closeMenu(); cancelHoverClose(); setHover(null); }}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.15}
        >
          <Background color="var(--color-border)" gap={20} />
          <Controls showInteractive={false} className="!bg-[var(--color-bg-secondary)] !border-[var(--color-border)]" />
          <MiniMap pannable zoomable className="!bg-[var(--color-bg-secondary)] !border-[var(--color-border)]"
            nodeColor={(n) => ((n.data as DevNodeData)?.seed ? 'var(--color-accent)' : (n.data as DevNodeData)?.discovered ? 'var(--color-text-muted)' : 'var(--color-bg-tertiary)')} />
        </ReactFlow>

        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          <button onClick={startHere} title="Reset to just this device and build the map manually"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:border-[var(--color-accent)]">
            <Play className="w-3 h-3" /> Start mapping here
          </button>
          <button onClick={saveMap} title="Save this map"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:border-[var(--color-accent)]">
            <Save className="w-3 h-3" /> Save
          </button>
          {maps.length > 0 && (
            <div className="inline-flex items-center gap-1 h-8 px-2 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded">
              <FolderOpen className="w-3 h-3 text-[var(--color-text-muted)]" />
              <select onChange={(e) => { if (e.target.value) loadMap(e.target.value); e.target.value = ''; }} defaultValue=""
                className="bg-transparent text-xs outline-none cursor-pointer max-w-[120px]">
                <option value="" disabled>Load map…</option>
                {maps.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>

        {traceMeta && <TracePanel meta={traceMeta} onClose={() => setTraceMeta(null)} />}

        {nodes.length <= 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] rounded px-3 py-1.5">
            Click the <span className="text-[var(--color-accent)]">＋</span> on a device to add its neighbors.
          </div>
        )}

        {/* Right-click context menu */}
        {menu && (
          <div className="fixed z-50 min-w-[180px] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md shadow-lg text-[13px]"
            style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] truncate border-b border-[var(--color-border)]">
              {(menu.node.data as DevNodeData).label}
            </div>
            <MenuItem icon={<Plus className="w-3.5 h-3.5" />} label="Add neighbors"
              onClick={() => { setPicker({ ip: menu.node.id, x: menu.x, y: menu.y }); closeMenu(); }} />
            <MenuItem icon={<RefreshCw className="w-3.5 h-3.5" />}
              label={(menu.node.data as DevNodeData).discovered ? 'Re-discover' : 'Discover'}
              onClick={() => { discover(menu.node.id); closeMenu(); }} />
            <MenuItem icon={<Server className="w-3.5 h-3.5" />} label="Open device page"
              onClick={() => { nav(`/devices/${encodeURIComponent(menu.node.id)}`); closeMenu(); }} />
            <MenuItem icon={<ExternalLink className="w-3.5 h-3.5" />} label="Open Web UI"
              onClick={() => { window.open(`https://${menu.node.id}`, '_blank', 'noopener'); closeMenu(); }} />
            <MenuItem icon={<TerminalSquare className="w-3.5 h-3.5" />} label="SSH"
              onClick={() => { window.location.href = `ssh://${menu.node.id}`; closeMenu(); }} />
            {menu.node.id !== seed && (
              <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Remove from map" danger
                onClick={() => { removeNode(menu.node.id); closeMenu(); }} />
            )}
          </div>
        )}

        {picker && (
          <NeighborPicker ip={picker.ip} x={picker.x} y={picker.y} present={known.current}
            onAdd={(chosen) => addNeighbors(picker.ip, chosen)} onClose={() => setPicker(null)} />
        )}

        {hover && !menu && !picker && (
          <div className="fixed z-50"
            onMouseEnter={hover.pinned ? undefined : cancelHoverClose}
            onMouseLeave={hover.pinned ? undefined : closeHoverSoon}
            style={{ left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1600) - 300),
                     top: Math.min(hover.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 900) - 240) }}>
            {hover.kind === 'node' && hover.ip && <NodeHoverCard ip={hover.ip} onDiscover={discover} onClose={() => setHover(null)} />}
            {hover.kind === 'edge' && hover.edge && <EdgeHoverCard edge={hover.edge} labelOf={(id) => (nodes.find((n) => n.id === id)?.data as DevNodeData | undefined)?.label ?? id} />}
          </div>
        )}

        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-[12px] text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-accent)] rounded px-3 py-1.5 shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </PickerCtx.Provider>
  );
}

// Context card for a map imported from the Traceroute page: reminds the user
// what path this map represents (source → destination, every hop in order).
function TracePanel({ meta, onClose }: { meta: TraceMeta; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="absolute top-3 right-3 z-10 w-[280px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md shadow-lg text-[12px] overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--color-border)]">
        <RouteIcon className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
        <span className="font-semibold">Traceroute</span>
        <button onClick={() => setOpen((o) => !o)} className="ml-auto p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          title={open ? 'Collapse' : 'Expand'}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onClose} className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-2.5 py-2 flex items-center gap-1.5 text-[11px]">
        <span className="font-medium truncate max-w-[110px]" title={meta.from}>{meta.from}</span>
        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
        <span className="font-medium truncate max-w-[110px]" title={meta.to}>{meta.to}</span>
      </div>
      <div className="px-2.5 pb-2 text-[10px] text-[var(--color-text-muted)]">
        {meta.total} hops · {meta.resolved} resolved in this network
      </div>
      {open && (
        <div className="max-h-[300px] overflow-y-auto border-t border-[var(--color-border)]">
          {meta.rows.map((r) => (
            <div key={r.hop} className="flex items-center gap-2 px-2.5 py-1 border-b border-[var(--color-border)]/40 last:border-0">
              <span className="font-mono text-[10px] text-[var(--color-text-muted)] w-4 text-right shrink-0">{r.hop}</span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.timedOut ? 'bg-[var(--color-text-muted)]' : r.resolved ? 'bg-[var(--color-accent)]' : 'bg-yellow-500/60'}`} />
              <span className="truncate flex-1" title={r.name}>{r.timedOut ? <span className="text-[var(--color-text-muted)]">* * *</span> : r.name}</span>
              {r.ms != null && <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">{r.ms.toFixed(1)}ms</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HoverShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-[230px] max-w-[320px] p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md shadow-xl text-[12px]">
      {children}
    </div>
  );
}
function HoverKV({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <>
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-right truncate">{value}</span>
    </>
  );
}

function DiscoverBtn({ ip, discovered, onDiscover }: { ip: string; discovered: boolean; onDiscover: (ip: string) => void }) {
  return (
    <button onClick={() => onDiscover(ip)}
      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
      <RefreshCw className="w-3 h-3" /> {discovered ? 'Re-discover' : 'Discover'}
    </button>
  );
}

function NodeHoverCard({ ip, onDiscover, onClose }: { ip: string; onDiscover: (ip: string) => void; onClose?: () => void }) {
  const { data, isError } = useQuery({ queryKey: ['device', ip, 'details'], queryFn: () => getDeviceDetails(ip), staleTime: 30_000, retry: false });
  const closeBtn = onClose && (
    <button onClick={onClose} className="ml-auto -mr-1 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="Close">
      <X className="w-3.5 h-3.5" />
    </button>
  );
  if (!data) {
    return <HoverShell>
      <div className="flex items-center gap-2"><Server className="w-4 h-4 text-[var(--color-text-muted)]" /><code className="font-mono">{ip}</code>{closeBtn}</div>
      <div className="mt-1 text-[var(--color-text-muted)]">{isError ? 'Not discovered (LLDP-only)' : 'Loading…'}</div>
      {isError && <div className="mt-2"><DiscoverBtn ip={ip} discovered={false} onDiscover={onDiscover} /></div>}
    </HoverShell>;
  }
  const d = data as Record<string, unknown>;
  const counts = (d.counts as Record<string, number> | undefined);
  const os = `${d.os ?? ''} ${d.os_ver ?? ''}`.trim();
  return (
    <HoverShell>
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-4 h-4 text-[var(--color-accent)]" />
        <span className="font-semibold truncate">{(d.dns || d.name || ip) as string}</span>
        {closeBtn}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <HoverKV label="IP" value={<code className="font-mono">{ip}</code>} />
        <HoverKV label="Vendor" value={d.vendor as string} />
        <HoverKV label="Model" value={(d.chassis_model || d.model) as string} />
        <HoverKV label="OS" value={os} />
        <HoverKV label="Layers" value={d.layers ? decodeLayers(d.layers) : undefined} />
        <HoverKV label="Location" value={d.location as string} />
        <HoverKV label="Serial" value={d.serial ? <code className="font-mono">{d.serial as string}</code> : undefined} />
        <HoverKV label="Uptime" value={d.uptime ? formatUptime(d.uptime) : undefined} />
        <HoverKV label="Ports" value={counts?.ports} />
        <HoverKV label="Last discover" value={d.last_discover ? relativeTime(d.last_discover) : undefined} />
      </div>
      <div className="mt-2.5 flex items-center gap-4">
        <Link to={`/devices/${encodeURIComponent(ip)}`}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline">
          View device <ArrowRight className="w-3 h-3" />
        </Link>
        <DiscoverBtn ip={ip} discovered onDiscover={onDiscover} />
      </div>
    </HoverShell>
  );
}

function EdgeHoverCard({ edge, labelOf }: { edge: Edge; labelOf: (id: string) => string }) {
  const e = edge.data as Record<string, unknown> | undefined;
  const local = e?.localPort as string | undefined;
  const { data: ports } = useQuery({ queryKey: ['device', edge.source, 'ports'], queryFn: () => getDevicePorts(edge.source), staleTime: 30_000, retry: false });
  const port = (ports ?? []).find((p) => p.port === local) as Record<string, unknown> | undefined;
  const up = port?.up === 'up';
  const stats = port ? [port.speed, port.duplex].filter(Boolean).join(' / ') : '';
  return (
    <HoverShell>
      <div className="font-semibold mb-2 truncate">{labelOf(edge.source)} ↔ {labelOf(edge.target)}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <HoverKV label="Local" value={<code className="font-mono">{local || '--'}</code>} />
        <HoverKV label="Status" value={port ? <span className={up ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}>{up ? 'up' : 'down'}</span> : undefined} />
        <HoverKV label="Speed/Duplex" value={stats || undefined} />
        <HoverKV label="Native VLAN" value={port?.vlan as string | number | undefined} />
        <HoverKV label="Remote" value={<code className="font-mono">{(e?.remotePort as string) || '--'}</code>} />
        <HoverKV label="Remote platform" value={e?.remoteType ? String(e.remoteType).split(',')[0] : undefined} />
        {Number(e?.links) > 1 && <HoverKV label="Links" value={`${e?.links} (LAG)`} />}
      </div>
    </HoverShell>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-bg-tertiary)] ${danger ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}>
      {icon} {label}
    </button>
  );
}

export function TopologyGraph({ seed, openMap }: { seed: string; openMap?: string }) {
  return (
    <ReactFlowProvider>
      <Canvas key={`${seed}:${openMap ?? ''}`} seed={seed} openMap={openMap} />
    </ReactFlowProvider>
  );
}
