import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Loader2, Network } from 'lucide-react';
import { useTypeahead, type SearchResult } from '@/hooks/use-typeahead';

export function Typeahead() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const { data, loading } = useTypeahead(q);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  function mapFrom(ip: string) {
    setOpen(false);
    nav(`/topology?ip=${encodeURIComponent(ip)}`);
  }

  useEffect(() => {
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  function navTo(item: SearchResult) {
    setOpen(false);
    if (item.kind === 'device') {
      nav(`/devices/${encodeURIComponent(item.ip)}`);
    } else if (item.kind === 'node') {
      nav(`/nodes/${encodeURIComponent(item.mac)}`);
    } else if (item.kind === 'port') {
      nav(`/devices/${encodeURIComponent(item.ip)}?tab=ports&port=${encodeURIComponent(item.port)}`);
    } else if (item.kind === 'vlan') {
      nav(`/reports/VLAN/vlaninventory?vlan=${encodeURIComponent(String(item.vlan))}`);
    } else if (item.kind === 'subnet') {
      nav(`/reports/IP/subnets?net=${encodeURIComponent(item.net)}`);
    }
  }

  const kindStyle = (k: SearchResult['kind']) =>
    k === 'device' ? 'bg-blue-500/15 text-blue-400' :
    k === 'node' ? 'bg-emerald-500/15 text-emerald-400' :
    k === 'port' ? 'bg-amber-500/15 text-amber-400' :
    k === 'vlan' ? 'bg-purple-500/15 text-purple-400' :
    'bg-cyan-500/15 text-cyan-400';

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, data.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    if (e.key === 'Enter') {
      const item = data[hi];
      if (item) navTo(item);
      else if (q.trim()) { setOpen(false); nav(`/search?q=${encodeURIComponent(q.trim())}`); }
    }
  }

  return (
    <div ref={ref} className="flex-1 max-w-[720px] relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search devices, serials, MACs, hostnames, subnets..."
        className="w-full h-[30px] pl-8 pr-8 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] text-[13px] outline-none focus:border-[var(--color-border-active)]"
        data-testid="topbar-search"
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] animate-spin" data-testid="topbar-search-loading" />
      )}
      {open && data.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-lg max-h-[400px] overflow-auto z-50">
          {data.map((it, i) => (
            <li
              key={i}
              data-testid="typeahead-item"
              className={`group flex items-center px-3 py-2 cursor-pointer text-[13px] ${i === hi ? 'bg-[var(--color-bg-active)]' : 'hover:bg-[var(--color-bg-hover)]'}`}
              onClick={() => navTo(it)}
              onMouseEnter={() => setHi(i)}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className={`text-[10px] mr-2 uppercase font-semibold px-1.5 py-0.5 rounded ${kindStyle(it.kind)}`}>{it.kind}</span>
                <span className={it.kind === 'node' || it.kind === 'port' ? 'font-mono' : ''}>{it.label}</span>
                {it.kind === 'device' && it.matched && (
                  <span className="ml-2 text-[var(--color-text-muted)] text-[11px]">
                     |  matched {it.matched.field}: <code className="font-mono">{it.matched.value}</code>
                  </span>
                )}
                {it.kind === 'node' && it.routerName && (
                  <span className="ml-2 text-[var(--color-text-muted)] text-[11px]">
                    on {it.routerName}
                  </span>
                )}
              </span>
              {it.kind === 'device' && (
                <button
                  data-testid="typeahead-map"
                  title="Map this device in Topology"
                  onClick={(e) => { e.stopPropagation(); mapFrom(it.ip); }}
                  className="shrink-0 ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-accent)]"
                >
                  <Network className="w-3 h-3" /> Map
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
