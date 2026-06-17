import { createContext, useContext, useEffect } from 'react';

// Panels call `useReportEmpty(true)` when they have no data.
// The wrapping PanelShell reads this via context to hide the panel.
export const PanelEmptyContext = createContext<((empty: boolean) => void) | undefined>(undefined);

export function useReportEmpty(empty: boolean) {
  const report = useContext(PanelEmptyContext);
  useEffect(() => { report?.(empty); }, [empty, report]);
}
