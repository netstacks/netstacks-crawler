import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { CellLink } from '@/components/common/cell-link';
import { isIP } from '@/lib/cell-link';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  filter?: string;
  getRowId?: (row: T) => string;
  tableId?: string;
  defaultColumnVisibility?: VisibilityState;
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: T[]) => void;
}

export function DataTable<T>({
  data, columns, onRowClick, filter, getRowId,
  tableId, defaultColumnVisibility,
  enableRowSelection, onSelectionChange,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (tableId) {
      try {
        const saved = localStorage.getItem(`columns:${tableId}`);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return defaultColumnVisibility ?? {};
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    if (tableId) {
      localStorage.setItem(`columns:${tableId}`, JSON.stringify(columnVisibility));
    }
  }, [tableId, columnVisibility]);

  const allColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectCol: ColumnDef<T> = {
      id: '_select',
      header: ({ table: t }) => (
        <input type="checkbox"
          checked={t.getIsAllPageRowsSelected()}
          onChange={t.getToggleAllPageRowsSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="accent-[var(--color-accent)]"
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="accent-[var(--color-accent)]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [selectCol, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    defaultColumn: {
      cell: ({ getValue, column, row }) => {
        const v = getValue();
        if (v == null || v === '') return '--';
        const orig = row.original as Record<string, unknown>;
        const deviceIp = (typeof orig.ip === 'string' && isIP(orig.ip)) ? orig.ip
                       : (typeof orig.device === 'string' && isIP(String(orig.device))) ? String(orig.device)
                       : (typeof orig.switch === 'string' && isIP(String(orig.switch))) ? String(orig.switch)
                       : undefined;
        const remoteIp = (typeof orig.remote_ip === 'string' && isIP(String(orig.remote_ip))) ? String(orig.remote_ip) : undefined;
        const ctx = deviceIp ? { device: deviceIp, remoteDevice: remoteIp } : undefined;
        return <CellLink field={column.id} value={v} ctx={ctx} />;
      },
    },
    state: { sorting, globalFilter: filter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(table.getSelectedRowModel().rows.map((r) => r.original));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  return (
    <div>
      {tableId && (
        <div className="flex justify-end mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3" />
                Columns
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[360px] overflow-y-auto w-[220px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => {
                  setColumnVisibility(defaultColumnVisibility ?? {});
                  if (tableId) localStorage.removeItem(`columns:${tableId}`);
                }}
              >
                Reset to defaults
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <table className="w-full text-[13px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] border-b border-[var(--color-border)] cursor-pointer select-none">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as 'asc' | 'desc'] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}
                id={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={`hover:bg-[var(--color-bg-hover)] ${onRowClick ? 'cursor-pointer' : ''} ${row.getIsSelected() ? 'bg-[var(--color-accent)]/10' : ''}`}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 border-b border-[var(--color-border)]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
