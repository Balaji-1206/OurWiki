import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllTopicsForAdmin, countSubtree, deleteTopic } from '../../services/topics';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';

function StatusBadge({ status }) {
  return (
    <span
      className={[
        'rounded px-1.5 py-0.5 text-xs font-medium',
        status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function TreeRow({ node, depth, onDeleted }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      const count = await countSubtree(node.full_path);
      const message =
        count > 1
          ? `Delete "${node.title}" and its ${count - 1} descendant page(s)? This cannot be undone.`
          : `Delete "${node.title}"? This cannot be undone.`;
      if (!window.confirm(message)) {
        setBusy(false);
        return;
      }
      await deleteTopic(node.id);
      onDeleted();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-black/5"
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <span className="flex-1 truncate">{node.title}</span>
        <StatusBadge status={node.status} />
        <code className="hidden text-xs text-muted sm:block">/{node.full_path}</code>
        <div className="flex gap-2 text-sm">
          <Link to={`/admin/topics/new?parent=${node.id}`} className="text-accent-light hover:underline">
            + Child
          </Link>
          <button onClick={() => navigate(`/admin/topics/${node.id}`)} className="text-accent-light hover:underline">
            Edit
          </button>
          <button onClick={handleDelete} disabled={busy} className="text-red-600 hover:underline disabled:opacity-50">
            Delete
          </button>
        </div>
      </div>
      {node.children?.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1} onDeleted={onDeleted} />
      ))}
    </>
  );
}

export default function AdminDashboard() {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    getAllTopicsForAdmin()
      .then(setTree)
      .catch(setError);
  };

  useEffect(load, []);

  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!tree) return <LoadingState />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Topics</h1>
        <Link
          to="/admin/topics/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
        >
          + Create Topic
        </Link>
      </div>

      {tree.length === 0 ? (
        <p className="text-muted">No topics yet. Create your first one to get started.</p>
      ) : (
        <div className="rounded-lg border border-border bg-white">
          {tree.map((node) => (
            <TreeRow key={node.id} node={node} depth={0} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}
