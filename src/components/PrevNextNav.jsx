import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavTree, flattenInOrder } from '../hooks/useNavTree';

export default function PrevNextNav({ currentPath }) {
  const { tree } = useNavTree();
  const flat = flattenInOrder(tree);
  const idx = flat.findIndex((n) => n.full_path === currentPath);
  if (idx === -1) return null;

  const prev = flat[idx - 1];
  const next = flat[idx + 1];
  if (!prev && !next) return null;

  return (
    <div className="mt-14 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-stretch sm:justify-between dark:border-gray-800">
      <div className="flex-1">
        {prev && (
          <Link
            to={`/${prev.full_path}`}
            className="group flex flex-col rounded-xl border border-border p-3.5 text-sm transition hover:border-accent-light hover:bg-black/[0.01] dark:border-gray-800 dark:hover:border-emerald-600/60 dark:hover:bg-gray-800/30"
          >
            <span className="flex items-center gap-1 text-xs text-muted dark:text-gray-400">
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
              Previous
            </span>
            <div className="mt-1 font-semibold text-ink group-hover:text-accent dark:text-gray-200 dark:group-hover:text-emerald-400">
              {prev.title}
            </div>
          </Link>
        )}
      </div>
      <div className="flex-1">
        {next && (
          <Link
            to={`/${next.full_path}`}
            className="group flex flex-col items-end rounded-xl border border-border p-3.5 text-right text-sm transition hover:border-accent-light hover:bg-black/[0.01] dark:border-gray-800 dark:hover:border-emerald-600/60 dark:hover:bg-gray-800/30"
          >
            <span className="flex items-center gap-1 text-xs text-muted dark:text-gray-400">
              Next
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <div className="mt-1 font-semibold text-ink group-hover:text-accent dark:text-gray-200 dark:group-hover:text-emerald-400">
              {next.title}
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
