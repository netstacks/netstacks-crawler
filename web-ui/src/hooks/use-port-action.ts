import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitPortControl, type PortControlArgs } from '@/api/portcontrol';
import { getJob } from '@/api/jobs';

async function pollJob(id: number, maxSec = 60): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxSec * 1000) {
    const j = await getJob(id);
    if (j.status === 'done' || j.status === 'error') return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export function usePortAction(deviceIp: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: PortControlArgs) => {
      const { job_id } = await submitPortControl(args);
      await pollJob(job_id);
      return job_id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['device', deviceIp, 'ports'] }),
  });
}
