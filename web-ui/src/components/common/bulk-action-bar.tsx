import { useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface BulkAction<T> {
  key: string;
  label: string;
  variant?: 'default' | 'destructive';
  needsConfirmation?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  onExecute: (rows: T[]) => Promise<BulkResult[]>;
}

export interface BulkResult {
  id: string;
  success: boolean;
  message?: string;
}

interface Props<T> {
  selectedRows: T[];
  actions: BulkAction<T>[];
  getRowLabel: (row: T) => string;
  onClearSelection: () => void;
}

export function BulkActionBar<T>({ selectedRows, actions, getRowLabel, onClearSelection }: Props<T>) {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);

  async function execute(action: BulkAction<T>) {
    setRunning(action.key);
    setResults(null);
    try {
      const r = await action.onExecute(selectedRows);
      setResults(r);
    } catch {
      setResults([{ id: 'batch', success: false, message: 'batch execution failed' }]);
    } finally {
      setRunning(null);
    }
  }

  const successes = results?.filter((r) => r.success).length ?? 0;
  const failures = results?.filter((r) => !r.success).length ?? 0;

  return (
    <div className="sticky bottom-0 mt-4 -mx-6 px-6 py-3 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] flex items-center gap-3 z-40">
      <span className="text-xs font-medium">{selectedRows.length} selected</span>

      {actions.filter((a) => a.variant !== 'destructive').map((action) => (
        <button
          key={action.key}
          disabled={!!running}
          onClick={() => execute(action)}
          className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
        >
          {running === action.key ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
          {action.label}
        </button>
      ))}

      <div className="flex-1" />

      {actions.filter((a) => a.variant === 'destructive').map((action) => (
        <AlertDialog key={action.key}>
          <AlertDialogTrigger asChild>
            <button
              disabled={!!running}
              className="text-xs px-3 py-1.5 rounded border border-[rgba(239,83,80,0.4)] bg-[rgba(239,83,80,0.08)] text-[var(--color-error)] hover:bg-[rgba(239,83,80,0.16)] disabled:opacity-50"
            >
              {running === action.key ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              {action.label}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{action.confirmTitle ?? `${action.label}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {action.confirmDescription ?? `This will ${action.label.toLowerCase()} ${selectedRows.length} items.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => execute(action)}
                className="bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90"
              >{action.label} {selectedRows.length} items</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}

      <button
        onClick={() => { onClearSelection(); setResults(null); }}
        className="text-xs p-1 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
        title="Clear selection"
      ><X className="w-4 h-4" /></button>

      {results && (
        <div className="basis-full text-xs mt-1 flex items-center gap-2">
          {successes > 0 && <span className="inline-flex items-center gap-1 text-[var(--color-success)]"><CheckCircle2 className="w-3 h-3" /> {successes} succeeded</span>}
          {failures > 0 && <span className="inline-flex items-center gap-1 text-[var(--color-error)]"><XCircle className="w-3 h-3" /> {failures} failed</span>}
        </div>
      )}
    </div>
  );
}
