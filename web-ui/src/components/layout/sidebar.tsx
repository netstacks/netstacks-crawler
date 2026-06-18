import { NavLink } from 'react-router';
import { BarChart3, Server, FileText, Settings, Network, Boxes, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/use-whoami';

interface NavItem { to: string; icon: typeof BarChart3; label: string; testId: string; }

const M1: NavItem[] = [
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard', testId: 'dashboard' },
  { to: '/devices',   icon: Server,    label: 'Devices',   testId: 'devices' },
  { to: '/inventory', icon: Boxes,     label: 'Inventory', testId: 'inventory' },
  { to: '/topology',  icon: Network,   label: 'Topologies', testId: 'topology' },
  { to: '/reports',   icon: FileText,  label: 'Reports',   testId: 'reports' },
  { to: '/traceroute', icon: Route,    label: 'Traceroute', testId: 'traceroute' },
];

export function Sidebar() {
  const { isAdmin } = useIsAdmin();
  return (
    <nav className="w-[210px] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col py-3 shrink-0">
      {M1.map(({ to, icon: Icon, label, testId }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          data-nav={testId}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-4 py-2 text-[13px] border-l-2',
              isActive
                ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)] border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
            )
          }
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </NavLink>
      ))}

      {isAdmin && (
        <NavLink
          key="/admin"
          to="/admin"
          data-nav="admin"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-4 py-2 text-[13px] border-l-2',
              isActive
                ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)] border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
            )
          }
        >
          <Settings className="w-4 h-4" />
          <span>Admin</span>
        </NavLink>
      )}

    </nav>
  );
}
