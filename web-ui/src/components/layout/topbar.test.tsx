import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Topbar } from './topbar';
import '@testing-library/jest-dom';

// Topbar fetches branding via react-query, so it needs a QueryClientProvider.
function renderTopbar(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>,
  );
}

describe('Topbar', () => {
  it('renders brand and search input and user pill', () => {
    renderTopbar(<Topbar remoteUser="alice@netstacks.net" />);
    expect(screen.getByText(/NetStacks Crawler/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search devices/)).toBeInTheDocument();
    expect(screen.getByText('alice@netstacks.net')).toBeInTheDocument();
  });

  it('falls back when no remote user', () => {
    renderTopbar(<Topbar remoteUser={null} />);
    expect(screen.getByText('(unauthenticated)')).toBeInTheDocument();
  });
});
