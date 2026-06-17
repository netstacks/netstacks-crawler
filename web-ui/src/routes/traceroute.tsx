import { TracerouteResolver } from '@/components/search/traceroute-resolver';
import { Route } from 'lucide-react';

export function TraceroutePage() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-5">
        <Route className="w-5 h-5 text-[var(--color-accent)]" />
        <h1 className="text-xl font-semibold">Traceroute Resolver</h1>
      </div>
      <TracerouteResolver />
    </div>
  );
}
