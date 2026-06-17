import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CellLink } from '@/components/common/cell-link';
import { FieldGrid } from '@/components/common/field-grid';
import { getDevicePorts, getDeviceNodes } from '@/api/devices';
import { usePortProperties, useDevicePoweredPorts } from '@/hooks/use-device';
import { isEmptyValue } from '@/lib/format';
import { Cable, Activity, Layers, Network, Clock, Server, Zap, ShieldCheck, Radio } from 'lucide-react';

interface PortDrawerState {
  open: boolean;
  deviceIp: string;
  portName: string;
}

interface PortDrawerContextType {
  openPort: (deviceIp: string, portName: string) => void;
}

const PortDrawerContext = createContext<PortDrawerContextType>({ openPort: () => {} });
export const usePortDrawer = () => useContext(PortDrawerContext);

export function PortDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortDrawerState>({ open: false, deviceIp: '', portName: '' });

  const openPort = useCallback((deviceIp: string, portName: string) => {
    setState({ open: true, deviceIp, portName });
  }, []);

  return (
    <PortDrawerContext.Provider value={{ openPort }}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {state.open && <PortDrawerContent deviceIp={state.deviceIp} portName={state.portName} />}
        </DialogContent>
      </Dialog>
    </PortDrawerContext.Provider>
  );
}

