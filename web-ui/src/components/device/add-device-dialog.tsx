import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitJob, getJob } from '@/api/jobs';
import { Plus } from 'lucide-react';

async function pollJob(id: number, maxSec = 60): Promise<{ status?: string }> {
  const start = Date.now();
  while (Date.now() - start < maxSec * 1000) {
    const j = await getJob(id);
    if (j.status === 'done' || j.status === 'error') return j;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: 'pending' };
}

interface Props {
  triggerLabel?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export function AddDeviceDialog({ triggerLabel = 'Add device', variant = 'default' }: Props) {
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: async (deviceIp: string) => {
      const { job_id } = await submitJob({ action: 'discover', device: deviceIp });
      return pollJob(job_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      setOpen(false);
      setIp('');
    },
    onError: (e: unknown) => {
      const msg = (e as { message?: string })?.message ?? 'Failed to submit discovery job';
      setError(msg);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ip.trim()) { setError('IP address is required'); return; }
    m.mutate(ip.trim());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} data-testid="add-device-trigger">
          <Plus className="w-4 h-4 mr-1" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add device for discovery</DialogTitle>
          <DialogDescription>
            Enter an IP address. The crawler will SNMP-walk the device and add it
            to the inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 mt-2">
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">IP address</label>
            <Input
              autoFocus
              placeholder="10.0.0.1"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              data-testid="add-device-ip"
              disabled={m.isPending}
            />
          </div>
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
          {m.isPending && <p className="text-xs text-[var(--color-text-muted)]">Submitting discovery job, polling for completion (up to 60s)...</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>Cancel</Button>
            <Button type="submit" disabled={m.isPending} data-testid="add-device-submit">
              {m.isPending ? 'Discovering...' : 'Discover'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
