import { useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Network, ArrowLeft, Trash2, Share2, Clock, Server } from 'lucide-react';
import { TopologyGraph, listSavedMaps, listExplorations, deleteSavedMap, deleteExploration, type MapSummary } from '@/components/topology/topology-graph';

function MapCard({ m, to, onDelete }: { m: MapSummary; to: string; onDelete: () => void }) {
  return (
    <div className="group relative flex flex-col gap-1 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] transition-colors">
      <Link to={to} className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
          <span className="font-medium text-sm truncate">{m.name}</span>
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] truncate">
          {m.seedLabel && m.seedLabel !== m.name ? <>seeded at {m.seedLabel} · </> : null}
          {m.devices} {m.devices === 1 ? 'device' : 'devices'}
        </div>
      </Link>
      <button
        onClick={onDelete}
        title="Delete"
        className="absolute top-2 right-2 p-1 rounded text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] hover:bg-[var(--color-bg-tertiary)]"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TopologyLibrary() {
  const [saved, setSaved] = useState<MapSummary[]>(() => listSavedMaps());
  const [recent, setRecent] = useState<MapSummary[]>(() => listExplorations());

  const removeSaved = (name: string) => { deleteSavedMap(name); setSaved(listSavedMaps()); };
  const removeRecent = (seed: string) => { deleteExploration(seed); setRecent(listExplorations()); };

  const empty = saved.length === 0 && recent.length === 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-semibold">Topologies</h1>
      </div>
      <p className="text-[12px] text-[var(--color-text-muted)] mb-6">
        Saved maps and recent explorations. Start a new map by searching for a device in the top bar and choosing <span className="inline-flex items-center gap-0.5 text-[var(--color-text-secondary)]"><Network className="w-3 h-3" /> Map</span>.
      </p>

      {empty && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center border border-dashed border-[var(--color-border)] rounded-lg">
          <Share2 className="w-8 h-8 text-[var(--color-text-muted)]" />
          <div className="text-sm text-[var(--color-text-secondary)]">No topologies yet.</div>
          <div className="text-[12px] text-[var(--color-text-muted)] max-w-sm">
            Search for a device in the top search bar and click <span className="font-medium">Map</span> to start building one, or import a path from the Traceroute page.
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <section className="mb-8">
          <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            <Server className="w-3.5 h-3.5" /> Saved maps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((m) => (
              <MapCard key={m.name} m={m}
                to={`/topology?ip=${encodeURIComponent(m.seed ?? m.name)}&map=${encodeURIComponent(m.name)}`}
                onDelete={() => removeSaved(m.name)} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            <Clock className="w-3.5 h-3.5" /> Recent explorations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((m) => (
              <MapCard key={m.name} m={m}
                to={`/topology?ip=${encodeURIComponent(m.seed ?? m.name)}`}
                onDelete={() => removeRecent(m.name)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function TopologyPage() {
  const [params] = useSearchParams();
  const seed = params.get('ip') || '';
  const openMap = params.get('map') || undefined;

  if (!seed) return <TopologyLibrary />;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/topology" title="Back to Topologies"
            className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Topologies
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{openMap ?? seed}</h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">Click the ＋ on a device to add its neighbors and build the map outward.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <TopologyGraph seed={seed} openMap={openMap} />
      </div>
    </div>
  );
}
