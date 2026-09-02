import { Link } from 'react-router-dom';
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
    <div className="mt-12 flex items-stretch justify-between gap-4 border-t border-border pt-6">
      <div className="flex-1">
        {prev && (
          <Link
            to={`/${prev.full_path}`}
            className="block rounded-lg border border-border p-3 text-sm hover:border-accent-light"
          >
            <span className="text-xs text-muted">Previous</span>
            <div className="font-medium">{prev.title}</div>
          </Link>
        )}
      </div>
      <div className="flex-1 text-right">
        {next && (
          <Link
            to={`/${next.full_path}`}
            className="block rounded-lg border border-border p-3 text-sm hover:border-accent-light"
          >
            <span className="text-xs text-muted">Next</span>
            <div className="font-medium">{next.title}</div>
          </Link>
        )}
      </div>
    </div>
  );
}
