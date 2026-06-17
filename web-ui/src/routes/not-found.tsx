import { Link } from 'react-router';
export function NotFound() {
  return (
    <div className="p-12 text-center">
      <h1 className="text-3xl font-semibold mb-2">404</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">Route not found.</p>
      <div className="flex gap-3 justify-center">
        <Link to="/" className="px-4 py-2 bg-[var(--color-accent)] text-white rounded" data-testid="back-home">Back to home</Link>
        <Link to="/search" className="px-4 py-2 border border-[var(--color-border)] rounded" data-testid="search-instead">Search instead</Link>
      </div>
    </div>
  );
}
