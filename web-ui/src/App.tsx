import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PortDrawerProvider } from '@/components/device/port-drawer';
import { router } from './routes';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PortDrawerProvider>
          <RouterProvider router={router} />
        </PortDrawerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
