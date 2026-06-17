import { Link, useLocation } from 'react-router';

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.map((p, i) => ({
    label: decodeURIComponent(p),
    to: '/' + parts.slice(0, i + 1).join('/'),
  }));
  return (
    <div className="px-6 py-3 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
      <Link to="/" className="text-[var(--color-text-accent)] hover:underline">Dashboard</Link>
      {crumbs.map((c, i) => (
        <span key={c.to}>
          <span className="mx-2">/</span>
          {i === crumbs.length - 1
            ? <span className="text-[var(--color-text-primary)]">{c.label}</span>
            : <Link to={c.to} className="text-[var(--color-text-accent)] hover:underline">{c.label}</Link>}
        </span>
      ))}
    </div>
  );
}
