import { useState } from 'react';
import { useParams } from 'react-router';
import { useDeviceModules } from '@/hooks/use-device';
import { Badge } from '@/components/ui/badge';
import type { ModuleRow } from '@/api/types';
import {
  Server, Cpu, Fan, Power, Box, Layers,
  ChevronRight, ChevronDown, ChevronsUpDown,
} from 'lucide-react';

interface TreeNode {
  module: ModuleRow;
  children: TreeNode[];
}

function buildTree(modules: ModuleRow[]): TreeNode[] {
  const byIndex = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const m of modules) {
    byIndex.set(Number(m.index), { module: m, children: [] });
  }

  for (const m of modules) {
    const node = byIndex.get(Number(m.index))!;
    const parentIdx = m.parent != null ? Number(m.parent) : null;
    if (parentIdx != null && parentIdx !== 0 && byIndex.has(parentIdx)) {
      byIndex.get(parentIdx)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function hasTreeStructure(modules: ModuleRow[]): boolean {
  return modules.some((m) => m.parent != null && Number(m.parent) !== 0);
}

const CLASS_STYLES: Record<string, { icon: typeof Server; color: string }> = {
  chassis:     { icon: Server, color: 'border-l-blue-500' },
  container:   { icon: Box, color: 'border-l-slate-500' },
  module:      { icon: Cpu, color: 'border-l-slate-400' },
  powerSupply: { icon: Power, color: 'border-l-amber-500' },
  fan:         { icon: Fan, color: 'border-l-cyan-500' },
  port:        { icon: Layers, color: 'border-l-emerald-500' },
  sensor:      { icon: Cpu, color: 'border-l-pink-500' },
  stack:       { icon: Server, color: 'border-l-indigo-500' },
};

function getStyle(cls?: string | null): { icon: typeof Server; color: string } {
  if (!cls) return CLASS_STYLES['module']!;
  return CLASS_STYLES[cls] ?? CLASS_STYLES['module']!;
}

function ModuleTreeNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const m = node.module;
  const style = getStyle(m.class);
  const Icon = style.icon;
  const hasChildren = node.children.length > 0;
  const isFru = m.fru && Number(m.fru) !== 0;

  const label = m.name || m.description || m.type || `slot ${m.index}`;
  const version = m.sw_ver || m.fw_ver || m.fw;
  const serial = m.serial && m.serial.trim() ? m.serial : null;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 border-l-2 ${style.color} hover:bg-[var(--color-bg-hover)] ${hasChildren ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" /> :
                     <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        ) : <span className="w-3.5 shrink-0" />}

        <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />

        <span className="text-[13px] font-medium truncate">{label}</span>

        {m.class && (
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">/ {m.class}</span>
        )}

        {isFru && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-bold border-amber-500/50 text-amber-400 shrink-0">
            FRU
          </Badge>
        )}

        {version && (
          <span className="text-[11px] text-[var(--color-text-muted)] font-mono shrink-0">
            {version}
          </span>
        )}

        {m.model && (
          <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{m.model}</span>
        )}

        {serial && (
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono ml-auto shrink-0">
            s/n {serial}
          </span>
        )}

        {m.hw_ver && (
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">hw: {m.hw_ver}</span>
        )}
      </div>

      {expanded && node.children.map((child) => (
        <ModuleTreeNode key={Number(child.module.index)} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function DeviceModules() {
  const { ip = '' } = useParams();
  const { data } = useDeviceModules(ip);
  const [allExpanded, setAllExpanded] = useState(false);

  if (!data || data.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">No modules discovered.</p>;
  }

  if (!hasTreeStructure(data)) {
    const tree = data.map((m) => ({ module: m, children: [] as TreeNode[] }));
    return (
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        {tree.map((node) => (
          <ModuleTreeNode key={Number(node.module.index)} node={node} depth={0} />
        ))}
      </div>
    );
  }

  const tree = buildTree(data);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setAllExpanded(!allExpanded)}
          className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] inline-flex items-center gap-1.5"
        >
          <ChevronsUpDown className="w-3 h-3" />
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        {tree.map((node) => (
          <ModuleTreeNodeControlled key={Number(node.module.index)} node={node} depth={0} forceExpand={allExpanded} />
        ))}
      </div>
    </div>
  );
}

function ModuleTreeNodeControlled({ node, depth, forceExpand }: { node: TreeNode; depth: number; forceExpand: boolean }) {
  const [localToggle, setLocalToggle] = useState<boolean | null>(null);
  const expanded = localToggle ?? (forceExpand || depth < 2);
  const m = node.module;
  const style = getStyle(m.class);
  const Icon = style.icon;
  const hasChildren = node.children.length > 0;
  const isFru = m.fru && Number(m.fru) !== 0;

  const label = m.name || m.description || m.type || `slot ${m.index}`;
  const version = m.sw_ver || m.fw_ver || m.fw;
  const serial = m.serial && m.serial.trim() ? m.serial : null;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 border-l-2 ${style.color} hover:bg-[var(--color-bg-hover)] ${hasChildren ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => hasChildren && setLocalToggle(expanded ? false : true)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" /> :
                     <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        ) : <span className="w-3.5 shrink-0" />}
        <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
        <span className="text-[13px] font-medium truncate">{label}</span>
        {m.class && <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">/ {m.class}</span>}
        {isFru && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-bold border-amber-500/50 text-amber-400 shrink-0">FRU</Badge>
        )}
        {version && <span className="text-[11px] text-[var(--color-text-muted)] font-mono shrink-0">{version}</span>}
        {m.model && <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{m.model}</span>}
        {serial && <span className="text-[10px] text-[var(--color-text-muted)] font-mono ml-auto shrink-0">s/n {serial}</span>}
        {m.hw_ver && <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">hw: {m.hw_ver}</span>}
      </div>
      {expanded && node.children.map((child) => (
        <ModuleTreeNodeControlled key={Number(child.module.index)} node={child} depth={depth + 1} forceExpand={forceExpand} />
      ))}
    </div>
  );
}
