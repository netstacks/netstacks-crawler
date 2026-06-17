import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import type { Port } from '@/api/types';

interface Props {
  port: Port;
  onRename: () => void;
  onToggleAdmin: () => void;
  onChangeVlan: () => void;
  onCyclePoe: () => void;
  onViewLog: () => void;
}

export function PortRowActions({ port, onRename, onToggleAdmin, onChangeVlan, onCyclePoe, onViewLog }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Row actions" data-testid={`row-actions-${port.port}`} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
          <MoreHorizontal className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRename}>Rename port description</DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleAdmin}>Toggle admin status</DropdownMenuItem>
        <DropdownMenuItem onClick={onChangeVlan}>Change VLAN</DropdownMenuItem>
        <DropdownMenuItem onClick={onCyclePoe}>Cycle PoE</DropdownMenuItem>
        <DropdownMenuItem onClick={onViewLog}>View port log</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
