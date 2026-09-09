import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { getTopicBreadcrumbs } from '../services/topics';

export default function Breadcrumbs({ path }) {
  const [crumbs, setCrumbs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getTopicBreadcrumbs(path)
      .then((data) => !cancelled && setCrumbs(data || []))
      .catch(() => !cancelled && setCrumbs([]));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted dark:text-gray-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" className="flex items-center text-muted transition hover:text-accent-light dark:text-gray-400 dark:hover:text-emerald-400">
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-muted/60 dark:text-gray-600" aria-hidden="true" />
            {i === crumbs.length - 1 ? (
              <span className="font-medium text-ink dark:text-gray-200">{c.title}</span>
            ) : (
              <Link to={`/${c.full_path}`} className="transition hover:text-accent-light hover:underline dark:hover:text-emerald-400">
                {c.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
