import { useQuery } from '@tanstack/react-query';
import { getHealth } from '@/api/meta';

export function useStatusPoll() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
