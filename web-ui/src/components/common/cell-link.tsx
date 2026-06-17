import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { linkForCell, isMAC, type LinkContext } from '@/lib/cell-link';
import { ouiVendor } from '@/lib/oui';
import { EntityHoverCard } from '@/components/common/entity-hover-card';
import { usePortDrawer } from '@/components/device/port-drawer';

export function CellLink({
  field, value, ctx, children, className,
}: {
  field: string;
  value: unknown;
  ctx?: LinkContext;
  children?: ReactNode;
  className?: string;
}) {
  const v = value == null ? '' : String(value);
  const display = children ?? (v || '--');
  const link = linkForCell(field, value, ctx);
  const { openPort } = usePortDrawer();

  // OUI vendor chip — shown only when the value (not a custom child label) is a MAC.
  const vendor = !children && isMAC(v) ? ouiVendor(v) : null;
  const vendorChip = vendor && (
    <span className="ml-1.5 text-[10px] text-[var(--color-text-muted)] font-normal">[{vendor}]</span>
  );

  if (!link) {
    return <span className={className}>{display}{vendorChip}</span>;
  }

  const wrapped = link.display === 'mono'
    ? <code className="font-mono">{display}</code>
    : display;

  const isPort = ['port', 'interface', 'remote_port'].includes(field.toLowerCase());
  const portDevice = isPort ? (ctx?.device ?? ctx?.remoteDevice) : undefined;

  const anchor = (
    <Link
      to={link.href}
      className={`text-[var(--color-text-accent)] hover:underline ${className ?? ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (isPort && portDevice) {
          e.preventDefault();
          openPort(portDevice, v);
        }
      }}
    >
      {wrapped}
    </Link>
  );

  return (
    <EntityHoverCard field={field} value={value}>
      <span className="inline-flex items-baseline">{anchor}{vendorChip}</span>
    </EntityHoverCard>
  );
}
