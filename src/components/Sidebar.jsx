import { NavLink } from 'react-router-dom';
import { useNavTree } from '../hooks/useNavTree';

function Node({ node, currentPath }) {
  const isActive = currentPath === node.full_path;
  const isAncestor = currentPath?.startsWith(node.full_path + '/');
  return (
    <li>
      <NavLink
        to={`/${node.full_path}`}
        className={[
          'block rounded px-2 py-1 text-sm transition-colors',
          isActive ? 'bg-accent/10 font-medium text-accent-light' : 'text-ink/80 hover:bg-black/5',
        ].join(' ')}
      >
        {node.title}
      </NavLink>
      {node.children?.length > 0 && (isActive || isAncestor || node.depth === 0) && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
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

  if (loading) {
    return <div className="space-y-2 p-2 text-sm text-muted">Loading navigation…</div>;
  }
  if (error) {
    return <div className="p-2 text-sm text-red-600">Couldn't load navigation.</div>;
  }

  return (
    <nav aria-label="Documentation" className="text-sm">
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <Node key={node.id} node={node} currentPath={currentPath} />
        ))}
      </ul>
    </nav>
  );
}
