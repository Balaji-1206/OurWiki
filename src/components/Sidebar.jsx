import { NavLink, Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { useNavTree } from '../hooks/useNavTree';
import { useAuth } from '../contexts/AuthContext';

function Node({ node, currentPath }) {
  const isActive = currentPath === node.full_path;
  const isAncestor = currentPath?.startsWith(node.full_path + '/');
  const hasChildren = node.children?.length > 0;
  const isExpanded = isActive || isAncestor || node.depth === 0;

  return (
    <li className="my-0.5">
      <NavLink
        to={`/${node.full_path}`}
        className={[
          'group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-all',
          isActive
            ? 'bg-accent/10 font-semibold text-accent dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'text-ink/80 hover:bg-black/5 hover:text-ink dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white',
        ].join(' ')}
      >
        <span className="truncate">{node.title}</span>
        {hasChildren && (
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted transition-transform duration-150 dark:text-gray-500 ${
              isExpanded ? 'rotate-90 text-accent dark:text-emerald-400' : ''
            }`}
          />
        )}
      </NavLink>
      {hasChildren && isExpanded && (
        <ul className="ml-2.5 mt-0.5 space-y-0.5 border-l border-border/80 pl-2 dark:border-gray-800">
          {node.children.map((child) => (
            <Node key={child.id} node={child} currentPath={currentPath} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Sidebar({ currentPath }) {
  const { tree, loading, error } = useNavTree();
  const { isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="space-y-2 p-3 text-xs text-muted dark:text-gray-500">
        <div className="h-4 w-3/4 animate-pulse rounded bg-black/5 dark:bg-gray-800" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-black/5 dark:bg-gray-800" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-black/5 dark:bg-gray-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
        Could not load navigation.
      </div>
    );
  }

  return (
    <nav aria-label="Documentation" className="text-sm">
      {isAuthenticated && (
        <div className="mb-3 px-1">
          <Link
            to="/admin/topics/new"
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-paper/60 px-2.5 py-1.5 text-xs font-medium text-accent transition hover:border-accent hover:bg-accent/5 dark:border-gray-800 dark:bg-gray-800/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New topic</span>
          </Link>
        </div>
      )}
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <Node key={node.id} node={node} currentPath={currentPath} />
        ))}
      </ul>
    </nav>
  );
}
