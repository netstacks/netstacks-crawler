import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBranding, putBranding } from '@/api/admin';

export function AdminSettingsBranding() {
  const qc = useQueryClient();
  const branding = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (branding.data) {
      setName(branding.data.application_name);
      setDirty(false);
    }
  }, [branding.data]);

  const save = useMutation({
    mutationFn: (application_name: string) => putBranding({ application_name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding'] });
      setDirty(false);
    },
  });

  if (branding.isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>;

  return (
    <div>
      <section>
        <h2 className="text-sm font-semibold mb-3">Application name</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-3 max-w-2xl">
          Displayed in the top bar and browser tab. Leave blank to reset to the default.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(name.trim());
          }}
          className="flex gap-2 items-center"
        >
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            placeholder="NetStacks Crawler"
            className="h-8 w-72 px-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[13px]"
            data-testid="branding-name-input"
          />
          <button
            type="submit"
            disabled={!dirty || save.isPending}
            className="h-8 px-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white rounded text-xs disabled:opacity-40"
            data-testid="branding-save"
          >
            {save.isPending ? 'Saving...' : 'Save'}
          </button>
        </form>
        {save.isError && (
          <p className="text-xs text-[var(--color-error)] mt-2">Save failed: {(save.error as Error).message}</p>
        )}
        {save.isSuccess && !dirty && (
          <p className="text-xs text-[var(--color-success)] mt-2">Saved.</p>
        )}
      </section>
    </div>
  );
}
