import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Statusbar } from './statusbar';
import '@testing-library/jest-dom';

// Statusbar fetches health + version via react-query, so it needs a provider.
function renderStatusbar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><Statusbar /></QueryClientProvider>,
  );
}

describe('Statusbar', () => {
  it('renders an API docs link pointing at the public docs', () => {
    renderStatusbar();
    const link = screen.getByRole('link', { name: /API docs/i });
    expect(link).toHaveAttribute('href', '/api/docs');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
