import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Deferred } from './deferred';
import '@testing-library/jest-dom';

describe('Deferred', () => {
  it('hides the milestone badge by default', () => {
    render(<Deferred milestone="SP3" reason="Reports">Click me</Deferred>);
    expect(screen.queryByText('SP3')).not.toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  it('renders the milestone badge when showBadge is set', () => {
    render(<Deferred milestone="SP3" reason="Reports" showBadge>Click me</Deferred>);
    expect(screen.getByText('SP3')).toBeInTheDocument();
  });
  it('sets aria-disabled on the wrapper', () => {
    render(<Deferred milestone="SP4" reason="Admin">btn</Deferred>);
    expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
  });
  it('exposes the milestone via data-deferred', () => {
    render(<Deferred milestone="SP5" reason="Topology">map</Deferred>);
    expect(screen.getByRole('group')).toHaveAttribute('data-deferred', 'SP5');
  });
});
