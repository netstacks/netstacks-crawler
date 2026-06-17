import { createContext, useContext } from 'react';

// Per-panel inline search filter (lowercase substring).
// PanelShell sets the value; row-rendering panels (table, list) read it.
// undefined = panel is not searchable.
export const PanelSearchContext = createContext<string | undefined>(undefined);

export function usePanelSearch(): string | undefined {
  return useContext(PanelSearchContext);
}
