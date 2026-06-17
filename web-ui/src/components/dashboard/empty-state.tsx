import { Inbox } from 'lucide-react';

// Shared empty state for panels with no data -- visually intentional rather
// than feeling broken. Reasonably compact so it doesn't waste a tall panel.
export function EmptyState({ message = 'No rows', hint }: { message?: string; hint?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-2">
      <Inbox className="w-6 h-6 text-[var(--color-text-muted)] opacity-50 mb-1.5" strokeWidth={1.5} />
      <div className="text-[12px] text-[var(--color-text-muted)]">{message}</div>
      {hint && <div className="text-[10px] text-[var(--color-text-muted)] opacity-75 mt-0.5">{hint}</div>}
    </div>
  );
}