function PortDrawerContent({ deviceIp, portName }: { deviceIp: string; portName: string }) {
  const { data: ports } = useQuery({
    queryKey: ['device', deviceIp, 'ports'],
    queryFn: () => getDevicePorts(deviceIp),
    staleTime: 30_000,
  });
  const { data: nodes } = useQuery({
    queryKey: ['device', deviceIp, 'nodes'],
    queryFn: () => getDeviceNodes(deviceIp),
    staleTime: 30_000,
  });

  const { data: props } = usePortProperties(deviceIp, portName);
  const { data: poePorts } = useDevicePoweredPorts(deviceIp);

  const port = ports?.find((p) => p.port === portName);
  const portNodes = nodes?.filter((n) => n.port === portName) ?? [];
  const poe = poePorts?.find((p) => p.port === portName);

  if (!port) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-mono">{portName}</DialogTitle>
          <DialogDescription>Loading port details...</DialogDescription>
        </DialogHeader>
      </>
    );
  }

  const orig = port as Record<string, unknown>;
  const isUp = port.up === 'up';
  const isAdminDown = port.up_admin === 'down';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Cable className="w-5 h-5" />
          <code className="font-mono">{portName}</code>
          <span className="text-xs text-[var(--color-text-muted)]">on</span>
          <CellLink field="ip" value={deviceIp} />
        </DialogTitle>
        <DialogDescription>
          <span className={`inline-flex items-center gap-1.5 mt-1 ${
            isAdminDown ? 'text-amber-400' : isUp ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isAdminDown ? 'bg-amber-400' : isUp ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            {isAdminDown ? 'Admin Down' : isUp ? 'Up' : 'Down'}
          </span>
        </DialogDescription>
      </DialogHeader>

      {/* Port properties */}
      <div className="space-y-4">
        <section>
          <SectionTitle icon={<Activity className="w-3.5 h-3.5" />} label="Properties" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            <KV label="Speed" value={port.speed} />
            <KV label="Duplex" value={String(orig.duplex ?? '--')} />
            <KV label="MTU" value={String(orig.mtu ?? '--')} />
            <KV label="Type" value={String(orig.type ?? '--')} />
            <KV label="Admin status" value={port.up_admin} />
            <KV label="STP" value={String(orig.stp ?? '--')} />
            {(orig.mac as string | undefined) && <KV label="MAC" value={String(orig.mac)} mono />}
          </div>
        </section>

        {/* VLAN */}
        <VlanSection vlan={port.vlan} />

        {/* Neighbor */}
        {(orig.remote_ip != null || orig.remote_id != null || orig.remote_port != null) ? (
          <section>
            <SectionTitle icon={<Server className="w-3.5 h-3.5" />} label="Neighbor" />
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {orig.remote_ip != null && (
                <>
                  <span className="text-[var(--color-text-muted)]">Device</span>
                  <CellLink field="remote_ip" value={String(orig.remote_ip)} />
                </>
              )}
              {orig.remote_port != null && (
                <>
                  <span className="text-[var(--color-text-muted)]">Port</span>
                  <CellLink field="remote_port" value={String(orig.remote_port)}
                    ctx={orig.remote_ip ? { device: String(orig.remote_ip) } : undefined} />
                </>
              )}
              {orig.remote_id != null && orig.remote_ip == null && (
                <>
                  <span className="text-[var(--color-text-muted)]">ID</span>
                  <CellLink field="remote_id" value={String(orig.remote_id)} />
                </>
              )}
              {orig.remote_type != null && (
                <>
                  <span className="text-[var(--color-text-muted)]">Type</span>
                  <span>{String(orig.remote_type)}</span>
                </>
              )}
            </div>
          </section>
        ) : null}

        {/* PoE (device_port_power) */}
        {poe && (
          <section>
            <SectionTitle icon={<Zap className="w-3.5 h-3.5" />} label="Power over Ethernet" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
              <KV label="Admin" value={poe.admin} />
              <KV label="Status" value={poe.status} />
              <KV label="Class" value={poe.class} />
              <KV label="Power" value={poe.power != null ? `${(poe.power / 1000).toFixed(1)} W` : '--'} />
            </div>
          </section>
        )}

        {/* LLDP neighbor inventory (device_port_properties) */}
        {hasAny(props, LLDP_KEYS) && (
          <section>
            <SectionTitle icon={<Radio className="w-3.5 h-3.5" />} label="LLDP Neighbor Inventory" />
            <FieldGrid data={props!} only={LLDP_KEYS} />
          </section>
        )}

        {/* 802.1X / PAE (device_port_properties) */}
        {hasAny(props, PAE_KEYS) && (
          <section>
            <SectionTitle icon={<ShieldCheck className="w-3.5 h-3.5" />} label="802.1X" />
            <FieldGrid data={props!} only={PAE_KEYS} />
          </section>
        )}

        {/* Other port properties */}
        {hasAny(props, EXTRA_KEYS) && (
          <section>
            <SectionTitle icon={<Activity className="w-3.5 h-3.5" />} label="More" />
            <FieldGrid data={props!} only={EXTRA_KEYS} />
          </section>
        )}

        {/* Connected nodes */}
        {portNodes.length > 0 && (
          <section>
            <SectionTitle
              icon={<Network className="w-3.5 h-3.5" />}
              label={`Connected MACs (${portNodes.length})`}
            />
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="text-left px-2 py-1 font-medium">MAC</th>
                    <th className="text-left px-2 py-1 font-medium">VLAN</th>
                    <th className="text-left px-2 py-1 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {portNodes.map((n, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-1"><CellLink field="mac" value={n.mac} /></td>
                      <td className="px-2 py-1">{n.vlan != null ? <CellLink field="vlan" value={n.vlan} /> : '--'}</td>
                      <td className="px-2 py-1 text-[var(--color-text-muted)]">{n.time_last ?? '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {port.name && (
          <section>
            <SectionTitle icon={<Clock className="w-3.5 h-3.5" />} label="Description" />
            <p className="text-[13px]">{port.name}</p>
          </section>
        )}
      </div>
    </>
  );
}

// device_port_properties field groups.
const LLDP_KEYS = ['remote_vendor', 'remote_model', 'remote_os_ver', 'remote_serial', 'remote_dns', 'remote_is_wap', 'remote_is_phone', 'remote_is_discoverable'];
const PAE_KEYS = ['pae_authconfig_state', 'pae_authconfig_port_control', 'pae_authconfig_port_status', 'pae_authsess_user', 'pae_authsess_mab', 'pae_last_eapol_frame_source', 'pae_is_authenticator', 'pae_is_supplicant'];
const EXTRA_KEYS = ['error_disable_cause', 'raw_speed', 'faststart', 'ifindex'];

function hasAny(obj: Record<string, unknown> | undefined, keys: string[]): boolean {
  return !!obj && keys.some((k) => !isEmptyValue(obj[k]));
}

function VlanSection({ vlan }: { vlan: string | number | null | undefined }) {
  if (vlan == null) return null;
  return (
    <section>
      <SectionTitle icon={<Layers className="w-3.5 h-3.5" />} label="VLAN" />
      <div className="text-[13px]">
        Native: <CellLink field="vlan" value={vlan} />
      </div>
    </section>
  );
}

function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
      {icon} {label}
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <>
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value ?? '--'}</span>
    </>
  );
}
