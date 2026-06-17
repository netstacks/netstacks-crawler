import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type Milestone = 'SP3' | 'SP4' | 'SP5' | 'SP6' | 'SP7';

interface Props {
  milestone: Milestone;
  reason: string;
  children: ReactNode;
  className?: string;
  showBadge?: boolean;
}

export function Deferred({ milestone, reason, children, className, showBadge = false }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="group"
            aria-disabled="true"
            data-deferred={milestone}
            className={cn(
              'relative inline-block opacity-50 cursor-not-allowed pointer-events-none select-none',
              className,
            )}
            onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            {children}
            {showBadge && (
              <span
                className={cn(
                  'absolute -top-1 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border',
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border)]',
                )}
              >
                {milestone}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{`${reason} -- coming in ${milestone}`}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
