import { Link } from 'react-router';
export function NeighborLink({ ip, label }: { ip?: string | null; label?: string | null }) {
  if (!ip) return <span>{label ?? ''}</span>;
  return <Link to={`/devices/${ip}`} className="text-[var(--color-text-accent)]">{label ?? ip}</Link>;
}
