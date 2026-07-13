import { useQuery } from '@tanstack/react-query';
import { useStatusPoll } from '@/hooks/use-status-poll';
import { getVersion } from '@/api/meta';
import { Deferred } from '@/components/common/deferred';

export function Statusbar() {
  const { data, isError } = useStatusPoll();
  const version = useQuery({ queryKey: ['version'], queryFn: getVersion, staleTime: Infinity, retry: false });
  const dot = isError ? 'bg-[var(--color-error)]' : 'bg-[var(--color-success)]';
  return (
    <div className="flex items-center gap-4 px-4 h-6 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] text-[var(--color-text-secondary)] text-[11px] shrink-0">
      <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {data?.backends ?? '--'} backends</div>
      <div>{data?.workers ?? '--'} workers</div>
      <Deferred milestone="SP4" reason="Backend restart action">
        <span data-deferred="backend-restart" className="text-[11px]">⟲ restart</span>
      </Deferred>
      <div className="flex-1" />
      <a href="/api/docs" target="_blank" rel="noreferrer" className="hover:text-[var(--color-text-primary)] hover:underline">API docs</a>
      <div>crawler {version.data?.crawler_version ?? ''}</div>
    </div>
  );
}
