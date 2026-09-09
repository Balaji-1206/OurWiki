import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent dark:bg-emerald-950/60 dark:text-emerald-400">
        <FileQuestion className="h-6 w-6" />
      </div>
      <p className="font-mono text-sm font-semibold text-accent dark:text-emerald-400">404 Error</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink dark:text-white">Page not found</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted dark:text-gray-400">
        This documentation page does not exist, or it may have been moved, renamed, or unpublished.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-accent-light hover:text-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-emerald-500"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to docs home</span>
      </Link>
    </div>
  );
}
