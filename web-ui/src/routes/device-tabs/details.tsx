import { useParams } from 'react-router';
import { useDeviceDetails } from '@/hooks/use-device';
import { FieldGrid } from '@/components/common/field-grid';

// Curated sections surface the most-used fields in a sensible order; the
// "All fields" catch-all below guarantees every populated DB column is exposed
// (so if discovery captured it, the operator can see it).
const SECTIONS: { title: string; keys: string[] }[] = [
  { title: 'Identity', keys: ['name', 'dns', 'ip', 'vendor', 'model', 'chassis_model', 'serial', 'description', 'location', 'contact'] },
  { title: 'Software & SNMP', keys: ['os', 'os_ver', 'layers', 'uptime', 'snmp_ver', 'snmp_class', 'snmp_engineid', 'vtp_domain', 'vtp_mode', 'pae_is_enabled'] },
  { title: 'Hardware', keys: ['num_ports', 'slots', 'mac', 'chassis_id', 'ps1_type', 'ps1_status', 'ps2_type', 'ps2_status', 'fan'] },
  { title: 'Discovery', keys: ['creation', 'last_discover', 'last_macsuck', 'last_arpnip', 'is_pseudo', 'tags'] },
];

const CURATED = new Set(SECTIONS.flatMap((s) => s.keys));

export function DeviceDetails() {
  const { ip = '' } = useParams();
  const { data } = useDeviceDetails(ip);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const ctx = { device: ip };
  // Everything not in a curated section and not the derived `counts` blob.
  const restKeys = Object.keys(row).filter((k) => !CURATED.has(k) && k !== 'counts');

  return (
    <div className="space-y-6">
      {SECTIONS.map((s) => {
        const present = s.keys.filter((k) => k in row);
        if (present.length === 0) return null;
        return (
          <section key={s.title}>
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">{s.title}</h3>
            <FieldGrid data={row} only={present} ctx={ctx} />
          </section>
        );
      })}

      {restKeys.length > 0 && (
        <details className="group">
          <summary className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2 cursor-pointer select-none hover:text-[var(--color-text-primary)]">
            All fields ({restKeys.length})
          </summary>
          <div className="mt-2">
            <FieldGrid data={row} only={restKeys} ctx={ctx} showEmpty />
          </div>
        </details>
      )}
    </div>
  );
}
