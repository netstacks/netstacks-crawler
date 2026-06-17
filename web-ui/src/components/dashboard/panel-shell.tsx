import { useState, type ReactNode } from 'react';
import { MoreVertical, ArrowUpRight, X, Search } from 'lucide-react';
import { Link } from 'react-router';
import { PanelSearchContext } from './panel-search-context';
import { PanelEmptyContext } from './panel-empty-context';

export function PanelShell({
  title, icon, iconTint = 'blue',
  viewAllHref, viewAllLabel,
  searchable = false,
  isEditing, isEmpty, onEmpty,
  onRemove, onEditTitle, onEditSource, children,
}: {
  title: string;
  icon?: ReactNode;
  iconTint?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'pink';
  viewAllHref?: string;
  viewAllLabel?: string;
  searchable?: boolean;
  isEditing: boolean;
  isEmpty?: boolean;
  onEmpty?: (empty: boolean) => void;
  onRemove?: () => void;
  onEditTitle?: () => void;
  onEditSource?: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [search,  setSearch]      = useState('');

  const tintClass = {
    blue:   'bg-blue-500/10 text-blue-400',
    green:  'bg-emerald-500/10 text-emerald-400',
    orange: 'bg-amber-500/10 text-amber-400',
    red:    'bg-red-500/10 text-red-400',
    purple: 'bg-violet-500/10 text-violet-400',
    cyan:   'bg-cyan-500/10 text-cyan-400',
    pink:   'bg-pink-500/10 text-pink-400',
  }[iconTint];

  // react-grid-layout swallows pointer events on .panel-drag-handle. The drag
  // handle is the icon+title only -- control buttons sit outside it so their
  // clicks aren't grabbed by the grid.
  const stopRGL = (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={`h-full flex flex-col bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-sm overflow-hidden ${isEmpty && isEditing ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Drag handle = icon + title only */}
        <div
          className={`flex items-center gap-2 min-w-0 flex-1 ${isEditing ? 'panel-drag-handle cursor-move' : ''}`}
        >
          {icon && (
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${tintClass}`}>
              {icon}
            </span>
          )}
          <div className="text-[13px] font-medium text-[var(--color-text-primary)] truncate" data-testid="panel-header">
            {title}
          </div>
        </div>

        {searchable && (
          <div className="relative flex-shrink-0" onMouseDown={stopRGL}>
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={stopRGL}
              onClick={stopRGL}
              placeholder="Filter..."
              aria-label="Filter rows in this panel"
              data-testid="panel-search"
              className="h-6 pl-5 pr-2 w-28 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[11px] focus:outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        )}

        {viewAllHref && !isEditing && (
          <Link
            to={viewAllHref}
            className="inline-flex items-center gap-0.5 text-[11px] text-[var(--color-text-accent)] hover:underline flex-shrink-0"
            data-testid="panel-view-all"
            onMouseDown={stopRGL}
            onClick={stopRGL}
          >
            {viewAllLabel ?? 'View all'} <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}

        {isEditing && (
          <>
            <div className="relative flex-shrink-0" onMouseDown={stopRGL}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((s) => !s); }}
                onMouseDown={stopRGL}
                className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded"
                data-testid="panel-menu-toggle"
                aria-label="Panel options"
              >
                <MoreVertical className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded shadow-lg text-xs z-50 min-w-[160px]"
                     onMouseDown={stopRGL}>
                  <button onClick={(e) => { stopRGL(e); setMenuOpen(false); onEditTitle?.(); }}
                          className="block w-full text-left px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
                          data-testid="panel-menu-edit-title">Edit title</button>
                  <button onClick={(e) => { stopRGL(e); setMenuOpen(false); onEditSource?.(); }}
                          className="block w-full text-left px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
                          data-testid="panel-menu-edit-source">Edit data source</button>
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
              onMouseDown={stopRGL}
              className="p-1 hover:bg-red-500/15 hover:text-red-400 text-[var(--color-text-muted)] rounded flex-shrink-0"
              data-testid="panel-menu-remove"
              aria-label="Remove panel"
              title="Remove panel"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-auto px-4 pb-4 pt-1">
        <PanelEmptyContext.Provider value={onEmpty}>
          <PanelSearchContext.Provider value={searchable ? search.trim().toLowerCase() : undefined}>
            {children}
          </PanelSearchContext.Provider>
        </PanelEmptyContext.Provider>
      </div>
    </div>
  );
}
