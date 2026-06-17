import { useQuery } from '@tanstack/react-query';
import { search, type SearchType } from '@/api/search';

export function useSearch(q: string, type: SearchType) {
  return useQuery({
    queryKey: ['search', q, type],
    queryFn: () => search(q, type),
    enabled: q.length > 0,
  });
}
