import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import type { Panel } from '@/api/dashboard';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGrid = WidthProvider(Responsive);

export function DashboardGrid({
  panels, isEditing, onLayoutChange, children,
}: {
  panels: Panel[];
  isEditing: boolean;
  onLayoutChange: (next: Panel[]) => void;
  children: (p: Panel) => React.ReactNode;
}) {
  const layout: Layout[] = panels.map((p) => ({
    i: p.id, x: p.x, y: p.y, w: p.w, h: p.h, minW: 2, minH: 2,
  }));

  return (
    <ResponsiveGrid
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={48}
      isDraggable={isEditing}
      isResizable={isEditing}
      draggableHandle=".panel-drag-handle"
      onLayoutChange={(next) => {
        const byId = new Map(next.map((l) => [l.i, l]));
        onLayoutChange(
          panels.map((p) => {
            const l = byId.get(p.id);
            return l ? { ...p, x: l.x, y: l.y, w: l.w, h: l.h } : p;
          }),
        );
      }}
    >
      {panels.map((p) => (
        <div key={p.id} data-testid={`panel-${p.id}`}>
          {children(p)}
        </div>
      ))}
    </ResponsiveGrid>
  );
}
