import { NavLink, Outlet } from 'react-router';

const tabs = [
  { to: '/admin/actions',   label: 'Actions' },
  { to: '/admin/import',    label: 'Import' },
  { to: '/admin/jobs',      label: 'Jobs' },
  { to: '/admin/snmp',      label: 'SNMP Auth' },
  { to: '/admin/schedules', label: 'Schedules' },
  { to: '/admin/users',     label: 'Users' },
  { to: '/admin/api-keys',  label: 'API Keys' },
  { to: '/admin/branding',  label: 'Branding' },
];

export function AdminShell() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Admin & Settings</h1>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Operational controls for the crawler backend -- discovery, MAC/ARP refresh,
        worker pool, and on-disk settings.
      </p>
      <nav className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `px-4 py-2 text-sm border-b-2 -mb-px ${isActive
                ? 'border-[var(--color-text-accent)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`
            }
            data-testid={`admin-tab-${t.to.split('/').pop()}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
