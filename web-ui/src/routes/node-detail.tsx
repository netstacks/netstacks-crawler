import { useNavigate, useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Search, Wifi, Router, Globe, Tag } from 'lucide-react';
import { getNode, getNodeHistory } from '@/api/nodes';
import { searchNodes } from '@/api/search';
import { CellLink } from '@/components/common/cell-link';
import { MovementTimeline } from '@/components/node/movement-timeline';
import { Badge } from '@/components/ui/badge';
import { normaliseMAC } from '@/lib/cell-link';

const FIELD_LABELS: Record<string, string> = {
  mac: 'MAC',
  switch: 'Last seen on switch',
  port: 'Last seen on port',
  vlan: 'VLAN',
  time_first: 'First seen',
  time_last: 'Last seen',
  active: 'Active',
  ip: 'IP',
  oui: 'OUI vendor',
};

const HIDDEN_FIELDS = new Set([
  'time_first_stamp', 'time_last_stamp', 'seen_on_router_last',
  'seen_on_router_first', 'router_name', 'router_ip', 'manufacturer',
  'vrf', 'active',
]);

export function NodeDetail() {
  const { mac: rawMac = '' } = useParams();
  const mac = normaliseMAC(decodeURIComponent(rawMac));
  const nav = useNavigate();

  const current = useQuery({
    queryKey: ['node', mac],
    queryFn: () => getNode(mac),
    retry: false,
  });
  const history = useQuery({
    queryKey: ['node-history', mac],
    queryFn: () => getNodeHistory(mac),
    retry: false,
  });
  const enriched = useQuery({
    queryKey: ['node-search', mac],
    queryFn: () => searchNodes(mac),
    retry: false,
  });

  const data = current.data;
  const notFound = current.isError;
  const nodeSearch = enriched.data?.[0];

  const routerName = nodeSearch?.router_name;
  const routerIp = nodeSearch?.router_ip;
  const manufacturer = nodeSearch?.manufacturer;
  const vrf = nodeSearch?.vrf;
  const nodeIp = nodeSearch?.ip || (data ? String((data as Record<string, unknown>).ip ?? '') : '') || null;
  const isActive = nodeSearch?.active ? Number(nodeSearch.active) !== 0 : data?.active;

  return (
    <div className="p-6 max-w-5xl">
      <button onClick={() => nav(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-3">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>

      {/* Hero */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Node</div>
          {isActive ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400">active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/40 text-red-400">inactive</Badge>
          )}
          {manufacturer && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Tag className="w-2.5 h-2.5 mr-1" />{manufacturer}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold font-mono">{mac}</h1>
        {nodeIp && (
          <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
            <Globe className="w-3 h-3 inline mr-1" />
            IP: <CellLink field="ip" value={nodeIp} />
          </div>
        )}
      </div>

      {/* Router Association */}
      {(routerName || routerIp) && (
        <section className="mb-5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
            <Router className="w-3 h-3" /> Router Association
          </div>
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {routerName && (
                <>
                  <span className="text-[var(--color-text-muted)]">Router</span>
                  <span>{routerName}</span>
                </>
              )}
              {routerIp && (
                <>
                  <span className="text-[var(--color-text-muted)]">Router IP</span>
                  <CellLink field="ip" value={routerIp} />
                </>
              )}
              {vrf && (
                <>
                  <span className="text-[var(--color-text-muted)]">VRF</span>
                  <span className="font-mono">{vrf}</span>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Current Location */}
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
          <Wifi className="w-3 h-3" /> Current Location
        </div>
        {data && data.switch && data.port ? (
          <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <Wifi className="w-5 h-5 text-blue-400" />
            <div className="flex-1">
              <div className="text-[13px]">
                <CellLink field="switch" value={data.switch} /> &nbsp; | &nbsp;
                <CellLink field="port" value={data.port} ctx={{ device: String(data.switch) }} />
                {data.vlan != null && <> &nbsp; | &nbsp; VLAN <CellLink field="vlan" value={data.vlan} /></>}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                {data.time_last && <>Last seen {data.time_last}</>}
                {data.time_first && <> &nbsp; | &nbsp; first seen {data.time_first}</>}
              </div>
            </div>
          </div>
        ) : notFound ? (
          <EmptyHero mac={mac} />
        ) : (
          <div className="p-4 text-xs text-[var(--color-text-muted)]">Loading...</div>
        )}
      </section>

      {/* Details kv */}
      {data && (
        <section className="mb-5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Details</div>
          <div className="grid grid-cols-2 gap-x-8 text-[13px]">
            {Object.entries(data)
              .filter(([k]) => !HIDDEN_FIELDS.has(k))
              .map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[var(--color-border)] py-1.5">
                <span className="text-[var(--color-text-muted)]">{FIELD_LABELS[k] ?? k}</span>
                <span className="font-mono">
                  {v === null || v === undefined
                    ? <span className="text-[var(--color-text-muted)]">--</span>
                    : <CellLink field={k} value={v} ctx={data.switch ? { device: String(data.switch) } : undefined} />}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Movement Timeline */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Movement History
          </div>
        </div>
        {history.data ? (
          <MovementTimeline
            history={history.data}
            currentSwitch={data?.switch ? String(data.switch) : undefined}
          />
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Loading history...</p>
        )}
      </section>
    </div>
  );
}

function EmptyHero({ mac }: { mac: string }) {
  return (
    <div className="p-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
      <div className="text-sm font-medium mb-2">This MAC has not been observed yet</div>
      <p className="text-xs text-[var(--color-text-muted)] mb-3 max-w-2xl">
        The crawler hasn't seen <code className="font-mono">{mac}</code> on any switch yet. New observations
        come from <strong>macsuck</strong> (Layer 2 bridge-table polls) and <strong>arpnip</strong>
        (Layer 3 ARP/NDP polls). Run either against a candidate device to start populating the node table.
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link to="/admin/actions" className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--color-border)] rounded hover:border-[var(--color-text-accent)]">
          Trigger MAC walk
        </Link>
        <Link to={`/devices?q=${encodeURIComponent(mac)}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--color-border)] rounded hover:border-[var(--color-text-accent)]">
          <Search className="w-3 h-3" /> Search devices for this MAC
        </Link>
        <Link to="/reports/Node/nodevendor" className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--color-border)] rounded hover:border-[var(--color-text-accent)]">
          Browse known node vendors
        </Link>
      </div>
    </div>
  );
}
