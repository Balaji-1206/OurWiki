import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getTopicBreadcrumbs } from '../services/topics';

export default function Breadcrumbs({ path }) {
  const [crumbs, setCrumbs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getTopicBreadcrumbs(path)
      .then((data) => !cancelled && setCrumbs(data))
      .catch(() => !cancelled && setCrumbs([]));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="text-ink">{c.title}</span>
            ) : (
              <Link to={`/${c.full_path}`} className="hover:text-accent-light hover:underline">
                {c.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
