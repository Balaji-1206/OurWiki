import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium text-accent-light">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">
        This page doesn't exist, or it may have been moved or unpublished.
      </p>
      <Link to="/" className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm hover:border-accent-light">
        Back to docs home
      </Link>
    </div>
  );
}
